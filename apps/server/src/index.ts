import { serve } from '@hono/node-server'
import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors({
  origin: process.env.CORS_ORIGIN_FRONTEND as string ?? 'http://localhost:5173',
  credentials: true,
}))

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const port = Number(process.env.PORT ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})