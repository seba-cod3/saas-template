import { Hono } from 'hono'
import { WS_CHANNELS } from '@repo/shared/ws'
import { doLater } from '../lib/queue.js'
import { broadcast } from '../lib/ws.js'

// Dev-only smoke endpoints. Safe to delete when no longer needed.
export const testRoutes = new Hono()
  .post('/job', async (c) => {
    await doLater('example-log', { message: 'Hello from background job!' })
    return c.json({ queued: true })
  })
  .post('/ws', async (c) => {
    const body = await c.req.json()
    await broadcast({ channel: WS_CHANNELS.TEST_NOTIFICATIONS }, body)
    return c.json({ sent: true })
  })
  .post('/email', async (c) => {
    const { to, subject, html } = await c.req.json<{ to: string; subject: string; html: string }>()
    await doLater('send-email', { to, subject, html })
    return c.json({ queued: true })
  })
