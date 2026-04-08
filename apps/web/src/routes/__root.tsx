import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthHeader } from '../components/auth-header'

export const Route = createRootRoute({
  component: () => (
    <div>
      <AuthHeader />
      <Outlet />
    </div>
  ),
})