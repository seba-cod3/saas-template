import { AUTH, DEFAULT_ROLE } from '@repo/shared/auth'
import { WS_CHANNELS } from '@repo/shared/ws'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db/index.js'
import * as authSchema from '../db/schema/auth-schema.js'
import { broadcast } from './ws.js'

const socialProviders: BetterAuthOptions['socialProviders'] = {}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: AUTH.password.minLength,
    maxPasswordLength: AUTH.password.maxLength,
  },
  session: {
    // Cookie cache: better-auth stores a signed copy of the session in a
    // cookie. While it's fresh, `auth.api.getSession()` verifies the
    // signature and returns data WITHOUT touching Postgres — so every
    // authenticated request through `requireRole` / any middleware that
    // resolves the session is effectively a crypto check, not a DB query.
    //
    // It's a cookie, not a server-side cache: no RAM cost, no Redis cost.
    // Tradeoff: the data is frozen for `maxAge` seconds. To invalidate
    // sooner we push `session.refresh` / `session.revoked` over WS (see
    // lib/session-ops.ts) and the frontend reacts via TanStack Query.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  socialProviders,
  trustedOrigins: [process.env.CORS_ORIGIN_FRONTEND || 'http://localhost:5173'],
  user: {
    additionalFields: {
      organizationId: {
        type: 'string',
        required: false,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: DEFAULT_ROLE,
        input: false, // clients cannot self-assign a role on signup
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          // Live feed for the admin dashboard.
          await broadcast(
            { channel: WS_CHANNELS.ADMINS },
            {
              type: 'user.created',
              user: {
                id: createdUser.id,
                name: createdUser.name,
                email: createdUser.email,
                createdAt:
                  createdUser.createdAt instanceof Date
                    ? createdUser.createdAt.toISOString()
                    : createdUser.createdAt,
              },
            },
          )
        },
      },
    },
  },
})
