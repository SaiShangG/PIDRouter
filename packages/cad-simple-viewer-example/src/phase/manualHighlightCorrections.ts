import { isEqual } from 'lodash-es'

import type {
  ManualHighlightAddition,
  ManualHighlightCorrections
} from './types'

export class ManualHighlightCorrectionsValidationError extends Error { }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const invalid = (path: string): never => {
  throw new ManualHighlightCorrectionsValidationError(
    `Invalid manual highlight corrections: ${path}`
  )
}

export const normalizeCadHandle = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !/^[0-9a-f]+$/i.test(value.trim())) {
    return undefined
  }
  return BigInt(`0x${value.trim()}`).toString(16).toUpperCase()
}

export const normalizeManualHighlightCorrections = (
  value: unknown,
  normalizeHandle: (value: unknown) => string | undefined = normalizeCadHandle
): ManualHighlightCorrections => {
  if (!isRecord(value) || !Array.isArray(value.additions) || !Array.isArray(value.exclusions)) {
    return invalid('manualCorrections')
  }
  const additions = new Map<string, ManualHighlightAddition>()
  value.additions.forEach((candidate, index) => {
    const path = `manualCorrections.additions[${index}]`
    if (!isRecord(candidate)) return invalid(path)
    const handleKey = normalizeHandle(candidate.handleKey)
    if (handleKey === undefined) return invalid(`${path}.handleKey`)
    if (typeof candidate.highlightStyleRefId !== 'string' || !candidate.highlightStyleRefId.trim()) {
      return invalid(`${path}.highlightStyleRefId`)
    }
    let deviceState: ManualHighlightAddition['deviceState']
    if (candidate.deviceState !== undefined) {
      const state = candidate.deviceState
      if (!isRecord(state) || typeof state.stateKey !== 'string' || !state.stateKey.trim() ||
        typeof state.deviceType !== 'string' || !state.deviceType.trim()) {
        return invalid(`${path}.deviceState`)
      }
      deviceState = { stateKey: state.stateKey.trim(), deviceType: state.deviceType.trim() }
    }
    additions.set(handleKey, {
      handleKey,
      highlightStyleRefId: candidate.highlightStyleRefId.trim(),
      ...(deviceState ? { deviceState } : {})
    })
  })
  const exclusions = new Set<string>()
  value.exclusions.forEach((candidate, index) => {
    const handleKey = normalizeHandle(candidate)
    if (handleKey === undefined) {
      return invalid(`manualCorrections.exclusions[${index}]`)
    }
    exclusions.add(handleKey)
    // An exclusion wins if imported data contains both operations for one handle.
    additions.delete(handleKey)
  })
  return { additions: [...additions.values()], exclusions: [...exclusions] }
}

export const cloneManualHighlightCorrections = (
  value: ManualHighlightCorrections | undefined
): ManualHighlightCorrections | undefined =>
  value === undefined ? undefined : normalizeManualHighlightCorrections(value)

export interface ManualHighlightEraseHit {
  handleKey: string
  hasAutomaticFlow: boolean
  hasDeviceHighlight?: boolean
  hasDeviceState?: boolean
}

export class ManualHighlightCorrectionState {
  private additions = new Map<string, ManualHighlightAddition>()
  private exclusions = new Set<string>()
  private readonly undoStack: ManualHighlightCorrections[] = []
  private readonly redoStack: ManualHighlightCorrections[] = []
  private strokeBefore?: ManualHighlightCorrections

  restore(value?: ManualHighlightCorrections) {
    const normalized = cloneManualHighlightCorrections(value)
    this.replace(normalized)
    this.clearHistory()
  }

  private replace(normalized?: ManualHighlightCorrections) {
    this.additions = new Map(normalized?.additions.map(item => [item.handleKey, item]))
    this.exclusions = new Set(normalized?.exclusions)
  }

  clearHistory() {
    this.strokeBefore = undefined
    this.undoStack.length = 0
    this.redoStack.length = 0
  }

  beginStroke() {
    if (this.strokeBefore) throw new Error('A manual correction stroke is already active')
    this.strokeBefore = this.snapshot()
  }

  endStroke(): boolean {
    const before = this.strokeBefore
    if (!before) return false
    this.strokeBefore = undefined
    const current = this.snapshot()
    const ordered = (value: ManualHighlightCorrections) => ({
      additions: [...value.additions].sort((a, b) => a.handleKey.localeCompare(b.handleKey)),
      exclusions: [...value.exclusions].sort()
    })
    if (isEqual(ordered(before), ordered(current))) return false
    this.undoStack.push(before)
    this.redoStack.length = 0
    return true
  }

  get canUndo() {
    return this.undoStack.length > 0
  }

  get canRedo() {
    return this.redoStack.length > 0
  }

  get additionCount() {
    return this.additions.size
  }

  get exclusionCount() {
    return this.exclusions.size
  }

  undo(): boolean {
    this.endStroke()
    const previous = this.undoStack.pop()
    if (!previous) return false
    this.redoStack.push(this.snapshot())
    this.replace(previous)
    return true
  }

  redo(): boolean {
    this.endStroke()
    const next = this.redoStack.pop()
    if (!next) return false
    this.undoStack.push(this.snapshot())
    this.replace(next)
    return true
  }

  clear() {
    this.restore()
  }

  snapshot(): ManualHighlightCorrections {
    return normalizeManualHighlightCorrections({
      additions: [...this.additions.values()],
      exclusions: [...this.exclusions]
    })
  }

  getAddition(handleKey: string) {
    return this.additions.get(handleKey)
  }

  isExcluded(handleKey: string) {
    return this.exclusions.has(handleKey)
  }

  get additionHandleKeys() {
    return [...this.additions.keys()]
  }

  paint(
    handleKeys: readonly string[],
    highlightStyleRefId: string,
    deviceState?: ManualHighlightAddition['deviceState']
  ): boolean {
    const normalized = normalizeManualHighlightCorrections({
      additions: handleKeys.map(handleKey => ({
        handleKey, highlightStyleRefId,
        ...(deviceState ? { deviceState } : {})
      })),
      exclusions: []
    })
    let changed = false
    normalized.additions.forEach(addition => {
      if (!isEqual(this.additions.get(addition.handleKey), addition)) {
        this.additions.set(addition.handleKey, addition)
        changed = true
      }
      if (this.exclusions.delete(addition.handleKey)) changed = true
    })
    return changed
  }

  erase(hits: readonly ManualHighlightEraseHit[]): boolean {
    const normalizedHits = hits.map(hit => {
      const handleKey = normalizeCadHandle(hit.handleKey)
      if (handleKey === undefined) return invalid('erase.handleKey')
      return {
        handleKey,
        hasAutomaticHighlight: hit.hasAutomaticFlow || hit.hasDeviceHighlight === true || hit.hasDeviceState === true
      }
    })
    let changed = false
    normalizedHits.forEach(({ handleKey, hasAutomaticHighlight }) => {
      if (this.additions.delete(handleKey)) changed = true
      if (hasAutomaticHighlight && !this.exclusions.has(handleKey)) {
        this.exclusions.add(handleKey)
        changed = true
      }
    })
    return changed
  }
}
