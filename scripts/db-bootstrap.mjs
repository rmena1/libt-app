import { isMain, runScript } from './db-utils.mjs'
import { setupDatabase } from './db-setup.mjs'

export async function bootstrapDatabase() {
  await setupDatabase()
  runScript('db:migrate')
  runScript('db:seed')
}

if (isMain(import.meta.url)) {
  bootstrapDatabase().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
