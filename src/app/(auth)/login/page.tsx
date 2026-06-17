import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AuthForm } from '../auth-form'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/')

  return <AuthForm mode="login" />
}
