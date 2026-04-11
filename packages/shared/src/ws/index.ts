// ---- Channel definitions ----
// Add your channels here. Both frontend and backend import from this file.
export const WS_CHANNELS = {
  TEST_NOTIFICATIONS: 'test-notifications',
  /**
   * Fan-out channel for admin dashboards. Server broadcasts here on
   * events that any admin should see (e.g. user signups, system alerts).
   * Subscribe is gated server-side to sessions with role === 'admin'.
   */
  ADMINS: 'admins',
  /**
   * Private per-user channel. Used for session invalidation
   * (session.refresh / session.revoked) and for any future "notify a
   * specific user" flow. Always use with `entityId: userId`.
   * Subscribe is gated server-side so a client can only subscribe to
   * its own user id — never someone else's.
   */
  USER: 'user',
} as const

// ---- Typed payloads for events on the ADMINS channel ----
// Keep this union tight: any field a payload includes is visible to every
// connected admin, so no secrets — just "what happened" summaries.
export type AdminEvent = {
  type: 'user.created'
  user: {
    id: string
    name: string
    email: string
    createdAt: string
  }
}

// ---- Typed payloads for session events on the USER channel ----
// Kept here (not in auth) so the ws layer doesn't depend on auth.
export type SessionEvent =
  /**
   * Re-fetch the session. Cookie cache may still return stale data for
   * up to `cookieCache.maxAge` — if you need true freshness across the
   * refresh, the server should also drop the session row first.
   */
  | { type: 'session.refresh' }
  /**
   * Kill the session. Client should call signOut() and redirect to "/".
   * Backend must have already revoked the DB session before broadcasting
   * this, otherwise a reload would re-authenticate the user.
   */
  | { type: 'session.revoked'; reason?: string }

export type WsChannel = (typeof WS_CHANNELS)[keyof typeof WS_CHANNELS]

// ---- Channel key builder ----
export function channelKey(channel: WsChannel, entityId?: string): string {
  return entityId ? `${channel}:${entityId}` : channel
}

// ---- Wire protocol ----
export interface WsEnvelope<T = unknown> {
  channel: string
  payload: T
}

export type WsClientMessage =
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
