import { expect, test } from '@playwright/test'
import pg from 'pg'

const ACTIVE_USER_EMAIL = process.env.SEED_ACTIVE_USER_EMAIL || 'active@example.com'
const ACTIVE_USER_PASSWORD = process.env.SEED_ACTIVE_USER_PASSWORD || 'password123'
const PENDING_USER_EMAIL = 'pending-user@example.com'
const PENDING_USER_PASSWORD = 'password123'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/libt_app'

test.describe('auth', () => {
  test.describe.configure({ mode: 'serial' })

  test('handles concurrent duplicate registration attempts', async ({ request }) => {
    const email = `race-${Date.now()}@example.com`
    const payload = { email, password: PENDING_USER_PASSWORD }

    const responses = await Promise.all([
      request.post('/api/auth/register', { data: payload }),
      request.post('/api/auth/register', { data: payload }),
    ])

    const statuses = responses.map((response) => response.status()).sort()
    expect(statuses).toEqual([201, 409])

    const conflict = responses.find((response) => response.status() === 409)
    if (!conflict) throw new Error('Expected one registration request to conflict')
    await expect(conflict.json()).resolves.toMatchObject({ code: 'email_already_registered' })
  })

  test('registers a user and blocks access until admission', async ({ page }, testInfo) => {
    const pendingEmail = `${testInfo.project.name.toLowerCase().replaceAll(/\W+/g, '-')}-${PENDING_USER_EMAIL}`

    await page.goto('/register')

    await page.getByLabel('Email').fill(pendingEmail)
    await page.getByLabel('Password').fill(PENDING_USER_PASSWORD)
    await page.getByRole('button', { name: 'Registrarme' }).click()

    await expect(page.getByRole('status')).toContainText('Registro recibido')
    await expect(page).toHaveURL(/\/register/)

    await page.goto('/register')
    await page.getByLabel('Email').fill(pendingEmail)
    await page.getByLabel('Password').fill(PENDING_USER_PASSWORD)
    await page.getByRole('button', { name: 'Registrarme' }).click()

    await expect(page.getByRole('status')).toContainText('Ese email ya esta registrado')

    await page.goto('/login')
    await page.getByLabel('Email').fill(pendingEmail)
    await page.getByLabel('Password').fill(PENDING_USER_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('status')).toContainText('esperando admision')
    await expect(page).toHaveURL(/\/login/)
  })

  test('logs in the seeded active user', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill(ACTIVE_USER_EMAIL)
    await page.getByLabel('Password').fill(ACTIVE_USER_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('daily-scroll')).toBeVisible()
  })

  test('stops authorizing an existing session when the user is deactivated', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill(ACTIVE_USER_EMAIL)
    await page.getByLabel('Password').fill(ACTIVE_USER_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL('/')

    try {
      await setUserActive(ACTIVE_USER_EMAIL, false)

      const meResponse = await page.request.get('/api/auth/me')
      expect(meResponse.status()).toBe(401)

      const zeroResponse = await page.request.post('/api/zero/query', { data: {} })
      expect(zeroResponse.status()).toBe(401)

      await page.goto('/')
      await expect(page).toHaveURL(/\/login/)
    } finally {
      await setUserActive(ACTIVE_USER_EMAIL, true)
    }
  })
})

async function setUserActive(email: string, isActive: boolean) {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    await client.query('UPDATE users SET is_active = $1, updated_at = $2 WHERE email = $3', [
      isActive,
      Date.now(),
      email,
    ])
  } finally {
    await client.end()
  }
}
