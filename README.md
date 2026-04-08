## SaaS Template
-- This is not even in alpha version, its a work in progress

This is a template for a SaaS Application.

Its a turbo repo that contains:

1. Web App (SPA vite Using Tanstack Router)
2. Server (Node.js using Hono and Better Auth)
3. Database (PostgreSQL using Drizzle ORM)
4. Authentication (Better Auth)

-- WIP:
- Middlewares
- Redis with BullMQ for background tasks
- Email handling on backend
- Assets management (pipe on server to provider)

To use it, you need to run

```bash
docker compose up -d
```

To set up the DB and redis, then run Turbo:

```bash
pnpm install
pnpm run dev
```

This will start the development server for the web app and the server.

The web app will be available at http://localhost:5173 and the server will be available at http://localhost:3001.

## Deploying to Production

Recommended deploy strategie:

- Railway (server)
- Cloudflare Pages (frontend)
- Neon (Postgres prod)
- Redis (recommended Railway, optional Upstash) *


* BullMQ does polling, so it needs a Redis instance to work, using Server+Redis inside Railway garanties a reliable and scalable Redis instance, plus cheaper on initial instances.
In Railway Redis is included in the initial instance, so you can use it for free.
Upstash could burn the same budget for Redis just by BullMQ polling to it.

Remember to set the production environment variables in the server and web app.

## TODO

- [ ] Add a CI/CD pipeline
- [ ] Add a production deployment script for each server to trigger the correspondant deployment