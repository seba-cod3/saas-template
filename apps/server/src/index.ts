import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import './jobs/index.js'
import { auth } from './lib/auth.js'
import { idempotencyGuard } from './lib/middleware/idempotency-guard.js'
import { doLater, startWorker } from './lib/queue.js'
import { registerClient, unregisterClient, handleClientMessage } from './lib/ws.js'
import { assetRoutes } from './routes/assets.js'

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.use('*', cors({
  origin: process.env.CORS_ORIGIN_FRONTEND || 'http://localhost:5173',
  credentials: true,
}))

app.use('*', idempotencyGuard())
// app.use('*', timing()) // uncomment to enable endpoint timing logs

app.on(['POST', 'GET'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw)
})

app.route('/api/assets', assetRoutes)

app.get(
  '/ws',
  upgradeWebSocket((c) => ({
    onOpen(_event, ws) {
      registerClient(ws)
    },
    onMessage(event, ws) {
      handleClientMessage(ws, String(event.data))
    },
    onClose(_event, ws) {
      unregisterClient(ws)
    },
  })),
)

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Test endpoints — remove when no longer needed
app.post('/api/test-job', async (c) => {
  await doLater('example-log', { message: 'Hello from background job!' })
  return c.json({ queued: true })
})

app.post('/api/test-ws', async (c) => {
  const { broadcast } = await import('./lib/ws.js')
  const { WS_CHANNELS } = await import('@repo/shared/ws')
  const body = await c.req.json()
  await broadcast({ channel: WS_CHANNELS.TEST_NOTIFICATIONS }, body)
  return c.json({ sent: true })
})

startWorker()

const port = Number(process.env.SERVER_PORT ?? 3001)

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

injectWebSocket(server)