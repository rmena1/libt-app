import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { createSession, loginSchema, verifyPassword } from '@/lib/auth'
import { checkRateLimit, clearRateLimit, recordFailedAttempt } from '@/lib/auth/rate-limit'

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid login payload' }, { status: 400 })
  }

  const rateLimitKey = `login:${parsed.data.email}`
  const rateLimit = checkRateLimit(rateLimitKey)
  if (rateLimit.blocked) {
    return NextResponse.json({ error: 'Too many login attempts', retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
  }

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)

  const user = result[0]
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    recordFailedAttempt(rateLimitKey)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  clearRateLimit(rateLimitKey)
  await createSession(user.id)

  return NextResponse.json({ user: { id: user.id, email: user.email } })
}

