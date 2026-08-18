import type { PhaseWorkspaceState } from '../src/phase/types'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { ReportManifestStore } from '../src/report/reportManifest'

const createWorkspace = (
  sequenceCount = 2,
  phasesPerSequence = 3
): PhaseWorkspaceState => {
  const drawingAssets = {
    drawing: { id: 'drawing', kind: 'blank' as const, sourceName: 'Blank.dwg' }
  }
  return {
    version: 4,
    drawingAssets,
    processes: [
      {
        id: 'process',
        name: 'CIP',
        presentationProfile: createDefaultPresentationProfile(),
        createdAt: 'now',
        updatedAt: 'now',
        sequences: Array.from({ length: sequenceCount }, (_, sequenceIndex) => ({
          id: `sequence-${sequenceIndex + 1}`,
          number: sequenceIndex + 1,
          name: `Sequence ${sequenceIndex + 1}`,
          createdAt: 'now',
          updatedAt: 'now',
          phases: Array.from({ length: phasesPerSequence }, (_, phaseIndex) => ({
            id: `phase-${sequenceIndex + 1}-${phaseIndex + 1}`,
            number: phaseIndex + 1,
            name: `Phase ${phaseIndex + 1}`,
            drawing: {
              kind: 'assigned' as const,
              assetId: 'drawing',
              displayName: 'Blank.dwg'
            },
            flowState: { flowPaths: [] },
            deviceStates: {},
            createdAt: 'now',
            updatedAt: 'now'
          }))
        }))
      }
    ]
  }
}

const createStore = () => {
  let id = 0
  let tick = 0
  return new ReportManifestStore(
    undefined,
    () => `report-${++id}`,
    () => `time-${++tick}`
  )
}

describe('ReportManifestStore', () => {
  it('creates pages in process, sequence, and phase order', () => {
    const store = createStore()
    const manifest = store.reconcile(createWorkspace())

    expect(manifest.processId).toBe('process')
    expect(manifest.pages).toHaveLength(6)
    expect(manifest.pages.map(page => page.phaseId)).toEqual([
      'phase-1-1',
      'phase-1-2',
      'phase-1-3',
      'phase-2-1',
      'phase-2-2',
      'phase-2-3'
    ])
  })

  it('excludes and restores a page without changing business data', () => {
    const workspace = createWorkspace()
    const original = JSON.stringify(workspace)
    const store = createStore()
    const slot = store.reconcile(workspace).pages[1]

    expect(store.setExcluded(slot.id, true).excluded).toBe(true)
    expect(store.setExcluded(slot.id, false).excluded).toBe(false)
    expect(JSON.stringify(workspace)).toBe(original)
  })

  it('replaces page 390 in place without moving later slots', () => {
    const store = createStore()
    const before = store.reconcile(createWorkspace(14, 30))
    const slot = before.pages[389]
    const ids = before.pages.map(page => page.id)

    store.replace(slot.id, {
      kind: 'phase',
      processId: 'process',
      sequenceId: 'sequence-1',
      phaseId: 'phase-1-1'
    })
    const after = store.snapshot()

    expect(after.pages).toHaveLength(420)
    expect(after.pages[389].id).toBe(slot.id)
    expect(after.pages[389].replacement?.phaseId).toBe('phase-1-1')
    expect(after.pages.slice(390).map(page => page.id)).toEqual(ids.slice(390))
  })

  it('reconciles reordered phases while preserving slot ids and edits', () => {
    const workspace = createWorkspace(1, 3)
    const store = createStore()
    const before = store.reconcile(workspace)
    store.setExcluded(before.pages[1].id, true)
    workspace.processes[0].sequences[0].phases.reverse()

    const after = store.reconcile(workspace)

    expect(after.pages.map(page => page.phaseId)).toEqual([
      'phase-1-3',
      'phase-1-2',
      'phase-1-1'
    ])
    expect(after.pages[1].id).toBe(before.pages[1].id)
    expect(after.pages[1].excluded).toBe(true)
  })

  it('freezes an independent export snapshot and reports preflight issues', () => {
    const workspace = createWorkspace(1, 2)
    workspace.processes[0].sequences[0].phases[0].drawing = {
      kind: 'unassigned'
    }
    workspace.processes[0].sequences[0].phases[1].number = 1
    const store = createStore()
    const manifest = store.reconcile(workspace)
    store.setDrawingLoadFailed('drawing', true)
    const frozen = store.freeze()
    store.setExcluded(manifest.pages[0].id, true)

    expect(frozen.pages[0].excluded).toBe(false)
    expect(store.preflight(workspace).map(issue => issue.code)).toEqual([
      'missing-drawing',
      'duplicate-phase-number',
      'drawing-load-failed'
    ])
  })
})
