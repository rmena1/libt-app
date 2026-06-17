import { NextResponse } from 'next/server'
import { loginSchema, loginUser } from '@/lib/auth'
import { checkRateLimit, clearRateLimit, recordFailedAttempt } from '@/lib/auth/rate-limit'

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid login payload', code: 'invalid_login_payload' }, { status: 400 })
  }

  const rateLimitKey = `login:${parsed.data.email}`
  const rateLimit = checkRateLimit(rateLimitKey)
  if (rateLimit.blocked) {
    return NextResponse.json({ error: 'Too many login attempts', retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
  }

  const result = await loginUser(parsed.data)

  if (result.status === 'invalid_credentials') {
    recordFailedAttempt(rateLimitKey)
    return NextResponse.json({ error: 'Invalid email or password', code: result.code }, { status: 401 })
  }

  if (result.status === 'account_pending_admission') {
    clearRateLimit(rateLimitKey)
    return NextResponse.json({ error: 'Account pending admission', code: result.code }, { status: 403 })
  }

  clearRateLimit(rateLimitKey)

  return NextResponse.json({ user: result.user })
}
