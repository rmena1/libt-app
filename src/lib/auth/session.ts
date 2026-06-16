import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt, lt } from 'drizzle-orm'
import { db, sessions, users } from '@/lib/db'
import { generateId } from '@/lib/shared/id'

export const SESSION_COOKIE_NAME = 'libt_session'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export interface SessionUser {
  id: string
  email: string
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = generateId()
  const expiresAt = Date.now() + SESSION_DURATION_MS

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(expiresAt),
    path: '/',
  })

  return sessionId
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!sessionId) return null

  const result = await db
    .select({
      userId: sessions.userId,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, Date.now())))
    .limit(1)

  if (result.length === 0) {
    try {
      cookieStore.delete(SESSION_COOKIE_NAME)
    } catch {}
    return null
  }

  return {
    id: result[0].userId,
    email: result[0].email,
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function cleanupExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()))
}

