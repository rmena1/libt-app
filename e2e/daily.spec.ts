import { expect, test, type Locator, type Page } from '@playwright/test'
import pg from 'pg'

const ACTIVE_USER_EMAIL = process.env.SEED_ACTIVE_USER_EMAIL || 'active@example.com'
const ACTIVE_USER_PASSWORD = process.env.SEED_ACTIVE_USER_PASSWORD || 'password123'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/libt_app'

test.describe('daily view and app shell', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('desktop shell and daily block workflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only shell assertions')

    const date = addDays(todayIso(), 2)
    const content = `Nota desktop ${Date.now()}`
    const section = page.locator(`[data-date="${date}"]`)
    const blockInputs = section.locator('[data-testid^="block-input-"]')

    await expect(page.getByTestId('desktop-left-sidebar')).toBeVisible()
    await expect(page.getByTestId('desktop-right-sidebar')).toBeVisible()
    await goToDate(page, date)
    await expect(page.getByTestId(`day-state-${date}`)).toContainText('Shell')

    await page.getByTestId(`day-shell-input-${date}`).fill(content)
    await page.getByTestId(`day-shell-input-${date}`).press('Enter')
    await expect(page.getByTestId(`day-shell-input-${date}`)).toBeFocused()
    await expect(page.getByTestId(`day-shell-input-${date}`)).toHaveValue('')
    const input = blockInputs.last()
    await expect(input).toHaveValue(content)

    const firstBlockId = await blockIdFromInput(input)
    await expect(page.getByTestId(`day-state-${date}`)).toContainText('Daily block')

    const secondContent = 'Segundo bloque desde append'
    await page.getByTestId(`day-shell-input-${date}`).fill(secondContent)
    await page.getByTestId(`day-shell-input-${date}`).press('Enter')
    await expect(blockInputs).toHaveCount(2)
    await expect(blockInputs.last()).toHaveValue(secondContent)

    const parentForIndentedBlockId = await blockIdFromInput(blockInputs.last())
    await placeCursorAtEnd(blockInputs.last())
    await blockInputs.last().press('Enter')
    await expect(blockInputs).toHaveCount(3)

    const secondBlockId = await activeBlockInputId(page)
    const secondInput = page.getByTestId(`block-input-${secondBlockId}`)
    await expect(secondInput).toBeFocused()
    const tabContent = 'Bloque para tab'
    await secondInput.fill(tabContent)
    await secondInput.press('Tab')
    await expect.poll(async () => getBlockParentId(secondBlockId)).toBe(parentForIndentedBlockId)
    await expect(page.getByTestId(`block-input-${secondBlockId}`)).toHaveValue(tabContent)
    await expect(page.getByTestId(`block-input-${secondBlockId}`)).toBeFocused()

    await page.getByTestId(`block-input-${secondBlockId}`).press('Shift+Tab')
    await expect.poll(async () => getBlockParentId(secondBlockId)).not.toBe(firstBlockId)
    await expect(page.getByTestId(`block-input-${secondBlockId}`)).toBeFocused()

    await placeCursorAtEnd(page.getByTestId(`block-input-${secondBlockId}`))
    await page.getByTestId(`block-input-${secondBlockId}`).press('Enter')
    await expect(blockInputs).toHaveCount(4)
    await expect(blockInputs.last()).toBeFocused()
    const todoInput = blockInputs.last()
    await todoInput.fill('[] Comprar cafe')
    await todoInput.blur()
    await expect(section.locator('[data-testid^="todo-toggle-"]')).toBeVisible()

    await section.locator('[data-testid^="todo-toggle-"]').last().click()
    await expect(section.locator('.block-editor.is-complete')).toBeVisible()

    await section.locator('[data-testid^="outdent-"]').last().click()
  })

  test('desktop recording panel accepts an audio upload workflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only recording panel')

    const today = todayIso()
    const section = page.locator(`[data-date="${today}"]`)

    await page.reload()
    await expect(page.getByTestId('recording-panel')).toBeVisible()
    await expect(page.getByTestId('record-meeting-button')).toBeVisible()
    await expect(page.getByTestId('record-video-button')).toBeVisible()

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByTestId('upload-audio-button').click()
    const chooser = await chooserPromise
    await chooser.setFiles({
      name: 'meeting.webm',
      mimeType: 'audio/webm',
      buffer: Buffer.from('mock audio'),
    })

    await expect(page.getByTestId('upload-audio-button')).toBeEnabled({ timeout: 15000 })

    await expect.poll(async () => textareaValues(section)).toContain('meetings')
    await expect.poll(async () => textareaValues(section)).toContain('summary')
    await expect.poll(async () => textareaValues(section)).toContain('transcription')
    await expect.poll(async () => (await textareaValues(section)).some((value) =>
      value.includes('Reunion e2e de prueba'),
    )).toBe(true)

    const transcriptionBlockId = await blockIdForTextareaValue(section, 'transcription')
    const transcriptionRow = page.getByTestId(`block-${transcriptionBlockId}`).locator('xpath=..')
    const transcriptionDescendants = transcriptionRow.locator('.block-children textarea')
    await expect(page.getByTestId(`collapse-${transcriptionBlockId}`)).toHaveAttribute('aria-expanded', 'false')
    await expect(transcriptionDescendants).toHaveCount(0)

    await clickCollapse(page, transcriptionBlockId)
    await expect(transcriptionDescendants).toHaveCount(1)
    await expect(transcriptionDescendants.last()).toHaveValue(/pipeline de transcripcion/)
  })

  test('desktop virtual scroll and calendar navigation keep focused date in sync', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only calendar assertions')

    const today = todayIso()
    const targetDate = addDays(today, 5)

    await focusTodayFromCalendar(page, today)
    const initialCalendarOrder = await calendarOrder(page)

    await expect(page.getByTestId('calendar-today-button')).toHaveCount(0)
    await page.getByTestId(`calendar-date-${targetDate}`).click()
    await expect(page.getByTestId(`calendar-date-${targetDate}`)).toHaveClass(/is-selected/)
    await expect(page.locator(`[data-date="${targetDate}"]`)).toBeVisible()
    await expect.poll(async () => calendarOrder(page)).toEqual(initialCalendarOrder)
    await expect(page.getByTestId('calendar-today-button')).toBeVisible()

    await page.getByTestId('calendar-today-button').click()
    await expect(page.getByTestId(`calendar-date-${today}`)).toHaveClass(/is-selected/)
    await expect(page.locator(`[data-date="${today}"]`)).toBeVisible()
    await expect(page.getByTestId('calendar-today-button')).toHaveCount(0)
    await expect.poll(async () => {
      return page.getByTestId('daily-scroll').evaluate((node) => getComputedStyle(node).scrollbarWidth)
    }).toBe('none')

    const initialBounds = await windowBounds(page)
    await page.getByTestId('daily-scroll').evaluate((node) => {
      node.scrollTop = node.scrollHeight
      node.dispatchEvent(new Event('scroll', { bubbles: true }))
    })

    expect(await windowBounds(page)).toEqual(initialBounds)
    await expect.poll(async () => windowBounds(page)).not.toEqual(initialBounds)
  })

  test('desktop drag and drop moves blocks across positions and empty days', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only drag assertions')

    const sourceDate = addDays(todayIso(), 4)
    const targetDate = addDays(todayIso(), 5)
    const first = await createBlock(page, { date: sourceDate, content: `Drag first ${Date.now()}` })
    const second = await createBlock(page, { date: sourceDate, content: `Drag second ${Date.now()}` })

    await page.reload()
    await goToDate(page, sourceDate)
    await expect(page.getByTestId(`block-input-${first.id}`)).toHaveValue(first.content)
    await expect(page.getByTestId(`block-input-${second.id}`)).toHaveValue(second.content)

    await dragTo(page, `block-${first.id}`, `drop-after-${second.id}`)
    await expect(page.getByTestId(`block-input-${first.id}`)).toHaveValue(first.content)

    await goToDate(page, targetDate)
    await dragTo(page, `block-${first.id}`, `day-append-${targetDate}`)
    await expect(page.getByTestId(`day-state-${targetDate}`)).toContainText('Daily block')
    await expect(page.locator(`[data-date="${targetDate}"]`).getByTestId(`block-input-${first.id}`)).toHaveValue(first.content)
  })

  test('desktop block editor deletes empty blocks and converts todo shortcuts immediately', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only block editor assertions')

    const date = addDays(todayIso(), 6)
    const first = await createBlock(page, { date, content: `Previous ${Date.now()}` })
    const second = await createBlock(page, { date, content: `Delete me ${Date.now()}` })
    const todo = await createBlock(page, { date, content: '' })

    await page.reload()
    await goToDate(page, date)

    const secondInput = page.getByTestId(`block-input-${second.id}`)
    await secondInput.fill('')
    await secondInput.press('Backspace')
    await expect(page.getByTestId(`block-input-${second.id}`)).toHaveCount(0)
    await expect(page.getByTestId(`block-input-${first.id}`)).toBeFocused()
    await expect(page.getByTestId(`block-input-${first.id}`)).toHaveValue(first.content)

    const todoInput = page.getByTestId(`block-input-${todo.id}`)
    await todoInput.click()
    await page.keyboard.type('[] ')
    await expect(page.getByTestId(`todo-toggle-${todo.id}`)).toBeVisible()
    await expect(todoInput).toBeFocused()
    await expect(todoInput).toHaveValue('')
    await page.keyboard.type('Comprar cafe')
    await expect(todoInput).toHaveValue('Comprar cafe')
  })

  test('desktop Enter preserves tree position and splits block content', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only Enter tree assertions')

    const date = addDays(todayIso(), 10)
    const section = page.locator(`[data-date="${date}"]`)
    const parent = await createBlock(page, { date, content: `Parent Enter ${Date.now()}` })
    const child = await createBlock(page, { date, parentBlockId: parent.id, content: `Child Enter ${Date.now()}` })
    const followingRoot = await createBlock(page, { date, content: `Following root ${Date.now()}` })

    await page.reload()
    await goToDate(page, date)

    const parentInput = page.getByTestId(`block-input-${parent.id}`)
    await placeCursorAtEnd(parentInput)
    await parentInput.press('Enter')

    const firstInsertedChildId = await activeBlockInputId(page)
    await expect(page.getByTestId(`block-input-${firstInsertedChildId}`)).toBeFocused()
    await expect.poll(async () => getBlockParentId(firstInsertedChildId)).toBe(parent.id)
    await expect.poll(async () => getChildBlockIds(parent.id)).toEqual([firstInsertedChildId, child.id])

    await page.getByTestId(`block-input-${firstInsertedChildId}`).fill('Inserted before child')
    await placeCursorAtEnd(page.getByTestId(`block-input-${child.id}`))
    await page.getByTestId(`block-input-${child.id}`).press('Enter')

    const childSiblingId = await activeBlockInputId(page)
    await expect.poll(async () => getBlockParentId(childSiblingId)).toBe(parent.id)
    await expect.poll(async () => getChildBlockIds(parent.id)).toEqual([firstInsertedChildId, child.id, childSiblingId])

    await page.getByTestId(`block-input-${childSiblingId}`).fill('Sibling after child')
    await expect.poll(async () => blockTextareaValues(section)).toEqual([
      parent.content,
      'Inserted before child',
      child.content,
      'Sibling after child',
      followingRoot.content,
    ])

    const splitBlock = await createBlock(page, { date, content: 'Alpha Beta Gamma' })
    await page.reload()
    await goToDate(page, date)

    const splitInput = page.getByTestId(`block-input-${splitBlock.id}`)
    await placeCursorAtOffset(splitInput, 'Alpha '.length)
    await splitInput.press('Enter')

    const splitSiblingId = await activeBlockInputId(page)
    await expect(page.getByTestId(`block-input-${splitBlock.id}`)).toHaveValue('Alpha ')
    await expect(page.getByTestId(`block-input-${splitSiblingId}`)).toHaveValue('Beta Gamma')
    const splitParentId = await getBlockParentId(splitBlock.id)
    await expect.poll(async () => getBlockParentId(splitSiblingId)).toBe(splitParentId)
  })

  test('rejects cross-date reference mismatch without creating an empty daily block', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only API invariant')

    const sourceDate = addDays(todayIso(), 7)
    const farDate = addDays(todayIso(), 9)
    const reference = await createBlock(page, { date: sourceDate, content: `Reference ${Date.now()}` })
    const moving = await createBlock(page, { date: sourceDate, content: `Mismatch ${Date.now()}` })

    const response = await page.request.patch(`/api/blocks/${moving.id}`, {
      data: {
        action: 'move',
        targetDate: farDate,
        placement: 'after',
        referenceBlockId: reference.id,
      },
    })

    expect(response.status()).toBe(400)
    await expectDailyBlockCount(farDate, 0)

    const createResponse = await page.request.post('/api/blocks', {
      data: {
        date: farDate,
        kind: 'text',
        content: 'Should not create daily',
        afterBlockId: 'missing-block',
      },
    })
    expect(createResponse.status()).toBe(400)
    await expectDailyBlockCount(farDate, 0)
  })

  test('desktop expands a collapsed block after holding drag over child target', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only drag assertions')

    const date = addDays(todayIso(), -3)
    const parent = await createBlock(page, { date, content: `Parent ${Date.now()}` })
    const child = await createBlock(page, { date, parentBlockId: parent.id, content: `Child ${Date.now()}` })
    const moving = await createBlock(page, { date, content: `Moving ${Date.now()}` })
    await patchBlock(page, parent.id, { action: 'setCollapsed', isCollapsed: true })

    await page.reload()
    await goToDate(page, date)
    await expect(page.getByTestId(`block-input-${child.id}`)).toBeHidden()

    const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
    await page.getByTestId(`block-${moving.id}`).dispatchEvent('dragstart', { dataTransfer })
    await page.getByTestId(`block-${parent.id}`).dispatchEvent('dragover', { dataTransfer })
    await page.waitForTimeout(2200)

    await expect(page.getByTestId(`block-input-${child.id}`)).toHaveValue(child.content)
  })

  test('desktop block collapse persists and preserves descendant collapse state', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop-only collapse assertions')

    const date = addDays(todayIso(), -4)
    const parent = await createBlock(page, { date, content: `Parent ${Date.now()}` })
    const child = await createBlock(page, { date, parentBlockId: parent.id, content: `Child ${Date.now()}` })
    const grandchild = await createBlock(page, { date, parentBlockId: child.id, content: `Grandchild ${Date.now()}` })
    const todoParent = await createBlock(page, { date, kind: 'todo', content: `Todo parent ${Date.now()}` })
    const todoChild = await createBlock(page, { date, parentBlockId: todoParent.id, content: `Todo child ${Date.now()}` })

    await page.reload()
    await goToDate(page, date)

    await expect(page.getByTestId(`collapse-${parent.id}`)).toBeVisible()
    await expect(page.getByTestId(`collapse-${child.id}`)).toBeVisible()
    await expect(page.getByTestId(`collapse-${grandchild.id}`)).toHaveCount(0)
    await expect(page.getByTestId(`collapse-${todoParent.id}`)).toBeVisible()
    await expect(page.getByTestId(`todo-toggle-${todoParent.id}`)).toBeVisible()
    await expect(page.getByTestId(`collapse-${todoChild.id}`)).toHaveCount(0)

    await clickCollapse(page, child.id)
    await expect(page.getByTestId(`block-input-${grandchild.id}`)).toBeHidden()

    await clickCollapse(page, parent.id)
    await expect(page.getByTestId(`block-input-${child.id}`)).toBeHidden()

    await page.reload()
    await goToDate(page, date)
    await expect(page.getByTestId(`block-input-${child.id}`)).toBeHidden()

    await clickCollapse(page, parent.id)
    await expect(page.getByTestId(`block-input-${child.id}`)).toHaveValue(child.content)
    await expect(page.getByTestId(`block-input-${grandchild.id}`)).toBeHidden()
  })

  test('mobile shell exposes bottom navigation, date timeline, and AI screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'mobile-only shell assertions')

    const today = todayIso()

    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible()
    await expect(page.getByTestId('mobile-timeline')).toBeVisible()
    await expect(page.getByTestId(`mobile-date-${today}`)).toBeVisible()
    await expect(page.getByTestId('desktop-left-sidebar')).toBeHidden()
    await expect(page.getByTestId('desktop-right-sidebar')).toBeHidden()

    await page.getByTestId('ai-fab').click()
    await expect(page.getByTestId('ai-overlay')).toBeVisible()
  })

  test('mobile date timeline navigates the daily view', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'mobile-only timeline assertions')

    const targetDate = addDays(todayIso(), 3)
    await page.getByTestId(`mobile-date-${targetDate}`).click()

    await expect(page.getByTestId('daily-window-meta')).toContainText(targetDate)
    await expect(page.locator(`[data-date="${targetDate}"]`)).toBeVisible()
    await expect(page.getByTestId('mobile-timeline-month-label')).toBeVisible()
  })

  test('mobile can create, edit, convert, and complete a todo', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'mobile-only block workflow')

    const date = addDays(todayIso(), -2)
    const content = `Nota mobile ${Date.now()}`
    const section = page.locator(`[data-date="${date}"]`)
    const blockInputs = section.locator('[data-testid^="block-input-"]')

    await goToDate(page, date)
    await page.getByTestId(`day-shell-input-${date}`).fill(content)
    await page.getByTestId(`day-shell-input-${date}`).press('Enter')
    await expect(blockInputs.last()).toHaveValue(content)

    await blockInputs.last().fill('[] Todo mobile')
    await blockInputs.last().blur()
    await expect(section.locator('[data-testid^="todo-toggle-"]').last()).toBeVisible()

    await section.locator('[data-testid^="todo-toggle-"]').last().click()
    await expect(section.locator('.block-editor.is-complete')).toBeVisible()
  })
})

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ACTIVE_USER_EMAIL)
  await page.getByLabel('Password').fill(ACTIVE_USER_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('daily-scroll')).toBeVisible()
}

