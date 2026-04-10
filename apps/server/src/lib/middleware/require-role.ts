import type { UserRole } from '@repo/shared/auth'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { auth } from '../auth.js'

type SessionUser = {
  id: string
  email: string
  name: string
  role?: string | null
  organizationId?: string | null
}

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

declare module 'hono' {
  interface ContextVariableMap {
    session: NonNullable<Session>
    sessionUser: SessionUser
  }
}

/**
 * Gate a route (or sub-router) by role.
 *
 *   app.use('/admin/*', requireRole(['admin']))
 *
 * Resolves the session once, stores it on the context under `session` /
 * `sessionUser` so downstream handlers don't need to re-fetch it.
 * Throws 401 when unauthenticated, 403 when the role doesn't match.
 */
export function requireRole(allowed: readonly UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    const role = (session.user as SessionUser).role
    if (!role || !(allowed as readonly string[]).includes(role)) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    c.set('session', session)
    c.set('sessionUser', session.user as SessionUser)
    await next()
  }
}
