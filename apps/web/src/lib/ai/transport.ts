import { DefaultChatTransport } from 'ai'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/**
 * Factory that builds a DefaultChatTransport for a given conversation.
 *
 * - sendMessages  → POST /api/ai/conversations/:id/messages (streaming)
 * - reconnect     → GET  /api/ai/conversations/:id/stream  (resume)
 */
export function makeChatTransport(conversationId: string) {
  return new DefaultChatTransport({
    api: `${BASE}/api/ai/conversations/${conversationId}/messages`,
    credentials: 'include',
    prepareReconnectToStreamRequest: () => ({
      api: `${BASE}/api/ai/conversations/${conversationId}/stream`,
      credentials: 'include',
    }),
  })
}
