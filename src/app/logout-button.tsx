'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function logout() {
    setIsPending(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <button className="app-icon-button" disabled={isPending} onClick={logout} type="button">
      {isPending ? '...' : 'Salir'}
    </button>
  )
}
