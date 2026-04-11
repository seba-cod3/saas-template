/**
 * usage-sink — writeUsage persists ai_usage_event and upserts the monthly rollup.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateId } from 'ai'
import { db } from '../../db/index.js'
import {
  user,
  aiConversation,
  aiMessage,
  aiUsageEvent,
  userAiMonthlyUsage,
} from '../../db/schema/index.js'
import { writeUsage } from '../../lib/ai/usage-sink.js'
import { eq, inArray } from 'drizzle-orm'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const testUser = {
  id: `test-usage-user-${generateId()}`,
  name: 'Usage Test User',
  email: `usage-${generateId()}@test.example`,
  emailVerified: true as const,
}

const testConv = {
  id: generateId(),
  userId: testUser.id,
  provider: 'openai' as const,
  model: 'gpt-4o-mini',
  title: 'Test conversation',
}

const testMessage = {
  id: generateId(),
  conversationId: testConv.id,
  role: 'assistant',
  parts: [{ type: 'text', text: 'Hello!' }] as object,
  status: 'complete',
}

beforeAll(async () => {
  await db.insert(user).values(testUser)
  await db.insert(aiConversation).values(testConv)
  await db.insert(aiMessage).values(testMessage)
})

afterAll(async () => {
  await db.delete(aiUsageEvent).where(eq(aiUsageEvent.userId, testUser.id))
  await db.delete(userAiMonthlyUsage).where(eq(userAiMonthlyUsage.userId, testUser.id))
  await db.delete(aiMessage).where(eq(aiMessage.conversationId, testConv.id))
  await db.delete(aiConversation).where(eq(aiConversation.id, testConv.id))
  await db.delete(user).where(eq(user.id, testUser.id))
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('writeUsage', () => {
  it('inserts an ai_usage_event row', async () => {
    const event = {
      userId: testUser.id,
      conversationId: testConv.id,
      assistantMessageId: testMessage.id,
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0,
      latencyMs: 800,
      finishReason: 'stop',
      toolCount: 0,
      attachmentCount: 0,
      createdAt: new Date(),
    }

    await writeUsage(event)

    const rows = await db
      .select()
      .from(aiUsageEvent)
      .where(eq(aiUsageEvent.assistantMessageId, testMessage.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]!.promptTokens).toBe(100)
    expect(rows[0]!.completionTokens).toBe(50)
  })

  it('upserts the monthly rollup and accumulates on a second call', async () => {
    const event = {
      userId: testUser.id,
      conversationId: testConv.id,
      assistantMessageId: testMessage.id,
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      promptTokens: 200,
      completionTokens: 100,
      totalTokens: 300,
      estimatedCostUsd: 0,
      latencyMs: 500,
      finishReason: 'stop',
      toolCount: 0,
      attachmentCount: 0,
      createdAt: new Date(),
    }

    await writeUsage(event)
    await writeUsage(event) // second call — should accumulate

    const month = new Date()
    const monthStr = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}-01`

    const rows = await db
      .select()
      .from(userAiMonthlyUsage)
      .where(eq(userAiMonthlyUsage.userId, testUser.id))

    const row = rows.find((r) => r.month === monthStr)
    expect(row).toBeDefined()
    // requestCount increases each call
    expect(row!.requestCount).toBeGreaterThanOrEqual(2)
    // tokens are summed
    expect(row!.promptTokens).toBeGreaterThanOrEqual(400)
  })
})
