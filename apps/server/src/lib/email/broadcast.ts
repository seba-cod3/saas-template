import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { user } from '../../db/schema/index.js'
import { doLater } from '../../lib/queue.js'

export interface SendNewsParams {
  subject: string
  html: string
  text?: string
  /** When true, only sends to users that have verified their email address. */
  onlyVerified?: boolean
}

/**
 * Enqueues one `send-email` job per matching user.
 * Returns the number of jobs queued.
 */
export async function sendNews(params: SendNewsParams): Promise<number> {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(params.onlyVerified ? eq(user.emailVerified, true) : undefined)

  for (const row of rows) {
    await doLater('send-email', {
      to: row.email,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
  }

  return rows.length
}
