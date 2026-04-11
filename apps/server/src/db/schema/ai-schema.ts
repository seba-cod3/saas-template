import { relations } from 'drizzle-orm'
import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { asset } from './assets.js'
import { user } from './auth-schema.js'

// ─── ai_conversation ──────────────────────────────────────────────────────────

export const aiConversation = pgTable(
  'ai_conversation',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [index('ai_conv_userId_lastMsg_idx').on(table.userId, table.lastMessageAt)],
)

export const aiConversationRelations = relations(aiConversation, ({ one, many }) => ({
  user: one(user, { fields: [aiConversation.userId], references: [user.id] }),
  messages: many(aiMessage),
  streams: many(aiStream),
}))

// ─── ai_message ────────────────────────────────────────────────────────────────

export const aiMessage = pgTable(
  'ai_message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => aiConversation.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    parts: jsonb('parts').notNull(), // UIMessage['parts'] from AI SDK v5
    metadata: jsonb('metadata'), // UIMessage['metadata'] (latency, modelId, etc.)
    status: text('status').notNull(), // 'complete' | 'streaming' | 'error'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('ai_msg_convId_createdAt_idx').on(table.conversationId, table.createdAt)],
)

export const aiMessageRelations = relations(aiMessage, ({ one, many }) => ({
  conversation: one(aiConversation, {
    fields: [aiMessage.conversationId],
    references: [aiConversation.id],
  }),
  attachments: many(aiMessageAttachment),
  usageEvents: many(aiUsageEvent),
}))

// ─── ai_message_attachment ────────────────────────────────────────────────────

export const aiMessageAttachment = pgTable('ai_message_attachment', {
  id: text('id').primaryKey(),
  messageId: text('message_id')
    .notNull()
    .references(() => aiMessage.id, { onDelete: 'cascade' }),
  assetId: text('asset_id')
    .notNull()
    .references(() => asset.id, { onDelete: 'restrict' }),
  kind: text('kind').notNull(), // 'image' | 'file' | 'audio'
  mimeType: text('mime_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const aiMessageAttachmentRelations = relations(aiMessageAttachment, ({ one }) => ({
  message: one(aiMessage, {
    fields: [aiMessageAttachment.messageId],
    references: [aiMessage.id],
  }),
  asset: one(asset, {
    fields: [aiMessageAttachment.assetId],
    references: [asset.id],
  }),
}))

// ─── ai_stream ─────────────────────────────────────────────────────────────────

export const aiStream = pgTable('ai_stream', {
  id: text('id').primaryKey(), // streamId generated with generateId()
  conversationId: text('conversation_id')
    .notNull()
    .references(() => aiConversation.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const aiStreamRelations = relations(aiStream, ({ one }) => ({
  conversation: one(aiConversation, {
    fields: [aiStream.conversationId],
    references: [aiConversation.id],
  }),
}))

// ─── ai_usage_event ───────────────────────────────────────────────────────────

export const aiUsageEvent = pgTable(
  'ai_usage_event',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => aiConversation.id, {
      onDelete: 'set null',
    }),
    assistantMessageId: text('assistant_message_id').references(() => aiMessage.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),
    estimatedCostUsd: numeric('estimated_cost_usd', { precision: 12, scale: 6 }).notNull(),
    latencyMs: integer('latency_ms').notNull(),
    finishReason: text('finish_reason').notNull(),
    toolCount: integer('tool_count').notNull().default(0),
    attachmentCount: integer('attachment_count').notNull().default(0),
    raw: jsonb('raw').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('ai_usage_userId_createdAt_idx').on(table.userId, table.createdAt)],
)

export const aiUsageEventRelations = relations(aiUsageEvent, ({ one }) => ({
  user: one(user, { fields: [aiUsageEvent.userId], references: [user.id] }),
  conversation: one(aiConversation, {
    fields: [aiUsageEvent.conversationId],
    references: [aiConversation.id],
  }),
  assistantMessage: one(aiMessage, {
    fields: [aiUsageEvent.assistantMessageId],
    references: [aiMessage.id],
  }),
}))

// ─── user_ai_monthly_usage ────────────────────────────────────────────────────

export const userAiMonthlyUsage = pgTable(
  'user_ai_monthly_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    month: date('month').notNull(), // first day of the month UTC, e.g: '2026-04-01'
    requestCount: integer('request_count').notNull().default(0),
    promptTokens: bigint('prompt_tokens', { mode: 'number' }).notNull().default(0),
    completionTokens: bigint('completion_tokens', { mode: 'number' }).notNull().default(0),
    totalTokens: bigint('total_tokens', { mode: 'number' }).notNull().default(0),
    estimatedCostUsd: numeric('estimated_cost_usd', { precision: 14, scale: 6 })
      .notNull()
      .default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })],
)

export const userAiMonthlyUsageRelations = relations(userAiMonthlyUsage, ({ one }) => ({
  user: one(user, { fields: [userAiMonthlyUsage.userId], references: [user.id] }),
}))
