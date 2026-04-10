// ---- Channel definitions ----
// Add your channels here. Both frontend and backend import from this file.
export const WS_CHANNELS = {
  TEST_NOTIFICATIONS: 'test-notifications',
  /**
   * Fan-out channel for admin dashboards. Server broadcasts here on
   * events that any admin should see (e.g. user signups, system alerts).
   * Per-role auth is enforced on subscribe-time via a WS handshake hook
   * or simply by not surfacing the channel name to non-admin frontends.
   */
  ADMINS: 'admins',
} as const

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
