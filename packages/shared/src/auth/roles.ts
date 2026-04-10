// Canonical role set for the template.
//
// Keep this list intentionally small. Extend it per project if you need
// finer-grained access (e.g. 'moderator', 'client', 'billing-admin').
// Any role in BACKOFFICE_ROLES can reach the admin dashboard; within it
// you can gate individual actions with more specific checks.
export const USER_ROLES = ['admin', 'member'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const DEFAULT_ROLE: UserRole = 'member'

export const BACKOFFICE_ROLES: readonly UserRole[] = ['admin'] as const

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

export function isAdmin(role?: string | null): boolean {
  return role === 'admin'
}

export function canAccessBackoffice(role?: string | null): boolean {
  return !!role && (BACKOFFICE_ROLES as readonly string[]).includes(role)
}
