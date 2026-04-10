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
