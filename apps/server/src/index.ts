import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors({
  origin: 'http://localhost:3000',
  credentials: true,
}))

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

serve({
  fetch: app.fetch,
  port: 3001,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})