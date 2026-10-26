import { ManualHighlightCorrectionState } from '../src/phase/manualHighlightCorrections'
import { findPhaseOverlayStyleWarnings } from '../src/phase/phaseOverlayStyleResolver'
import { PhaseWorkspaceRepository } from '../src/phase/phaseWorkspaceRepository'
import {
  createDefaultPresentationProfile,
  PhaseWorkspaceStore
} from '../src/phase/phaseWorkspaceStore'
import type { DeviceState, FlowPathStatus, PhaseSnapshot } from '../src/phase/types'
import { resolveFlowHighlightLayers } from '../src/presentation/resolveFlowHighlightLayers'

const fixture = () => {
  const profile = createDefaultPresentationProfile()
  profile.utilities.push({
    id: 'water', name: 'Water', enabled: true, order: 0,
    style: { color: 0x123456, lineWidthPx: 3, opacity: 0.5, visible: true }
  })
  profile.devices.push({
    id: 'valve', name: 'Valve', order: 0,
    states: [{
      id: 'closed', key: 'CLOSE', displayName: 'Closed', enabled: true,
      color: 0x888888, lineWidthPx: 3, opacity: 1,
      autoHighlightFlow: false, flowBehavior: 'blocking', order: 0
    }]
  })
  const device: DeviceState = {
    key: 'A', stateKey: 'CLOSE', deviceType: 'Valve', highlightStyleRefId: 'closed'
  }
  const flows: FlowPathStatus[] = [
    {
      id: 'flow-one', name: 'First flow', handleKeys: ['A', 'B'],
      styleSource: { kind: 'utility', utilityId: 'water' }
    },
    {
      id: 'flow-two', name: 'Second flow', handleKeys: ['B'],
      styleSource: { kind: 'utility', utilityId: 'water' }
    }
  ]
  const state = new ManualHighlightCorrectionState()
  const layers = (handleKey: string, paths = flows, deviceState?: DeviceState) =>
    resolveFlowHighlightLayers(
      profile,
      paths.filter(flow => flow.handleKeys.includes(handleKey)),
      deviceState,
      undefined,
      undefined,
      {
        addition: state.getAddition(handleKey),
        excluded: state.isExcluded(handleKey),
        device: handleKey === 'A'
      }
    )
  return { state, profile, device, flows, layers }
}

