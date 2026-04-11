/**
 * buildTools — verifies per-user closure isolation.
 *
 * Creates two users with different assets, then checks that each
 * user's tool set only returns their own assets (not the other's).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateId } from 'ai'
import { db } from '../../db/index.js'
import { asset, user } from '../../db/schema/index.js'
import { buildTools } from '../../lib/ai/tools.js'
import { eq, inArray } from 'drizzle-orm'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const userA = {
  id: `test-user-a-${generateId()}`,
  name: 'User A',
  email: `usera-${generateId()}@test.example`,
  emailVerified: true as const,
}
const userB = {
  id: `test-user-b-${generateId()}`,
  name: 'User B',
  email: `userb-${generateId()}@test.example`,
  emailVerified: true as const,
}

const assetA = {
  id: generateId(),
  key: `test/asset-a-${generateId()}.txt`,
  userId: userA.id,
  contentType: 'text/plain',
  extension: 'txt',
  size: 100,
}
const assetB = {
  id: generateId(),
  key: `test/asset-b-${generateId()}.txt`,
  userId: userB.id,
  contentType: 'text/plain',
  extension: 'txt',
  size: 200,
}

beforeAll(async () => {
  await db.insert(user).values([userA, userB])
  await db.insert(asset).values([assetA, assetB])
})

afterAll(async () => {
  await db.delete(asset).where(inArray(asset.id, [assetA.id, assetB.id]))
  await db.delete(user).where(inArray(user.id, [userA.id, userB.id]))
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildTools — isolation', () => {
  it("listMyAssets for user A only returns user A's assets", async () => {
    const tools = buildTools({ userId: userA.id, db })
    const result = await (tools.listMyAssets.execute as (args: { kind?: 'image' | 'file' }) => Promise<unknown[]>)({})
    const ids = (result as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(assetA.id)
    expect(ids).not.toContain(assetB.id)
  })

  it("listMyAssets for user B only returns user B's assets", async () => {
    const tools = buildTools({ userId: userB.id, db })
    const result = await (tools.listMyAssets.execute as (args: { kind?: 'image' | 'file' }) => Promise<unknown[]>)({})
    const ids = (result as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(assetB.id)
    expect(ids).not.toContain(assetA.id)
  })
})
