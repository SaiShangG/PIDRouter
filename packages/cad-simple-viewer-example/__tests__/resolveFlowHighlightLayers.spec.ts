import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type { FlowPathStatus } from '../src/phase/types'
import { resolveFlowHighlightLayers } from '../src/presentation/resolveFlowHighlightLayers'

describe('resolveFlowHighlightLayers', () => {
  const createFixture = () => {
    const profile = createDefaultPresentationProfile()
    profile.utilities.push(
      {
        id: 'water',
        name: 'Water',
        style: {
          color: 0x1565c0,
          lineWidthPx: 2,
          opacity: 0.7,
          visible: true
        },
        enabled: true,
        order: 20
      },
      {
        id: 'steam',
        name: 'Steam',
        style: {
          color: 0xef6c00,
          lineWidthPx: 5,
          opacity: 0.45,
          visible: true
        },
        enabled: true,
        order: 10
      }
    )
    const water: FlowPathStatus = {
      id: 'water-path',
      name: 'Water path',
      handleKeys: ['shared'],
      priority: 20,
      highlightStyleRefId: 'water'
    }
    const steam: FlowPathStatus = {
      id: 'steam-path',
      name: 'Steam path',
      handleKeys: ['shared'],
      priority: 10,
      highlightStyleRefId: 'steam'
    }
    return { profile, water, steam }
  }

  it('selects the highest-priority flow style for a shared entity', () => {
    const { profile, water, steam } = createFixture()

    expect(resolveFlowHighlightLayers(profile, [water, steam])).toEqual([
      {
        id: 'water-path',
        renderOrder: 10000,
        style: expect.objectContaining({
          color: 0x1565c0,
          lineWidthPx: 2,
          opacity: 0.7,
          source: 'utility'
        })
      }
    ])
  })

  it('uses a stable ID tie-breaker when priorities match', () => {
    const { profile, water, steam } = createFixture()
    const equalPriorityWater = { ...water, priority: 10 }

    expect(resolveFlowHighlightLayers(profile, [steam, equalPriorityWater])
      .map(layer => layer.id)).toEqual(['steam-path'])
  })

  it('uses the active flow path before priority', () => {
    const { profile, water, steam } = createFixture()

    expect(resolveFlowHighlightLayers(profile, [water, steam], undefined, undefined, 'steam-path')
      .map(layer => layer.id)).toEqual(['steam-path'])
  })

  it('collapses flow layers when a configured device style has precedence', () => {
    const { profile, water, steam } = createFixture()
    profile.devices.push({
      id: 'valve', name: 'Valve', order: 0,
      states: [{
        id: 'open', key: 'OPEN', displayName: 'Open',
        color: 0x2e7d32, lineWidthPx: 4, opacity: 0.9, enabled: true,
        flowBehavior: 'conducting', autoHighlightFlow: true, order: 0
      }]
    })

    expect(resolveFlowHighlightLayers(
      profile,
      [water, steam],
      { key: 'valve-1', stateKey: 'OPEN', deviceType: 'Valve', highlightStyleRefId: 'open' }
    )).toEqual([{
      id: 'device:valve-1',
      renderOrder: 10000,
      style: expect.objectContaining({
        color: 0x2e7d32,
        lineWidthPx: 4,
        opacity: 0.9,
        source: 'device'
      })
    }])
  })

  it('renders only a persistent warning frame for deleted states, even on a saved flow or exclusion', () => {
    const { profile, water } = createFixture()
    const device = {
      key: 'A', stateKey: 'Close', deviceType: 'Valve', highlightStyleRefId: 'deleted-close'
    }
    const before = JSON.stringify(device)
    const warning = resolveFlowHighlightLayers(profile, [water], device, undefined, undefined, {
      excluded: true, device: true,
      addition: { handleKey: 'A', highlightStyleRefId: 'water' }
    })
    expect(warning).toEqual([{
      id: 'invalid-device-state:A', kind: 'device-warning', renderOrder: 25000,
      style: expect.objectContaining({ source: 'invalid-device-state', color: 0xff9800 })
    }])
    expect(resolveFlowHighlightLayers(profile, [], device)).toEqual(warning)
    expect(resolveFlowHighlightLayers(profile, [], { ...device })).toEqual(warning)
    expect(JSON.stringify(device)).toBe(before)
  })

  it('removes the warning when the original preset returns without rewriting the Phase state', () => {
    const { profile } = createFixture()
    const device = {
      key: 'A', stateKey: 'Close', deviceType: 'Valve', highlightStyleRefId: 'closed'
    }
    expect(resolveFlowHighlightLayers(profile, [], device)[0].kind).toBe('device-warning')
    profile.devices = [{ id: 'valve', name: 'Valve', order: 0, states: [{
      id: 'closed', key: 'Close', displayName: 'Closed', enabled: true,
      color: 0xff0000, lineWidthPx: 3, opacity: 1, order: 0,
      flowBehavior: 'blocking', autoHighlightFlow: false
    }] }]
    expect(resolveFlowHighlightLayers(profile, [], device)).toEqual([{
      id: 'device:A', renderOrder: 10000,
      style: expect.objectContaining({ source: 'device', color: 0xff0000 })
    }])
    expect(device.highlightStyleRefId).toBe('closed')
  })

  it('does not mark unselected devices and preserves explicit diagnostic precedence', () => {
    const { profile } = createFixture()
    expect(resolveFlowHighlightLayers(profile, [])).toEqual([])
    const device = {
      key: 'A', stateKey: 'Close', deviceType: 'Valve', highlightStyleRefId: 'deleted'
    }
    expect(resolveFlowHighlightLayers(profile, [], device, {
      color: 0x00bcd4, lineWidthPx: 5, opacity: 1, visible: true
    })[0]).toMatchObject({
      id: 'diagnostic:A', style: { source: 'diagnostic', color: 0x00bcd4 }
    })
  })
})