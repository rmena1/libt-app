import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:55432/libt_app'

export function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.join(ROOT, filename)
    if (!fs.existsSync(filePath)) continue

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue

      const key = trimmed.slice(0, separatorIndex).trim()
      const rawValue = trimmed.slice(separatorIndex + 1).trim()
      if (!key || process.env[key] !== undefined) continue

      process.env[key] = rawValue.replace(/^["']|["']$/g, '')
    }
  }
}

export function getDatabaseUrl() {
  loadEnv()
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL
}

export function hasExplicitDatabaseUrl() {
  loadEnv()
  return process.env.DATABASE_URL !== undefined
}

export function getDefaultDatabaseUrl() {
  return DEFAULT_DATABASE_URL
}

export function getSeedActiveUser() {
  loadEnv()
  return {
    email: process.env.SEED_ACTIVE_USER_EMAIL || 'active@example.com',
    password: process.env.SEED_ACTIVE_USER_PASSWORD || 'password123',
  }
}
