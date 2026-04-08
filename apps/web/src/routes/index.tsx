import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <div>Loading...</div>

  return (
    <div>
      <h1>SaaS Template</h1>
      {session ? (
        <div>
          <p>Logged in as {session.user.name}</p>
          <a href="/dashboard">Go to Dashboard</a>
        </div>
      ) : (
        <div>
          <a href="/login">Login</a>
          {' | '}
          <a href="/register">Register</a>
        </div>
      )}
    </div>
  )
}