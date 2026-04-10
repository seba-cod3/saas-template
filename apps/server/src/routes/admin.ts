import { AUTH, isUserRole, USER_ROLES, type UserRole } from '@repo/shared/auth'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import crypto from 'node:crypto'
import { db } from '../db/index.js'
import { asset } from '../db/schema/assets.js'
import { user } from '../db/schema/auth-schema.js'
import { auth } from '../lib/auth.js'
import { cached } from '../lib/cache.js'
import { requireRole } from '../lib/middleware/require-role.js'
import { redis } from '../lib/redis.js'
import { extractFile, getExtension } from '../lib/storage/helpers.js'
import { getStorage } from '../lib/storage/index.js'
import { getLocalWsStats } from '../lib/ws.js'

const USERS_CACHE_PREFIX = 'admin:users'
const USERS_CACHE_TTL = 10 // seconds — short, list is volatile
const MAX_PAGE_SIZE = 20
const HAS_NEXT_PAGE_OFFSET = 1

function usersCacheKey(params: { page: number; pageSize: number; q: string }) {
  return `${USERS_CACHE_PREFIX}:p${params.page}:s${params.pageSize}:q${params.q}`
}

async function invalidateUsersCache() {
  // Scan + DEL — tiny key space, fine for a template.
  const stream = redis.scanStream({ match: `cache:${USERS_CACHE_PREFIX}:*`, count: 100 })
  for await (const keys of stream as AsyncIterable<string[]>) {
    if (keys.length) await redis.del(...keys)
  }
}

