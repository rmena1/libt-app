import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.ts'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/libt_app'

let dbSingleton: ReturnType<typeof createDb> | null = null

function createDb() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
  })

  return drizzle(pool, { schema })
}

export function getDb() {
  dbSingleton ??= createDb()
  return dbSingleton
}

export const db = getDb()

export * from './schema.ts'

