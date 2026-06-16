import { zeroDrizzle } from '@rocicorp/zero/server/adapters/drizzle'
import { db } from '@/lib/db'
import { schema } from './schema'

export const dbProvider = zeroDrizzle(schema, db)

