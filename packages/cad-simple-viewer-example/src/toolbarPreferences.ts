import type { AcExToolbarPlacement } from '@mlightcad/cad-simple-ui-plugin'

export interface ToolbarPreferences {
  hiddenIds: string[]
  visible: boolean
  collapsed: boolean
  placement: AcExToolbarPlacement
  edgeOffset: number
  valveDebugEnabled: boolean
}

export const defaultToolbarPreferences = (): ToolbarPreferences => ({
  hiddenIds: ['layer', 'agent', 'measure', 'export', 'rev-vis', 'theme', 'locale'],
  visible: true, collapsed: false, placement: 'right', edgeOffset: 8,
  valveDebugEnabled: false
})

export function loadToolbarPreferences(userId: string, storage: Pick<Storage, 'getItem'>): ToolbarPreferences {
  const defaults = defaultToolbarPreferences()
  try {
    const value = JSON.parse(storage.getItem(toolbarPreferencesKey(userId)) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
    return {
      hiddenIds: Array.isArray(value.hiddenIds)
        ? [...new Set<string>(value.hiddenIds.filter((id: unknown) => typeof id === 'string'))]
        : defaults.hiddenIds,
      visible: typeof value.visible === 'boolean' ? value.visible : defaults.visible,
      collapsed: typeof value.collapsed === 'boolean' ? value.collapsed : defaults.collapsed,
      valveDebugEnabled: typeof value.valveDebugEnabled === 'boolean'
        ? value.valveDebugEnabled : defaults.valveDebugEnabled,
      placement: ['top', 'bottom', 'left', 'right'].includes(value.placement) ? value.placement : defaults.placement,
      edgeOffset: typeof value.edgeOffset === 'number' && Number.isFinite(value.edgeOffset)
        ? Math.min(80, Math.max(0, value.edgeOffset)) : defaults.edgeOffset
    }
  } catch {
    return defaults
  }
}

export function saveToolbarPreferences(userId: string, value: ToolbarPreferences, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(toolbarPreferencesKey(userId), JSON.stringify(value))
}

function toolbarPreferencesKey(userId: string): string {
  return `pid-viewer:toolbar:${encodeURIComponent(userId)}`
}