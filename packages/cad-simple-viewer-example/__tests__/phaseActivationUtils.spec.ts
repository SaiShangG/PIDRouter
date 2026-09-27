import { resolveWorkspacePhase, shouldHotSwitchPhase } from '../src/phase/phaseActivationUtils'
import { PhaseWorkspaceStore } from '../src/phase/phaseWorkspaceStore'

describe('resolveWorkspacePhase', () => {
  it.each(['first-assigned', 'active'] as const)('keeps an empty project idle in %s mode', mode => {
    const store = new PhaseWorkspaceStore()
    expect(resolveWorkspacePhase(store.snapshot(), mode).phase).toBeUndefined()
    store.createProcess('CIP')
    expect(resolveWorkspacePhase(store.snapshot(), mode).phase).toBeUndefined()
  })

  it('selects the actual assigned drawing when a Phase exists', () => {
    const store = new PhaseWorkspaceStore()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phase = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 1, name: 'Rinse',
      source: { kind: 'new', drawing: { id: 'file:5', kind: 'url', sourceName: 'PID.dwg', url: '/pid.dwg' }, displayName: 'PID.dwg' }
    })
    expect(resolveWorkspacePhase(store.snapshot()).phase?.id).toBe(phase.id)
    expect(resolveWorkspacePhase(store.snapshot(), 'active').phase?.id).toBe(phase.id)
  })
})

describe('shouldHotSwitchPhase', () => {
  const ready = {
    loadedAssetId: 'drawing-1',
    targetAssetId: 'drawing-1',
    isLoading: false,
    hasPendingActivation: false
  }

  it('hot switches when the loaded and target drawings match', () => {
    expect(shouldHotSwitchPhase(ready)).toBe(true)
  })

  it.each([
    ['different drawing', { targetAssetId: 'drawing-2' }],
    ['unassigned target', { targetAssetId: undefined }],
    ['drawing load in progress', { isLoading: true }],
    ['pending activation', { hasPendingActivation: true }]
  ])('uses a full load for %s', (_label, override) => {
    expect(shouldHotSwitchPhase({ ...ready, ...override })).toBe(false)
  })
})
