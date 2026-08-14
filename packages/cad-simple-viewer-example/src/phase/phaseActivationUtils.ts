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
