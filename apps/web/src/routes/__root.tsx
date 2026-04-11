import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { AuthHeader } from '../components/auth-header'

// Router context shape — must match the `context` object passed to
// `createRouter` in main.tsx. Child routes access it via `context` in
// beforeLoad/loader.
export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div>
      <AuthHeader />
      <Outlet />
    </div>
  ),
})