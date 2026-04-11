/**
 * Idempotency guard — verifies /api/ai/* is excluded from the 3s duplicate check.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { idempotencyGuard } from '../../lib/middleware/idempotency-guard.js'

describe('idempotencyGuard — AI bypass', () => {
  it('passes /api/ai/conversations without a 409 even on repeat calls', async () => {
    // Build a micro-app with just the guard and a dummy POST handler
    const app = new Hono()
    app.use('*', idempotencyGuard())
    app.post('/api/ai/conversations', (c) => c.json({ ok: true }))

    const body = JSON.stringify({ provider: 'openai', model: 'gpt-4o-mini' })
    const headers = { 'content-type': 'application/json' }

    // Two identical requests in quick succession — guard must NOT block either
    const [r1, r2] = await Promise.all([
      app.request('/api/ai/conversations', { method: 'POST', headers, body }),
      app.request('/api/ai/conversations', { method: 'POST', headers, body }),
    ])

    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
  })

  it('still blocks duplicate non-AI POST requests', async () => {
    const app = new Hono()
    app.use('*', idempotencyGuard())
    app.post('/api/other', (c) => c.json({ ok: true }))

    const body = JSON.stringify({ foo: 'bar' })
    const headers = { 'content-type': 'application/json' }

    // First request goes through
    const r1 = await app.request('/api/other', { method: 'POST', headers, body })
    expect(r1.status).toBe(200)

    // Second identical request within TTL window is blocked
    const r2 = await app.request('/api/other', { method: 'POST', headers, body })
    expect(r2.status).toBe(409)
  })
})
