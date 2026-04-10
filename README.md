# SaaS Template

> **Not even alpha yet** — actively under development. Expect breaking changes.

A production-ready SaaS starter as a Turborepo monorepo. Clone it, configure your env vars, and start building.

## Features

- **Frontend** — Vite + React SPA with TanStack Router, TanStack Query, and React Compiler
- **Backend** — Hono on Node.js with full TypeScript
- **Authentication** — Better Auth (email/password + optional Google/GitHub OAuth)
- **Database** — PostgreSQL 16 with Drizzle ORM and migrations
- **Background Jobs** — BullMQ + Redis with type-safe `doLater()` pattern and auto-scaffolding
- **Asset Storage** — Streaming upload/download (no disk temp files), adapter pattern (local dev, S3/R2 for prod)
- **Caching** — `cached(key, ttl, fn)` utility backed by Redis
- **WebSockets** — Real-time sync with typed channels shared between server and web, Redis Pub/Sub for multi-instance
- **Idempotency Guard** — Automatic duplicate request rejection (409) for mutations
- **Shared Packages** — Zod validation schemas, WebSocket channels, and constants shared between server and web

---

- **Middleware de timing de endpoints**


## Getting Started

```bash
docker compose up -d    # Postgres + Redis
pnpm install
pnpm run dev            # Starts web (localhost:5173) and server (localhost:3001)
```

Copy the example env files and adjust as needed:

- `apps/server/.env.example`
- `apps/web/.env.example`

## Project Structure

```
apps/
  server/         Hono API + Better Auth + BullMQ worker
  web/            Vite React SPA + TanStack Router
packages/
  shared/         Zod schemas and constants
  docs/           Setup guides (auth, storage, etc.)
```

## Documentation

- [Authentication & OAuth setup](packages/docs/auth.md)
- [S3/R2 Storage setup](packages/docs/storage-s3.md)
- [WebSockets setup & usage](packages/docs/websockets.md)
- [Server deploy & Docker guide](packages/docs/server.md)

## Deploying to Production

Recommended strategy:

| Service  | Provider                          |
| -------- | --------------------------------- |
| Server   | Railway / Fly.io                  |
| Frontend | Cloudflare Pages / Vercel         |
| Postgres | Neon                              |
| Redis    | Railway (recommended) / Upstash * |

\* BullMQ uses polling, so colocating Redis with the server on Railway is cheaper and more reliable. Railway includes Redis in the initial instance. Upstash can burn budget fast from BullMQ polling alone.

Remember to set the production environment variables in both `apps/server` and `apps/web`.

## Roadmap

It's on the works, but not yet ready for production.

- [ ] Admin dashboard
- [ ] AI proxy/streaming endpoint
- [ ] CI/CD pipeline

## License

This project is licensed under the [Business Source License 1.1](./LICENSE).

**TL;DR**

- **Free for non-production use** (evaluation, development, testing, research, personal projects) — always, for anyone, regardless of company size.
- **Free for production use** as long as the aggregate annual revenue earned from any product, service, or offering built upon, derived from, or materially dependent on this software stays under **USD 20,000,000** (trailing twelve months).
- **Internal-use applications don't count** toward the threshold, even in large organizations.
- **Attribution required** — redistributions and products built on this software must preserve the [`NOTICE`](./NOTICE) file.
- **Converts to Apache License 2.0** four years after each version is published.

If your use exceeds the threshold above, or if you're interested in a **commercial license**, a **perpetual license**, or **source code acquisition**, I'd love to hear from you:

**Contact:** [sebastiankoleff@gmail.com](mailto:sebastiankoleff@gmail.com)

Whether you're a startup outgrowing the free tier, an enterprise looking for a license that fits your compliance process, or a team that wants to own a custom fork — reach out and we'll figure out terms that make sense for both sides.
