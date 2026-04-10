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
 */
export const api = hc<AppType>(baseURL)