describe('manual correction runtime', () => {
  it('paints and erases a closed valve without changing its state or automatic flows', () => {
    const { state, device, flows, layers } = fixture()
    const before = JSON.stringify({ device, flows })
    state.paint(['A'], { kind: 'utility', utilityId: 'water' })
    expect(layers('A', flows, device)).toEqual([
      expect.objectContaining({ id: 'device:A', style: expect.objectContaining({ color: 0x888888 }) }),
      expect.objectContaining({
        id: 'manual:device:A', geometry: 'bounds',
        style: expect.objectContaining({ color: 0x123456 })
      })
    ])
    state.erase([{ handleKey: 'A', hasAutomaticFlow: true }])
    expect(layers('A', flows, device)).toEqual([
      expect.objectContaining({ id: 'device:A', style: expect.objectContaining({ color: 0x888888 }) })
    ])
    expect(JSON.stringify({ device, flows })).toBe(before)
  })

  it('supplements missing flow and overrides automatic style with one entity layer', () => {
    const { state, layers } = fixture()
    const source = {
      kind: 'custom' as const,
      style: { color: 0xff0000, lineWidthPx: 5, opacity: 1, visible: true }
    }
    state.paint(['B', 'C'], source)
    for (const handleKey of ['B', 'C']) {
      expect(layers(handleKey)).toEqual([
        expect.objectContaining({
          id: `manual:flow:${handleKey}`,
          renderOrder: 20000,
          style: expect.objectContaining({ color: 0xff0000 })
        })
      ])
    }
    source.style.color = 0
    expect(layers('B')[0].style.color).toBe(0xff0000)
  })

  it('removes overlap in one erase and excludes all automatic flow contributions', () => {
    const { state, flows, layers } = fixture()
    state.paint(['B'], { kind: 'utility', utilityId: 'water' })
    state.erase([{ handleKey: 'B', hasAutomaticFlow: true }])
    expect(state.getAddition('B')).toBeUndefined()
    expect(state.snapshot().exclusions).toEqual(['B'])
    expect(layers('B')).toEqual([])
    const recomputed = flows.map(flow => ({ ...flow, id: `${flow.id}-recomputed` }))
    expect(layers('B', recomputed)).toEqual([])
  })

  it('does not exclude empty or device-only objects, or mutate state on repeated erasing', () => {
    const { state, device, layers } = fixture()
    expect(state.erase([
      { handleKey: 'A', hasAutomaticFlow: false },
      { handleKey: 'C', hasAutomaticFlow: false }
    ])).toBe(false)
    expect(state.snapshot()).toEqual({ additions: [], exclusions: [] })
    expect(layers('A', [], device)[0].id).toBe('device:A')
    state.paint(['C'], { kind: 'utility' })
    expect(state.erase([{ handleKey: 'C', hasAutomaticFlow: false }])).toBe(true)
    expect(state.erase([{ handleKey: 'C', hasAutomaticFlow: false }])).toBe(false)
    expect(state.snapshot()).toEqual({ additions: [], exclusions: [] })
  })

  it('repaints an excluded handle and permits recoloring without changing other marks', () => {
    const { state } = fixture()
    state.erase([{ handleKey: 'B', hasAutomaticFlow: true }])
    expect(state.paint(['B', 'C'], { kind: 'utility', utilityId: 'water' })).toBe(true)
    expect(state.isExcluded('B')).toBe(false)
    expect(state.paint(['B'], { kind: 'utility', utilityId: 'water' })).toBe(false)
    state.paint(['B'], { kind: 'utility' })
    expect(state.getAddition('C')?.styleSource).toEqual({ kind: 'utility', utilityId: 'water' })
    expect(state.getAddition('B')?.styleSource).toEqual({ kind: 'utility' })
  })

  it('rejects malformed erase hits before partially applying a correction', () => {
    const { state } = fixture()
    state.paint(['B'], { kind: 'utility', utilityId: 'water' })
    const before = state.snapshot()
    expect(() => state.erase([
      { handleKey: 'B', hasAutomaticFlow: true },
      { handleKey: 'invalid', hasAutomaticFlow: false }
    ])).toThrow('Invalid manual highlight corrections')
    expect(state.snapshot()).toEqual(before)
  })

  it('retains supplements when automatic flow is removed and preserves device fallback', () => {
    const { state, layers, device } = fixture()
    state.paint(['B'], { kind: 'utility', utilityId: 'water' })
    expect(layers('B', [])[0].id).toBe('manual:flow:B')
    state.erase([{ handleKey: 'A', hasAutomaticFlow: true }])
    expect(layers('A', [], { ...device, highlightStyleRefId: 'missing' })[0].id)
      .toBe('default:A')
  })

  it('restores exact corrections and isolates phases without changing automatic flow data', () => {
    const { state, flows, device, layers } = fixture()
    state.paint(['C', 'DEAD'], { kind: 'utility', utilityId: 'water' })
    state.erase([{ handleKey: 'B', hasAutomaticFlow: true }])
    const saved = state.snapshot()
    const before = JSON.stringify({ flows, device })
    state.restore()
    expect(layers('B')).toHaveLength(1)
    expect(layers('C')).toEqual([])
    state.restore(saved)
    saved.additions.splice(0)
    expect(layers('B')).toEqual([])
    expect(layers('C')[0].id).toBe('manual:flow:C')
    expect(state.getAddition('DEAD')).toBeDefined()
    expect(JSON.stringify({ flows, device })).toBe(before)
  })

  it('reports missing manual Utility references and renders a default without losing the reference', () => {
    const { state, profile, layers } = fixture()
    state.paint(['C'], { kind: 'utility', utilityId: 'missing' })
    expect(findPhaseOverlayStyleWarnings(profile, [], {}, state.snapshot())).toEqual([{
      kind: 'missing-manual-utility', handleKey: 'C', styleRefId: 'missing'
    }])
    expect(layers('C')[0].style.color).toBe(profile.defaultFlowStyle.color)
    expect(state.getAddition('C')?.styleSource).toEqual({
      kind: 'utility', utilityId: 'missing'
    })
  })

  it('round-trips edited corrections via the phase store and backend payload without new flow members', async () => {
    const { state, flows, device, profile } = fixture()
    state.paint(['C'], { kind: 'utility', utilityId: 'water' })
    state.erase([{ handleKey: 'B', hasAutomaticFlow: true }])
    const phase: PhaseSnapshot = {
      id: '20', name: 'Rinse', number: 1, drawing: { kind: 'unassigned' },
      flowState: { flowPaths: [], deviceStates: { A: device } },
      manualCorrections: state.snapshot(),
      createdAt: 'now', updatedAt: 'now'
    }
    const update = jest.fn().mockResolvedValue(undefined)
    const get = jest.fn()
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '', projectId: 1,
      files: { list: jest.fn(), upload: jest.fn() },
      procedures: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      operations: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      phases: { list: jest.fn(), create: jest.fn(), update, get, delete: jest.fn() }
    })
    await repository.updatePhase('10', phase, 1)
    get.mockResolvedValue({ ...update.mock.calls[0][1], id: 20 })
    const loaded = await repository.loadPhase('20', {}, 0)
    const store = new PhaseWorkspaceStore({
      version: 5, presentationProfile: profile, drawingAssets: {},
      processes: [{
        id: '1', name: 'Process', createdAt: 'now', updatedAt: 'now',
        sequences: [{
          id: '10', number: 1, name: 'Sequence', createdAt: 'now', updatedAt: 'now',
          phases: [loaded]
        }]
      }]
    })
    state.restore(store.snapshot().processes[0].sequences[0].phases[0].manualCorrections)
    expect(state.snapshot()).toEqual(phase.manualCorrections)
    expect(loaded.flowState.flowPaths).toEqual([])
    expect(loaded.flowState.deviceStates).toEqual({ A: device })
    expect(flows[0].handleKeys).toEqual(['A', 'B'])
  })
})
