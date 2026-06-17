import { getDatabaseUrl } from './env.mjs'
import { assertLocalDatabase, isMain, runScript, withClient } from './db-utils.mjs'
import { setupDatabase } from './db-setup.mjs'

export async function resetDatabase() {
  assertLocalDatabase()
  await setupDatabase()

  await withClient(getDatabaseUrl(), async (client) => {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await client.query('CREATE SCHEMA public')
    await client.query('GRANT ALL ON SCHEMA public TO public')
  })

  console.log('[db:reset] Dropped local app and migration schemas')

  runScript('db:migrate')
  runScript('db:seed')
}

if (isMain(import.meta.url)) {
  resetDatabase().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
