import { hc } from 'hono/client'
import type { AppType } from '@saas-template/server'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/**
 * Typed HTTP client for the backend RPC routes.
 *
 * Usage:
 *   const res = await api.health.$get()
 *   const data = await res.json()  // fully typed from the server handler
 *
 * Not RPC-exposed: /api/auth/** (use better-auth client) and /ws (use lib/ws.ts).
 *
 * `credentials: 'include'` is required so the better-auth session cookie
 * rides along on cross-origin requests (web on :5173 → server on :3001).
 * Without it, any route behind `requireRole` / auth middleware returns 401.
 */
export const api = hc<AppType>(baseURL, {
  fetch: ((input, init) =>
    fetch(input, { ...init, credentials: 'include' })) as typeof fetch,
})
