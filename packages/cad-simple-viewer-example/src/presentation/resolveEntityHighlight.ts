import type { FlowPathStatus } from '../phase/types'
import type { ResolvedEntityPresentation } from './presentationStyleResolver'

export interface ResolvedFlowHighlight {
  flowPathId: string
  priority: number
  style: ResolvedEntityPresentation
}

export interface EntityHighlightState {
  flowStyles?: readonly ResolvedFlowHighlight[]
  brushStyle?: ResolvedEntityPresentation
  ordinaryStyle?: ResolvedEntityPresentation
  selectionStyle?: ResolvedEntityPresentation
  hoverStyle?: ResolvedEntityPresentation
  selected?: boolean
  hovered?: boolean
}

export interface EntityHighlightResolution {
  source: 'flow' | 'brush' | 'ordinary' | 'selection' | 'hover'
  style: ResolvedEntityPresentation
}

const compareFlowHighlights = (
  left: ResolvedFlowHighlight,
  right: ResolvedFlowHighlight
) =>
  right.priority - left.priority ||
  left.flowPathId.localeCompare(right.flowPathId)

export const resolvePrimaryFlowHighlight = (
  flowStyles: readonly ResolvedFlowHighlight[],
  activeFlowPathId?: string
) => {
  const active = flowStyles.find(
    flowStyle => flowStyle.flowPathId === activeFlowPathId
  )
  if (active) return active
  return [...flowStyles].sort(compareFlowHighlights)[0]
}

export const resolveEntityHighlight = (
  state: EntityHighlightState,
  activeFlowPathId?: string
): EntityHighlightResolution | undefined => {
  const flow = resolvePrimaryFlowHighlight(
    state.flowStyles ?? [],
    activeFlowPathId
  )
  if (flow) return { source: 'flow', style: flow.style }
  if (state.brushStyle) return { source: 'brush', style: state.brushStyle }
  if (state.selected && state.selectionStyle) {
    return { source: 'selection', style: state.selectionStyle }
  }
  if (state.hovered && state.hoverStyle) {
    return { source: 'hover', style: state.hoverStyle }
  }
  if (state.ordinaryStyle) {
    return { source: 'ordinary', style: state.ordinaryStyle }
  }
  return undefined
}

export const toResolvedFlowHighlight = (
  flowPath: FlowPathStatus,
  style: ResolvedEntityPresentation
): ResolvedFlowHighlight => ({
  flowPathId: flowPath.id,
  priority: flowPath.priority ?? 0,
  style
})