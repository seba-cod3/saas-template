import { z } from 'zod'
import { AUTH } from './constants.js'

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Invalid email address')

export const passwordSchema = z
  .string()
  .min(AUTH.password.minLength, `Password must be at least ${AUTH.password.minLength} characters`)
  .max(AUTH.password.maxLength, `Password must be at most ${AUTH.password.maxLength} characters`)

export const nameSchema = z
  .string()
  .trim()
  .min(AUTH.name.minLength, 'Name is required')
  .max(AUTH.name.maxLength, `Name must be at most ${AUTH.name.maxLength} characters`)

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
