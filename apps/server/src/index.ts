import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { WS_CHANNELS, channelKey } from '@repo/shared/ws'
import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import './jobs/index.js'
import { auth } from './lib/auth.js'
import { idempotencyGuard } from './lib/middleware/idempotency-guard.js'
import { startWorker } from './lib/queue.js'
import {
  handleClientMessage,
  registerClient,
  sendToSocket,
  unregisterClient,
} from './lib/ws.js'
import { adminRoutes } from './routes/admin.js'
import { assetRoutes } from './routes/assets.js'
import { healthRoutes } from './routes/health.js'
import { testRoutes } from './routes/test.js'

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// Global middlewares
app.use('*', cors({
  origin: process.env.CORS_ORIGIN_FRONTEND || 'http://localhost:5173',
  credentials: true,
}))
app.use('*', idempotencyGuard())
// app.use('*', timing()) // uncomment to enable endpoint timing logs

// Non-RPC mounts — handled outside the chained RPC type:
//   - Better Auth reads the raw Request and exposes no typed response.
//   - /ws is a WebSocket upgrade handler, not a JSON endpoint.
app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw))

app.get(
  '/ws',
  upgradeWebSocket(async (c) => {
    // Resolve the better-auth session from the upgrade request cookies
    // *once*, and carry the identity into the socket's lifecycle. This
    // is what powers:
    //   - subscribe gating (user:<id> + admins)
    //   - the auto-refresh push on connect
    //   - targeted sendToUser() from session-ops
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const identity = {
      userId: session?.user.id ?? null,
      role: (session?.user as { role?: string | null } | undefined)?.role ?? null,
    }

    return {
      onOpen(_event, ws) {
        registerClient(ws, identity)

        // Fresh tab / reconnect from an authenticated user → push a
        // session.refresh *immediately* so the frontend invalidates its
        // TanStack Query cache and fetches a fresh session. This is the
        // "every first connection from frontend fires a refetch" contract.
        if (identity.userId) {
          sendToSocket(
            ws,
            channelKey(WS_CHANNELS.USER, identity.userId),
            { type: 'session.refresh' as const },
          )
        }
      },
      onMessage(event, ws) {
        handleClientMessage(ws, String(event.data))
      },
      onClose(_event, ws) {
        unregisterClient(ws)
      },
    }
  }),
)

// RPC routes — the chained expression here is what hono/client consumes.
// Add new feature routers with another `.route()` call.
const routes = app
  .route('/api/assets', assetRoutes)
  .route('/api/admin', adminRoutes)
  .route('/health', healthRoutes)
  .route('/api/test', testRoutes)

export type AppType = typeof routes

startWorker()

const port = Number(process.env.SERVER_PORT ?? 3001)

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

injectWebSocket(server)
