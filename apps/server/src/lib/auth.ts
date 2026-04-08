import { betterAuth } from 'better-auth'
import type { BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { AUTH } from '@repo/shared/auth'
import { db } from '../db/index.js'
import * as authSchema from '../db/schema/auth-schema.js'

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
        defaultValue: 'member',
      },
    },
  },
})
