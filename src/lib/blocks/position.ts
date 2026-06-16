export type Position = string

const POSITION_STEP = 1000
const POSITION_WIDTH = 16

export const FIRST_POSITION: Position = formatPosition(POSITION_STEP)

export function nextPositionAfter(lastPosition: Position | null | undefined): Position {
  if (!lastPosition) return FIRST_POSITION

  const parsed = Number.parseInt(lastPosition, 10)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid position: ${lastPosition}`)
  }

  return formatPosition(parsed + POSITION_STEP)
}

export function comparePositions(left: Position, right: Position): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function formatPosition(value: number): Position {
  return value.toString().padStart(POSITION_WIDTH, '0')
}
