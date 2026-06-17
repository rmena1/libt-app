import { NextResponse } from 'next/server'
import { registerSchema, registerUser } from '@/lib/auth'

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid registration payload', code: 'invalid_registration_payload' },
      { status: 400 },
    )
  }

  const result = await registerUser(parsed.data)

  if (result.status === 'email_already_registered') {
    return NextResponse.json(
      { error: 'Email already registered', code: result.code },
      { status: 409 },
    )
  }

  return NextResponse.json(
    { user: result.user, status: result.status },
    { status: 201 },
  )
}
