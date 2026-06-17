import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from './lib/auth/constants'

const PUBLIC_PATHS = new Set(['/login', '/register'])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/favicon.ico' || pathname === '/manifest.json') return true
  return false
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()

  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (sessionId) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
}
