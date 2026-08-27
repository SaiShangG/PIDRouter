import { findPhaseOverlayStyleWarnings } from '../src/phase/phaseOverlayStyleResolver'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'

describe('findPhaseOverlayStyleWarnings', () => {
  it('accepts existing Utility and device style references', () => {
    const profile = createDefaultPresentationProfile()
    profile.utilities.push({
      id: 'water',
      name: 'Water',
      style: profile.defaultFlowStyle,
      enabled: true,
      order: 0
    })
    profile.devices.push({
      id: 'valve',
      name: 'Valve',
      order: 0,
      states: [{
        id: 'valve-open',
        key: 'Open',
        displayName: 'Open',
        color: 0x00cc66,
        lineWidthPx: 3,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: true,
        flowBehavior: 'conducting',
        order: 0
      }]
    })

    expect(findPhaseOverlayStyleWarnings(profile, [{
      id: 'flow-1',
      name: 'Flow 1',
      handleKeys: ['1A'],
      styleSource: { kind: 'utility', utilityId: 'water' }
    }], {
      '1A': {
        key: '1A',
        label: 'XV-1',
        mode: 'unknown',
        stateKey: 'Open',
        deviceDefinitionId: 'valve',
        highlightStyleRefId: 'valve-open'
      }
    })).toEqual([])
  })

  it('reports missing references without changing the persisted runtime values', () => {
    const profile = createDefaultPresentationProfile()
    const flowPath = {
      id: 'flow-1',
      name: 'Flow 1',
      handleKeys: ['1A'],
      styleSource: { kind: 'utility' as const, utilityId: 'missing-utility' }
    }
    const deviceState = {
      key: '1A',
      label: 'XV-1',
      mode: 'unknown' as const,
      stateKey: 'Open',
      deviceDefinitionId: 'valve',
      highlightStyleRefId: 'missing-style'
    }
    const before = JSON.stringify({ flowPath, deviceState })

    expect(findPhaseOverlayStyleWarnings(
      profile,
      [flowPath],
      { '1A': deviceState }
    )).toEqual([
      {
        kind: 'missing-flow-utility',
        flowPathId: 'flow-1',
        styleRefId: 'missing-utility'
      },
      {
        kind: 'missing-device-definition',
        handleKey: '1A',
        deviceType: 'valve'
      }
    ])
    expect(JSON.stringify({ flowPath, deviceState })).toBe(before)
  })

  it('reports a stateKey that does not exist on the referenced device', () => {
    const profile = createDefaultPresentationProfile()
    profile.devices.push({
      id: 'valve',
      name: 'Valve',
      order: 0,
      states: [{
        id: 'valve-open',
        key: 'Open',
        displayName: 'Open',
        color: 0x00cc66,
        lineWidthPx: 3,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: true,
        flowBehavior: 'conducting',
        order: 0
      }]
    })

    expect(findPhaseOverlayStyleWarnings(profile, [], {
      '1A': {
        key: '1A',
        label: 'XV-1',
        mode: 'unknown',
        stateKey: 'Missing',
        deviceDefinitionId: 'valve',
        highlightStyleRefId: 'valve-open'
      }
    })).toEqual([{
      kind: 'missing-device-state',
      handleKey: '1A',
      deviceType: 'valve',
      stateKey: 'Missing'
    }])
  })
})