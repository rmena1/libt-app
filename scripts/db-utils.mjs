import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { getDatabaseUrl } from './env.mjs'

export function parseDatabaseUrl() {
  const url = new URL(getDatabaseUrl())
  const databaseName = url.pathname.replace(/^\//, '')
  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name')
  }

  return { url, databaseName }
}

export function getAdminDatabaseUrl() {
  const { url } = parseDatabaseUrl()
  url.pathname = '/postgres'
  return url.toString()
}

export function assertLocalDatabase() {
  const { url, databaseName } = parseDatabaseUrl()
  const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
  if (!localHosts.has(url.hostname)) {
    throw new Error(`Refusing to reset non-local database host: ${url.hostname}`)
  }

  if (!databaseName.includes('libt')) {
    throw new Error(`Refusing to reset unexpected database: ${databaseName}`)
  }
}

export async function withClient(connectionString, fn) {
  const client = new pg.Client({ connectionString })
  await client.connect()

  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export function runScript(scriptName) {
  const result = spawnSync('npm', ['run', scriptName], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.status !== 0) {
    throw new Error(`npm run ${scriptName} failed`)
  }
}

export function isMain(importMetaUrl) {
  return importMetaUrl === pathToFileURL(process.argv[1]).href
}
