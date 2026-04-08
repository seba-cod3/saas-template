export const AUTH = {
  password: {
    minLength: 8,
    maxLength: 128,
  },
  name: {
    minLength: 1,
    maxLength: 100,
  },
} as const