async function createBlock(page: Page, input: {
  date: string
  content: string
  parentBlockId?: string
  kind?: 'text' | 'todo'
  afterBlockId?: string
  beforeBlockId?: string
}) {
  const response = await page.request.post('/api/blocks', {
    data: {
      date: input.date,
      content: input.content,
      parentBlockId: input.parentBlockId ?? null,
      kind: input.kind ?? 'text',
      afterBlockId: input.afterBlockId ?? null,
      beforeBlockId: input.beforeBlockId ?? null,
    },
  })
  expect(response.ok()).toBeTruthy()
  const payload = await response.json() as { block: { id: string; content: string } }
  return payload.block
}

async function patchBlock(page: Page, blockId: string, body: object) {
  const response = await page.request.patch(`/api/blocks/${blockId}`, { data: body })
  expect(response.ok()).toBeTruthy()
}

async function clickCollapse(page: Page, blockId: string) {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/blocks/${blockId}`) && response.request().method() === 'PATCH',
  )
  await page.getByTestId(`collapse-${blockId}`).click()
  expect((await responsePromise).ok()).toBeTruthy()
}

async function blockIdFromInput(input: ReturnType<Page['locator']>) {
  const testId = await input.getAttribute('data-testid')
  if (!testId) throw new Error('Missing block input test id')
  return testId.replace('block-input-', '')
}

async function blockIdForTextareaValue(scope: Locator, value: string) {
  const testId = await scope.locator('textarea').evaluateAll((nodes, expected) => {
    const match = nodes.find((node) => (node as HTMLTextAreaElement).value === expected)
    return match?.getAttribute('data-testid') ?? null
  }, value)

  if (!testId?.startsWith('block-input-')) throw new Error(`Missing textarea with value: ${value}`)
  return testId.replace('block-input-', '')
}

async function textareaValues(scope: Locator) {
  return scope.locator('textarea').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLTextAreaElement).value),
  )
}

async function blockTextareaValues(scope: Locator) {
  return scope.locator('[data-testid^="block-input-"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLTextAreaElement).value),
  )
}

async function placeCursorAtEnd(input: Locator) {
  await input.evaluate((node) => {
    const textarea = node as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  })
}

async function placeCursorAtOffset(input: Locator, offset: number) {
  await input.evaluate((node, cursorOffset) => {
    const textarea = node as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(cursorOffset, cursorOffset)
  }, offset)
}

async function activeBlockInputId(page: Page) {
  await expect.poll(async () => activeBlockInputTestId(page)).not.toBeNull()
  const testId = await activeBlockInputTestId(page)
  if (!testId?.startsWith('block-input-')) throw new Error(`Expected a focused block input, got ${testId}`)
  return testId.replace('block-input-', '')
}

async function activeBlockInputTestId(page: Page) {
  const testId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null)
  return testId?.startsWith('block-input-') ? testId : null
}

async function calendarOrder(page: Page) {
  return page.locator('.mini-calendar button').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('data-testid')),
  )
}

async function focusTodayFromCalendar(page: Page, today: string) {
  if (await page.getByTestId('calendar-today-button').count() > 0) {
    await page.getByTestId('calendar-today-button').click()
  }

  await expect(page.getByTestId(`calendar-date-${today}`)).toHaveClass(/is-selected/)
  await expect(page.locator(`[data-date="${today}"]`)).toBeVisible()
}

async function windowBounds(page: Page) {
  const meta = await page.getByTestId('daily-window-meta').textContent()
  const [startDate, , endDate] = meta?.split(' / ') ?? []
  if (!startDate || !endDate) throw new Error('Daily window metadata is incomplete')
  return { startDate, endDate }
}

async function dragTo(page: Page, sourceTestId: string, targetTestId: string) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await page.getByTestId(sourceTestId).dispatchEvent('dragstart', { dataTransfer })
  await page.getByTestId(targetTestId).dispatchEvent('dragover', { dataTransfer })
  await page.getByTestId(targetTestId).dispatchEvent('drop', { dataTransfer })
}

async function goToDate(page: Page, date: string) {
  if (await page.getByTestId('desktop-right-sidebar').isVisible()) {
    await page.getByTestId(`calendar-date-${date}`).click()
  } else {
    await page.getByTestId(`mobile-date-${date}`).click()
  }

  await expect(page.getByTestId('daily-window-meta')).toContainText(date)
  await expect(page.locator(`[data-date="${date}"]`)).toBeVisible()
}

function todayIso() {
  const date = new Date()
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: string, offset: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  parsed.setUTCDate(parsed.getUTCDate() + offset)
  return parsed.toISOString().slice(0, 10)
}

async function expectDailyBlockCount(date: string, expectedCount: number) {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const result = await client.query('SELECT COUNT(*)::int AS count FROM daily_blocks WHERE date = $1', [date])
    expect(result.rows[0].count).toBe(expectedCount)
  } finally {
    await client.end()
  }
}

async function getBlockParentId(blockId: string) {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const result = await client.query('SELECT parent_block_id FROM blocks WHERE id = $1', [blockId])
    return result.rows[0]?.parent_block_id ?? null
  } finally {
    await client.end()
  }
}

async function getChildBlockIds(parentBlockId: string) {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const result = await client.query('SELECT id FROM blocks WHERE parent_block_id = $1 ORDER BY position', [parentBlockId])
    return result.rows.map((row) => row.id)
  } finally {
    await client.end()
  }
}
