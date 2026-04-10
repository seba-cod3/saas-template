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

    // Skip routes that read the raw Request body themselves (multipart /
    // streaming / better-auth handler).
    if (
      c.req.path.startsWith('/api/assets') ||
      c.req.path.startsWith('/api/auth') ||
      /^\/api\/admin\/users\/[^/]+\/image$/.test(c.req.path)
    ) {
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
    // Hono's type says string, but runtime #cachedBody expects a Promise
    ;(c.req.bodyCache as Record<string, unknown>).text = Promise.resolve(body)

    await next()
  }
}
