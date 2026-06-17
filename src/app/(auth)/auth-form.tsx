'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

type AuthMode = 'login' | 'register'

type AuthFormProps = {
  mode: AuthMode
}

type FormState =
  | { status: 'idle'; message: string | null }
  | { status: 'submitting'; message: string | null }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>({ status: 'idle', message: null })

  const isLogin = mode === 'login'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')

    setFormState({ status: 'submitting', message: null })

    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const payload = await response.json().catch(() => null) as { code?: string; status?: string } | null

    if (response.ok) {
      if (isLogin) {
        router.replace('/')
        router.refresh()
        return
      }

      setFormState({
        status: 'success',
        message: 'Registro recibido. Tu cuenta queda esperando admision.',
      })
      return
    }

    if (payload?.code === 'account_pending_admission') {
      setFormState({ status: 'error', message: 'Tu cuenta esta esperando admision.' })
      return
    }

    if (payload?.code === 'email_already_registered') {
      setFormState({ status: 'error', message: 'Ese email ya esta registrado.' })
      return
    }

    setFormState({
      status: 'error',
      message: isLogin ? 'Email o password incorrectos.' : 'No se pudo crear la cuenta.',
    })
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-kicker">libt</div>
        <h1 id="auth-title">{isLogin ? 'Entrar' : 'Crear cuenta'}</h1>
        <p className="auth-copy">
          {isLogin ? 'Acceso privado a tus bloques.' : 'Las cuentas nuevas quedan pendientes de admision.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              placeholder="tu@email.com"
              required
              type="email"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={isLogin ? 1 : 8}
              name="password"
              placeholder={isLogin ? 'Password' : 'Minimo 8 caracteres'}
              required
              type="password"
            />
          </label>

          <button disabled={formState.status === 'submitting'} type="submit">
            {formState.status === 'submitting' ? 'Procesando' : isLogin ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        {formState.message ? (
          <p
            className={formState.status === 'success' ? 'auth-message success' : 'auth-message error'}
            role="status"
          >
            {formState.message}
          </p>
        ) : null}

        <p className="auth-switch">
          {isLogin ? 'No tienes cuenta?' : 'Ya tienes cuenta?'}{' '}
          <Link href={isLogin ? '/register' : '/login'}>{isLogin ? 'Crear cuenta' : 'Entrar'}</Link>
        </p>
      </section>
    </div>
  )
}
