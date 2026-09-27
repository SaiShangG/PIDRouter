import type { PhaseWorkspaceState } from './types'

export function resolveWorkspacePhase(
  state: PhaseWorkspaceState,
  mode: 'first-assigned' | 'active' = 'first-assigned'
) {
  const process = state.processes.find(item => item.id === state.activeProcessId)
  const sequence = process?.sequences.find(item => item.id === process.activeSequenceId)
  const phase = mode === 'active'
    ? sequence?.phases.find(item => item.id === sequence.activePhaseId)
    : sequence?.phases.find(item => item.drawing.kind === 'assigned')
  return { process, sequence, phase }
}

export interface PhaseHotSwitchContext {
  loadedAssetId?: string
  targetAssetId?: string
  isLoading: boolean
  hasPendingActivation: boolean
}

export const shouldHotSwitchPhase = ({
  loadedAssetId,
  targetAssetId,
  isLoading,
  hasPendingActivation
}: PhaseHotSwitchContext) =>
  Boolean(
    loadedAssetId &&
    targetAssetId &&
    loadedAssetId === targetAssetId &&
    !isLoading &&
    !hasPendingActivation
  )
