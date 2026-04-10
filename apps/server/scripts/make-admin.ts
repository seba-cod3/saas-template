import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { DEFAULT_ROLE, USER_ROLES, isUserRole, type UserRole } from '@repo/shared/auth'
import { db } from '../src/db/index.js'
import { user } from '../src/db/schema/auth-schema.js'

// Usage:
//   pnpm --filter server make-admin <email> [role]
//
//   pnpm --filter server make-admin you@example.com          # → admin
//   pnpm --filter server make-admin you@example.com member   # → demote
//
// Exits non-zero on any failure so it plays nicely in CI / provisioning.

async function main() {
  const [, , emailArg, roleArg] = process.argv

  if (!emailArg) {
    console.error('Error: email is required.')
    console.error(`Usage: pnpm --filter server make-admin <email> [${USER_ROLES.join('|')}]`)
    process.exit(1)
  }

  const role: UserRole = roleArg ? (roleArg as UserRole) : 'admin'

  if (!isUserRole(role)) {
    console.error(`Error: invalid role "${roleArg}".`)
    console.error(`Valid roles: ${USER_ROLES.join(', ')}`)
    process.exit(1)
  }

  const email = emailArg.trim().toLowerCase()

  const [existing] = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (!existing) {
    console.error(`Error: no user found with email "${email}".`)
    process.exit(1)
  }

  if (existing.role === role) {
    console.log(`User "${email}" already has role "${role}" — nothing to do.`)
    process.exit(0)
  }

  await db.update(user).set({ role }).where(eq(user.id, existing.id))

  console.log(
    `✓ Updated "${email}" (${existing.name}): ${existing.role ?? DEFAULT_ROLE} → ${role}`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
