import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: '/' })
    }
  }, [isPending, session, navigate])

  if (isPending) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#6b7280' }}>
        Loading...
      </div>
    )
  }

  if (!session) return null

  return (
    <div style={{ padding: '32px 24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
        Dashboard
      </h1>
      <p style={{ fontSize: '16px', color: '#6b7280' }}>
        Welcome, {session.user.name}. Role: {session.user.role ?? 'member'}
      </p>
    </div>
  )
}
