import {
  DeviceStateWarningNotifications,
  resolveDeviceStateDefinition
} from '../src/phase/phaseDeviceStateRuntime'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type { DeviceState, DeviceStateStyleDefinition } from '../src/phase/types'

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