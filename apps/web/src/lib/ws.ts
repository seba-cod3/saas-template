import type { WsClientMessage, WsEnvelope } from '@repo/shared/ws'

type Listener = (payload: unknown) => void

const channelListeners = new Map<string, Set<Listener>>()

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 1000

function getWsUrl(): string {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  return api.replace(/^http/, 'ws') + '/ws'
}

function send(msg: WsClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    reconnectDelay = 1000
    // Re-subscribe all active channels
    for (const channel of channelListeners.keys()) {
      send({ type: 'subscribe', channel })
    }
  }

  ws.onmessage = (event) => {
    try {
      const envelope: WsEnvelope = JSON.parse(event.data)
      const listeners = channelListeners.get(envelope.channel)
      if (listeners) {
        for (const cb of listeners) cb(envelope.payload)
      }
    } catch {
      // Invalid message
    }
  }

  ws.onclose = () => {
    if (channelListeners.size > 0) {
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000)
        connect()
      }, reconnectDelay)
    }
  }
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    ws.onclose = null
    ws.close()
    ws = null
  }
}

/** Subscribe to a WS channel. Returns an unsubscribe function. */
export function subscribe<T = unknown>(
  channel: string,
  onMessage: (payload: T) => void,
): () => void {
  if (!channelListeners.has(channel)) {
    channelListeners.set(channel, new Set())
  }
  const listeners = channelListeners.get(channel)!
  const cb = onMessage as Listener
  listeners.add(cb)

  // First subscriber for any channel — open the connection
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    connect()
  } else {
    send({ type: 'subscribe', channel })
  }

  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) {
      channelListeners.delete(channel)
      send({ type: 'unsubscribe', channel })

      // No more listeners at all — close the connection
      if (channelListeners.size === 0) {
        disconnect()
      }
    }
  }
}
