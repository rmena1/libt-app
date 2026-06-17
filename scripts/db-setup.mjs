import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getDatabaseUrl, hasExplicitDatabaseUrl } from './env.mjs'
import { getAdminDatabaseUrl, isMain, parseDatabaseUrl, withClient } from './db-utils.mjs'

const LOCAL_CONTAINER_NAME = 'libt-app-postgres'
const LOCAL_POSTGRES_IMAGE = 'postgres:16-alpine'
const LOCAL_DATA_DIR = path.join(process.cwd(), '.local', 'postgres')
const LOCAL_LOG_FILE = path.join(process.cwd(), '.local', 'postgres.log')

export async function setupDatabase({ verifyOnly = false } = {}) {
  const { databaseName } = parseDatabaseUrl()

  if (!verifyOnly) {
    await ensureReachableLocalServer()
  }

  if (!verifyOnly) {
    await withClient(getAdminDatabaseUrl(), async (client) => {
      const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName])
      if (existing.rowCount === 0) {
        await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`)
        console.log(`[db:setup] Created database ${databaseName}`)
      } else {
        console.log(`[db:setup] Database ${databaseName} already exists`)
      }
    })
  }

  await withClient(getDatabaseUrl(), async (client) => {
    await client.query('SELECT 1')
  })

  console.log(`[db:setup] Database ${databaseName} is reachable`)
}

async function ensureReachableLocalServer() {
  try {
    await withClient(getAdminDatabaseUrl(), async (client) => {
      await client.query('SELECT 1')
    })
    return
  } catch (error) {
    if (hasExplicitDatabaseUrl()) {
      throw error
    }
  }

  if (!ensureLocalPostgresCluster()) {
    ensureDockerContainer()
  }

  await waitForPostgres()
}

function ensureLocalPostgresCluster() {
  const initdb = findBinary('initdb')
  const pgCtl = findBinary('pg_ctl')
  if (!initdb || !pgCtl) return false

  fs.mkdirSync(path.dirname(LOCAL_DATA_DIR), { recursive: true })

  if (!fs.existsSync(path.join(LOCAL_DATA_DIR, 'PG_VERSION'))) {
    const initialized = spawnSync(
      initdb,
      ['-D', LOCAL_DATA_DIR, '-U', 'postgres', '--auth=trust', '--encoding=UTF8'],
      { stdio: 'inherit' },
    )

    if (initialized.status !== 0) {
      throw new Error('Could not initialize local Postgres cluster')
    }
  }

  const { url } = parseDatabaseUrl()
  const port = url.port || '5432'
  const started = spawnSync(
    pgCtl,
    ['-D', LOCAL_DATA_DIR, '-o', `-p ${port}`, '-l', LOCAL_LOG_FILE, 'start', '-w'],
    { stdio: 'ignore' },
  )

  if (started.status === 0) {
    console.log(`[db:setup] Started local Postgres cluster on port ${port}`)
    return true
  }

  return true
}

function findBinary(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout.trim() || null
}

function ensureDockerContainer() {
  const inspected = spawnSync('docker', ['inspect', LOCAL_CONTAINER_NAME], { stdio: 'ignore' })

  if (inspected.status === 0) {
    const started = spawnSync('docker', ['start', LOCAL_CONTAINER_NAME], { stdio: 'ignore' })
    if (started.status !== 0) {
      throw new Error(`Could not start Docker container ${LOCAL_CONTAINER_NAME}`)
    }
    console.log(`[db:setup] Started Docker container ${LOCAL_CONTAINER_NAME}`)
    return
  }

  const { url } = parseDatabaseUrl()
  const port = url.port || '5432'
  const created = spawnSync(
    'docker',
    [
      'run',
      '--name',
      LOCAL_CONTAINER_NAME,
      '-e',
      'POSTGRES_USER=postgres',
      '-e',
      'POSTGRES_PASSWORD=postgres',
      '-p',
      `${port}:5432`,
      '-d',
      LOCAL_POSTGRES_IMAGE,
    ],
    { stdio: 'inherit' },
  )

  if (created.status !== 0) {
    throw new Error(`Could not create Docker container ${LOCAL_CONTAINER_NAME}`)
  }
}

async function waitForPostgres() {
  const deadline = Date.now() + 30000
  let lastError = null

  while (Date.now() < deadline) {
    try {
      await withClient(getAdminDatabaseUrl(), async (client) => {
        await client.query('SELECT 1')
      })
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  throw lastError ?? new Error('Postgres did not become reachable')
}

if (isMain(import.meta.url)) {
  setupDatabase({ verifyOnly: process.argv.includes('--verify') }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
