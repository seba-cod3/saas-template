import { queryOptions } from '@tanstack/react-query'
import { api } from '../api'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const AI_QUERY_KEYS = {
  models: ['chat', 'models'] as const,
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
}

// ─── Query Options ────────────────────────────────────────────────────────────

export const modelsQueryOptions = queryOptions({
  queryKey: AI_QUERY_KEYS.models,
  queryFn: () =>
    (api as unknown as { api: { ai: { models: { $get: () => Promise<Response> } } } }).api.ai.models
      .$get()
      .then((r: Response) => r.json()),
  staleTime: 1000 * 60 * 10, // models rarely change — 10 min stale
})

export const conversationsQueryOptions = queryOptions({
  queryKey: AI_QUERY_KEYS.conversations,
  queryFn: () =>
    fetch(`${BASE}/api/ai/conversations`, { credentials: 'include' }).then((r) => r.json()),
  staleTime: 1000 * 30,
})

export const messagesQueryOptions = (conversationId: string) =>
  queryOptions({
    queryKey: AI_QUERY_KEYS.messages(conversationId),
    queryFn: () =>
      fetch(`${BASE}/api/ai/conversations/${conversationId}/messages`, {
        credentials: 'include',
      }).then((r) => r.json()),
    staleTime: Infinity, // managed by useChat in memory during active session
  })
