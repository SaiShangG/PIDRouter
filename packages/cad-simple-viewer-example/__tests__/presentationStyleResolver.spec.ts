import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type { FlowPathStatus } from '../src/phase/types'
import {
  normalizeHighlightStyle,
  resolveEntityPresentation
} from '../src/presentation/presentationStyleResolver'

describe('presentationStyleResolver', () => {
  it('applies global device, utility, and default precedence', () => {
    const profile = createDefaultPresentationProfile()
    profile.utilities.push({
      id: 'water',
      name: 'Water',
      style: { color: 0x112233, lineWidthPx: 2, opacity: 0.8, visible: true },
      enabled: true,
      order: 0
    })
    const flowPath: FlowPathStatus = {
      id: 'flow-1',
      name: 'Route',
      handleKeys: ['1a'],
      utilityId: 'water',
      styleOverride: { color: 0x445566 }
    }

    expect(resolveEntityPresentation(profile, { flowPath })).toMatchObject({
      color: 0x112233,
      lineWidthPx: 2,
      source: 'utility'
    })
    expect(
      resolveEntityPresentation(profile, {
        flowPath,
        deviceState: { key: '1a', label: 'XV-1', mode: 'closed' }
      })
    ).toMatchObject({ color: 0x112233, source: 'utility' })
    profile.deviceStyles.valve.closed = {
      color: 0xd32f2f,
      lineWidthPx: 3,
      opacity: 1,
      visible: true
    }
    expect(
      resolveEntityPresentation(profile, {
        flowPath,
        deviceState: { key: '1a', label: 'XV-1', mode: 'closed' }
      })
    ).toMatchObject({ color: 0xd32f2f, source: 'device' })
    expect(
      resolveEntityPresentation(profile, {
        flowPath: { ...flowPath, utilityId: 'missing', styleOverride: undefined }
      })
    ).toMatchObject({ color: 0x00c853, source: 'flow' })
    expect(
      resolveEntityPresentation(profile, {
        flowPath: {
          ...flowPath,
          utilityId: undefined,
          styleOverride: { color: 0x9c27b0, lineWidthPx: 3.5 }
        }
      })
    ).toMatchObject({ color: 0x9c27b0, lineWidthPx: 3.5, source: 'flow' })
  })

  it('clamps style fields and produces stable keys', () => {
    expect(
      normalizeHighlightStyle({
        color: 0x1ffffff,
        lineWidthPx: 99,
        opacity: -1,
        visible: false
      })
    ).toEqual({ color: 0xffffff, lineWidthPx: 12, opacity: 0, visible: false })
    const profile = createDefaultPresentationProfile()
    const first = resolveEntityPresentation(profile)
    const second = resolveEntityPresentation(profile)
    expect(first.key).toBe(second.key)
  })

  it('does not mutate profile, flow, or override inputs', () => {
    const profile = createDefaultPresentationProfile()
    const flowPath: FlowPathStatus = {
      id: 'flow-1',
      name: 'Route',
      handleKeys: ['1a'],
      styleOverride: { opacity: 0.4 }
    }
    const before = JSON.stringify({ profile, flowPath })
    resolveEntityPresentation(profile, { flowPath })
    expect(JSON.stringify({ profile, flowPath })).toBe(before)
  })
})