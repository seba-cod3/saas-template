# AI Chat

Streaming AI chat built on the [Vercel AI SDK v5](https://sdk.vercel.ai) with multi-provider support (OpenAI + Anthropic), resumable streams over Redis, per-user tool scoping, and usage tracking.

## Architecture

```
Frontend (useChat hook — @ai-sdk/react)
    │  POST /api/ai/conversations/:id/messages
    ▼
Hono route (routes/ai.ts, requireAuth)
    │
    ├──► chatService.loadConversation()   (ownership + fixed provider/model)
    ├──► chatService.persistUserMessage() (BEFORE calling the provider)
    ├──► chatService.appendStreamId()     (register for resume)
    │
    ▼
createUIMessageStream (AI SDK v5)
    │
    ▼
streamText({ model, tools, system, messages, abortSignal })
    │                    │
    │                    └── buildTools({ userId, db })  ← closure-scoped
    │
    ▼  onFinish → usageCapture (closure)
    │
JsonToSseTransformStream
    │
    ▼
streamContext.resumableStream(streamId)   ← Redis-backed
    │
    ▼
SSE response (UI_MESSAGE_STREAM_HEADERS)
```

Key invariants:

1. **Provider/model is fixed at conversation creation** — `loadConversation()` is the source of truth. The body of the streaming request never dictates which model runs. This prevents clients from sending `provider: 'openai'` to a conversation that was created with Anthropic and getting mixed history.
2. **User message persisted BEFORE calling the provider** — so it survives crashes or disconnects mid-stream.
3. **Streams are resumable** — each streaming request generates a `streamId` registered in `ai_stream`. If the client reconnects, it hits `GET /api/ai/conversations/:id/stream` which looks up the most recent `streamId` and pipes it through `resumable-stream/ioredis`. The server keeps writing to the stream even after the client disconnects (`result.consumeStream()` is called without `await`) so the assistant message is always fully persisted.
4. **Idempotency guard excludes `/api/ai/*`** — the global guard has a 3-second TTL, which would block consecutive messages and reconnection retries. AI endpoints handle their own deduplication via conversation + streamId.
5. **Usage capture via mutable closure** — `streamText.onFinish` writes into a closure variable, which `createUIMessageStream.onFinish` then flushes through `writeUsage()`. Both callbacks run on the same request, but from different SDK layers.

## File layout

```
apps/server/src/
  routes/ai.ts                 ← HTTP routes (requireAuth, chained sub-router)
  lib/ai/
    catalog.ts                 ← Available models + pricing
    resolve-model.ts           ← Catalog entry → AI SDK model instance
    tools.ts                   ← buildTools({ userId, db }) — per-request, scoped
    chat-service.ts            ← DB ops (conversations, messages, streamIds)
    stream-context.ts          ← resumable-stream config (Redis pub/sub)
    usage-sink.ts              ← writeUsage() → ai_usage_event + monthly upsert
    types.ts                   ← AiProvider, CatalogEntry

apps/web/src/
  lib/ai/
    transport.ts               ← DefaultChatTransport configured for our endpoints
    use-ai-chat.ts             ← Wrapper around @ai-sdk/react useChat
    queries.ts                 ← TanStack Query options for conversations/models
  routes/_authenticated/chat/
    index.tsx                  ← Conversation list + new-chat form
    $conversationId.tsx        ← Active chat UI

packages/shared/src/ai/
  index.ts                     ← Shared types (AiProvider, UsageEvent, etc.)
```

## Database tables

Migration `0003_*` adds:

| Table                    | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `ai_conversation`        | One row per conversation. Fixed `provider` + `model`.          |
| `ai_message`             | Persisted user + assistant messages (UIMessage parts as JSON). |
| `ai_message_attachment`  | (Schema only — multimodal pipeline not wired yet.)             |
| `ai_stream`              | Stream IDs per conversation — lookup table for resume.         |
| `ai_usage_event`         | Raw per-request usage row (tokens, cost, latency, finish).    |
| `user_ai_monthly_usage`  | Upsert aggregate per `(user_id, month)`. Running totals.      |

## Env vars

```bash
# apps/server/.env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

The Vercel AI SDK reads these automatically from `process.env` — no manual wiring. If you only use one provider, only set that one; calls to a disabled model will fail at `resolveModel()`.

## Adding a new model

Edit `apps/server/src/lib/ai/catalog.ts`:

```ts
{
  provider: 'openai',
  model: 'gpt-4.1-mini',
  enabled: true,
  displayName: 'GPT-4.1 Mini',
  supportsAttachments: true,
  supportsTools: true,
  maxContextTokens: 128_000,
  pricing: { promptPerMTokUsd: 0.40, completionPerMTokUsd: 1.60 },
},
```

Then teach `resolveModel()` to map the model string to an SDK provider call if needed. New models of an existing provider usually work without changes.

**Pricing** is in USD per million tokens. Used by `usage-sink.ts` to compute `estimatedCostUsd`. Update whenever the provider updates pricing — this file is the single source of truth.

## Adding a tool

Tools are **scoped per request** via a closure. The `userId` is captured at request time so the model cannot spoof it through a tool's input schema.

```ts
// apps/server/src/lib/ai/tools.ts
export function buildTools(ctx: ToolContext): ToolSet {
  return {
    listMyAssets: tool({
      description: "List the current user's uploaded assets",
      inputSchema: z.object({
        kind: z.enum(['image', 'file']).optional(),
      }),
      execute: async ({ kind }) => {
        // ctx.userId is trusted — never expose it in inputSchema
        return ctx.db.select().from(asset).where(eq(asset.userId, ctx.userId))
      },
    }),

    // Add your tool here:
    // sendNotification: tool({ ... }),
  }
}
```

**Rules:**

- **Never put `userId` in `inputSchema`.** The model will hallucinate values. Always read it from `ctx`.
- **Use Zod for `inputSchema`.** The SDK uses it for both JSON Schema generation and runtime validation.
- **`stepCountIs(5)`** caps the tool-call loop in `routes/ai.ts`. Raise if your use case needs more hops, lower for stricter cost control.

## Usage tracking

Every completed stream calls `writeUsage()`, which:

1. **Logs** to stdout as `[ai.usage] { ...event }` (Railway/Fly log pickup).
2. **Inserts** into `ai_usage_event` with the full raw event as JSONB (flexible analytics).
3. **Upserts** into `user_ai_monthly_usage` with running totals per `(user_id, month)`.

Cost is computed from `catalog.ts` pricing. If a model is removed from the catalog, historical events keep their stored `estimated_cost_usd` but new events for that model will write `0`.

> **Known limitation — enforcement is not wired yet.** The data is collected but nothing in the streaming path checks `user_ai_monthly_usage` to gate requests. Adding a quota check before `streamText()` in `routes/ai.ts` is the next planned AI step. See CLAUDE.md roadmap.

## Resumable streams — how they work

`resumable-stream` wraps a `ReadableStream` and publishes chunks to Redis so a reconnecting client can pick up mid-response.

- On the **first** request to `POST /api/ai/conversations/:id/messages`:
  - Server generates `streamId`, writes it to `ai_stream`.
  - `streamContext.resumableStream(streamId, () => sseStream)` starts publishing chunks to Redis under that ID.
  - If the client disconnects, `result.consumeStream()` (no `await`) keeps draining the source so `onFinish` still runs and the assistant message is persisted.
- On **reconnect**: the client sends `GET /api/ai/conversations/:id/stream`. The server looks up the most recent `streamId` and calls `streamContext.resumeExistingStream(streamId)`, which replays buffered chunks from Redis and continues piping any new ones.

The `useChat` hook on the frontend is configured with `resume: true` and `prepareReconnectToStreamRequest` to hit the GET endpoint automatically on reconnect.

## Testing

Vitest tests live in `apps/server/src/__tests__/ai/`. They hit a real Postgres database — make sure the DB is up (`docker compose up -d`) before running:

```bash
pnpm --filter server test
```

## Frontend usage

```tsx
import { useAiChat } from '@/lib/ai/use-ai-chat'

function Chat({ conversationId }: { conversationId: string }) {
  const { messages, input, handleInputChange, handleSubmit, status } =
    useAiChat({ conversationId })

  return (
    <>
      {messages.map((m) => <Bubble key={m.id} message={m} />)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </>
  )
}
```

The hook wraps `@ai-sdk/react`'s `useChat` with our transport (sends cookies, resolves conversation-scoped endpoints, handles resume on reconnect).

## Notes on AI SDK v5

- Token fields are `inputTokens` / `outputTokens` (not `promptTokens` / `completionTokens`). `usage-sink.ts` maps them to the app shape.
- `createUIMessageStream` is the v5 way to merge a model stream with custom writer events.
- `stopWhen: stepCountIs(n)` replaces the deprecated `maxSteps` option.
