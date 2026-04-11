import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { makeChatTransport } from './transport'

/**
 * Thin wrapper over useChat (@ai-sdk/react) that wires the transport and enables stream resume.
 *
 * resume: true — on mount, the hook calls reconnectToStream (GET .../stream)
 * and replays any in-flight stream. Transparent to the user on tab reload.
 */
export function useAiChat(conversationId: string, initialMessages: UIMessage[] = []) {
  return useChat({
    id: conversationId,
    messages: initialMessages,
    transport: makeChatTransport(conversationId),
    resume: true,
  })
}
