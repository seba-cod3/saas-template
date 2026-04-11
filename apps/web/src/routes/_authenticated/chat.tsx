import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AI_QUERY_KEYS, conversationsQueryOptions, modelsQueryOptions } from '../../lib/ai/queries'

export const Route = createFileRoute('/_authenticated/chat')({
  component: ChatLayout,
})

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function ChatLayout() {
  const { data: conversations = { items: [] } } = useQuery(conversationsQueryOptions)
  const { data: models = [] } = useQuery(modelsQueryOptions)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('')

  const createConversation = useMutation({
    mutationFn: (body: { provider: string; model: string; title?: string }) =>
      fetch(`${BASE}/api/ai/conversations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: AI_QUERY_KEYS.conversations })
      setShowNewDialog(false)
      navigate({ to: '/chat/$conversationId', params: { conversationId: conv.id } })
    },
  })

  function handleModelSelect(value: string) {
    const [provider, ...rest] = value.split(':')
    setSelectedProvider(provider ?? '')
    setSelectedModel(rest.join(':'))
  }

  function handleCreate() {
    if (!selectedProvider || !selectedModel) return
    createConversation.mutate({ provider: selectedProvider, model: selectedModel })
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>Chat</span>
          <button style={styles.newBtn} onClick={() => setShowNewDialog(true)}>
            + New
          </button>
        </div>

        <nav style={styles.nav}>
          {(conversations.items ?? []).map(
            (conv: { id: string; title: string; provider: string; model: string }) => (
              <Link
                key={conv.id}
                to="/chat/$conversationId"
                params={{ conversationId: conv.id }}
                style={styles.navLink}
                activeProps={{ style: { ...styles.navLink, ...styles.navLinkActive } }}
              >
                <span style={styles.navTitle}>{conv.title}</span>
                <span style={styles.navMeta}>
                  {conv.provider}/{conv.model}
                </span>
              </Link>
            ),
          )}
          {(conversations.items ?? []).length === 0 && (
            <p style={styles.emptyHint}>No conversations yet. Start one!</p>
          )}
        </nav>
      </aside>

      <main style={styles.main}>
        <Outlet />
      </main>

      {showNewDialog && (
        <>
          <div style={styles.backdrop} onClick={() => setShowNewDialog(false)} />
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>New conversation</h3>
            <label style={styles.label}>Model</label>
            <select
              style={styles.select}
              value={selectedProvider && selectedModel ? `${selectedProvider}:${selectedModel}` : ''}
              onChange={(e) => handleModelSelect(e.target.value)}
            >
              <option value="">Select a model...</option>
              {(models as Array<{ provider: string; model: string; enabled: boolean }>)
                .filter((m) => m.enabled)
                .map((m) => (
                  <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>
                    {m.provider} / {m.model}
                  </option>
                ))}
            </select>
            <div style={styles.dialogActions}>
              <button style={styles.cancelBtn} onClick={() => setShowNewDialog(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.createBtn,
                  opacity: !selectedModel || createConversation.isPending ? 0.5 : 1,
                }}
                disabled={!selectedModel || createConversation.isPending}
                onClick={handleCreate}
              >
                {createConversation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    minHeight: 'calc(100vh - 65px)',
  },
  sidebar: {
    borderRight: '1px solid #e5e7eb',
    padding: '16px',
    backgroundColor: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  sidebarTitle: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: '#9ca3af',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  newBtn: {
    fontSize: '12px',
    padding: '4px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontWeight: 500,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navLink: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 10px',
    borderRadius: '6px',
    color: '#374151',
    textDecoration: 'none',
    fontSize: '14px',
  },
  navLinkActive: {
    backgroundColor: '#111827',
    color: '#fff',
  },
  navTitle: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navMeta: {
    fontSize: '11px',
    opacity: 0.6,
    marginTop: '2px',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#9ca3af',
    padding: '8px 0',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 65px)',
    overflow: 'hidden',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 199,
  },
  dialog: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    padding: '24px',
    zIndex: 200,
    width: '360px',
  },
  dialogTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px',
  },
  dialogActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
  },
  createBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#111827',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
}
