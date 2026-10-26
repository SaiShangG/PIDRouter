import {
  ManualHighlightCorrectionsValidationError,
  normalizeManualHighlightCorrections
} from '../src/phase/manualHighlightCorrections'
import { parsePhasePidOverlay } from '../src/phase/phasePidOverlay'
import { PhaseSaveState } from '../src/phase/phaseSaveState'
import { PhaseWorkspaceRepository } from '../src/phase/phaseWorkspaceRepository'
import { PhaseWorkspaceStore } from '../src/phase/phaseWorkspaceStore'
import type {
  ManualHighlightCorrections,
  PhaseSnapshot
} from '../src/phase/types'

const corrections = (): ManualHighlightCorrections => ({
  additions: [
    { handleKey: 'AB12', styleSource: { kind: 'utility', utilityId: 'missing-utility' } },
    {
      handleKey: 'CD34',
      styleSource: {
        kind: 'custom',
        style: { color: 0x123456, lineWidthPx: 4, opacity: 0.5, visible: true }
      }
    }
  ],
  exclusions: ['EF56', '20000000000001']
})

const createContext = () => {
  let id = 0
  const store = new PhaseWorkspaceStore(undefined, () => String(++id), () => 'now')
  const process = store.createProcess('CIP')
  const sequence = process.sequences[0]
  const phase = store.createPhase({
    processId: process.id,
    sequenceId: sequence.id,
    number: 1,
    name: 'Rinse',
    source: {
      kind: 'new',
      drawing: { id: 'file:5', kind: 'url', sourceName: 'PID' },
      displayName: 'PID'
    }
  })
  return { store, processId: process.id, sequenceId: sequence.id, phaseId: phase.id }
}

const firstPhase = (store: PhaseWorkspaceStore) =>
  store.snapshot().processes[0].sequences[0].phases[0]

const createRepository = () => {
  const phases = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn()
  }
  const repository = new PhaseWorkspaceRepository({
    baseUrl: '',
    projectId: 1,
    files: { list: jest.fn(), upload: jest.fn() },
    procedures: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    operations: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    phases
  })
  return { repository, phases }
}

const overlay = (manualCorrections: unknown) => ({
  Index: 1, OrderId: 1, Name: 'Rinse', Comment: null,
  autoFlowPaths: [], flowPaths: [], deviceStates: [], textNotes: [], manualCorrections
})

