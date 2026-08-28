import {
  PHASE_WORKSPACE_STORAGE_KEY,
  PhaseWorkspaceStore
} from '../src/phase/phaseWorkspaceStore'
import type {
  DrawingAssetRef,
  FlowPathStatus,
  PhaseWorkspaceState
} from '../src/phase/types'

const flowState = (handleKeys: string[] = []) => ({
  flowPaths: handleKeys.length
    ? [
      {
        id: 'flow-1',
        name: 'Main route',
        handleKeys: [...handleKeys],
        styleOverride: { color: 0x123456, lineWidthPx: 4 }
      }
    ]
    : []
})

const drawing: DrawingAssetRef = {
  id: 'drawing-1',
  kind: 'local',
  sourceName: 'PID-0001.dwg'
}

const createStore = () => {
  let id = 0
  return new PhaseWorkspaceStore(
    undefined,
    () => `id-${++id}`,
    () => '2026-08-11T00:00:00.000Z'
  )
}

const createProcessContext = (store: PhaseWorkspaceStore) => {
  const process = store.createProcess('CIP')
  return { process, sequence: process.sequences[0] }
}

const legacyPhase = {
  id: 'phase-1',
  number: 1,
  name: 'Initial rinse',
  drawingAssetId: drawing.id,
  drawingDisplayName: 'CIP-01.dwg',
  flowState: { openBoundaryHandleKeys: ['1a'] },
  deviceStates: {
    '1a': { key: '1a', label: 'XV-101', mode: 'open' }
  },
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z'
}

