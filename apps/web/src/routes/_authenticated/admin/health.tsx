import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../../lib/api'

export const Route = createFileRoute('/_authenticated/admin/health')({
  component: AdminHealthPage,
})

type HealthResponse = {
  api: { status: 'ok' }
  db: { status: 'ok' | 'down'; latencyMs: number }
  redis: { status: 'ok' | 'down'; latencyMs: number }
  ws: { localClients: number; localSubscriptions: number; note: string }
  timestamp: string
}

function AdminHealthPage() {
  const { data, isPending, error, refetch, isFetching } = useQuery<HealthResponse>({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const res = await api.api.admin.health.$get()
      if (!res.ok) throw new Error('Failed to load health')
      return (await res.json()) as HealthResponse
    },
    refetchInterval: 5000,
  })

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Health</h1>
        <button style={styles.refreshBtn} onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div style={styles.error}>Failed to load health</div>}
      {isPending && <div style={styles.loading}>Loading…</div>}

      {data && (
        <div style={styles.grid}>
          <Card label="API" status="ok" detail="Handler responding" />
          <Card
            label="Database (Postgres)"
            status={data.db.status}
            detail={`${data.db.latencyMs} ms`}
          />
          <Card
            label="Redis"
            status={data.redis.status}
            detail={`${data.redis.latencyMs} ms`}
          />
          <Card
            label="WebSocket clients (local)"
            status="ok"
            detail={`${data.ws.localClients} clients · ${data.ws.localSubscriptions} subs`}
            note={data.ws.note}
          />
        </div>
      )}

      {data && (
        <div style={styles.footer}>
          Last update: {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

function Card({
  label,
  status,
  detail,
  note,
}: {
  label: string
  status: 'ok' | 'down'
  detail: string
  note?: string
}) {
  const ok = status === 'ok'
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span
          style={{
            ...styles.dot,
            background: ok ? '#22c55e' : '#ef4444',
          }}
        />
        <span style={styles.cardLabel}>{label}</span>
      </div>
      <div style={styles.cardDetail}>{detail}</div>
      <div style={styles.cardStatus}>{ok ? 'OPERATIONAL' : 'DOWN'}</div>
      {note && <div style={styles.cardNote}>{note}</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 },
  refreshBtn: {
    padding: '8px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  error: {
    padding: 12,
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 6,
  },
  loading: { color: '#6b7280' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
  card: {
    padding: 20,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: '50%' },
  cardLabel: { fontSize: 13, color: '#6b7280', fontWeight: 600 },
  cardDetail: {
    fontSize: 24,
    fontWeight: 700,
    color: '#111827',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  cardStatus: {
    marginTop: 6,
    fontSize: 11,
    color: '#6b7280',
    letterSpacing: '0.05em',
  },
  cardNote: { marginTop: 8, fontSize: 12, color: '#9ca3af', lineHeight: 1.4 },
  footer: { marginTop: 20, fontSize: 13, color: '#6b7280' },
}
