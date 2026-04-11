import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { UIMessage } from 'ai'
import { useEffect, useRef, useState } from 'react'
import { messagesQueryOptions } from '../../../lib/ai/queries'
import { useAiChat } from '../../../lib/ai/use-ai-chat'

export const Route = createFileRoute('/_authenticated/chat/$conversationId')({
  component: ConversationPage,
})

function ConversationPage() {
  const { conversationId } = Route.useParams()
  const { data: historicMessages = [] } = useQuery(messagesQueryOptions(conversationId))

  return <ChatView conversationId={conversationId} initialMessages={historicMessages} />
}

function ChatView({
  conversationId,
  initialMessages,
}: {
  conversationId: string
  initialMessages: UIMessage[]
}) {
  const { messages, sendMessage, stop, status, error, regenerate } = useAiChat(
    conversationId,
    initialMessages,
  )
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || status === 'streaming' || status === 'submitted') return
    sendMessage({ role: 'user', parts: [{ type: 'text', text: trimmed }] })
    setInput('')
  }

  const isGenerating = status === 'streaming' || status === 'submitted'
  const lastMessage = messages.at(-1)

  return (
    <div style={styles.container}>
      <div style={styles.messages}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {error && <p style={styles.errorMsg}>Error: {error.message}</p>}
        <div ref={bottomRef} />
      </div>

      <div style={styles.bottom}>
        {lastMessage?.role === 'assistant' && !isGenerating && (
          <div style={styles.actions}>
            <button style={styles.actionBtn} onClick={() => regenerate()}>
              Regenerate
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <textarea
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message…"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e as unknown as React.SubmitEvent<HTMLFormElement>)
              }
            }}
          />
          <div style={styles.formActions}>
            <span style={styles.statusBadge(status)}>{status}</span>
            {isGenerating ? (
              <button type="button" style={styles.stopBtn} onClick={() => stop()}>
                Stop
              </button>
            ) : (
              <button type="submit" style={styles.sendBtn} disabled={!input.trim()}>
                Send
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'

  const textContent = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => ('text' in p ? p.text : ''))
    .join('')

  return (
    <div
      style={{
        ...styles.bubble,
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        backgroundColor: isUser ? '#111827' : '#f3f4f6',
        color: isUser ? '#fff' : '#111827',
        maxWidth: '80%',
      }}
    >
      <pre style={styles.pre}>{textContent}</pre>
    </div>
  )
}

const statusColors: Record<string, string> = {
  ready: '#10b981',
  submitted: '#f59e0b',
  streaming: '#3b82f6',
  error: '#ef4444',
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  bubble: {
    padding: '12px 16px',
    borderRadius: '12px',
    wordBreak: 'break-word' as const,
  },
  pre: {
    margin: 0,
    fontFamily: 'inherit',
    fontSize: '14px',
    whiteSpace: 'pre-wrap' as const,
  },
  errorMsg: {
    color: '#ef4444',
    fontSize: '13px',
    padding: '8px 12px',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
  },
  bottom: {
    borderTop: '1px solid #e5e7eb',
    padding: '16px',
    backgroundColor: '#fff',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  actionBtn: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#374151',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'none' as const,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  formActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: (status: string): React.CSSProperties => ({
    fontSize: '12px',
    color: statusColors[status] ?? '#6b7280',
    fontWeight: 500,
  }),
  stopBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#ef4444',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  sendBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#111827',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
} satisfies Record<string, React.CSSProperties | ((status: string) => React.CSSProperties)>
