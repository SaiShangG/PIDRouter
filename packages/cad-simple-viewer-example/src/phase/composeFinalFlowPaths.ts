import { resolveFlowHighlightLayers } from '../presentation/resolveFlowHighlightLayers'
import { normalizeCadHandle, normalizeManualHighlightCorrections } from './manualHighlightCorrections'
import type { PhasePidOverlayFlowPath } from './phasePidOverlay'
import type { PhaseSnapshot, PresentationProfile } from './types'

export const composeFinalFlowPaths = (
  phase: PhaseSnapshot,
  profile: PresentationProfile
): PhasePidOverlayFlowPath[] => {
  const canonicalHandle = (handle: string) => {
    const key = normalizeCadHandle(handle)
    if (key === undefined) throw new Error(`Invalid CAD highlight handle: ${handle}`)
    return key
  }
  const contributions = new Map<string, typeof phase.flowState.flowPaths>()
  phase.flowState.flowPaths.forEach(path => {
    new Set(path.handleKeys.map(canonicalHandle)).forEach(handle => {
      const paths = contributions.get(handle) ?? []
      paths.push(path)
      contributions.set(handle, paths)
    })
  })
  const corrections = normalizeManualHighlightCorrections(
    phase.manualCorrections ?? { additions: [], exclusions: [] }
  )
  const additions = new Map(corrections.additions.map(item => [item.handleKey, item]))
  const exclusions = new Set(corrections.exclusions)
  const deviceStates = new Map(Object.values(phase.flowState.deviceStates ?? {})
    .map(state => [canonicalHandle(state.key), state]))
  const handles = new Set([...contributions.keys(), ...additions.keys()])
  return [...handles].flatMap(handleKey => {
    const addition = additions.get(handleKey)
    const deviceState = deviceStates.get(handleKey)
    const layers = resolveFlowHighlightLayers(
      profile,
      contributions.get(handleKey) ?? [],
      deviceState,
      undefined,
      phase.flowState.activeFlowPathId,
      { addition, excluded: exclusions.has(handleKey), device: addition?.geometry === 'bounds' }
    )
    return layers.filter(layer =>
      (layer.style.source === 'flow' || layer.style.source === 'utility') &&
      layer.style.visible && layer.style.opacity > 0
    ).map(layer => {
      const { color, lineWidthPx, opacity, visible } = layer.style
      const style = { color, lineWidthPx, opacity, visible }
      const manual = layer.id.startsWith('manual:')
      const path = contributions.get(handleKey)?.find(candidate => candidate.id === layer.id)
      const styleSource = manual && addition
        ? addition.styleSource
        : path?.styleSource ?? (path?.styleOverride
          ? { kind: 'custom' as const, style }
          : { kind: 'utility' as const, utilityId: path?.utilityId })
      const utilityId = styleSource.kind === 'utility' ? styleSource.utilityId : undefined
      return {
        handleKey,
        styleSource,
        style,
        ...(utilityId ? { highlightStyleRefId: utilityId } : {}),
        ...(layer.geometry ? { geometry: layer.geometry } : {})
      }
    })
  })
}