// Chained definition — required for hono/client RPC type inference.
export const adminRoutes = new Hono()
  .use('*', requireRole(['admin']))

  // ── Users list ───────────────────────────────────────────────────────
  // Paginated + optional text filter over name/email.
  // MB used = SUM(asset.size) per user, joined in a single query.
  .get('/users', async (c) => {
    const page = Math.max(1, Number(c.req.query('page') ?? 1))
    const pageSizeRaw = Number(c.req.query('pageSize') ?? 20)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw))
    const q = (c.req.query('q') ?? '').trim()

    // If admin has organizationId allow multi-tenant administration.
    const userOrganizationId = c.get('sessionUser').organizationId ?? null

    const data = await cached(
      usersCacheKey({ page, pageSize, q }),
      USERS_CACHE_TTL,
      async () => {

        const baseWhere = userOrganizationId ? eq(user.organizationId, userOrganizationId) : undefined
        const additionalWhere = q
          ? or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`))
          : undefined

        const whereClause = and(baseWhere, additionalWhere)

        /**
         * @roadmap: Create a dedicated table for user_usage, can be use to store user storage + token usage + even emails sent, deprecate current implementation.
         * Rethink this, if you Services handles loads of files and need to measure, create a dedicated table for it.
         * Don't use sum in production with a Service that handles user's loading files.
         */
        const bytesUsed = sql<number>`COALESCE(SUM(${asset.size}), 0)`.as('bytes_used')

        const rows = await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image,
            createdAt: user.createdAt,
            bytesUsed,
          })
          .from(user)
          .leftJoin(asset, eq(asset.userId, user.id))
          .where(whereClause)
          .groupBy(user.id)
          .orderBy(desc(user.createdAt))
          .limit(pageSize + HAS_NEXT_PAGE_OFFSET)
          .offset((page - 1) * pageSize)

        /**
         * @roadmap: Create a dedicated table for it, deprecate current implementation
         */
        const [{ total }] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(user)
          .where(whereClause)

        // Dynamo-like pagination, create a dedicated table to store amount of users per organization if you need to know the total pages/items.
        const hasNextPage = rows.length > pageSize

        return {
          page,
          pageSize,
          total: Number(total),
          hasNextPage,
          items: rows.map((r) => ({
            ...r,
            createdAt:
              r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
            bytesUsed: Number(r.bytesUsed),
            mbUsed: Number(r.bytesUsed) / (1024 * 1024),
          })),
        }
      },
    )

    return c.json(data)
  })

  // ── Override user password ───────────────────────────────────────────
  // Goes through better-auth's internal adapter so the hash matches its
  // format. Requires admin role (the middleware already enforced it).
  .post('/users/:id/password', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ newPassword?: unknown }>()

    if (typeof body.newPassword !== 'string') {
      throw new HTTPException(400, { message: 'newPassword is required' })
    }
    if (body.newPassword.length < AUTH.password.minLength) {
      throw new HTTPException(400, {
        message: `Password must be at least ${AUTH.password.minLength} characters`,
      })
    }
    if (body.newPassword.length > AUTH.password.maxLength) {
      throw new HTTPException(400, {
        message: `Password must be at most ${AUTH.password.maxLength} characters`,
      })
    }

    const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1)
    if (!target) {
      throw new HTTPException(404, { message: 'User not found' })
    }

    const ctx = await auth.$context
    const hashed = await ctx.password.hash(body.newPassword)
    await ctx.internalAdapter.updatePassword(id, hashed)

    return c.json({ ok: true })
  })

  // ── Change user photo ────────────────────────────────────────────────
  // Uses the same storage pipeline as /api/assets, but the asset belongs
  // to the *admin* that uploaded it (so ownership/quota stays sane). If you want to allow admins to "fix user avatar" change ownership
  // The public URL is written to user.image.
  .post('/users/:id/image', async (c) => {
    const id = c.req.param('id')
    const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1)
    if (!target) {
      throw new HTTPException(404, { message: 'User not found' })
    }

    const file = await extractFile(c)
    if (!file.type.startsWith('image/')) {
      throw new HTTPException(400, { message: 'File must be an image' })
    }

    const storage = await getStorage()
    const assetId = crypto.randomUUID()
    const extension = getExtension(file.name)
    const key = `${assetId}${extension}`

    const admin = c.get('sessionUser')

    const result = await storage.upload(key, file.stream(), {
      contentType: file.type,
      contentLength: file.size,
    })

    try {
      await db.insert(asset).values({
        id: assetId,
        key,
        userId: admin.id,
        contentType: file.type,
        extension,
        size: result.size ?? file.size,
      })

      const imageUrl = `/api/assets/${key}`
      await db.update(user).set({ image: imageUrl }).where(eq(user.id, id))

      await invalidateUsersCache()

      return c.json({ ok: true, image: imageUrl })
    } catch (error) {
      await storage.delete(key)
      throw new HTTPException(500, { message: 'Failed to upload image', cause: error })
    }

  })

  // ── Change user role ─────────────────────────────────────────────────
  .patch('/users/:id/role', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ role?: unknown }>()

    if (!isUserRole(body.role)) {
      throw new HTTPException(400, {
        message: `role must be one of: ${USER_ROLES.join(', ')}`,
      })
    }

    const admin = c.get('sessionUser')
    if (admin.id === id && body.role !== 'admin') {
      throw new HTTPException(400, { message: 'You cannot demote yourself' })
    }

    const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1)
    if (!target) {
      throw new HTTPException(404, { message: 'User not found' })
    }

    await db
      .update(user)
      .set({ role: body.role as UserRole })
      .where(eq(user.id, id))

    await invalidateUsersCache()

    return c.json({ ok: true, role: body.role })
  })

  // ── Health dashboard ─────────────────────────────────────────────────
  // API is implicit (this handler answering = ok). Redis is probed via
  // PING. WS stats are local to this process — note the caveat.
  .get('/health', async (c) => {
    const redisStart = performance.now()
    let redisStatus: 'ok' | 'down' = 'ok'
    let redisLatencyMs = 0
    try {
      const pong = await redis.ping()
      redisLatencyMs = Math.round((performance.now() - redisStart) * 100) / 100
      if (pong !== 'PONG') redisStatus = 'down'
    } catch {
      redisStatus = 'down'
      redisLatencyMs = Math.round((performance.now() - redisStart) * 100) / 100
    }

    const dbStart = performance.now()
    let dbStatus: 'ok' | 'down' = 'ok'
    let dbLatencyMs = 0
    try {
      await db.execute(sql`select 1`)
      dbLatencyMs = Math.round((performance.now() - dbStart) * 100) / 100
    } catch {
      dbStatus = 'down'
      dbLatencyMs = Math.round((performance.now() - dbStart) * 100) / 100
    }

    const ws = getLocalWsStats()

    return c.json({
      api: { status: 'ok' as const },
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      redis: { status: redisStatus, latencyMs: redisLatencyMs },
      ws: {
        localClients: ws.clients,
        localSubscriptions: ws.subscriptions,
        note: 'Counts are per-process. Multi-instance deploys need a Redis-backed counter.',
      },
      timestamp: new Date().toISOString(),
    })
  })

