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

- [ ] AI proxy/streaming endpoint
- [ ] HTTP client base class
- [ ] Ownership validation helpers
- [ ] Postman collection
- [ ] CI/CD pipeline
- [ ] Production deployment scripts
