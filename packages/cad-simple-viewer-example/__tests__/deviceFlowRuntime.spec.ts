import {
  calculateAutomaticFlowPaths,
  haveFlowRulesChanged,
  resolveDeviceFlowPolicy
} from '../src/flow/deviceFlowRuntime'
import { buildFlowGraphIndex } from '../src/flow/flowGraph'
import { traverseFlowFromDevice } from '../src/flow/flowTraversal'
import { ManualHighlightCorrectionState } from '../src/phase/manualHighlightCorrections'
import { createDefaultPresentationProfile, PhaseWorkspaceStore } from '../src/phase/phaseWorkspaceStore'
import type {
  DeviceState,
  FlowBehavior,
  FlowPathStatus
} from '../src/phase/types'

const fixture = () => {
  const graph = buildFlowGraphIndex({
    Areas: [{
      Id: 'area',
      ControlModules: [
        { CadHandle: 1, Name: 'Valve' },
        { CadHandle: 3, Name: 'Pump' },
        { CadHandle: 5, Name: 'PP' }
      ],
      ContainCadEntityHandles: [1, 2, 3, 4, 5, 6]
    }],
    Map: { Graph: {
      Vertices: [1, 2, 3, 4, 5, 6],
      Edges: [1, 2, 3, 4, 5].map(key => ({ Source: key, Target: key + 1 }))
    } }
  })
  const profile = createDefaultPresentationProfile()
  const presets: Array<[string, FlowBehavior, boolean]> = [
    ['RUN', 'conducting', true],
    ['PASS', 'conducting', false],
    ['STOP', 'blocking', true],
    ['NEUTRAL', 'neutral', true]
  ]
  profile.devices = ['Valve', 'Pump', 'PP'].map(name => ({
    id: name, name, order: 0,
    states: presets.map(([key, flowBehavior, autoHighlightFlow], order) => ({
      id: `${name}-${key}`, key, displayName: key,
      flowBehavior, autoHighlightFlow, enabled: true,
      color: 0x00ff00, lineWidthPx: 3, opacity: 1, order
    }))
  }))
  profile.utilities = [
    { id: 'later', name: 'Later', enabled: true, order: 2,
      style: { color: 0x0000ff, lineWidthPx: 3, opacity: 1, visible: true } },
    { id: 'first', name: 'First', enabled: true, order: 1,
      style: { color: 0x00ff00, lineWidthPx: 3, opacity: 1, visible: true } }
  ]
  const selected = (key: string, type: string, state: string): DeviceState => ({
    key, deviceType: type, stateKey: state, highlightStyleRefId: `${type}-${state}`
  })
  const states = [
    selected('1', 'Valve', 'RUN'),
    selected('3', 'Pump', 'PASS'),
    selected('5', 'PP', 'PASS')
  ]
  const calculate = (paths: readonly FlowPathStatus[] = [], utilitySelections?: ReadonlyMap<string, string>) =>
    calculateAutomaticFlowPaths(graph, profile, states, paths, {
      idPrefix: 'flow-phase', name: 'Connected flow', utilitySelections
    })
  return { graph, profile, states, selected, calculate }
}

