import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, userPreferences, users } from '@/lib/db'
import { createSession, hashPassword, registerSchema } from '@/lib/auth'
import { generateId } from '@/lib/shared/id'

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid registration payload' }, { status: 400 })
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const now = Date.now()
  const userId = generateId()
  const passwordHash = await hashPassword(parsed.data.password)

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email: parsed.data.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(userPreferences).values({
      userId,
      updatedAt: now,
    })
  })

  await createSession(userId)

  return NextResponse.json({ user: { id: userId, email: parsed.data.email } }, { status: 201 })
}

