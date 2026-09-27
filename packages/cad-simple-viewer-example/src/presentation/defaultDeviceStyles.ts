import type { FlowConnectionDocumentInput } from '../flow/types'
import { clonePresentationProfile } from '../phase/phaseWorkspaceStore'
import type { PresentationProfile } from '../phase/types'
import defaultTemplates from './defaultDeviceStyles.json'
import { parseHighlightStyleDocument } from './highlightStyleDocument'

const defaultTemplateVersion = 2

const parseDefaultStyles = (input: unknown) => {
  const result = parseHighlightStyleDocument(input)
  if (!result.ok) {
    throw new Error(`Invalid default styles: ${result.errors.map(error => `${error.path}: ${error.code}`).join(', ')}`)
  }
  return result.profile
}

const normalizeCategory = (name: string) => name.trim().toLowerCase()

export const generateDefaultDeviceStyles = (
  document: FlowConnectionDocumentInput,
  source: PresentationProfile,
  templates: unknown = defaultTemplates
) => {
  return supplementDeviceStyles(document, source, parseDefaultStyles(templates))
}

const supplementDeviceStyles = (
  document: FlowConnectionDocumentInput,
  source: PresentationProfile,
  defaults: PresentationProfile
) => {
  const devicesByCategory = new Map(defaults.devices.map(device => [normalizeCategory(device.name), device]))
  const categories = new Map<string, string>()
  document.Areas?.forEach(area => area.ControlModules?.forEach(module => {
    const name = module.Name?.trim()
    if (name && !categories.has(normalizeCategory(name))) {
      categories.set(normalizeCategory(name), name)
    }
  }))
  const profile = clonePresentationProfile(source)
  const usedIds = new Set([
    ...profile.devices.flatMap(device => [device.id, ...device.states.map(state => state.id)]),
    ...profile.utilities.map(utility => utility.id)
  ])
  const uniqueId = (base: string) => {
    let candidate = base
    let suffix = 2
    while (usedIds.has(candidate)) candidate = `${base}:${suffix++}`
    usedIds.add(candidate)
    return candidate
  }
  const addedCategories: string[] = []
  const addedStates: string[] = []
  const unknownCategories: string[] = []
  categories.forEach((name, category) => {
    let device = profile.devices.find(candidate => normalizeCategory(candidate.name) === category)
    const configuredTemplate = devicesByCategory.get(category)
    if (device && !configuredTemplate) return
    if (!configuredTemplate) unknownCategories.push(name)
    const template = configuredTemplate ?? {
      id: `builtin:${encodeURIComponent(category)}`,
      states: [
        { key: 'OPEN', displayName: 'ON', color: 0x00c853 },
        { key: 'CLOSE', displayName: 'OFF', color: 0xb8b8b8 }
      ].map((state, order) => ({
        ...state,
        id: `builtin:${encodeURIComponent(category)}:${state.key}`,
        lineWidthPx: 3,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: false,
        flowBehavior: 'neutral' as const,
        order
      }))
    }
    if (!device) {
      device = {
        id: uniqueId(template.id),
        name,
        states: [],
        order: Math.max(-1, ...profile.devices.map(existing => existing.order)) + 1
      }
      profile.devices.push(device)
      addedCategories.push(name)
    }
    template.states.forEach(state => {
      if (device.states.some(existing => existing.key === state.key)) return
      device.states.push({
        ...state,
        id: uniqueId(state.id),
        order: Math.max(-1, ...device.states.map(existing => existing.order)) + 1
      })
      addedStates.push(`${name} / ${state.key}`)
    })
  })
  if (addedCategories.length || addedStates.length) {
    profile.defaultStyleSeed = { status: 'generated', templateVersion: defaultTemplateVersion }
  }
  return { profile, addedCategories, addedStates, unknownCategories, templateVersion: defaultTemplateVersion }
}

export const initializeDefaultDeviceStyles = (
  document: FlowConnectionDocumentInput,
  profile: PresentationProfile
) => {
  if (profile.defaultStyleSeed?.status !== 'pending' || profile.devices.length || profile.utilities.length) {
    return undefined
  }
  const defaults = parseDefaultStyles(defaultTemplates)
  const result = supplementDeviceStyles(document, profile, defaults)
  if (result.addedStates.length) {
    result.profile.utilities = defaults.utilities
  }
  return result
}

export const initializeProjectDeviceStyles = (source: PresentationProfile) => {
  if (source.defaultStyleSeed?.status !== 'pending' || source.devices.length || source.utilities.length) {
    return undefined
  }
  const defaults = parseDefaultStyles(defaultTemplates)
  const profile = clonePresentationProfile(source)
  profile.devices = defaults.devices
  profile.utilities = defaults.utilities
  profile.defaultStyleSeed = { status: 'generated', templateVersion: defaultTemplateVersion }
  return {
    profile,
    addedCategories: defaults.devices.map(device => device.name),
    addedStates: defaults.devices.flatMap(device => device.states.map(state => `${device.name} / ${state.key}`)),
    unknownCategories: [],
    templateVersion: defaultTemplateVersion
  }
}