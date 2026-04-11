import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { asset } from '../../db/schema/index.js'

interface ToolContext {
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>
}

/**
 * Factory that builds a per-request tool set scoped to the authenticated user.
 *
 * Pattern: userId is captured in closure — the model CANNOT spoof it via
 * the tool's inputSchema. Do NOT add userId to any tool's input schema.
 */
export function buildTools(ctx: ToolContext): ToolSet {
  return {
    listMyAssets: tool({
      description: "List the current user's uploaded assets (files, images, etc.)",
      inputSchema: z.object({
        kind: z
          .enum(['image', 'file'])
          .optional()
          .describe('Optional filter by asset kind'),
      }),
      execute: async ({ kind }) => {
        const rows = await ctx.db
          .select({
            id: asset.id,
            key: asset.key,
            contentType: asset.contentType,
            extension: asset.extension,
            size: asset.size,
            createdAt: asset.createdAt,
          })
          .from(asset)
          .where(eq(asset.userId, ctx.userId))

        if (kind) {
          const filtered = rows.filter((r) =>
            kind === 'image' ? r.contentType.startsWith('image/') : true,
          )
          return filtered
        }
        return rows
      },
    }),
  }
}
