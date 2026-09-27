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
  })

  it('enables only the requested toolbar groups by default', () => {
    const rootIds = [
      'select', 'pan', 'zoom-extent', 'zoom-window', 'layer',
      'brush-highlight', 'brush-erase', 'agent', 'measure', 'export',
      'annotation', 'rev-vis', 'switch-bg', 'monochrome', 'toolbar-placement', 'theme', 'locale'
    ]
    const preferences = defaultToolbarPreferences()
    expect(rootIds.filter(id => !preferences.hiddenIds.includes(id))).toEqual([
      'select', 'pan', 'zoom-extent', 'zoom-window', 'brush-highlight', 'brush-erase',
      'annotation', 'switch-bg', 'monochrome', 'toolbar-placement'
    ])
    preferences.hiddenIds.push('select')
    expect(defaultToolbarPreferences().hiddenIds).not.toContain('select')
  })

  it('uses the requested defaults when the hidden list is absent', () => {
    expect(loadToolbarPreferences('new-user', { getItem: () => '{}' })).toEqual(defaultToolbarPreferences())
  })

  it('persists independently for each user', () => {
    const preferences = { ...defaultToolbarPreferences(), hiddenIds: ['export-pdf'], visible: false, valveDebugEnabled: true }
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
      getItem: () => JSON.stringify({ hiddenIds: ['pan', 'pan', 1], visible: 'no', collapsed: true, placement: 'invalid', edgeOffset: -9, valveDebugEnabled: 'true' })
    })
    expect(preferences).toEqual({ ...defaultToolbarPreferences(), hiddenIds: ['pan'], collapsed: true, edgeOffset: 0 })
  })

  it('reports save failures instead of pretending the setting was saved', () => {
    expect(() => saveToolbarPreferences('alice', defaultToolbarPreferences(), {
      setItem: () => { throw new Error('full') }
    })).toThrow('full')
  })
})