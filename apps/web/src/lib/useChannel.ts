import { useEffect, useRef } from 'react'
import { subscribe } from './ws.js'

/**
 * Subscribe to a WebSocket channel. The callback fires on each message.
 *
 * Usage:
 *   useChannel(WS_CHANNELS.TEST_NOTIFICATIONS, (payload) => { ... })
 *   useChannel(channelKey(WS_CHANNELS.WHITEBOARD, boardId), (data) => { ... })
 */
export function useChannel<T = unknown>(
  channel: string,
  onMessage: (payload: T) => void,
): void {
  const callbackRef = useRef(onMessage)
  callbackRef.current = onMessage

  useEffect(() => {
    return subscribe<T>(channel, (payload) => callbackRef.current(payload))
  }, [channel])
}
