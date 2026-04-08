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

## OAuth Providers (optional)

OAuth login with Google and GitHub is supported but disabled by default. To enable it:

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**
4. Select **Web application**
5. Add `http://localhost:3001/api/auth/callback/google` to **Authorized redirect URIs** (replace with your production URL when deploying)
6. Copy the **Client ID** and **Client Secret**

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set **Homepage URL** to `http://localhost:5173`
4. Set **Authorization callback URL** to `http://localhost:3001/api/auth/callback/github`
5. Copy the **Client ID** and generate a **Client Secret**

### Environment variables

Add to `apps/server/.env`:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

Add to `apps/web/.env`:

```env
VITE_OAUTH_GOOGLE=true
VITE_OAUTH_GITHUB=true
```

You can enable one or both providers independently. If no env vars are set, the OAuth buttons won't appear in the login/register modals.

## TODO

- [ ] Add a CI/CD pipeline
- [ ] Add a production deployment script for each server to trigger the correspondant deployment