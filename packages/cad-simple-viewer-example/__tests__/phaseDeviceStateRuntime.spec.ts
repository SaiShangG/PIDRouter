import {
  DeviceStateWarningNotifications,
  enrichManualHighlightDeviceStates,
  mergeHighlightedValveStates,
  resolveDeviceStateDefinition,
  resolveManualHighlightDeviceState,
  resolveValveBrushStyleRefId
} from '../src/phase/phaseDeviceStateRuntime'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type {
  DeviceState,
  DeviceStateStyleDefinition,
  DeviceStyleDefinition,
  ManualHighlightCorrections
} from '../src/phase/types'
import { resolveEntityPresentation } from '../src/presentation/presentationStyleResolver'

describe('manual highlight device metadata', () => {
  const fixture = () => {
    const device: DeviceStyleDefinition = {
      id: 'valve', name: 'Valve', order: 0,
      states: [
        {
          id: 'open', key: 'RUNNING', displayName: 'Open', enabled: true,
          color: 0x00ff00, lineWidthPx: 3, opacity: 1,
          flowBehavior: 'conducting', autoHighlightFlow: true, order: 0
        },
        {
          id: 'closed', key: 'CLOSED', displayName: 'Closed', enabled: true,
          color: 0xff0000, lineWidthPx: 3, opacity: 1,
          flowBehavior: 'blocking', autoHighlightFlow: false, order: 1
        }
      ]
    }
    return { device }
  }

  it.each([
    ['open', 'RUNNING'],
    ['closed', 'CLOSED']
  ])('uses the selected %s preset state instead of hard-coding OPEN', (styleId, stateKey) => {
    const { device } = fixture()
    const before = JSON.stringify(device)
    expect(resolveManualHighlightDeviceState(device, styleId))
      .toEqual({ stateKey, deviceType: 'Valve' })
    expect(JSON.stringify(device)).toBe(before)
  })

  it('does not infer device identity from a style or accept disabled and foreign presets', () => {
    const { device } = fixture()
    expect(resolveManualHighlightDeviceState(undefined, 'open')).toBeUndefined()
    expect(resolveManualHighlightDeviceState(device, 'utility-water')).toBeUndefined()
    expect(resolveManualHighlightDeviceState(device, 'pump-open')).toBeUndefined()
    device.states[0].enabled = false
    expect(resolveManualHighlightDeviceState(device, 'open')).toBeUndefined()
  })

  it('enriches only verified devices and preserves explicit metadata, exclusions and sources', () => {
    const { device } = fixture()
    const explicitState = { stateKey: 'OPEN', deviceType: 'Valve' }
    const corrections: ManualHighlightCorrections = {
      additions: [
        { handleKey: 'A', highlightStyleRefId: 'open' },
        { handleKey: 'B', highlightStyleRefId: 'open' },
        { handleKey: 'C', highlightStyleRefId: 'utility-water' },
        { handleKey: 'D', highlightStyleRefId: 'closed', deviceState: explicitState },
        { handleKey: 'E', highlightStyleRefId: 'missing' },
        { handleKey: 'F', highlightStyleRefId: 'closed' }
      ],
      exclusions: ['F']
    }
    const before = JSON.stringify(corrections)
    const resolveDevice = (handleKey: string) => handleKey === 'B' ? undefined : device
    const enriched = enrichManualHighlightDeviceStates(corrections, resolveDevice)
    expect(enriched).toEqual({
      additions: [
        {
          handleKey: 'A', highlightStyleRefId: 'open',
          deviceState: { stateKey: 'RUNNING', deviceType: 'Valve' }
        },
        corrections.additions[1],
        corrections.additions[2],
        corrections.additions[3],
        corrections.additions[4],
        {
          handleKey: 'F', highlightStyleRefId: 'closed',
          deviceState: { stateKey: 'CLOSED', deviceType: 'Valve' }
        }
      ],
      exclusions: ['F']
    })
    expect(JSON.stringify(corrections)).toBe(before)
    expect(enrichManualHighlightDeviceStates(enriched, resolveDevice)).toBe(enriched)
    expect(mergeHighlightedValveStates([], enriched, createDefaultPresentationProfile()))
      .toEqual([
        {
          handleKey: 'A', highlightStyleRefId: 'open',
          stateKey: 'RUNNING', deviceType: 'Valve', source: 'manual'
        },
        {
          handleKey: 'D', highlightStyleRefId: 'closed',
          stateKey: 'OPEN', deviceType: 'Valve', source: 'manual'
        }
      ])
  })

  it('keeps absent, empty and unresolvable corrections unchanged', () => {
    const resolveDevice = jest.fn()
    expect(enrichManualHighlightDeviceStates(undefined, resolveDevice)).toBeUndefined()
    const empty = { additions: [], exclusions: [] }
    expect(enrichManualHighlightDeviceStates(empty, resolveDevice)).toBe(empty)
    expect(resolveDevice).not.toHaveBeenCalled()
    const corrections = {
      additions: [{ handleKey: 'A', highlightStyleRefId: 'open' }],
      exclusions: []
    }
    expect(enrichManualHighlightDeviceStates(corrections, resolveDevice)).toBe(corrections)
  })
})

