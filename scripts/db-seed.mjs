import bcrypt from 'bcryptjs'
import { getDatabaseUrl, getSeedActiveUser } from './env.mjs'
import { isMain, withClient } from './db-utils.mjs'

const ACTIVE_USER_ID = 'seed-active-user'
const PASSWORD_SALT_ROUNDS = 12

export async function seedDatabase() {
  const now = Date.now()
  const activeUser = getSeedActiveUser()
  const passwordHash = await bcrypt.hash(activeUser.password, PASSWORD_SALT_ROUNDS)

  await withClient(getDatabaseUrl(), async (client) => {
    const result = await client.query(
      `
        INSERT INTO users (id, email, password_hash, is_active, timezone, created_at, updated_at)
        VALUES ($1, $2, $3, true, 'America/Santiago', $4, $4)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          is_active = true,
          timezone = EXCLUDED.timezone,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `,
      [ACTIVE_USER_ID, activeUser.email, passwordHash, now],
    )

    const userId = result.rows[0].id

    await client.query(
      `
        INSERT INTO user_preferences (user_id, dark_mode, updated_at)
        VALUES ($1, false, $2)
        ON CONFLICT (user_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
      `,
      [userId, now],
    )
  })

  console.log(`[db:seed] Seeded active user ${activeUser.email}`)
}

if (isMain(import.meta.url)) {
  seedDatabase().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
