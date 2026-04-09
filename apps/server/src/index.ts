import { serve } from '@hono/node-server'
import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/auth.js'
import { doLater, startWorker } from './lib/queue.js'
import './jobs/index.js'

const app = new Hono()

app.use('*', cors({
  origin: process.env.CORS_ORIGIN_FRONTEND || 'http://localhost:5173',
  credentials: true,
}))

app.on(['POST', 'GET'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw)
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Test endpoint — remove when no longer needed
app.post('/api/test-job', async (c) => {
  await doLater('example-log', { message: 'Hello from background job!' })
  return c.json({ queued: true })
})

startWorker()

const port = Number(process.env.SERVER_PORT ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})