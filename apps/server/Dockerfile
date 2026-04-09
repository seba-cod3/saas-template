# Build context must be the monorepo root:
#   docker build -f apps/server/Dockerfile -t saas-server .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# --- Install dependencies (cached layer) ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile

# --- Production image ---
FROM base AS runner

COPY --from=deps /app ./

COPY packages/typescript-config ./packages/typescript-config
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

WORKDIR /app/apps/server

ENV NODE_ENV=production
EXPOSE 3001

# tsx runs TypeScript natively — needed because @repo/shared exports raw .ts files.
# When shared gets a build step, switch to: CMD ["node", "dist/index.js"]
CMD ["npx", "tsx", "src/index.ts"]
