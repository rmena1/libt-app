export const APP_TIMEZONE = 'America/Santiago'

export function nowMs(): number {
  return Date.now()
}

export function todayInAppTimezone(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE })
}

