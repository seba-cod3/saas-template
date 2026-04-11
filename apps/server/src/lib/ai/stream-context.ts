import { createResumableStreamContext } from 'resumable-stream/ioredis'
import { redis } from '../redis.js'

/**
 * Singleton resumable-stream context backed by ioredis.
 *
 * Uses a duplicated Redis connection as subscriber (required by pub/sub).
 * waitUntil is a no-op — in a long-lived Node process the event loop stays
 * alive naturally; no need for Vercel-style waitUntil semantics.
 */
export const streamContext = createResumableStreamContext({
  waitUntil: null,
  publisher: redis,
  subscriber: redis.duplicate(),
})
