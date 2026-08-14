export const PHASE_SIDEBAR_DEFAULT_WIDTH = 320
export const PHASE_SIDEBAR_MIN_WIDTH = 240
export const PHASE_SIDEBAR_MAX_WIDTH = 520

const KEYBOARD_STEP = 10

export function clampPhaseSidebarWidth(width: number): number {
  return Math.min(
    PHASE_SIDEBAR_MAX_WIDTH,
    Math.max(PHASE_SIDEBAR_MIN_WIDTH, width)
  )
}

export function getKeyboardResizeWidth(
  width: number,
  key: string
): number | undefined {
  if (key === 'ArrowLeft') return clampPhaseSidebarWidth(width - KEYBOARD_STEP)
  if (key === 'ArrowRight') return clampPhaseSidebarWidth(width + KEYBOARD_STEP)
  if (key === 'Home') return PHASE_SIDEBAR_MIN_WIDTH
  if (key === 'End') return PHASE_SIDEBAR_MAX_WIDTH
  return undefined
}