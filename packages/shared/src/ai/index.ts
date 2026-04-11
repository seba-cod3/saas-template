import { z } from 'zod';

// ─── Provider ───────────────────────────────────────────────────────────────

export const AI_PROVIDERS = ['openai', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const modelCatalogItemSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string(),
  enabled: z.boolean(),
});
export type ModelCatalogItem = z.infer<typeof modelCatalogItemSchema>;

// ─── Conversation ─────────────────────────────────────────────────────────────

export const createConversationSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().min(1),
  title: z.string().max(255).optional(),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const listConversationsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;

export const conversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.enum(AI_PROVIDERS),
  model: z.string(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

// ─── Messages ──────────────────────────────────────────────────────────────────

/**
 * The body shape for the POST /api/ai/conversations/:id/messages endpoint.
 * is an array of UIMessage objects from the AI SDK v5.
 * This is permissive typing in Zod, the real type is imported from 'ai' in server/web directly.
 */
export const sendMessageSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ─── Usage Event ───────────────────────────────────────────────────────────────

export const usageEventSchema = z.object({
  userId: z.string(),
  conversationId: z.string(),
  assistantMessageId: z.string(),
  provider: z.enum(AI_PROVIDERS),
  model: z.string(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  finishReason: z.string(),
  toolCount: z.number().int().nonnegative().default(0),
  attachmentCount: z.number().int().nonnegative().default(0),
  createdAt: z.date(),
});
export type UsageEvent = z.infer<typeof usageEventSchema>;
