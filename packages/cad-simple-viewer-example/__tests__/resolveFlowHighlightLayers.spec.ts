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
      styleSource: { kind: 'utility', utilityId: 'water' }
    }
    const steam: FlowPathStatus = {
      id: 'steam-path',
      name: 'Steam path',
      handleKeys: ['shared'],
      priority: 10,
      styleSource: { kind: 'utility', utilityId: 'steam' }
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
    profile.deviceStyles.valve.open = {
      color: 0x2e7d32,
      lineWidthPx: 4,
      opacity: 0.9,
      visible: true
    }

    expect(resolveFlowHighlightLayers(
      profile,
      [water, steam],
      { key: 'valve-1', label: 'XV-1', mode: 'open' }
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
})