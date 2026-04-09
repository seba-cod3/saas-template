import type { MiddlewareHandler } from 'hono'

/**
 * Logs method, path, status, and response time for every request.
 * Add to app.use('*', timing()) to enable, remove to disable.
 */
export function timing(): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now()
    await next()
    const ms = (performance.now() - start).toFixed(2)
    const { method } = c.req
    const path = new URL(c.req.url).pathname
    const status = c.res.status
    console.log(`[timing] ${method} ${path} ${status} — ${ms}ms`)
  }
}
