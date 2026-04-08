import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data) {
      throw redirect({ to: '/' })
    }
    return { session: session.data } // This is your Route Context values, use it to pass data to the children routes
  },
  component: () => <Outlet />,
})
