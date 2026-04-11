import {
  JsonToSseTransformStream,
  UI_MESSAGE_STREAM_HEADERS,
  convertToModelMessages,
  createUIMessageStream,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db } from '../db/index.js'
import { requireAuth } from '../lib/middleware/require-role.js'
import { toPublicCatalog, getEntry } from '../lib/ai/catalog.js'
import * as chatService from '../lib/ai/chat-service.js'
import { resolveModel } from '../lib/ai/resolve-model.js'
import { streamContext } from '../lib/ai/stream-context.js'
import { buildTools } from '../lib/ai/tools.js'
import { writeUsage } from '../lib/ai/usage-sink.js'
import type { AiProvider } from '../lib/ai/types.js'

const aiRoutes = new Hono()

// All AI routes require authentication (any role)
aiRoutes.use('*', requireAuth())

// ─── Models ───────────────────────────────────────────────────────────────────

aiRoutes.get('/models', (c) => {
  return c.json(toPublicCatalog())
})

// ─── Conversations ────────────────────────────────────────────────────────────

aiRoutes.get('/conversations', async (c) => {
  const user = c.get('sessionUser')
  const limit = Math.min(Number(c.req.query('limit') ?? '20'), 100)
  const cursor = c.req.query('cursor')

  const result = await chatService.listConversations(user.id, limit, cursor)
  return c.json(result)
})

aiRoutes.post('/conversations', async (c) => {
  const user = c.get('sessionUser')
  const body = await c.req.json<{ provider: AiProvider; model: string; title?: string }>()

  const entry = getEntry(body.provider, body.model)
  if (!entry || !entry.enabled) {
    throw new HTTPException(400, { message: 'Invalid or disabled model' })
  }

  const conversation = await chatService.createConversation({
    userId: user.id,
    provider: body.provider,
    model: body.model,
    title: body.title,
    organizationId: user.organizationId ?? null,
  })

  return c.json(conversation, 201)
})

aiRoutes.get('/conversations/:id', async (c) => {
  const user = c.get('sessionUser')
  const conversation = await chatService.loadConversation(c.req.param('id'), user.id)
  return c.json(conversation)
})

aiRoutes.get('/conversations/:id/messages', async (c) => {
  const user = c.get('sessionUser')
  // Validate ownership
  await chatService.loadConversation(c.req.param('id'), user.id)

  const messages = await chatService.loadHistory(c.req.param('id'))
  return c.json(messages)
})

// ─── Streaming ────────────────────────────────────────────────────────────────

aiRoutes.post('/conversations/:id/messages', async (c) => {
  const conversationId = c.req.param('id')
  const user = c.get('sessionUser')
  const body = await c.req.json<{ messages: UIMessage[] }>()

  // 1) Validate ownership and load conversation (provider + model fixed to row)
  const conversation = await chatService.loadConversation(conversationId, user.id)

  // 2) Persist the last user message BEFORE calling the provider
  const lastUserMessage = body.messages.at(-1)
  if (lastUserMessage?.role === 'user') {
    await chatService.persistUserMessage(conversationId, lastUserMessage)
  }

  // 3) Create streamId and register it for resume
  const streamId = generateId()
  await chatService.appendStreamId(conversationId, streamId)

  // 4) Capture usage via mutable closure (streamText.onFinish → createUIMessageStream.onFinish)
  let usageCapture: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    finishReason: string
    toolCount: number
  } | null = null

  const startedAt = Date.now()

  // 5) Build the UI message stream
  const uiStream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: resolveModel(conversation.provider as AiProvider, conversation.model),
        system: 'You are a helpful assistant.',
        messages: convertToModelMessages(body.messages),
        tools: buildTools({ userId: user.id, db }),
        stopWhen: stepCountIs(5), // cap tool-call loops
        abortSignal: c.req.raw.signal,
        onFinish: (event) => {
          usageCapture = {
            promptTokens: event.totalUsage.inputTokens ?? 0,
            completionTokens: event.totalUsage.outputTokens ?? 0,
            totalTokens: event.totalUsage.totalTokens ?? 0,
            finishReason: String(event.finishReason),
            toolCount: Object.keys(event.toolCalls ?? {}).length,
          }
        },
      })

      // consumeStream() without await so onFinish runs even if client disconnects
      result.consumeStream()
      writer.merge(result.toUIMessageStream())
    },
    onError: (error) => {
      console.error('[ai.stream]', error)
      return 'Stream error — please retry'
    },
    onFinish: async ({ responseMessage }) => {
      const assistantMessageId = await chatService.persistAssistantMessage(
        conversationId,
        responseMessage,
      )

      if (usageCapture) {
        await writeUsage({
          userId: user.id,
          conversationId,
          assistantMessageId,
          provider: conversation.provider as AiProvider,
          model: conversation.model,
          promptTokens: usageCapture.promptTokens,
          completionTokens: usageCapture.completionTokens,
          totalTokens: usageCapture.totalTokens,
          estimatedCostUsd: 0, // computed inside writeUsage from catalog
          latencyMs: Date.now() - startedAt,
          finishReason: usageCapture.finishReason,
          toolCount: usageCapture.toolCount,
          attachmentCount: 0,
          createdAt: new Date(),
        })
      }
    },
  })

  // 6) Pipe through SSE transform and wrap in resumable stream
  const sseStream = uiStream.pipeThrough(new JsonToSseTransformStream())
  const resumable = await streamContext.resumableStream(streamId, () => sseStream)

  if (!resumable) {
    // Stream already completed (race condition) — return 204
    return new Response(null, { status: 204 })
  }

  return new Response(resumable, { headers: UI_MESSAGE_STREAM_HEADERS })
})

// ─── Resume ───────────────────────────────────────────────────────────────────

aiRoutes.get('/conversations/:id/stream', async (c) => {
  const conversationId = c.req.param('id')
  const user = c.get('sessionUser')

  // Validate ownership
  await chatService.loadConversation(conversationId, user.id)

  const streamIds = await chatService.loadStreamIds(conversationId)
  const recentStreamId = streamIds.at(-1)
  if (!recentStreamId) return new Response(null, { status: 204 })

  const resumed = await streamContext.resumeExistingStream(recentStreamId)
  if (!resumed) return new Response(null, { status: 204 })

  return new Response(resumed, { headers: UI_MESSAGE_STREAM_HEADERS })
})

export { aiRoutes }
