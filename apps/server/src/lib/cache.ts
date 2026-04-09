import { redis } from './redis.js'

/**
 * Cache the result of an async function in Redis with a TTL.
 *
 * Usage:
 *   const users = await cached('heavy-query:active-users', 60, async () => {
 *     return db.select().from(users).where(eq(users.active, true))
 *   })
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(`cache:${key}`)
  if (hit) return JSON.parse(hit) as T

  const result = await fn()
  await redis.set(`cache:${key}`, JSON.stringify(result), 'EX', ttlSeconds)
  return result
}

/**
 * Invalidate a cached key.
 */
export async function invalidate(key: string): Promise<void> {
  await redis.del(`cache:${key}`)
}
