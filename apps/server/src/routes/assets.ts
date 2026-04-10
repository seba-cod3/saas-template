import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { db } from '../db/index.js'
import { asset } from '../db/schema/assets.js'
import { auth } from '../lib/auth.js'
import { getStorage } from '../lib/storage/index.js'
import { extractFile, getExtension } from '../lib/storage/helpers.js'

const maxSizeMB = Number(process.env.ASSET_MAX_SIZE_MB || 10)

async function requireUser(c: { req: { raw: Request } }) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }
  return session.user
}

// Chained definition — required for hono/client RPC type inference.
// Each .post/.get/.delete call returns a new app type; assigning the final
// chained expression to `assetRoutes` captures all routes in the type.
export const assetRoutes = new Hono()
  // Upload — requires auth, creates record in assets table
  .post(
    '/',
    bodyLimit({ maxSize: maxSizeMB * 1024 * 1024 }),
    async (c) => {
      const user = await requireUser(c)
      const file = await extractFile(c)

      const storage = await getStorage()
      const id = crypto.randomUUID()
      const extension = getExtension(file.name)
      const key = `${id}${extension}`

      const result = await storage.upload(key, file.stream(), {
        contentType: file.type,
        contentLength: file.size,
      })

      await db.insert(asset).values({
        id,
        key,
        userId: user.id,
        contentType: file.type,
        extension,
        size: result.size ?? file.size,
      })

      return c.json({ id, key, size: result.size }, 201)
    },
  )
  // Download — requires auth, pipes stream directly
  .get('/:key{.+}', async (c) => {
    await requireUser(c)

    const key = c.req.param('key')
    const storage = await getStorage()

    const exists = await storage.exists(key)
    if (!exists) {
      throw new HTTPException(404, { message: 'Asset not found' })
    }

    const result = await storage.download(key)

    return new Response(result.stream, {
      headers: {
        ...(result.contentType && { 'content-type': result.contentType }),
        ...(result.contentLength && { 'content-length': String(result.contentLength) }),
      },
    })
  })
  // Delete — requires auth + ownership
  .delete('/:key{.+}', async (c) => {
    const user = await requireUser(c)
    const key = c.req.param('key')

    const [record] = await db
      .select()
      .from(asset)
      .where(eq(asset.key, key))
      .limit(1)

    if (!record) {
      throw new HTTPException(404, { message: 'Asset not found' })
    }

    if (record.userId !== user.id) {
      throw new HTTPException(403, { message: 'You do not own this asset' })
    }

    const storage = await getStorage()
    await storage.delete(key)
    await db.delete(asset).where(eq(asset.key, key))

    return c.body(null, 204)
  })
