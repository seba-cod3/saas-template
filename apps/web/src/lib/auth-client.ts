import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        organizationId: {
          type: 'string',
          required: false,
        },
        role: {
          type: 'string',
          required: false,
        },
      },
    }),
  ],
})
