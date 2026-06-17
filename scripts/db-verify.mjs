import fs from 'node:fs'
import path from 'node:path'
import { getDatabaseUrl } from './env.mjs'
import { isMain, withClient } from './db-utils.mjs'
import { setupDatabase } from './db-setup.mjs'

export async function verifyDatabase() {
  await setupDatabase({ verifyOnly: true })

  const migrationFiles = fs
    .readdirSync(path.join(process.cwd(), 'drizzle'))
    .filter((file) => /^[0-9]+_.*\.sql$/.test(file))
    .sort()

  await withClient(getDatabaseUrl(), async (client) => {
    const migrationTable = await client.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'drizzle'
          AND table_name = '__drizzle_migrations'
      `,
    )

    if (migrationTable.rowCount === 0) {
      throw new Error('Drizzle migration table is missing. Run npm run db:migrate.')
    }

    const applied = await client.query('SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations')
    const appliedCount = Number(applied.rows[0]?.count ?? 0)

    if (appliedCount !== migrationFiles.length) {
      throw new Error(
        `Database migration count mismatch. Applied ${appliedCount}, expected ${migrationFiles.length}. Run npm run db:migrate.`,
      )
    }
  })

  console.log(`[db:verify] ${migrationFiles.length} migrations applied`)
}

if (isMain(import.meta.url)) {
  verifyDatabase().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
