import {
  deviceModeFromFlowBehavior,
  resolveDeviceStateDefinition
} from '../src/phase/phaseDeviceStateRuntime'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'

describe('phase device state runtime', () => {
  it('resolves a state by the exact deviceType and stateKey pair', () => {
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
      deviceDefinitionId: 'valve',
      stateKey: 'Running'
    })?.state.id).toBe('valve-running')
  })

  it('does not fall back to a state from another device definition', () => {
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
      deviceDefinitionId: 'valve',
      stateKey: 'Running'
    })).toBeUndefined()
  })

  it.each([
    ['conducting', 'open'],
    ['blocking', 'closed'],
    ['neutral', 'unknown']
  ] as const)('derives %s flow behavior as %s runtime mode', (behavior, mode) => {
    expect(deviceModeFromFlowBehavior(behavior)).toBe(mode)
  })
})