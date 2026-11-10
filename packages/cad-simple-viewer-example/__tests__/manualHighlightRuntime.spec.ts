import { composeFinalFlowPaths } from '../src/phase/composeFinalFlowPaths'
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
      highlightStyleRefId: 'water'
    },
    {
      id: 'flow-two', name: 'Second flow', handleKeys: ['B'],
      highlightStyleRefId: 'water'
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
        excluded: state.isExcluded(handleKey)
      }
    )
  return { state, profile, device, flows, layers }
}

describe('manual correction runtime', () => {
  it('retains painted and erased device highlights independently of editing mode without modifying states', () => {
    const { state, device, flows, layers } = fixture()
    const before = JSON.stringify({ device, flows })
    const baseline = layers('A', [], device)
    expect(baseline[0].id).toBe('device:A')
    state.beginStroke()
    state.paint(['A', 'B', 'C'], 'water')
    state.endStroke()
    for (const handle of ['A', 'B', 'C']) {
      expect(layers(handle, flows, handle === 'A' ? device : undefined)[0])
        .toMatchObject({ id: `manual:flow:${handle}`, style: { color: 0x123456 } })
    }
    state.beginStroke()
    state.erase([{ handleKey: 'A', hasAutomaticFlow: false, hasDeviceHighlight: true }])
    state.endStroke()
    expect(state.snapshot().exclusions).toEqual(['A'])
    expect(layers('A', [], device)).toEqual([])
    state.undo()
    expect(layers('A', [], device)[0].id).toBe('manual:flow:A')
    state.redo()
    expect(layers('A', [], device)).toEqual([])
    expect(JSON.stringify({ device, flows })).toBe(before)
  })

  it('round-trips manual device overrides and exclusions with the same final visible snapshot', async () => {
    const { state, device, profile, flows } = fixture()
    const phase: PhaseSnapshot = {
      id: '20', number: 1, name: 'Manual', drawing: { kind: 'unassigned' },
      flowState: { flowPaths: flows, deviceStates: { A: device } },
      createdAt: 'now', updatedAt: 'now'
    }
    const update = jest.fn().mockResolvedValue(undefined)
    const get = jest.fn()
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '', projectId: 1, getPresentationProfile: () => profile,
      files: { list: jest.fn(), upload: jest.fn() },
      procedures: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      operations: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      phases: { list: jest.fn(), create: jest.fn(), update, get, delete: jest.fn() }
    })
    state.paint(['A'], 'water', { stateKey: 'OPEN', deviceType: 'Valve' })
    state.paint(['C'], 'water', { stateKey: 'OPEN', deviceType: 'Pump' })
    state.erase([{ handleKey: 'B', hasAutomaticFlow: true }])
    phase.manualCorrections = state.snapshot()
    await repository.updatePhase('10', phase, 1)
    const payload = update.mock.calls[0][1]
    expect(JSON.parse(payload.jsonData).flowPaths).toEqual([
      { handleKey: '10', highlightStyleRefId: 'water' },
      { handleKey: '12', highlightStyleRefId: 'water' }
    ])
    expect(JSON.parse(payload.jsonData)).not.toHaveProperty('highlightMode')
    for (const highlightMode of [undefined, 'auto', 'manual']) {
      get.mockResolvedValue({
        ...payload, id: 20,
        jsonData: JSON.stringify({ ...JSON.parse(payload.jsonData), highlightMode })
      })
      const loaded = await repository.loadPhase('20', {}, 0)
      expect(loaded).not.toHaveProperty('highlightMode')
      expect(loaded.manualCorrections?.additions).toEqual([
        { handleKey: 'A', highlightStyleRefId: 'water', deviceState: { stateKey: 'OPEN', deviceType: 'Valve' } },
        { handleKey: 'C', highlightStyleRefId: 'water', deviceState: { stateKey: 'OPEN', deviceType: 'Pump' } }
      ])
      expect(loaded.flowState.deviceStates).toEqual({ A: device })
      expect(repository.createPhaseData(loaded).mergedDeviceStates)
        .toEqual(JSON.parse(payload.jsonData).mergedDeviceStates)
      expect(composeFinalFlowPaths(loaded, profile)).toEqual(composeFinalFlowPaths(phase, profile))
    }
    state.erase([{ handleKey: 'A', hasAutomaticFlow: false, hasDeviceHighlight: true }])
    phase.manualCorrections = state.snapshot()
    await repository.updatePhase('10', phase, 1)
    const erased = update.mock.calls[1][1]
    expect(JSON.parse(erased.jsonData).mergedDeviceStates).toEqual([])
    get.mockResolvedValue({ ...erased, id: 20 })
    const restored = await repository.loadPhase('20', {}, 0)
    expect(restored.manualCorrections?.exclusions).toEqual(['B', 'A'])
    expect(resolveFlowHighlightLayers(profile, [], restored.flowState.deviceStates?.A,
      undefined, undefined, { excluded: true })).toEqual([])
    expect(restored.flowState.deviceStates).toEqual({ A: device })
  })

  it('honors saved valve corrections even when the automatic device style changes', () => {
    const { state, device, profile, flows, layers } = fixture()
    const before = JSON.stringify({ device, flows })
    state.paint(['A'], 'water')
    profile.devices[0].states[0].color = 0xff0000
    expect(layers('A', flows, device)).toEqual([
      expect.objectContaining({ id: 'manual:flow:A', style: expect.objectContaining({ color: 0x123456 }) })
    ])
    state.erase([{ handleKey: 'A', hasAutomaticFlow: true }])
    profile.devices[0].states[0].color = 0x00ff00
    expect(layers('A', flows, device)).toEqual([])
    expect(JSON.stringify({ device, flows })).toBe(before)
  })

  it('restores base device styles only when manual corrections are explicitly cleared', () => {
    const { state, device, flows, layers } = fixture()
    const automatic = layers('A', flows, device)
    state.paint(['A'], 'water')
    expect(layers('A', flows, device)[0].id).toBe('manual:flow:A')
    state.clear()
    expect(layers('A', flows, device)).toEqual(automatic)
    state.erase([{ handleKey: 'A', hasAutomaticFlow: false, hasDeviceHighlight: true }])
    expect(layers('A', flows, device)).toEqual([])
    state.clear()
    expect(layers('A', flows, device)).toEqual(automatic)
  })

  it('uses a device preset ID for manual flow and follows configuration changes', () => {
    const { state, profile, layers } = fixture()
    const preset = profile.devices[0].states[0]
    preset.color = 0xff0000
    preset.lineWidthPx = 5
    state.paint(['B', 'C'], preset.id)
    for (const handleKey of ['B', 'C']) {
      expect(layers(handleKey)).toEqual([
        expect.objectContaining({
          id: `manual:flow:${handleKey}`,
          renderOrder: 20000,
          style: expect.objectContaining({ color: 0xff0000 })
        })
      ])
    }
    expect(state.getAddition('B')?.highlightStyleRefId).toBe('closed')
    preset.color = 0x00ff00
    preset.lineWidthPx = 2
    expect(layers('B')[0].style).toMatchObject({ color: 0x00ff00, lineWidthPx: 2 })
  })

  it('removes overlap in one erase and excludes all automatic flow contributions', () => {
    const { state, flows, layers } = fixture()
    state.paint(['B'], 'water')
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
    state.paint(['C'], 'water')
    expect(state.erase([{ handleKey: 'C', hasAutomaticFlow: false }])).toBe(true)
    expect(state.erase([{ handleKey: 'C', hasAutomaticFlow: false }])).toBe(false)
    expect(state.snapshot()).toEqual({ additions: [], exclusions: [] })
  })

  it('repaints an excluded handle and permits recoloring without changing other marks', () => {
    const { state } = fixture()
    state.erase([{ handleKey: 'B', hasAutomaticFlow: true }])
    expect(state.paint(['B', 'C'], 'water')).toBe(true)
    expect(state.isExcluded('B')).toBe(false)
    expect(state.paint(['B'], 'water')).toBe(false)
    state.paint(['B'], 'closed')
    expect(state.getAddition('C')?.highlightStyleRefId).toEqual('water')
    expect(state.getAddition('B')?.highlightStyleRefId).toEqual('closed')
  })

  it('rejects malformed erase hits before partially applying a correction', () => {
    const { state } = fixture()
    state.paint(['B'], 'water')
    const before = state.snapshot()
    expect(() => state.erase([
      { handleKey: 'B', hasAutomaticFlow: true },
      { handleKey: 'invalid', hasAutomaticFlow: false }
    ])).toThrow('Invalid manual highlight corrections')
    expect(state.snapshot()).toEqual(before)
  })

  it('retains supplements when automatic flow is removed and preserves invalid-device warnings', () => {
    const { state, layers, device } = fixture()
    state.paint(['B'], 'water')
    expect(layers('B', [])[0].id).toBe('manual:flow:B')
    state.erase([{ handleKey: 'A', hasAutomaticFlow: true }])
    expect(layers('A', [], { ...device, highlightStyleRefId: 'missing' })[0].id)
      .toBe('invalid-device-state:A')
  })

  it('restores exact corrections and isolates phases without changing automatic flow data', () => {
    const { state, flows, device, layers } = fixture()
    state.paint(['C', 'DEAD'], 'water')
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
    state.paint(['C'], 'missing')
    expect(findPhaseOverlayStyleWarnings(profile, [], {}, state.snapshot())).toEqual([{
      kind: 'missing-manual-style', handleKey: 'C', styleRefId: 'missing'
    }])
    expect(layers('C')[0].style.color).toBe(profile.defaultFlowStyle.color)
    expect(state.getAddition('C')?.highlightStyleRefId).toEqual('missing')
  })

  it('round-trips edited corrections via the phase store and backend payload without new flow members', async () => {
    const { state, flows, device, profile } = fixture()
    state.paint(['C'], 'water')
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
      version: 6, presentationProfile: profile, drawingAssets: {},
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
