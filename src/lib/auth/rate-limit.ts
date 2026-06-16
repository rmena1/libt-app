interface RateLimitEntry {
  count: number
  firstAttempt: number
  blockedUntil: number | null
}

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const BLOCK_DURATION_MS = 15 * 60 * 1000

const store = new Map<string, RateLimitEntry>()

export function checkRateLimit(key: string, now = Date.now()): { blocked: false } | { blocked: true; retryAfterMs: number } {
  const entry = store.get(key)
  if (!entry) return { blocked: false }

  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { blocked: true, retryAfterMs: entry.blockedUntil - now }
  }

  if (entry.blockedUntil || now - entry.firstAttempt > WINDOW_MS) {
    store.delete(key)
  }

  return { blocked: false }
}

export function recordFailedAttempt(key: string, now = Date.now()): boolean {
  const entry = store.get(key)

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    store.set(key, { count: 1, firstAttempt: now, blockedUntil: null })
    return false
  }

  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_DURATION_MS
    return true
  }

  return false
}

export function clearRateLimit(key: string): void {
  store.delete(key)
}