describe('manual highlight correction data', () => {
  it('normalizes handles, deduplicates and keeps additions/exclusions disjoint', () => {
    const result = normalizeManualHighlightCorrections({
      additions: [
        { handleKey: ' 00ab ', styleSource: { kind: 'utility', utilityId: 'first' } },
        { handleKey: 'AB', styleSource: { kind: 'utility', utilityId: ' second ' } },
        { handleKey: 'cd', styleSource: { kind: 'utility' } }
      ],
      exclusions: ['00cd', 'CD']
    })
    expect(result).toEqual({
      additions: [{
        handleKey: 'AB', styleSource: { kind: 'utility', utilityId: 'second' }
      }],
      exclusions: ['CD']
    })
    expect(normalizeManualHighlightCorrections(result)).toEqual(result)
  })

  it.each([
    null,
    {},
    { additions: [], exclusions: ['not-a-handle'] },
    { additions: [null], exclusions: [] },
    { additions: [{ handleKey: 'AB', styleSource: { kind: 'device-state' } }], exclusions: [] },
    { additions: [{ handleKey: 'AB', styleSource: { kind: 'utility', utilityId: '' } }], exclusions: [] },
    {
      additions: [{
        handleKey: 'AB',
        styleSource: {
          kind: 'custom',
          style: { color: 1, lineWidthPx: 3, opacity: 2, visible: true }
        }
      }],
      exclusions: []
    }
  ])('rejects malformed corrections explicitly: %j', value => {
    expect(() => normalizeManualHighlightCorrections(value))
      .toThrow(ManualHighlightCorrectionsValidationError)
  })

  it('parses decimal backend handles without confusing them with CAD hex handles', () => {
    const result = parsePhasePidOverlay(overlay({
      additions: [{
        handleKey: ' 000438 ',
        styleSource: { kind: 'utility', utilityId: 'missing-utility' }
      }],
      exclusions: ['9007199254740993']
    }))
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') throw new Error('Expected a valid overlay')
    expect(result.warnings).toEqual([])
    expect(result.overlay.manualCorrections).toEqual({
      additions: [{
        handleKey: '438',
        styleSource: { kind: 'utility', utilityId: 'missing-utility' }
      }],
      exclusions: ['9007199254740993']
    })
  })

  it('reports invalid manual data without treating it as a device or flow', () => {
    const result = parsePhasePidOverlay(overlay({
      additions: [], exclusions: ['EF']
    }))
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') throw new Error('Expected a valid root')
    expect(result.warnings).toEqual([{
      code: 'invalid-manual-corrections', path: 'manualCorrections'
    }])
    expect(result.overlay.flowPaths).toEqual([])
    expect(result.overlay.deviceStates).toEqual([])
  })

  it('preserves manual corrections through local persistence, snapshots and flow capture', () => {
    const { store, processId, sequenceId, phaseId } = createContext()
    const input = corrections()
    store.updateManualCorrections(processId, sequenceId, phaseId, input)
    input.exclusions.push('FF')
    const snapshot = firstPhase(store)
    snapshot.manualCorrections?.additions.splice(0, 1)
    store.updatePhaseState(processId, sequenceId, phaseId, {
      flowState: {
        flowPaths: [{ id: 'flow', name: 'Auto flow', handleKeys: ['AB12'] }],
        deviceStates: {
          AB12: { key: 'AB12', stateKey: 'OPEN', deviceType: 'Valve', highlightStyleRefId: 'open' }
        }
      }
    })
    const storage = { setItem: jest.fn() }
    expect(store.persist(storage)).toBe(true)
    const restored = PhaseWorkspaceStore.load({
      getItem: () => storage.setItem.mock.calls[0][1]
    })
    expect(restored.snapshot().version).toBe(5)
    expect(firstPhase(restored).manualCorrections).toEqual(corrections())
    expect(firstPhase(restored).flowState.deviceStates?.AB12.stateKey).toBe('OPEN')
  })

  it('migrates v4 without interpreting old flow records as manual corrections', () => {
    const { store } = createContext()
    const legacy = { ...store.snapshot(), version: 4 }
    const migrated = PhaseWorkspaceStore.load({ getItem: () => JSON.stringify(legacy) })
    expect(migrated.snapshot().version).toBe(5)
    expect(firstPhase(migrated).id).toBe(firstPhase(store).id)
    expect(firstPhase(migrated).manualCorrections).toBeUndefined()
  })

  it('does not silently replace a workspace containing malformed corrections', () => {
    const { store } = createContext()
    const state = store.snapshot()
    const malformed = {
      ...state,
      processes: state.processes.map(process => ({
        ...process,
        sequences: process.sequences.map(sequence => ({
          ...sequence,
          phases: sequence.phases.map(phase => ({
            ...phase,
            manualCorrections: { additions: [], exclusions: ['bad-handle'] }
          }))
        }))
      }))
    }
    expect(() => PhaseWorkspaceStore.load({
      getItem: () => JSON.stringify(malformed)
    })).toThrow(ManualHighlightCorrectionsValidationError)
  })

  it('rejects invalid edits before mutating phase state', () => {
    const { store, processId, sequenceId, phaseId } = createContext()
    const before = firstPhase(store)
    expect(() => store.updatePhaseState(processId, sequenceId, phaseId, {
      flowState: { flowPaths: [{ id: 'new', name: 'New', handleKeys: ['AB'] }] },
      manualCorrections: { additions: [], exclusions: ['bad-handle'] }
    })).toThrow(ManualHighlightCorrectionsValidationError)
    expect(firstPhase(store)).toEqual(before)
  })

  it('copies and inherits corrections without sharing style or array references', () => {
    const { store, processId, sequenceId, phaseId } = createContext()
    store.updateManualCorrections(processId, sequenceId, phaseId, corrections())
    const previous = store.createPhase({
      processId, sequenceId, number: 2, name: 'Previous', source: { kind: 'previous' }
    })
    const history = store.createPhase({
      processId, sequenceId, number: 3, name: 'History',
      source: { kind: 'history', phaseId }
    })
    const copy = store.copyPhase(processId, sequenceId, phaseId, sequenceId, 4, 'Copy')
    const replacement = store.copyPhaseOver(
      processId, sequenceId, phaseId, sequenceId, history.id
    )
    for (const phase of [previous, history, copy, replacement]) {
      expect(phase.manualCorrections).toEqual(corrections())
    }
    const custom = copy.manualCorrections?.additions[1].styleSource
    if (custom?.kind !== 'custom') throw new Error('Expected custom style')
    custom.style.color = 0
    store.updateManualCorrections(processId, sequenceId, previous.id, {
      additions: [], exclusions: []
    })
    expect(firstPhase(store).manualCorrections).toEqual(corrections())
  })

  it('retains corrections on same-drawing association and clears them on replacement/removal', () => {
    const { store, processId, sequenceId, phaseId } = createContext()
    store.updateManualCorrections(processId, sequenceId, phaseId, corrections())
    store.associateDrawing(processId, sequenceId, phaseId, {
      id: 'file:5', kind: 'url', sourceName: 'PID'
    }, 'Renamed')
    expect(firstPhase(store).manualCorrections).toEqual(corrections())
    store.associateDrawing(processId, sequenceId, phaseId, {
      id: 'file:6', kind: 'url', sourceName: 'Other PID'
    }, 'Other PID')
    expect(firstPhase(store).manualCorrections).toBeUndefined()
    store.updateManualCorrections(processId, sequenceId, phaseId, corrections())
    store.clearDrawingAssociation(processId, sequenceId, phaseId)
    expect(firstPhase(store).manualCorrections).toBeUndefined()
  })

  it('copies corrections when associating a marked phase', () => {
    const { store, processId, sequenceId, phaseId } = createContext()
    store.updateManualCorrections(processId, sequenceId, phaseId, corrections())
    const target = store.createPhase({
      processId, sequenceId, number: 2, name: 'Target', source: { kind: 'unassigned' }
    })
    store.associateMarkedPhase(processId, sequenceId, target.id, processId, sequenceId, phaseId)
    expect(store.snapshot().processes[0].sequences[0].phases[1].manualCorrections)
      .toEqual(corrections())
  })

  it('tracks correction-only changes as unsaved highlights, including clearing', () => {
    const { store } = createContext()
    const tracker = new PhaseSaveState()
    const phase = firstPhase(store)
    tracker.accept(phase)
    phase.manualCorrections = { additions: [], exclusions: [] }
    expect(tracker.get(phase).saved).toBe(true)
    phase.manualCorrections = corrections()
    expect(tracker.get(phase).changes).toEqual(['highlights'])
    tracker.accept(phase)
    phase.manualCorrections = { additions: [], exclusions: [] }
    expect(tracker.get(phase).changes).toEqual(['highlights'])
  })

  it('round-trips utility/custom styles and unresolved handles through backend JSON', async () => {
    const { repository, phases } = createRepository()
    const { store } = createContext()
    const phase: PhaseSnapshot = {
      ...firstPhase(store),
      manualCorrections: corrections()
    }
    const payload = repository.createPhaseData(phase)
    expect(payload.manualCorrections?.additions[0].handleKey)
      .toBe(BigInt('0xAB12').toString(10))
    expect(payload.manualCorrections?.exclusions[1]).toBe('9007199254740993')
    expect(payload.autoFlowPaths).toEqual([])
    expect(payload.flowPaths?.map(item => item.handleKey)).toEqual(
      payload.manualCorrections?.additions.filter(item => item.styleSource.kind !== 'custom' ||
        (item.styleSource.style.visible && item.styleSource.style.opacity > 0)).map(item => item.handleKey)
    )
    expect(payload.deviceStates).toBeNull()
    await repository.updatePhase('10', phase, 1)
    const written = phases.update.mock.calls[0][1]
    phases.get.mockResolvedValue({ ...written, id: Number(phase.id) })
    expect((await repository.loadPhase(phase.id, {}, 0)).manualCorrections)
      .toEqual(corrections())
    expect(phase.manualCorrections).toEqual(corrections())
  })

  it('preserves empty corrections as an explicit backend clear', () => {
    const { repository } = createRepository()
    const { store } = createContext()
    expect(repository.createPhaseData({
      ...firstPhase(store),
      manualCorrections: { additions: [], exclusions: [] }
    }).manualCorrections).toEqual({ additions: [], exclusions: [] })
  })

  it('does not carry corrections into backend data for a different drawing', () => {
    const { repository } = createRepository()
    const { store } = createContext()
    const phase = { ...firstPhase(store), manualCorrections: corrections() }
    expect(repository.createPhaseData(phase, { fileId: 5, displayName: 'Renamed' })
      .manualCorrections).toBeDefined()
    expect(repository.createPhaseData(phase, { fileId: 6, displayName: 'Other' })
      .manualCorrections).toBeUndefined()
  })

  it('fails loading malformed corrections rather than accepting a lossy snapshot', async () => {
    const { repository, phases } = createRepository()
    phases.get.mockResolvedValue({
      id: 20,
      name: 'Rinse',
      jsonData: JSON.stringify(overlay({ additions: [], exclusions: ['bad-handle'] }))
    })
    await expect(repository.loadPhase('20', {}, 0))
      .rejects.toThrow('invalid highlight snapshot data')
  })
})
