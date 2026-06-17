import { eq } from 'drizzle-orm'
import { db, userPreferences, users } from '@/lib/db'
import { generateId } from '@/lib/shared/id'
import { ACCOUNT_PENDING_ADMISSION_CODE, canAccessApp } from './admission'
import { hashPassword, verifyPassword } from './password'
import type { LoginInput, RegisterInput } from './schemas'
import { createSession } from './session'

export const INVALID_CREDENTIALS_CODE = 'invalid_credentials'
export const EMAIL_ALREADY_REGISTERED_CODE = 'email_already_registered'

export type PublicUser = {
  id: string
  email: string
}

export type RegisterUserResult =
  | { status: 'registered_pending_admission'; user: PublicUser }
  | { status: 'email_already_registered'; code: typeof EMAIL_ALREADY_REGISTERED_CODE }

export type LoginUserResult =
  | { status: 'authenticated'; user: PublicUser }
  | { status: 'invalid_credentials'; code: typeof INVALID_CREDENTIALS_CODE }
  | { status: 'account_pending_admission'; code: typeof ACCOUNT_PENDING_ADMISSION_CODE }

export async function registerUser(input: RegisterInput): Promise<RegisterUserResult> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  if (existing.length > 0) {
    return { status: 'email_already_registered', code: EMAIL_ALREADY_REGISTERED_CODE }
  }

  const now = Date.now()
  const userId = generateId()
  const passwordHash = await hashPassword(input.password)

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: input.email,
        passwordHash,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      })

      await tx.insert(userPreferences).values({
        userId,
        updatedAt: now,
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { status: 'email_already_registered', code: EMAIL_ALREADY_REGISTERED_CODE }
    }

    throw error
  }

  return {
    status: 'registered_pending_admission',
    user: { id: userId, email: input.email },
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === '23505') return true
  if ('cause' in error) return isUniqueViolation(error.cause)
  return false
}

export async function loginUser(input: LoginInput): Promise<LoginUserResult> {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  const user = result[0]
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    return { status: 'invalid_credentials', code: INVALID_CREDENTIALS_CODE }
  }

  if (!canAccessApp(user)) {
    return { status: 'account_pending_admission', code: ACCOUNT_PENDING_ADMISSION_CODE }
  }

  await createSession(user.id)

  return {
    status: 'authenticated',
    user: { id: user.id, email: user.email },
  }
}
