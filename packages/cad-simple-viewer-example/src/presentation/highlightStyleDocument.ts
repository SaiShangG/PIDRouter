import { normalizePresentationProfile } from '../phase/phaseWorkspaceStore'
import type { PresentationProfile } from '../phase/types'

export interface StyleValidationError {
  code: 'structure' | 'required' | 'value' | 'duplicateId' | 'duplicateState'
  path: string
}

export type StyleParseResult =
  | { ok: true; profile: PresentationProfile }
  | { ok: false; errors: StyleValidationError[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const parseHighlightStyleDocument = (input: unknown): StyleParseResult => {
  if (!isRecord(input) || !isRecord(input.presentationProfile) ||
    !Array.isArray(input.presentationProfile.deviceStyles) ||
    !Array.isArray(input.presentationProfile.utilities)) {
    return { ok: false, errors: [{ code: 'structure', path: 'presentationProfile' }] }
  }
  const source = input.presentationProfile
  const errors: StyleValidationError[] = []
  const ids = new Set<string>()
  const states = new Map<string, Set<string>>()
  const validate = (value: unknown, path: string, device: boolean) => {
    const error = (code: StyleValidationError['code'], field?: string) =>
      errors.push({ code, path: field ? `${path}.${field}` : path })
    if (!isRecord(value)) {
      error('structure')
      return
    }
    for (const field of device ? ['id', 'deviceType', 'deviceState', 'displayName'] : ['id', 'name']) {
      if (!isText(value[field])) error('required', field)
    }
    if (isText(value.id)) {
      const id = value.id.trim()
      if (ids.has(id)) error('duplicateId', 'id')
      ids.add(id)
    }
    if (typeof value.color !== 'string' || !/^#[\da-f]{6}$/i.test(value.color)) error('value', 'color')
    if (typeof value.lineWidthPx !== 'number' || !Number.isFinite(value.lineWidthPx) ||
      value.lineWidthPx < 1 || value.lineWidthPx > 12) error('value', 'lineWidthPx')
    if (typeof value.opacity !== 'number' || !Number.isFinite(value.opacity) ||
      value.opacity < 0 || value.opacity > 1) error('value', 'opacity')
    if (device) {
      if (typeof value.autoHighlightFlow !== 'boolean') error('value', 'autoHighlightFlow')
      if (typeof value.flowBehavior !== 'string' ||
        !['conducting', 'blocking', 'neutral'].includes(value.flowBehavior)) error('value', 'flowBehavior')
      if (isText(value.deviceType) && isText(value.deviceState)) {
        const category = value.deviceType.trim()
        const key = value.deviceState.trim()
        const keys = states.get(category) ?? new Set<string>()
        if (keys.has(key)) error('duplicateState', 'deviceState')
        keys.add(key)
        states.set(category, keys)
      }
    }
  }
  ;(source.deviceStyles as unknown[]).forEach((value, index) => validate(value, `deviceStyles[${index}]`, true))
  ;(source.utilities as unknown[]).forEach((value, index) => validate(value, `utilities[${index}]`, false))
  return errors.length
    ? { ok: false, errors }
    : { ok: true, profile: normalizePresentationProfile(source) }
}