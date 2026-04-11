import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { WS_CHANNELS, channelKey } from '@repo/shared/ws'
import type { SessionEvent } from '@repo/shared/ws'
import { authClient } from '../lib/auth-client'
import { sessionQueryOptions, SESSION_QUERY_KEY } from '../lib/session'
import { subscribe } from '../lib/ws'

export const Route = createFileRoute('/_authenticated')({
  // Read from the query cache first. `ensureQueryData` returns the
  // cached value if fresh, otherwise triggers the queryFn once. Result:
  // navigating between /dashboard and /admin never makes a new network
  // call — the first landing on any _authenticated/* route does.
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (!session) {
      throw redirect({ to: '/' })
    }
    return { session }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { session } = Route.useRouteContext()
  const qc = useQueryClient()

  // Mirrors the TanStack Query cache. If an external event (WS revoke,
  // explicit setQueryData, etc.) nulls the session out, this picks it up
  // on the next render and we bounce to "/".
  const { data: liveSession } = useQuery(sessionQueryOptions)

  useEffect(() => {
    if (liveSession === null) {
      window.location.href = '/'
    }
  }, [liveSession])

  // Subscribe to the private per-user channel. Server also auto-pushes
  // `session.refresh` immediately after the socket opens (see
  // apps/server/src/index.ts) — so every fresh tab gets one refetch for
  // free, which is how we keep the "page just opened" case fresh.
  const userId = session.user.id
  useEffect(() => {
    const channel = channelKey(WS_CHANNELS.USER, userId)
    const unsubscribe = subscribe<SessionEvent>(channel, async (event) => {
      if (event.type === 'session.refresh') {
        await qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
      } else if (event.type === 'session.revoked') {
        try {
          await authClient.signOut()
        } catch {
          // already signed out
        }
        qc.setQueryData(SESSION_QUERY_KEY, null)
        window.location.href = '/'
      }
    })
    return unsubscribe
  }, [userId, qc])

  return <Outlet />
}
