import type { Context, MiddlewareHandler } from 'hono'
import crypto from 'node:crypto'
import { redis } from '../redis.js'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const DEFAULT_TTL = 3

interface IdempotencyOptions {
  ttlSeconds?: number
  /** Extract a user identifier from the request to scope keys per user. */
  getUserId?: (c: Context) => string | null
}

function generateKey(
  method: string,
  url: string,
  body: string,
  userId: string | null,
): string {
  const payload = JSON.stringify({
    method: method.toUpperCase(),
    url,
    body,
    userId: userId ?? null,
  })
  const hashed = crypto.createHash('sha256').update(payload).digest('hex')
  return `idempotency:${hashed}`
}

export function idempotencyGuard(options: IdempotencyOptions = {}): MiddlewareHandler {
  const ttl = options.ttlSeconds ?? DEFAULT_TTL

  return async (c, next) => {
    if (!MUTATION_METHODS.has(c.req.method)) {
      return next()
    }

    const body = await c.req.text()
    const userId = options.getUserId?.(c) ?? null
    // Scope per user if authenticated, otherwise per IP
    const scope = userId ?? c.req.header('x-forwarded-for') ?? 'anonymous'
    const key = generateKey(c.req.method, c.req.url, body, scope)

    try {
      const isNew = await redis.set(key, '1', 'EX', ttl, 'NX')
      if (!isNew) {
        return c.json({ error: 'Duplicate request' }, 409)
      }
    } catch {
      // Redis down — fail open, let the request through
    }

    // Re-create the request body since we consumed it with .text()
    c.req.bodyCache.text = body

    await next()
  }
}
