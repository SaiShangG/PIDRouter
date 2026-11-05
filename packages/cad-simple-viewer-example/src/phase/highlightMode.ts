import type { HighlightMode } from './types'

export class HighlightModeValidationError extends Error {
  constructor() {
    super('Invalid Phase highlight mode')
    this.name = 'HighlightModeValidationError'
  }
}

export const normalizeHighlightMode = (value: unknown): HighlightMode => {
  if (value === undefined) return 'auto'
  if (value === 'auto' || value === 'manual') return value
  throw new HighlightModeValidationError()
}
