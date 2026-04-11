import { queryOptions } from '@tanstack/react-query'
import { authClient } from './auth-client'

/**
 * Canonical session query. Anywhere the frontend needs to know "who is
 * logged in and what role they have", use this query options object.
 *
 * Why this exists:
 *   - `authClient.useSession()` makes an HTTP call per mounted component
 *     unless the hook is already running elsewhere. It also bypasses
 *     the router/query caches entirely.
 *   - Using TanStack Query as the single source of truth means:
 *       * `beforeLoad` in protected routes can call `ensureQueryData`
 *         and reuse the same data as every component downstream.
 *       * WebSocket events can invalidate with `queryClient.invalidateQueries(['session'])`
 *         and every consumer reacts at once.
 *       * Auth flows (login/register/logout) update a single cache entry.
 *
 * staleTime:
 *   - 60 seconds is a defensive floor while the WS invalidation layer
 *     is the primary signal. If for some reason the WS drops and
 *     session.revoked never arrives, the next refetch (≤60s later)
 *     re-hits the server. The server returns from cookie cache so it
 *     is cheap anyway.
 *   - Bump to `Infinity` once you trust the WS path fully.
 */
export type SessionData = Awaited<ReturnType<typeof authClient.getSession>>['data']

export const SESSION_QUERY_KEY = ['session'] as const

export const sessionQueryOptions = queryOptions<SessionData>({
  queryKey: SESSION_QUERY_KEY,
  queryFn: async () => {
    const res = await authClient.getSession()
    return res.data ?? null
  },
  staleTime: 60 * 1000,
  gcTime: Infinity,
  retry: false,
})
