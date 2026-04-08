import { createFileRoute } from '@tanstack/react-router'

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
    </div>
  )
}