describe('device state warning notifications', () => {
  const fixture = () => {
    const profile = createDefaultPresentationProfile()
    const preset: DeviceStateStyleDefinition = {
      id: 'closed', key: 'Close', displayName: 'Closed', enabled: true,
      color: 0xff0000, lineWidthPx: 3, opacity: 1, order: 0,
      flowBehavior: 'blocking', autoHighlightFlow: false
    }
    profile.devices = [{ id: 'valve', name: 'Valve', order: 0, states: [] }]
    const record: DeviceState = {
      key: 'A', deviceType: 'Valve', stateKey: 'Close', highlightStyleRefId: 'closed'
    }
    return { profile, preset, record, notifications: new DeviceStateWarningNotifications() }
  }

  it('notifies once for repeated invalid references in each Phase', () => {
    const { notifications, profile, record } = fixture()
    const before = JSON.stringify(record)
    expect(notifications.update('project:phase-1', profile, [record])).toBe(true)
    expect(notifications.update('project:phase-1', profile, [record])).toBe(false)
    expect(notifications.update('project:phase-2', profile, [record])).toBe(true)
    expect(notifications.update('project:phase-1', profile, [record])).toBe(false)
    expect(notifications.update('project:phase-1', profile, [record, { ...record, key: 'B' }]))
      .toBe(true)
    expect(JSON.stringify(record)).toBe(before)
  })

  it('clears recovered references and warns again on a new invalid episode', () => {
    const { notifications, profile, preset, record } = fixture()
    expect(notifications.update('phase', profile, [record])).toBe(true)
    profile.devices[0].states.push(preset)
    expect(notifications.update('phase', profile, [record])).toBe(false)
    profile.devices[0].states = []
    expect(notifications.update('phase', profile, [record])).toBe(true)
    expect(notifications.update('phase', profile, [record])).toBe(false)
    notifications.clear()
    expect(notifications.update('phase', profile, [record])).toBe(true)
  })

  it('does not warn for unselected devices and distinguishes changed invalid references', () => {
    const { notifications, profile, record } = fixture()
    expect(notifications.update('phase', profile, [])).toBe(false)
    expect(notifications.update('phase', profile, [record])).toBe(true)
    expect(notifications.update('phase', profile, [{ ...record, highlightStyleRefId: 'other' }]))
      .toBe(true)
    expect(notifications.update('phase', profile, [])).toBe(false)
    expect(notifications.update('phase', profile, [record])).toBe(true)
  })

  it('rejects disabled and foreign presets without replacing the selected reference', () => {
    const { profile, preset, record } = fixture()
    profile.devices[0].states.push(preset)
    expect(resolveDeviceStateDefinition(profile, { ...record, deviceType: ' valve ' })?.state)
      .toBe(preset)
    expect(resolveDeviceStateDefinition(profile, { ...record, deviceType: 'Pump' }))
      .toBeUndefined()
    preset.enabled = false
    expect(resolveDeviceStateDefinition(profile, record)).toBeUndefined()
  })
})

