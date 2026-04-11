import type { UIMessage } from 'ai'
import { generateId } from 'ai'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiConversation, aiMessage, aiStream } from '../../db/schema/index.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  userId: string
  provider: string
  model: string
  title: string
  organizationId: string | null
}

// ─── Conversation ──────────────────────────────────────────────────────────────

/**
 * Load a conversation and validate ownership.
 * Throws 404-style error if not found or not owned by the given user.
 */
export async function loadConversation(id: string, userId: string): Promise<Conversation> {
  const rows = await db
    .select()
    .from(aiConversation)
    .where(and(eq(aiConversation.id, id), eq(aiConversation.userId, userId)))
    .limit(1)

  if (rows.length === 0) {
    const err = new Error('Conversation not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }

  const row = rows[0]!
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    model: row.model,
    title: row.title,
    organizationId: row.organizationId,
  }
}

export async function createConversation(params: {
  userId: string
  provider: string
  model: string
  title?: string
  organizationId?: string | null
}): Promise<Conversation> {
  const id = generateId()
  const title = params.title ?? 'New conversation'

  await db.insert(aiConversation).values({
    id,
    userId: params.userId,
    provider: params.provider,
    model: params.model,
    title,
    organizationId: params.organizationId ?? null,
  })

  return { id, userId: params.userId, provider: params.provider, model: params.model, title, organizationId: params.organizationId ?? null }
}

export async function listConversations(userId: string, limit: number, cursor?: string) {
  const rows = await db
    .select({
      id: aiConversation.id,
      title: aiConversation.title,
      provider: aiConversation.provider,
      model: aiConversation.model,
      lastMessageAt: aiConversation.lastMessageAt,
      createdAt: aiConversation.createdAt,
    })
    .from(aiConversation)
    .where(
      cursor
        ? and(eq(aiConversation.userId, userId), eq(aiConversation.archivedAt, null as unknown as Date))
        : and(eq(aiConversation.userId, userId), eq(aiConversation.archivedAt, null as unknown as Date)),
    )
    .orderBy(asc(aiConversation.createdAt))
    .limit(limit + 1)

  const hasNextPage = rows.length > limit
  const items = hasNextPage ? rows.slice(0, limit) : rows
  const nextCursor = hasNextPage ? items[items.length - 1]?.id : undefined

  return {
    items: items.map((r) => ({
      id: r.id,
      title: r.title,
      provider: r.provider,
      model: r.model,
      lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
    hasNextPage,
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function loadHistory(conversationId: string): Promise<UIMessage[]> {
  const rows = await db
    .select({
      id: aiMessage.id,
      role: aiMessage.role,
      parts: aiMessage.parts,
      metadata: aiMessage.metadata,
    })
    .from(aiMessage)
    .where(eq(aiMessage.conversationId, conversationId))
    .orderBy(asc(aiMessage.createdAt))

  return rows.map((r) => ({
    id: r.id,
    role: r.role as UIMessage['role'],
    parts: r.parts as UIMessage['parts'],
    metadata: r.metadata as UIMessage['metadata'],
  }))
}

export async function persistUserMessage(conversationId: string, message: UIMessage): Promise<void> {
  await db.insert(aiMessage).values({
    id: message.id ?? generateId(),
    conversationId,
    role: message.role,
    parts: message.parts as object,
    metadata: message.metadata as object ?? null,
    status: 'complete',
  })

  await db
    .update(aiConversation)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(aiConversation.id, conversationId))
}

export async function persistAssistantMessage(
  conversationId: string,
  message: UIMessage,
): Promise<string> {
  const id = message.id ?? generateId()

  await db.insert(aiMessage).values({
    id,
    conversationId,
    role: 'assistant',
    parts: message.parts as object,
    metadata: message.metadata as object ?? null,
    status: 'complete',
    completedAt: new Date(),
  })

  await db
    .update(aiConversation)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(aiConversation.id, conversationId))

  return id
}

// ─── Streams ──────────────────────────────────────────────────────────────────

export async function appendStreamId(conversationId: string, streamId: string): Promise<void> {
  await db.insert(aiStream).values({ id: streamId, conversationId })
}

export async function loadStreamIds(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ id: aiStream.id })
    .from(aiStream)
    .where(eq(aiStream.conversationId, conversationId))
    .orderBy(asc(aiStream.createdAt))

  return rows.map((r) => r.id)
}
