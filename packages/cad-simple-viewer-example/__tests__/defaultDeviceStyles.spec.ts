import { createDefaultPresentationProfile, normalizePresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { toPersistedPresentationProfile } from '../src/phase/phaseWorkspaceRepository'
import { generateDefaultDeviceStyles, initializeDefaultDeviceStyles, initializeProjectDeviceStyles } from '../src/presentation/defaultDeviceStyles'
import templates from '../src/presentation/defaultDeviceStyles.json'
import { findPhaseOverlayStyleWarnings } from '../src/phase/phaseOverlayStyleResolver'
import { parseHighlightStyleDocument } from '../src/presentation/highlightStyleDocument'

const document = {
  Areas: [{
    ControlModules: [
      { Name: 'Valve' }, { Name: ' valve ' }, { Name: 'PP' }, { Name: 'MX' }, { Name: '' }
    ]
  }]
}

describe('default device styles', () => {
  it('parses exported styles without changing values or references', () => {
    const initialized = initializeProjectDeviceStyles(createDefaultPresentationProfile())!.profile
    const exported = { presentationProfile: toPersistedPresentationProfile(initialized) }
    const parsed = parseHighlightStyleDocument(exported)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('Expected valid exported styles')
    expect(toPersistedPresentationProfile(parsed.profile)).toEqual(exported.presentationProfile)
    parsed.profile.utilities[0].style.opacity = 0.1
    expect(exported.presentationProfile.utilities[0].opacity).toBe(0.5)
  })

  it('rejects invalid fields and duplicate references before normalization', () => {
    const profile = toPersistedPresentationProfile(initializeProjectDeviceStyles(createDefaultPresentationProfile())!.profile)
    profile.deviceStyles.push({ ...profile.deviceStyles[0] })
    profile.utilities[0].id = profile.deviceStyles[0].id
    profile.utilities[0].color = 'invalid'
    profile.utilities[0].opacity = 2
    profile.deviceStyles[0].lineWidthPx = 13
    const result = parseHighlightStyleDocument({ presentationProfile: profile })
    expect(result).toMatchObject({
      ok: false, errors: expect.arrayContaining([
        { code: 'value', path: 'deviceStyles[0].lineWidthPx' },
        { code: 'duplicateId', path: 'deviceStyles[3].id' },
        { code: 'duplicateState', path: 'deviceStyles[3].deviceState' },
        { code: 'duplicateId', path: 'utilities[0].id' },
        { code: 'value', path: 'utilities[0].color' },
        { code: 'value', path: 'utilities[0].opacity' }
      ])
    })
    expect(parseHighlightStyleDocument({})).toMatchObject({ ok: false })
  })

  it('initializes a new project from bundled templates before any drawing is loaded', () => {
    const source = normalizePresentationProfile({})
    const initialized = initializeProjectDeviceStyles(source)!.profile
    expect(initialized.devices.map(device => device.name)).toEqual(['Valve'])
    expect(initialized.devices[0].states.map(state => state.key)).toEqual(['OPEN', 'CLOSE', 'PULSE'])
    expect(initialized.defaultStyleSeed).toEqual({ status: 'generated', templateVersion: 2 })
    expect(toPersistedPresentationProfile(initialized)).toMatchObject({
      deviceStyles: [
        { deviceType: 'Valve', deviceState: 'OPEN', displayName: 'ON', color: '#00C853', lineWidthPx: 3, opacity: 0.5, autoHighlightFlow: true, flowBehavior: 'conducting' },
        { deviceType: 'Valve', deviceState: 'CLOSE', displayName: 'OFF', color: '#B8B8B8', lineWidthPx: 3, opacity: 0.5, autoHighlightFlow: false, flowBehavior: 'blocking' },
        { deviceType: 'Valve', deviceState: 'PULSE', displayName: 'PULSE', color: '#00C853', lineWidthPx: 3, opacity: 1, autoHighlightFlow: false, flowBehavior: 'neutral' }
      ],
      utilities: [
        { id: 'builtin:utility:1', name: 'Utility 1', color: '#10D7DA', lineWidthPx: 4, opacity: 0.5 },
        { id: 'builtin:utility:2', name: 'Utility 2', color: '#C79C00', lineWidthPx: 3, opacity: 0.5 }
      ]
    })
    expect(initialized.utilities.every(utility => utility.enabled && utility.style.visible)).toBe(true)
    expect(source.devices).toEqual([])
    expect(source.utilities).toEqual([])
    expect(initializeProjectDeviceStyles(initialized)).toBeUndefined()
    const cleared = { ...initialized, devices: [], utilities: [] }
    expect(initializeProjectDeviceStyles(cleared)).toBeUndefined()
    expect(initializeProjectDeviceStyles(normalizePresentationProfile({ deviceStyles: [], utilities: [] }))!.profile.devices).toHaveLength(1)
  })

  it('preserves generated state references through persistence', () => {
    const generated = generateDefaultDeviceStyles(document, createDefaultPresentationProfile()).profile
    const restored = normalizePresentationProfile(toPersistedPresentationProfile(generated))
    expect(findPhaseOverlayStyleWarnings(restored, [], {
      A1: { key: 'A1', deviceType: 'Valve', stateKey: 'OPEN', highlightStyleRefId: generated.devices[0].states[0].id }
    })).toEqual([])
  })

  it('round-trips Utility defaults without replacing customized or deleted utilities', () => {
    const initialized = initializeProjectDeviceStyles(createDefaultPresentationProfile())!.profile
    const restored = normalizePresentationProfile(toPersistedPresentationProfile(initialized))
    expect(restored.utilities).toEqual(initialized.utilities)
    expect(findPhaseOverlayStyleWarnings(restored, [{
      id: 'flow-1', name: 'Flow', handleKeys: [], utilityId: initialized.utilities[0].id
    }])).toEqual([])
    restored.utilities[0].style.color = 0x123456
    restored.utilities.pop()
    expect(initializeProjectDeviceStyles(restored)).toBeUndefined()
    expect(generateDefaultDeviceStyles(document, restored).profile.utilities).toEqual(restored.utilities)
    const onlyUtilities = createDefaultPresentationProfile()
    onlyUtilities.utilities = restored.utilities
    expect(initializeProjectDeviceStyles(onlyUtilities)).toBeUndefined()
    restored.utilities = []
    expect(initializeProjectDeviceStyles(normalizePresentationProfile(toPersistedPresentationProfile(restored)))).toBeUndefined()
  })

  it('avoids existing IDs and appends after custom ordering', () => {
    const source = createDefaultPresentationProfile()
    source.devices.push({ id: 'custom', name: 'Custom', states: [], order: 20 })
    source.utilities.push({
      id: 'builtin:valve:OPEN', name: 'Custom utility', style: source.defaultFlowStyle,
      enabled: true, order: 0
    })
    const generated = generateDefaultDeviceStyles(document, source).profile
    expect(generated.devices[1].order).toBe(21)
    expect(generated.devices[1].states[0].id).toBe('builtin:valve:OPEN:2')
    expect(generated.utilities).toEqual(source.utilities)
    generated.devices[1].states.pop()
    generated.devices[1].states[0].order = 30
    const supplemented = generateDefaultDeviceStyles(document, generated).profile
    expect(supplemented.devices[1].states[2].order).toBe(31)
    expect(initializeDefaultDeviceStyles(document, source)).toBeUndefined()
  })

  it('persists initialization and does not regenerate after explicit deletion', () => {
    const source = createDefaultPresentationProfile()
    expect(initializeDefaultDeviceStyles({}, source)?.profile.defaultStyleSeed?.status).toBe('pending')
    const generated = initializeDefaultDeviceStyles(document, source)!.profile
    generated.devices = []
    const restored = normalizePresentationProfile(toPersistedPresentationProfile(generated))
    expect(restored.defaultStyleSeed).toEqual({ status: 'generated', templateVersion: 2 })
    expect(initializeDefaultDeviceStyles(document, restored)).toBeUndefined()
    const legacy = normalizePresentationProfile({
      defaultStyleSeed: { status: 'configured' }, deviceStyles: [], utilities: []
    })
    expect(legacy.defaultStyleSeed?.status).toBe('configured')
    expect(initializeDefaultDeviceStyles(document, legacy)).toBeUndefined()
    expect(normalizePresentationProfile({}).defaultStyleSeed?.status).toBe('pending')
  })

  it.each([
    {},
    { deviceStyles: [], utilities: [] },
    { devices: [], utilities: [] },
    { deviceStyles: { valve: { open: null, closed: null } }, utilities: [] }
  ])('initializes unmarked empty backend configuration: %j', configuration => {
    const source = normalizePresentationProfile(configuration)
    expect(source.defaultStyleSeed?.status).toBe('pending')
    const initialized = initializeProjectDeviceStyles(source)!.profile
    expect(initialized.devices[0].states).toHaveLength(3)
    expect(initialized.utilities).toHaveLength(2)
    expect(initializeProjectDeviceStyles(initialized)).toBeUndefined()
  })

  it('generates once per category and reports unknown categories without changing its input', () => {
    const source = createDefaultPresentationProfile()
    const result = generateDefaultDeviceStyles(document, source)
    expect(result.addedCategories).toEqual(['Valve'])
    expect(result.addedStates).toEqual(['Valve / OPEN', 'Valve / CLOSE', 'Valve / PULSE'])
    expect(result.unknownCategories).toEqual(['PP', 'MX'])
    expect(result.profile.devices[0].states.map(state => state.autoHighlightFlow)).toEqual([true, false, false])
    expect(source.devices).toEqual([])
    expect(generateDefaultDeviceStyles(document, result.profile).profile).toEqual(result.profile)
    expect(generateDefaultDeviceStyles({}, source).addedStates).toEqual([])
  })

  it('only appends missing states and preserves custom styles and references', () => {
    const source = generateDefaultDeviceStyles(document, createDefaultPresentationProfile()).profile
    source.devices[0].name = 'VALVE'
    source.devices[0].states.pop()
    source.devices[0].states[0].id = 'user-state'
    source.devices[0].states[0].color = 0x123456
    const result = generateDefaultDeviceStyles(document, source)
    expect(result.profile.devices[0].states[0]).toEqual(source.devices[0].states[0])
    expect(result.addedCategories).toEqual([])
    expect(result.addedStates).toEqual(['Valve / PULSE'])
  })

  it('supports additional exported categories with their own stable IDs', () => {
    const result = generateDefaultDeviceStyles(document, createDefaultPresentationProfile(), {
      presentationProfile: {
        ...templates.presentationProfile,
        deviceStyles: [
          ...templates.presentationProfile.deviceStyles,
          ...templates.presentationProfile.deviceStyles.map(state => ({
            ...state, deviceType: 'PP', id: state.id.replace('valve', 'pp')
          }))
        ]
      }
    })
    const ids = result.profile.devices.flatMap(device => device.states.map(state => state.id))
    expect(new Set(ids).size).toBe(6)
  })

  it('rejects invalid templates before generating styles', () => {
    expect(() => generateDefaultDeviceStyles(document, createDefaultPresentationProfile(), {
      presentationProfile: { deviceStyles: [{}], utilities: [] }
    })).toThrow('Invalid default styles')
  })

  it('initializes with the same parsed data as import and preserves unrelated presentation settings', () => {
    const source = createDefaultPresentationProfile()
    source.defaultFlowStyle.color = 0x123456
    source.dimmedBaseStyle.opacity = 0.25
    const initialized = initializeProjectDeviceStyles(source)!.profile
    const parsed = parseHighlightStyleDocument(templates)
    if (!parsed.ok) throw new Error('Expected valid defaults')
    expect(initialized.devices).toEqual(parsed.profile.devices)
    expect(initialized.utilities).toEqual(parsed.profile.utilities)
    expect(initialized.defaultFlowStyle).toEqual(source.defaultFlowStyle)
    expect(initialized.dimmedBaseStyle).toEqual(source.dimmedBaseStyle)
    expect(toPersistedPresentationProfile(initialized)).toMatchObject(templates.presentationProfile)
    initialized.devices[0].states[0].opacity = 0.2
    expect(initializeProjectDeviceStyles(source)!.profile.devices[0].states[0].opacity).toBe(0.5)
  })
})