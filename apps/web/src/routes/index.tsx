import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../lib/api'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
        SaaS Template
      </h1>
      <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '480px', margin: '0 auto' }}>
        A production-ready SaaS starter with authentication, multi-tenancy, and more.
      </p>
      <HealthBadge />
    </div>
  )
}

function HealthBadge() {
  const { data, isPending, error } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.health.$get()
      if (!res.ok) throw new Error('Health check failed')
      return res.json()
    },
  })

  const baseStyle: React.CSSProperties = {
    display: 'inline-block',
    marginTop: '24px',
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '13px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  }

  if (isPending) {
    return <span style={{ ...baseStyle, background: '#f3f4f6', color: '#6b7280' }}>checking server…</span>
  }
  if (error) {
    return <span style={{ ...baseStyle, background: '#fee2e2', color: '#991b1b' }}>server down</span>
  }
  return (
    <span style={{ ...baseStyle, background: '#dcfce7', color: '#166534' }}>
      server {data.status} · {new Date(data.timestamp).toLocaleTimeString()}
    </span>
  )
}
