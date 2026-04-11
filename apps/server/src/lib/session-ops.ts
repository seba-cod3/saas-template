import { eq } from 'drizzle-orm'
import { WS_CHANNELS } from '@repo/shared/ws'
import type { SessionEvent } from '@repo/shared/ws'
import { db } from '../db/index.js'
import { session } from '../db/schema/auth-schema.js'
import { broadcast } from './ws.js'

/**
 * Soft invalidation: tell the user's open tabs to refetch their session.
 *
 * Used when we want the frontend to see a change ASAP (e.g. after a
 * profile update) WITHOUT forcing a logout. Note: if the server-side
 * cookie cache is still fresh, the refetch may still return stale data
 * until `session.cookieCache.maxAge` expires. For hard guarantees use
 * `revokeUserSessions()` instead.
 */
export async function notifyUserSessionChanged(userId: string): Promise<void> {
  const payload: SessionEvent = { type: 'session.refresh' }
  await broadcast({ channel: WS_CHANNELS.USER, entityId: userId }, payload)
}

/**
 * Hard invalidation: delete all session rows for the user in DB, then
 * push a `session.revoked` event on their private channel. The frontend
 * reacts by calling `authClient.signOut()` (which wipes the cookie) and
 * redirecting to "/".
 *
 * This is the correct primitive for:
 *   - admin changes a user's role (we don't want stale role in cookie)
 *   - admin kicks a user out
 *   - user account deletion
 *
 * NOTE on cookie cache: even after deleting the DB row, the user's
 * signed cookie cache is still valid until `maxAge` — someone could
 * reload and briefly appear authenticated. The WS push is what closes
 * that window in practice, because the frontend signs them out before
 * they have a chance to reload. If an attacker has the cookie and
 * bypasses our frontend, they still get up to `maxAge` of grace. If
 * that's unacceptable for your app, lower `maxAge` or disable cookie
 * cache for sensitive routes.
 */
export async function revokeUserSessions(
  userId: string,
  reason?: string,
): Promise<void> {
  await db.delete(session).where(eq(session.userId, userId))
  const payload: SessionEvent = { type: 'session.revoked', reason }
  await broadcast({ channel: WS_CHANNELS.USER, entityId: userId }, payload)
}