describe('device flow runtime', () => {
  it.each([
    ['conducting', true, true], ['conducting', false, false],
    ['blocking', true, false], ['blocking', false, false],
    ['neutral', true, false], ['neutral', false, false]
  ] as const)(
    'resolves flowBehavior=%s, autoHighlightFlow=%s to source=%s',
    (flowBehavior, autoHighlightFlow, expected) => {
      const { profile } = fixture()
      const state = { ...profile.devices[0].states[0], flowBehavior, autoHighlightFlow }
      expect(resolveDeviceFlowPolicy([state], state.id)).toEqual({
        flowBehavior, autoHighlightFlow: expected
      })
    }
  )

  it.each(['Valve', 'Pump', 'PP'])('lets %s start and retain a flow through repeated recalculations', type => {
    const { states, selected, calculate } = fixture()
    states.splice(0, states.length,
      selected('1', 'Valve', type === 'Valve' ? 'RUN' : 'PASS'),
      selected('3', 'Pump', type === 'Pump' ? 'RUN' : 'PASS'),
      selected('5', 'PP', type === 'PP' ? 'RUN' : 'PASS'))
    let paths = calculate().paths
    for (let index = 0; index < 3; index++) paths = calculate(paths).paths
    expect(paths).toHaveLength(1)
    expect(new Set(paths[0].handleKeys)).toEqual(new Set(['1', '2', '3', '4', '5', '6']))
    expect(paths[0].highlightStyleRefId).toBe('first')
  })

  it.each(['PASS', 'STOP', 'NEUTRAL'])('does not let explicit source selection override %s rules', state => {
    const { graph, states, selected, calculate } = fixture()
    states[0] = selected('1', 'Valve', state)
    expect(traverseFlowFromDevice(graph, '1', calculate().policies, true).highlightedKeys.size)
      .toBe(0)
  })

  it.each([
    ['3', 'Pump', ['1', '2']],
    ['5', 'PP', ['1', '2', '3', '4']]
  ])('blocks at %s %s even with a legacy conflicting auto flag', (key, type, expected) => {
    const { states, selected, calculate } = fixture()
    states.splice(states.findIndex(state => state.key === key), 1, selected(key, type, 'STOP'))
    expect(calculate().paths.map(path => path.ownerHandleKey)).toEqual(['1'])
    expect(calculate().paths[0].handleKeys).toEqual(expected)
  })

  it('passes through neutral devices without making them sources', () => {
    const { states, selected, calculate } = fixture()
    states[1] = selected('3', 'Pump', 'NEUTRAL')
    states[2] = selected('5', 'PP', 'NEUTRAL')
    expect(calculate().paths).toHaveLength(1)
    expect(calculate().paths[0].handleKeys).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('blocks unselected configured devices, but never treats an inferred pipe owner as a device', () => {
    const { graph, states, calculate } = fixture()
    states.splice(1)
    const result = calculate()
    expect(result.policies.get('3')?.issue).toBe('unselected')
    expect(graph.primaryHandleByCadHandle.get('6')).toBe('5')
    expect(result.policies.has('6')).toBe(false)
    expect(result.paths[0].handleKeys).toEqual(['1', '2'])
  })

  it('blocks and diagnoses missing, disabled, or foreign state references without mutating state records', () => {
    const { states, profile, calculate } = fixture()
    expect(resolveDeviceFlowPolicy(profile.devices[1].states, undefined, true).issue)
      .toBe('missing-state')
    for (const reference of ['', 'missing', 'PP-RUN', 'Pump-STOP']) {
      profile.devices[1].states.find(state => state.id === 'Pump-STOP')!.enabled = false
      states[1].highlightStyleRefId = reference
      const before = JSON.stringify(states)
      const result = calculate()
      expect(result.paths[0].handleKeys).toEqual(['1', '2'])
      expect(result.diagnostics).toContainEqual({ kind: 'missing-state', handleKey: '3' })
      expect(JSON.stringify(states)).toBe(before)
    }
  })

  it('preserves source identity, priority and valid Utility, honoring an explicit selection', () => {
    const { calculate } = fixture()
    const previous: FlowPathStatus = {
      id: 'saved-id', name: 'Saved route', ownerHandleKey: '1',
      handleKeys: ['1', '2'], priority: 12, highlightStyleRefId: 'later'
    }
    const before = JSON.stringify(previous)
    expect(calculate([previous]).paths[0]).toMatchObject({
      id: 'saved-id', name: 'Saved route', priority: 12, highlightStyleRefId: 'later'
    })
    expect(calculate([previous], new Map([['1', 'first']])).paths[0].highlightStyleRefId)
      .toBe('first')
    expect(JSON.stringify(previous)).toBe(before)
  })

  it('falls back to the first enabled Utility by order and reports when none is available', () => {
    const { profile, calculate } = fixture()
    const paths = calculate([], new Map([['1', 'later']])).paths
    profile.utilities[0].enabled = false
    expect(calculate(paths).paths[0].highlightStyleRefId).toBe('first')
    profile.utilities[1].enabled = false
    expect(calculate(paths)).toMatchObject({
      paths: [], diagnostics: [{ kind: 'missing-utility', handleKey: '1' }]
    })
  })

  it('retains ownerless saved routes and unresolved members without mutating them', () => {
    const { calculate } = fixture()
    const previous: FlowPathStatus = {
      id: 'legacy-route', name: 'Saved route', handleKeys: ['F', '2'],
      highlightStyleRefId: 'later'
    }
    expect(calculate([previous]).paths.find(path => path.id === previous.id)).toEqual(previous)
    expect(previous.handleKeys).toEqual(['F', '2'])
  })

  it('adds and removes sources after rule edits, preserving other sources and manual corrections', () => {
    const { states, profile, calculate } = fixture()
    const manual = new ManualHighlightCorrectionState()
    manual.paint(['2'], 'later')
    manual.erase([{ handleKey: '4', hasAutomaticFlow: true }])
    const before = JSON.stringify({ manual: manual.snapshot(), states })
    const initial = calculate().paths
    profile.devices[1].states.find(state => state.key === 'PASS')!.autoHighlightFlow = true
    const added = calculate(initial).paths
    expect(added.map(path => path.ownerHandleKey)).toEqual(['1', '3'])
    profile.devices[0].states.find(state => state.key === 'RUN')!.autoHighlightFlow = false
    const retained = calculate(added).paths
    expect(retained.map(path => path.ownerHandleKey)).toEqual(['3'])
    expect(retained[0].id).toBe(added[1].id)
    profile.devices[1].name = 'Unmatched Title'
    expect(calculate(retained).paths).toEqual([])
    expect(JSON.stringify({ manual: manual.snapshot(), states })).toBe(before)
  })

  it('updates blocking behavior after editing a selected preset and matches the debug traversal', () => {
    const { graph, profile, calculate } = fixture()
    const paths = calculate().paths
    const pass = profile.devices[1].states.find(state => state.key === 'PASS')!
    pass.flowBehavior = 'blocking'
    const result = calculate(paths)
    expect(result.paths[0].handleKeys).toEqual(['1', '2'])
    expect([...traverseFlowFromDevice(graph, '1', result.policies).highlightedKeys])
      .toEqual(result.paths[0].handleKeys)
    pass.flowBehavior = 'neutral'
    expect(calculate(result.paths).paths[0].handleKeys).toEqual(['1', '2', '3', '4', '5', '6'])
    profile.devices[1].states.splice(profile.devices[1].states.indexOf(pass), 1)
    expect(calculate().diagnostics).toContainEqual({ kind: 'missing-state', handleKey: '3' })
  })

  it('handles cycles and overlapping sources without duplicate members', () => {
    const { graph, states, selected, profile } = fixture()
    const adjacency = new Map([...graph.adjacency].map(([key, values]) => [key, [...values]]))
    adjacency.get('2')!.push('4')
    adjacency.get('4')!.push('2')
    states[1] = selected('3', 'Pump', 'RUN')
    const result = calculateAutomaticFlowPaths({ ...graph, adjacency }, profile, states, [], {
      idPrefix: 'cycle', name: 'Cycle'
    })
    expect(result.paths).toHaveLength(2)
    result.paths.forEach(path => {
      expect(path.handleKeys).toHaveLength(6)
      expect(new Set(path.handleKeys).size).toBe(6)
    })
  })

  it('shares conducting device states across routes bound to different Utilities', () => {
    const { states, selected, profile, calculate } = fixture()
    const connectedHandles = new Set(['1', '2', '3', '4', '5', '6'])
    states[1] = selected('3', 'Pump', 'RUN')
    const paths = calculate([], new Map([['1', 'first'], ['3', 'later']])).paths
    expect(paths.map(path => [path.ownerHandleKey, path.highlightStyleRefId]))
      .toEqual([['1', 'first'], ['3', 'later']])
    paths.forEach(path => {
      expect(new Set(path.handleKeys)).toEqual(connectedHandles)
    })

    profile.devices[0].states[0].autoHighlightFlow = false
    const retained = calculate(paths).paths
    expect(retained).toHaveLength(1)
    expect(retained[0]).toMatchObject({
      ownerHandleKey: '3',
      highlightStyleRefId: 'later'
    })
    expect(new Set(retained[0].handleKeys)).toEqual(connectedHandles)
  })

  it('distinguishes calculation rules from visual-only edits', () => {
    const { profile } = fixture()
    const before = structuredClone(profile)
    profile.devices[0].states[0].color = 0xffffff
    profile.utilities[0].style.lineWidthPx = 7
    expect(haveFlowRulesChanged(before, profile)).toBe(false)
    profile.devices[0].states[0].autoHighlightFlow = false
    expect(haveFlowRulesChanged(before, profile)).toBe(true)
  })

  it('restores stored paths without recalculating and only updates the selected Phase snapshot', () => {
    const { profile, states, calculate } = fixture()
    const store = new PhaseWorkspaceStore()
    store.updatePresentationProfile(profile)
    const process = store.createProcess('Test')
    const sequence = process.sequences[0]
    const first = store.createPhase({ processId: process.id, sequenceId: sequence.id,
      number: 1, name: 'First', source: { kind: 'unassigned' } })
    const second = store.createPhase({ processId: process.id, sequenceId: sequence.id,
      number: 2, name: 'Second', source: { kind: 'unassigned' } })
    const saved = { flowState: { flowPaths: calculate().paths,
      deviceStates: Object.fromEntries(states.map(state => [state.key, state])) } }
    store.updatePhaseState(process.id, sequence.id, first.id, saved)
    store.updatePhaseState(process.id, sequence.id, second.id, saved)
    const secondBefore = store.snapshot().processes[0].sequences[0].phases[1]
    profile.devices[1].states.find(state => state.key === 'PASS')!.flowBehavior = 'blocking'
    store.updatePresentationProfile(profile)
    const restored = new PhaseWorkspaceStore(store.snapshot())
    expect(restored.snapshot().processes[0].sequences[0].phases[0].flowState.flowPaths[0].handleKeys)
      .toHaveLength(6)
    restored.updatePhaseState(process.id, sequence.id, first.id, {
      flowState: { ...saved.flowState, flowPaths: calculate(saved.flowState.flowPaths).paths }
    })
    expect(restored.snapshot().processes[0].sequences[0].phases[0].flowState.flowPaths[0].handleKeys)
      .toEqual(['1', '2'])
    expect(restored.snapshot().processes[0].sequences[0].phases[1]).toEqual(secondBefore)
  })
})
