import { resolveDeviceStateDefinition } from '../src/phase/phaseDeviceStateRuntime'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'

describe('phase device state runtime', () => {
  it('resolves a state by its globally unique style reference', () => {
    const profile = createDefaultPresentationProfile()
    profile.devices.push({
      id: 'motor',
      name: 'Motor',
      order: 0,
      states: [{
        id: 'motor-running',
        key: 'Running',
        displayName: 'Motor running',
        color: 0xffaa00,
        lineWidthPx: 2,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: false,
        flowBehavior: 'neutral',
        order: 0
      }]
    }, {
      id: 'valve',
      name: 'Valve',
      order: 1,
      states: [{
        id: 'valve-running',
        key: 'Running',
        displayName: 'Valve open',
        color: 0x00cc66,
        lineWidthPx: 4,
        opacity: 0.9,
        enabled: true,
        autoHighlightFlow: true,
        flowBehavior: 'conducting',
        order: 0
      }]
    })

    expect(resolveDeviceStateDefinition(profile, {
      highlightStyleRefId: 'valve-running'
    })?.state.id).toBe('valve-running')
  })

  it('returns no state for an unknown style reference', () => {
    const profile = createDefaultPresentationProfile()
    profile.devices.push({
      id: 'motor',
      name: 'Motor',
      order: 0,
      states: [{
        id: 'motor-running',
        key: 'Running',
        displayName: 'Running',
        color: 0xffaa00,
        lineWidthPx: 2,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: false,
        flowBehavior: 'neutral',
        order: 0
      }]
    })

    expect(resolveDeviceStateDefinition(profile, {
      highlightStyleRefId: 'missing-style'
    })).toBeUndefined()
  })
})