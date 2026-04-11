/**
 * AI routes — authentication & authorization tests.
 *
 * These tests hit a real DB (Postgres + Redis from .env).
 * No AI provider calls are made — the 401/403 gates fire before any provider
 * interaction.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { aiRoutes } from '../../routes/ai.js'

// Minimal app that mirrors the real mount
const app = new Hono().route('/api/ai', aiRoutes)

describe('AI routes — unauthenticated', () => {
  it('GET /api/ai/models returns 401 without a session cookie', async () => {
    const res = await app.request('/api/ai/models', { method: 'GET' })
    expect(res.status).toBe(401)
  })

  it('GET /api/ai/conversations returns 401 without a session cookie', async () => {
    const res = await app.request('/api/ai/conversations', { method: 'GET' })
    expect(res.status).toBe(401)
  })

  it('POST /api/ai/conversations returns 401 without a session cookie', async () => {
    const res = await app.request('/api/ai/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4o-mini' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/ai/conversations/:id/messages returns 401 without a session', async () => {
    const res = await app.request('/api/ai/conversations/fake-id/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/ai/conversations/:id/stream returns 401 without a session', async () => {
    const res = await app.request('/api/ai/conversations/fake-id/stream', { method: 'GET' })
    expect(res.status).toBe(401)
  })
})
