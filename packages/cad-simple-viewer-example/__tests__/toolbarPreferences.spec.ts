import { defaultToolbarPreferences, loadToolbarPreferences, saveToolbarPreferences } from '../src/toolbarPreferences'

describe('toolbar preferences', () => {
  const entries = new Map<string, string>()
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value) }
  }
  beforeEach(() => entries.clear())

  it('uses defaults for a new user', () => {
    expect(loadToolbarPreferences('new-user', storage)).toEqual(defaultToolbarPreferences())
    expect(defaultToolbarPreferences().valveDebugEnabled).toBe(false)
    expect(defaultToolbarPreferences().brushDebugEnabled).toBe(false)
    expect(defaultToolbarPreferences().phaseMoveEnabled).toBe(false)
  })

  it('enables only the requested toolbar groups by default', () => {
    const rootIds = [
      'select', 'pan', 'zoom-extent', 'zoom-window', 'layer',
      'brush-highlight', 'brush-valve-toggle', 'brush-erase', 'agent', 'measure', 'export',
      'annotation', 'rev-vis', 'switch-bg', 'monochrome', 'toolbar-placement', 'theme', 'locale'
    ]
    const preferences = defaultToolbarPreferences()
    expect(rootIds.filter(id => !preferences.hiddenIds.includes(id))).toEqual([
      'select', 'pan', 'zoom-extent', 'zoom-window', 'brush-highlight', 'brush-valve-toggle', 'brush-erase',
      'annotation', 'switch-bg', 'monochrome', 'toolbar-placement'
    ])
    preferences.hiddenIds.push('select')
    expect(defaultToolbarPreferences().hiddenIds).not.toContain('select')
  })

  it('uses the requested defaults when the hidden list is absent', () => {
    expect(loadToolbarPreferences('new-user', { getItem: () => '{}' })).toEqual(defaultToolbarPreferences())
  })

  it('persists independently for each user', () => {
    const preferences = { ...defaultToolbarPreferences(), hiddenIds: ['export-pdf'], visible: false, valveDebugEnabled: true, brushDebugEnabled: true }
    saveToolbarPreferences('alice', preferences, storage)
    expect(loadToolbarPreferences('alice', storage)).toEqual(preferences)
    expect(loadToolbarPreferences('bob', storage)).toEqual(defaultToolbarPreferences())
  })

  it('recovers from invalid or unavailable storage', () => {
    expect(loadToolbarPreferences('alice', { getItem: () => '{' })).toEqual(defaultToolbarPreferences())
    expect(loadToolbarPreferences('alice', { getItem: () => { throw new Error('blocked') } })).toEqual(defaultToolbarPreferences())
  })

  it('validates stored values without migrating a legacy format', () => {
    const preferences = loadToolbarPreferences('alice', {
      getItem: () => JSON.stringify({ hiddenIds: ['pan', 'pan', 1], visible: 'no', collapsed: true, placement: 'invalid', edgeOffset: -9, valveDebugEnabled: 'true', brushDebugEnabled: 'true' })
    })
    expect(preferences).toEqual({ ...defaultToolbarPreferences(), hiddenIds: ['pan'], collapsed: true, edgeOffset: 0 })
  })

  it('keeps existing users opted out of brush debugging until enabled', () => {
    const preferences = loadToolbarPreferences('alice', {
      getItem: () => JSON.stringify({ valveDebugEnabled: true })
    })
    expect(preferences.valveDebugEnabled).toBe(true)
    expect(preferences.brushDebugEnabled).toBe(false)
  })

  it.each([undefined, null, 'true', 1])('disables Phase move controls for missing or invalid values: %s', phaseMoveEnabled => {
    const preferences = loadToolbarPreferences('alice', {
      getItem: () => JSON.stringify({ phaseMoveEnabled, collapsed: true })
    })
    expect(preferences.phaseMoveEnabled).toBe(false)
    expect(preferences.collapsed).toBe(true)
  })

  it.each([true, false])('persists Phase move controls as %s per user', phaseMoveEnabled => {
    const preferences = { ...defaultToolbarPreferences(), phaseMoveEnabled }
    saveToolbarPreferences('alice', preferences, storage)
    expect(loadToolbarPreferences('alice', storage)).toEqual(preferences)
    expect(loadToolbarPreferences('bob', storage).phaseMoveEnabled).toBe(false)
  })

  it.each(['valves', 'non-valves', 'all'] as const)('persists the %s valve brush scope per user', valveBrushScope => {
    const preferences = { ...defaultToolbarPreferences(), valveBrushScope }
    saveToolbarPreferences('alice', preferences, storage)
    expect(loadToolbarPreferences('alice', storage).valveBrushScope).toBe(valveBrushScope)
    expect(loadToolbarPreferences('bob', storage).valveBrushScope).toBe('valves')
  })

  it.each(['all', 'non-valves', 'valves'] as const)('initializes unversioned scope %s to valves only without resetting other settings', valveBrushScope => {
    const preferences = { ...defaultToolbarPreferences(), valveBrushScope, hiddenIds: ['pan'], edgeOffset: 20 }
    expect(loadToolbarPreferences('alice', {
      getItem: () => JSON.stringify(preferences)
    })).toEqual({ ...preferences, valveBrushScope: 'valves' })
  })

  it.each([undefined, null, 'invalid', 1])('defaults invalid or legacy scope %s to valves only', valveBrushScope => {
    expect(loadToolbarPreferences('alice', {
      getItem: () => JSON.stringify({ valveBrushScope, valveBrushScopeVersion: 1 })
    }).valveBrushScope).toBe('valves')
  })

  it('reports save failures instead of pretending the setting was saved', () => {
    expect(() => saveToolbarPreferences('alice', defaultToolbarPreferences(), {
      setItem: () => { throw new Error('full') }
    })).toThrow('full')
  })
})