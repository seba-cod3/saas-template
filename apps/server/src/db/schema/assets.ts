import { relations } from 'drizzle-orm'
import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth-schema.js'

export const asset = pgTable(
  'asset',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull(),
    extension: text('extension').notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('asset_userId_idx').on(table.userId),
    index('asset_key_idx').on(table.key),
  ],
)

export const assetRelations = relations(asset, ({ one }) => ({
  user: one(user, {
    fields: [asset.userId],
    references: [user.id],
  }),
}))
