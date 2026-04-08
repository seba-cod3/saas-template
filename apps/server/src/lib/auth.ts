import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { AUTH } from '@repo/shared/auth'
import { db } from '../db/index.js'
import * as authSchema from '../db/schema/auth-schema.js'

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
