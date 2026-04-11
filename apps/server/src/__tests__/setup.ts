import 'dotenv/config'

// Tests require DATABASE_URL and REDIS_URL to be set.
// Copy apps/server/.env.example to apps/server/.env and fill in the values.
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for tests. Copy .env.example → .env and fill in the values.',
  )
}
