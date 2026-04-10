import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { USER_ROLES } from '@repo/shared/auth'
import { WS_CHANNELS } from '@repo/shared/ws'
import { api } from '../../../lib/api'
import { useChannel } from '../../../lib/useChannel'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminUsersPage,
})

type UsersResponse = {
  page: number
  pageSize: number
  total: number
  items: Array<{
    id: string
    name: string
    email: string
    role: string | null
    image: string | null
    createdAt: string
    bytesUsed: number
    mbUsed: number
  }>
}

function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [newSignups, setNewSignups] = useState(0)
  const qc = useQueryClient()

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const queryKey = useMemo(
    () => ['admin', 'users', { page, pageSize, q: debouncedQ }] as const,
    [page, debouncedQ],
  )

  const { data, isPending, error, isFetching } = useQuery<UsersResponse>({
    queryKey,
    queryFn: async () => {
      const res = await api.api.admin.users.$get({
        query: { page: String(page), pageSize: String(pageSize), q: debouncedQ },
      })
      if (!res.ok) throw new Error('Failed to load users')
      return (await res.json()) as UsersResponse
    },
  })

  // Live feed — any new signup bumps a counter with a "refresh" CTA.
  useChannel(WS_CHANNELS.ADMINS, () => {
    setNewSignups((n) => n + 1)
  })

  function applyNewSignups() {
    setNewSignups(0)
    qc.invalidateQueries({ queryKey: ['admin', 'users'] })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Users</h1>
        <input
          type="search"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={styles.search}
        />
      </div>

      {newSignups > 0 && (
        <button style={styles.refreshBanner} onClick={applyNewSignups}>
          {newSignups} new user{newSignups === 1 ? '' : 's'} — click to refresh
        </button>
      )}

      {error && <div style={styles.error}>Error loading users</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Storage</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {isPending || !data ? (
              <tr>
                <td colSpan={6} style={styles.empty}>
                  Loading…
                </td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={6} style={styles.empty}>
                  No users
                </td>
              </tr>
            ) : (
              data.items.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onChanged={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div style={styles.pagination}>
          <button
            style={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span style={styles.pageInfo}>
            Page {page} of {totalPages} · {data.total} total
            {isFetching && ' · refreshing…'}
          </span>
          <button
            style={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function UserRow({
  user,
  onChanged,
}: {
  user: UsersResponse['items'][number]
  onChanged: () => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)

  // Note on RPC: these handlers read their JSON body via `c.req.json<T>()`
  // instead of a `zValidator`, so hono/client can't infer the body shape.
  // We fall back to plain fetch for mutations. The list query still uses
  // the typed `api` client, which demonstrates the happy path for GETs.
  const setPasswordMut = useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? 'Failed')
      }
      return res.json()
    },
    onSuccess: () => {
      setShowPassword(false)
      setNewPassword('')
      setPwError(null)
    },
    onError: (err: Error) => setPwError(err.message),
  })

  const setRoleMut = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error('Failed to update role')
      return res.json()
    },
    onSuccess: onChanged,
  })

  // Multipart uploads don't round-trip cleanly through hono/client RPC types
  // yet, so we use plain fetch for this one endpoint.
  const uploadImageMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/image`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Upload failed')
      return res.json()
    },
    onSuccess: onChanged,
  })

  return (
    <>
      <tr style={styles.tr}>
        <td style={styles.td}>
          <div style={styles.userCell}>
            <label style={styles.avatarLabel}>
              {user.image ? (
                <img
                  src={user.image.startsWith('/') ? `${API_BASE}${user.image}` : user.image}
                  alt={user.name}
                  style={styles.avatarImg}
                />
              ) : (
                <div style={styles.avatarFallback}>
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadImageMut.mutate(f)
                }}
              />
            </label>
            <span>{user.name}</span>
          </div>
        </td>
        <td style={styles.td}>{user.email}</td>
        <td style={styles.td}>
          <select
            value={user.role ?? 'member'}
            onChange={(e) => setRoleMut.mutate(e.target.value)}
            style={styles.select}
            disabled={setRoleMut.isPending}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </td>
        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {user.mbUsed.toFixed(2)} MB
        </td>
        <td style={styles.td}>{new Date(user.createdAt).toLocaleDateString()}</td>
        <td style={styles.td}>
          <button
            style={styles.actionBtn}
            onClick={() => setShowPassword((v) => !v)}
          >
            Set password
          </button>
        </td>
      </tr>
      {showPassword && (
        <tr>
          <td colSpan={6} style={{ ...styles.td, background: '#f9fafb' }}>
            <div style={styles.pwForm}>
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.pwInput}
              />
              <button
                style={styles.actionBtn}
                disabled={setPasswordMut.isPending || newPassword.length < 8}
                onClick={() => setPasswordMut.mutate(newPassword)}
              >
                {setPasswordMut.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                style={{ ...styles.actionBtn, background: '#fff', color: '#374151' }}
                onClick={() => {
                  setShowPassword(false)
                  setNewPassword('')
                  setPwError(null)
                }}
              >
                Cancel
              </button>
              {pwError && <span style={{ color: '#b91c1c', fontSize: 13 }}>{pwError}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 },
  search: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    minWidth: 260,
  },
  refreshBanner: {
    width: '100%',
    padding: '10px 14px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 6,
    color: '#1e40af',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 12,
  },
  error: {
    padding: 12,
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 6,
    marginBottom: 12,
  },
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    background: '#f9fafb',
    color: '#6b7280',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e5e7eb',
  },
  tr: { borderTop: '1px solid #e5e7eb' },
  td: { padding: '12px 16px', color: '#111827', verticalAlign: 'middle' as const },
  empty: { padding: 24, textAlign: 'center' as const, color: '#6b7280' },
  userCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatarLabel: { cursor: 'pointer' },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    objectFit: 'cover' as const,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#e5e7eb',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 600,
  },
  select: {
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 13,
    background: '#fff',
  },
  actionBtn: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 13,
    background: '#111827',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 500,
  },
  pwForm: { display: 'flex', alignItems: 'center', gap: 8 },
  pwInput: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 13,
    minWidth: 260,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  pageBtn: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  pageInfo: { color: '#6b7280', fontSize: 13 },
}