describe('PhaseWorkspaceStore', () => {
  it('creates a process with an active default sequence and a phase', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)
    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Initial rinse',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })

    const snapshot = store.snapshot()
    expect(snapshot.activeProcessId).toBe(process.id)
    expect(snapshot.processes[0].activeSequenceId).toBe(sequence.id)
    expect(snapshot.processes[0].sequences[0].activePhaseId).toBe(phase.id)
    expect(phase.drawing).toEqual({
      kind: 'assigned',
      assetId: drawing.id,
      displayName: 'CIP-01.dwg'
    })
  })

  it('deletes a process, falls back to its neighbor, and preserves shared drawings', () => {
    const store = createStore()
    const first = store.createProcess('CIP')
    const firstSequence = first.sequences[0]
    store.createPhase({
      processId: first.id,
      sequenceId: firstSequence.id,
      number: 1,
      name: 'Initial rinse',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })
    const second = store.createProcess('SIP')
    store.createPhase({
      processId: second.id,
      sequenceId: second.sequences[0].id,
      number: 1,
      name: 'Sterilization',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })

    const deleted = store.deleteProcess(second.id)
    let snapshot = store.snapshot()
    expect(deleted.id).toBe(second.id)
    expect(snapshot.activeProcessId).toBe(first.id)
    expect(snapshot.drawingAssets[drawing.id]).toEqual(drawing)

    store.deleteProcess(first.id)
    snapshot = store.snapshot()
    expect(snapshot.activeProcessId).toBeUndefined()
    expect(snapshot.processes).toEqual([])
    expect(snapshot.drawingAssets[drawing.id]).toBeUndefined()
  })

  it('migrates v1 processes into deterministic default sequences', () => {
    const storage = {
      getItem: jest.fn((key: string) =>
        key === PHASE_WORKSPACE_STORAGE_KEY
          ? JSON.stringify({
            version: 1,
            processes: [
              {
                id: 'process-1',
                name: 'CIP',
                phases: [legacyPhase],
                activePhaseId: legacyPhase.id,
                createdAt: '2026-08-10T00:00:00.000Z',
                updatedAt: '2026-08-10T00:00:00.000Z'
              }
            ],
            drawingAssets: { [drawing.id]: drawing },
            activeProcessId: 'process-1'
          })
          : null
      )
    }

    const snapshot = PhaseWorkspaceStore.load(storage).snapshot()
    const process = snapshot.processes[0]
    const sequence = process.sequences[0]

    expect(snapshot.version).toBe(4)
    expect(snapshot.presentationProfile.defaultFlowStyle.color).toBe(0x00c853)
    expect(process).not.toHaveProperty('presentationProfile')
    expect(process.activeSequenceId).toBe('sequence-default-process-1')
    expect(sequence.id).toBe('sequence-default-process-1')
    expect(sequence.activePhaseId).toBe(legacyPhase.id)
    expect(sequence.phases[0]).toMatchObject({
      id: legacyPhase.id,
      number: legacyPhase.number,
      name: legacyPhase.name,
      drawing: {
        kind: 'assigned',
        assetId: drawing.id,
        displayName: 'CIP-01.dwg'
      },
      flowState: {
        flowPaths: [
          {
            id: `flow-default-${legacyPhase.id}`,
            name: '默认流路',
            handleKeys: ['1a']
          }
        ]
      }
    })
    expect(sequence.phases[0]).not.toHaveProperty('deviceStates')
    expect(snapshot.drawingAssets[drawing.id]).toEqual(drawing)
  })

  it('creates, renames, reorders, copies, and deletes sequences', () => {
    const store = createStore()
    const { process, sequence: first } = createProcessContext(store)
    const second = store.createSequence(process.id, 2, 'Tank wash')
    store.renameSequence(process.id, second.id, 'Vessel wash')
    store.reorderSequence(process.id, second.id, 0)
    const copied = store.copySequence(process.id, first.id, 3, 'Copied route')

    let processSnapshot = store.snapshot().processes[0]
    expect(processSnapshot.sequences.map(sequence => sequence.number)).toEqual([
      2,
      1,
      3
    ])
    expect(processSnapshot.sequences[0].name).toBe('Vessel wash')
    expect(copied.name).toBe('Copied route')

    store.deleteSequence(process.id, second.id)
    processSnapshot = store.snapshot().processes[0]
    expect(processSnapshot.sequences.map(sequence => sequence.id)).not.toContain(
      second.id
    )
  })

  it('clones phase state within its sequence without shared references', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)
    const first = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Initial rinse',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })
    store.updatePhaseState(process.id, sequence.id, first.id, {
      flowState: flowState(['1a', '2b'])
    })

    const second = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 2,
      name: 'Caustic wash',
      source: { kind: 'previous', displayName: 'CIP-02.dwg' }
    })
    const historical = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 24,
      name: 'Final rinse',
      source: { kind: 'history', phaseId: first.id }
    })

    second.flowState.flowPaths[0].handleKeys.push('changed')
    second.flowState.flowPaths[0].styleOverride!.color = 0xffffff
    const storedFirst = store.snapshot().processes[0].sequences[0].phases[0]
    expect(storedFirst.flowState.flowPaths[0].handleKeys).toEqual(['1a', '2b'])
    expect(storedFirst.flowState.flowPaths[0].styleOverride?.color).toBe(0x123456)
    expect(historical.sourcePhaseId).toBe(first.id)
  })

  it('clones explicit custom flow styles without shared references', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)
    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Custom route',
      source: { kind: 'unassigned' }
    })
    const flowPath: FlowPathStatus = {
      id: 'flow-custom',
      name: 'Custom route',
      handleKeys: ['1a'],
      styleSource: {
        kind: 'custom',
        style: {
          color: 0x123456,
          lineWidthPx: 4,
          opacity: 0.5,
          visible: true
        }
      }
    }
    store.updatePhaseState(process.id, sequence.id, phase.id, {
      flowState: { flowPaths: [flowPath] }
    })

      ; (flowPath.styleSource as Extract<NonNullable<FlowPathStatus['styleSource']>, { kind: 'custom' }>).style.color = 0xffffff

    expect(
      store.snapshot().processes[0].sequences[0].phases[0].flowState.flowPaths[0]
        .styleSource
    ).toMatchObject({ kind: 'custom', style: { color: 0x123456 } })
  })

  it('copies a phase across sequences without sharing mutable state', () => {
    const store = createStore()
    const { process, sequence: sourceSequence } = createProcessContext(store)
    const source = store.createPhase({
      processId: process.id,
      sequenceId: sourceSequence.id,
      number: 1,
      name: 'Initial rinse',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })
    store.updatePhaseState(process.id, sourceSequence.id, source.id, {
      flowState: flowState(['1a'])
    })
    const targetSequence = store.createSequence(process.id, 2, 'Tank wash')

    const copy = store.copyPhase(
      process.id,
      sourceSequence.id,
      source.id,
      targetSequence.id,
      3,
      'Initial rinse copy'
    )

    expect(copy).toMatchObject({
      number: 3,
      name: 'Initial rinse copy',
      drawing: source.drawing,
      sourcePhaseId: source.id
    })
    copy.flowState.flowPaths[0].handleKeys.push('changed')
    copy.flowState.flowPaths[0].styleOverride!.lineWidthPx = 12
    const snapshot = store.snapshot()
    const storedSource = snapshot.processes[0].sequences[0].phases[0]
    const storedTarget = snapshot.processes[0].sequences[1]
    expect(storedSource.flowState.flowPaths[0].handleKeys).toEqual(['1a'])
    expect(storedSource.flowState.flowPaths[0].styleOverride?.lineWidthPx).toBe(4)
    expect(storedTarget.phases.map(phase => phase.id)).toEqual([copy.id])
    expect(storedTarget.activePhaseId).toBe(copy.id)
    expect(snapshot.processes[0].activeSequenceId).toBe(targetSequence.id)
    expect(snapshot.drawingAssets[drawing.id]).toEqual(drawing)
    expect(() =>
      store.copyPhase(
        process.id,
        sourceSequence.id,
        source.id,
        targetSequence.id,
        3,
        'Duplicate number'
      )
    ).toThrow('Phase 3 already exists')
  })

  it('keeps phase numbering and ordering scoped to each sequence', () => {
    const store = createStore()
    const { process, sequence: first } = createProcessContext(store)
    const second = store.createSequence(process.id, 2, 'Second route')

    for (const sequence of [first, second]) {
      store.createPhase({
        processId: process.id,
        sequenceId: sequence.id,
        number: 1,
        name: 'Phase 1',
        source: {
          kind: 'new',
          drawing: {
            id: `drawing-${sequence.id}`,
            kind: 'blank',
            sourceName: `${sequence.id}.dwg`
          },
          displayName: `${sequence.id}.dwg`
        }
      })
    }

    const firstPhase = store.createPhase({
      processId: process.id,
      sequenceId: first.id,
      number: 2,
      name: 'Phase 2',
      source: { kind: 'previous' }
    })
    store.reorderPhase(process.id, first.id, firstPhase.id, 0)

    const snapshot = store.snapshot().processes[0]
    expect(snapshot.sequences[0].phases.map(phase => phase.number)).toEqual([2, 1])
    expect(snapshot.sequences[1].phases.map(phase => phase.number)).toEqual([1])
  })

  it('retains a drawing until no phase in any sequence references it', () => {
    const store = createStore()
    const { process, sequence: first } = createProcessContext(store)
    const firstPhase = store.createPhase({
      processId: process.id,
      sequenceId: first.id,
      number: 1,
      name: 'Initial rinse',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })
    const copied = store.copySequence(process.id, first.id, 2, 'Copied route')

    store.deletePhase(process.id, first.id, firstPhase.id)
    expect(store.snapshot().drawingAssets[drawing.id]).toBeDefined()

    store.deleteSequence(process.id, copied.id)
    expect(store.snapshot().drawingAssets[drawing.id]).toBeUndefined()
  })

  it('creates an unassigned phase without registering a drawing', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)

    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Plan later',
      source: { kind: 'unassigned' }
    })

    expect(phase.drawing).toEqual({ kind: 'unassigned' })
    expect(store.snapshot().drawingAssets).toEqual({})
  })

  it('migrates v2 phases with missing assets as unassigned', () => {
    const storage = {
      getItem: jest.fn(() =>
        JSON.stringify({
          version: 2,
          processes: [
            {
              id: 'process-1',
              name: 'CIP',
              sequences: [
                {
                  id: 'sequence-1',
                  number: 1,
                  name: 'Route',
                  phases: [legacyPhase, { ...legacyPhase, id: 'phase-2', drawingAssetId: 'missing' }],
                  createdAt: legacyPhase.createdAt,
                  updatedAt: legacyPhase.updatedAt
                }
              ],
              activeSequenceId: 'sequence-1',
              createdAt: legacyPhase.createdAt,
              updatedAt: legacyPhase.updatedAt
            }
          ],
          drawingAssets: { [drawing.id]: drawing },
          activeProcessId: 'process-1'
        })
      )
    }

    const phases = PhaseWorkspaceStore.load(storage).snapshot().processes[0]
      .sequences[0].phases
    expect(phases[0].drawing.kind).toBe('assigned')
    expect(phases[1].drawing).toEqual({ kind: 'unassigned' })
  })

  it('migrates v3 handles into a default flow path and profile', () => {
    const storage = {
      getItem: jest.fn(() =>
        JSON.stringify({
          version: 3,
          processes: [
            {
              id: 'process-1',
              name: 'CIP',
              sequences: [
                {
                  id: 'sequence-1',
                  number: 1,
                  name: 'Route',
                  phases: [
                    {
                      id: 'phase-1',
                      number: 1,
                      name: 'Rinse',
                      drawing: { kind: 'unassigned' },
                      flowState: { openBoundaryHandleKeys: ['1a', '2b'] },
                      createdAt: legacyPhase.createdAt,
                      updatedAt: legacyPhase.updatedAt
                    }
                  ],
                  createdAt: legacyPhase.createdAt,
                  updatedAt: legacyPhase.updatedAt
                }
              ],
              createdAt: legacyPhase.createdAt,
              updatedAt: legacyPhase.updatedAt
            }
          ],
          drawingAssets: {}
        })
      )
    }

    const snapshot = PhaseWorkspaceStore.load(storage).snapshot()
    expect(snapshot.version).toBe(4)
    expect(snapshot.presentationProfile.defaultFlowStyle).toEqual({
      color: 0x00c853,
      lineWidthPx: 3,
      opacity: 1,
      visible: true
    })
    expect(
      snapshot.processes[0].sequences[0].phases[0].flowState.flowPaths[0]
    ).toEqual({
      id: 'flow-default-phase-1',
      name: '默认流路',
      handleKeys: ['1a', '2b']
    })
  })

  it('preserves persisted UUIDs when normalizing presentation styles', () => {
    const deviceStyleId = 'a4f4cb2a-edf8-4880-b45c-0ca42a45063d'
    const utilityId = '0a4e2606-bb00-479d-bb6d-22c2a8607189'
    const state = {
      version: 4,
      presentationProfile: {
        deviceStyles: [{
          id: deviceStyleId,
          deviceType: 'Valve',
          deviceState: 'state-1',
          displayName: '状态 1',
          color: '#00C853',
          lineWidthPx: 3,
          opacity: 1
        }],
        utilities: [{
          id: utilityId,
          name: 'Water',
          style: {
            color: 0x123456,
            lineWidthPx: 5,
            opacity: 0.6,
            visible: true
          },
          color: '#00C853',
          lineWidthPx: 3,
          opacity: 1
        }]
      },
      processes: [{
        id: 'process-1',
        name: 'CIP',
        sequences: [],
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z'
      }],
      drawingAssets: {}
    } as unknown as PhaseWorkspaceState

    const profile = new PhaseWorkspaceStore(state)
      .snapshot().presentationProfile

    expect(profile.devices[0].states[0].id).toBe(deviceStyleId)
    expect(profile.devices[0].states[0].key).toBe('state-1')
    expect(profile.utilities[0].id).toBe(utilityId)
    expect(profile.utilities[0].style).toEqual({
      color: 0x123456,
      lineWidthPx: 5,
      opacity: 0.6,
      visible: true
    })
  })

  it('preserves unresolved Utility references after profile updates', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)
    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Rinse',
      source: { kind: 'unassigned' }
    })
    store.updatePhaseState(process.id, sequence.id, phase.id, {
      flowState: {
        flowPaths: [{
          id: 'flow-1',
          name: 'Water route',
          handleKeys: ['1A'],
          utilityId: 'removed-utility',
          styleSource: {
            kind: 'utility',
            utilityId: 'removed-utility'
          }
        }]
      }
    })

    store.updatePresentationProfile({
      ...store.snapshot().presentationProfile,
      utilities: []
    })

    const flowPath = store.snapshot().processes[0]
      .sequences[0].phases[0].flowState.flowPaths[0]
    expect(flowPath.utilityId).toBe('removed-utility')
    expect(flowPath.styleSource).toEqual({
      kind: 'utility',
      utilityId: 'removed-utility'
    })
  })

  it('keeps project presentation styles when phase runtime state changes', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)
    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Rinse',
      source: { kind: 'unassigned' }
    })
    const profile = {
      ...store.snapshot().presentationProfile,
      defaultFlowStyle: {
        ...store.snapshot().presentationProfile.defaultFlowStyle,
        color: 0xff0000,
        lineWidthPx: 7
      }
    }

    store.updatePresentationProfile(profile)
    store.updatePhaseState(process.id, sequence.id, phase.id, {
      flowState: {
        flowPaths: [],
        deviceStates: {
          '1A': {
            key: '1A',
            stateKey: 'open',
            deviceType: 'VALVE',
            highlightStyleRefId: 'valve-open'
          }
        }
      }
    })

    const snapshot = store.snapshot()
    expect(snapshot.presentationProfile.defaultFlowStyle).toMatchObject({
      color: 0xff0000,
      lineWidthPx: 7
    })
    expect(snapshot.processes[0]).not.toHaveProperty('presentationProfile')
  })

  it('associates and replaces drawings while retaining shared old assets', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)
    const first = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'First',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })
    const second = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 2,
      name: 'Second',
      source: { kind: 'previous' }
    })
    const replacement: DrawingAssetRef = {
      id: 'drawing-2',
      kind: 'url',
      sourceName: 'CIP-02.dwg',
      url: 'https://example.test/CIP-02.dwg'
    }

    expect(
      store.associateDrawing(
        process.id,
        sequence.id,
        first.id,
        replacement,
        'CIP-02.dwg'
      )
    ).toBeUndefined()
    expect(store.snapshot().drawingAssets[drawing.id]).toBeDefined()

    const removed = store.associateDrawing(
      process.id,
      sequence.id,
      second.id,
      replacement,
      'CIP-02.dwg'
    )
    expect(removed).toEqual(drawing)
    expect(store.snapshot().drawingAssets[drawing.id]).toBeUndefined()
  })

  it('associates a drawing and marked state from a Phase in another sequence', () => {
    const store = createStore()
    const { process, sequence } = createProcessContext(store)
    const source = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Marked source',
      source: { kind: 'new', drawing, displayName: 'CIP-01.dwg' }
    })
    store.updatePhaseState(process.id, sequence.id, source.id, {
      flowState: flowState(['1a'])
    })
    const targetSequence = store.createSequence(process.id, 2, 'Target route')
    const target = store.createPhase({
      processId: process.id,
      sequenceId: targetSequence.id,
      number: 1,
      name: 'Target',
      source: { kind: 'unassigned' }
    })

    store.associateMarkedPhase(
      process.id,
      targetSequence.id,
      target.id,
      process.id,
      sequence.id,
      source.id
    )

    const associated = store.snapshot().processes[0].sequences[1].phases[0]
    expect(associated.drawing).toEqual(source.drawing)
    expect(associated.sourcePhaseId).toBe(source.id)
    expect(associated.flowState.flowPaths[0].handleKeys).toEqual(['1a'])
    expect(associated.flowState.flowPaths[0].styleOverride).toEqual({
      color: 0x123456,
      lineWidthPx: 4
    })
  })
})
