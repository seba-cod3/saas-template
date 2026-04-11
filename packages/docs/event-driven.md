# Event-driven jobs (BullMQ)

Background job processing using [BullMQ](https://docs.bullmq.io/) over Redis, with a type-safe `doLater()` API and file-based auto-discovery.

The goal: **adding a new background job should take one file, zero wiring, and give you end-to-end type safety from the caller to the handler.**

## Architecture

```
Caller somewhere in the codebase
    │
    │  await doLater('example-log', { message: 'hi' })
    ▼
queue.add(name, payload)           (BullMQ → Redis)
    │
    ▼
BullMQ worker (startWorker())
    │
    ▼
handlers.get(job.name)(job.data)
    │
    ▼
Your job's handler runs
```

- **Queue + worker** live in `apps/server/src/lib/queue.ts`. A single default queue, a single worker process (started during server bootstrap). Multi-queue support is intentionally out of scope until there's a real need.
- **Job definitions** live in `apps/server/src/jobs/definitions/*.ts`. One file per job. Each file default-exports a `defineJob({ name, handler })`.
- **Barrel auto-generation** — `scripts/generate-jobs.ts` watches `definitions/`, writes `definitions/index.ts` with every job imported, and scaffolds template code into empty files. Runs in parallel with `tsx watch` during `pnpm dev`.
- **Type map** — `jobs/index.ts` derives a `JobMap` interface from the `allJobs` tuple using a mapped type. Module augmentation merges it into `lib/queue.ts`, which makes `doLater<'name'>(payload)` check the payload type at the call site.

## Creating a new job

### 1. Create an empty file in `definitions/`

With `pnpm dev` running:

```bash
touch apps/server/src/jobs/definitions/send-welcome-email.ts
```

The `generate-jobs` watcher sees it and writes a template into the empty file:

```ts
// apps/server/src/jobs/definitions/send-welcome-email.ts
import { defineJob } from '../../lib/queue.js'

export default defineJob({
  name: 'send-welcome-email',
  handler: async (payload: Record<string, unknown> /* Add your types */) => {
    // TODO: implement send-welcome-email
  },
})
```

It also rewrites `definitions/index.ts` with the new import and re-exports `allJobs`.

> The job's **name** is derived from the filename (`send-welcome-email.ts` → `'send-welcome-email'`). Keep filenames in kebab-case — they become the runtime identifier used by both the queue and the type map.

### 2. Replace the payload type

```ts
import { defineJob } from '../../lib/queue.js'

export default defineJob({
  name: 'send-welcome-email',
  handler: async (payload: { userId: string; email: string }) => {
    // send the email, log usage, etc.
  },
})
```

As soon as you save, `JobMap` picks up the new type. `doLater('send-welcome-email', { userId, email })` is now type-checked — missing or wrong-typed fields are a TS error at the call site.

### 3. Call it from anywhere

```ts
import { doLater } from './lib/queue.js'

await doLater('send-welcome-email', {
  userId: user.id,
  email: user.email,
})
```

That's it. No registration, no manual imports, no barrel editing. The worker will run the handler on the next drain of the queue.

## When to use `doLater()`

Use it for work that:

- Is **slow** and would block the response (email sending, image processing, LLM calls that aren't streamed, third-party API calls).
- Can **fail and retry** without the user having to refresh.
- Doesn't need to complete before you return a result to the caller (fire-and-forget).
- Needs **at-least-once** semantics with BullMQ's built-in retry/backoff.

Don't use it for:

- Work that must complete inside the request (compute the response payload).
- Real-time broadcasts to connected clients — use [WebSockets](./websockets.md) instead. `doLater` is for delayed work, not pub/sub.
- Short-circuit caching — use `cached()` in `lib/cache.ts`.

## What NOT to do

- **Don't hand-edit `definitions/index.ts`.** It's auto-generated — it starts with a banner comment that says so, and the watcher will overwrite your changes the next time a file in `definitions/` changes.
- **Don't import from `definitions/` outside of `jobs/`.** Callers use `doLater()`, not the handler directly. The handler is for the worker only.
- **Don't use `any` for the payload.** The whole point of `JobMap` is that you get type checking at the call site. `Record<string, unknown>` is the template default — replace it with the real shape the first time you run the file.
- **Don't skip the template by writing a non-default export.** The barrel expects `export default defineJob(...)`. Named exports won't be picked up.
- **Don't start a second worker.** `startWorker()` is called once during server bootstrap (`apps/server/src/index.ts`). BullMQ handles concurrency inside that worker.

## Under the hood

### `defineJob`

Pure identity function — it only exists to give you inference on the name literal and the payload generic:

```ts
export function defineJob<N extends string, P>(
  definition: JobDefinition<N, P>,
): JobDefinition<N, P> {
  return definition
}
```

### `JobMap` derivation

In `jobs/index.ts`:

```ts
type DeriveJobMap<T extends readonly JobDefinition<string, any>[]> = {
  [J in T[number] as J extends JobDefinition<infer N, any> ? N : never]:
    J extends JobDefinition<string, infer P> ? P : never
}

declare module '../lib/queue.js' {
  interface JobMap extends DeriveJobMap<typeof allJobs> {}
}
```

`allJobs` is the auto-generated tuple of every default export in `definitions/`. `DeriveJobMap` walks that tuple and builds an object type keyed by job names with payloads as values. The `declare module` merges it into the `JobMap` interface that `doLater()` reads.

### The watcher

`scripts/generate-jobs.ts` runs via `tsx --watch` in `pnpm dev`. On any change to `definitions/`:

1. List `*.ts` files (excluding `index.ts` and any `_*.ts`).
2. For each empty file, write the scaffold template.
3. Regenerate `definitions/index.ts` with one `import` per file and `allJobs` as a `readonly` tuple.

The tuple must stay `as const` — the type derivation depends on it.

## Production notes

- Workers run **in-process** with the server. For horizontal scale, run multiple server instances — BullMQ will distribute jobs across them via Redis.
- Railway is the recommended Redis host (see the main README): BullMQ polls, and Upstash pricing can be punishing for that pattern. Colocating Redis with the server is both cheaper and faster.
- **Failed jobs retry** with BullMQ defaults. Customize via options to `queue.add()` if you need different retry policy per job.
