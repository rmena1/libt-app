import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AuthForm } from '../auth-form'

export default async function RegisterPage() {
  const session = await getSession()
  if (session) redirect('/')

  return <AuthForm mode="register" />
}