describe('phase device state runtime', () => {
  it.each([
    ['conducting', true, true],
    ['blocking', true, false],
    ['neutral', true, false],
    ['conducting', false, false]
  ] as const)('merges configured %s enabled=%s valves as open=%s', (flowBehavior, enabled, expected) => {
    const profile = createDefaultPresentationProfile()
    profile.devices = [{
      id: 'valve', name: 'Valve', order: 0,
      states: [{
        id: 'configured-state', key: 'CUSTOM', displayName: 'Custom', enabled,
        color: 0x00ff00, lineWidthPx: 3, opacity: 1, order: 0,
        flowBehavior, autoHighlightFlow: false
      }]
    }]
    const automatic = [{
      handleKey: '10', stateKey: 'OPEN', deviceType: 'Valve', highlightStyleRefId: 'configured-state'
    }]
    const before = JSON.stringify({ profile, automatic })
    expect(mergeHighlightedValveStates(automatic, undefined, profile)).toHaveLength(expected ? 1 : 0)
    expect(mergeHighlightedValveStates([
      { ...automatic[0], highlightStyleRefId: 'missing' }
    ], undefined, profile)).toEqual([])
    expect(mergeHighlightedValveStates(automatic, {
      additions: [{
        handleKey: '10', highlightStyleRefId: 'manual-open',
        deviceState: { stateKey: 'OPEN', deviceType: 'Valve' }
      }],
      exclusions: ['10']
    }, profile)).toEqual([])
    expect(JSON.stringify({ profile, automatic })).toBe(before)
  })

  it('uses the valve device preset rather than a Utility and preserves the device configuration', () => {
    const closed: DeviceStateStyleDefinition = {
      id: 'valve-closed', key: 'closed', displayName: 'Closed', enabled: true,
      color: 0xff0000, lineWidthPx: 3, opacity: 1, order: 0,
      flowBehavior: 'blocking', autoHighlightFlow: false
    }
    const open: DeviceStateStyleDefinition = {
      ...closed, id: 'valve-open', key: 'Open', flowBehavior: 'conducting', order: 1
    }
    const device = { id: 'valve', name: 'Valve', order: 0, states: [closed, open] }
    const before = JSON.stringify(device)
    expect(resolveValveBrushStyleRefId(device)).toBe(open.id)
    expect(resolveValveBrushStyleRefId(device, { highlightStyleRefId: closed.id })).toBe(closed.id)
    expect(resolveValveBrushStyleRefId(device, { highlightStyleRefId: 'utility-water' })).toBe(open.id)
    expect(JSON.stringify(device)).toBe(before)
    const profile = createDefaultPresentationProfile()
    profile.devices = [device]
    profile.utilities = [{
      id: 'utility-water', name: 'Water', enabled: true, order: 0,
      style: { color: 0x0000ff, lineWidthPx: 1, opacity: 0.5, visible: true }
    }]
    const flowPath = {
      id: 'manual:A', name: 'Manual correction', handleKeys: ['A'],
      highlightStyleRefId: resolveValveBrushStyleRefId(device)!
    }
    expect(resolveEntityPresentation(profile, { flowPath })).toMatchObject({
      color: open.color, lineWidthPx: open.lineWidthPx, opacity: open.opacity
    })
    open.color = 0x00ff00
    expect(resolveEntityPresentation(profile, { flowPath }).color).toBe(0x00ff00)
    expect(resolveEntityPresentation(profile, {
      flowPath: { ...flowPath, highlightStyleRefId: 'utility-water' }
    }).color).toBe(0x0000ff)
    expect(resolveValveBrushStyleRefId({ ...device, states: [{ ...open, enabled: false }, closed] })).toBe(closed.id)
    expect(resolveValveBrushStyleRefId({ ...device, states: [{ ...open, key: 'Running' }, closed] })).toBe(open.id)
    expect(resolveValveBrushStyleRefId({ ...device, states: [{ ...open, enabled: false }] })).toBeUndefined()
    expect(resolveValveBrushStyleRefId(undefined)).toBeUndefined()
  })

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