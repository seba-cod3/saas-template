import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { session } = Route.useRouteContext()

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
