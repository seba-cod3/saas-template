// ---- Channel definitions ----
// Add your channels here. Both frontend and backend import from this file.
export const WS_CHANNELS = {
  TEST_NOTIFICATIONS: 'test-notifications',
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
