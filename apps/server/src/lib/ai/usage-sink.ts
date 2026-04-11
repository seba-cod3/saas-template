import { sql } from 'drizzle-orm'
import type { UsageEvent } from '@repo/shared/ai'
import { db } from '../../db/index.js'
import { aiUsageEvent, userAiMonthlyUsage } from '../../db/schema/index.js'
import { getEntry } from './catalog.js'

/**
 * Persist a usage event:
 *  1) console.log for Railway/Fly log pickup
 *  2) INSERT into ai_usage_event (with raw jsonb for flexible analytics)
 *  3) UPSERT into user_ai_monthly_usage (running totals per user per month)
 */
export async function writeUsage(event: UsageEvent): Promise<void> {
  console.log('[ai.usage]', JSON.stringify(event))

  const catalogEntry = getEntry(event.provider, event.model)
  const estimatedCostUsd =
    catalogEntry
      ? (event.promptTokens / 1_000_000) * catalogEntry.pricing.promptPerMTokUsd +
        (event.completionTokens / 1_000_000) * catalogEntry.pricing.completionPerMTokUsd
      : 0

  const eventWithCost = { ...event, estimatedCostUsd }

  await db.insert(aiUsageEvent).values({
    id: crypto.randomUUID(),
    userId: event.userId,
    conversationId: event.conversationId,
    assistantMessageId: event.assistantMessageId,
    provider: event.provider,
    model: event.model,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    totalTokens: event.totalTokens,
    estimatedCostUsd: String(estimatedCostUsd),
    latencyMs: event.latencyMs,
    finishReason: event.finishReason,
    toolCount: event.toolCount,
    attachmentCount: event.attachmentCount,
    raw: eventWithCost,
    createdAt: event.createdAt,
  })

  const month = startOfMonthUtc(event.createdAt)

  await db
    .insert(userAiMonthlyUsage)
    .values({
      userId: event.userId,
      month: month.toISOString().slice(0, 10), // 'YYYY-MM-DD'
      requestCount: 1,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      estimatedCostUsd: String(estimatedCostUsd),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userAiMonthlyUsage.userId, userAiMonthlyUsage.month],
      set: {
        requestCount: sql`${userAiMonthlyUsage.requestCount} + 1`,
        promptTokens: sql`${userAiMonthlyUsage.promptTokens} + ${event.promptTokens}`,
        completionTokens: sql`${userAiMonthlyUsage.completionTokens} + ${event.completionTokens}`,
        totalTokens: sql`${userAiMonthlyUsage.totalTokens} + ${event.totalTokens}`,
        estimatedCostUsd: sql`${userAiMonthlyUsage.estimatedCostUsd} + ${estimatedCostUsd}`,
        updatedAt: new Date(),
      },
    })
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}
