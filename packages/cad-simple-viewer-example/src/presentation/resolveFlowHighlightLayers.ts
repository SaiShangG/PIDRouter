import type {
  DeviceState,
  FlowPathStatus,
  HighlightStyle,
  PresentationProfile
} from '../phase/types'
import {
  type ResolvedEntityPresentation,
  resolveEntityPresentation
} from './presentationStyleResolver'
import { resolvePrimaryFlowHighlight } from './resolveEntityHighlight'

const FLOW_HIGHLIGHT_RENDER_ORDER = 10000

export interface FlowHighlightLayer {
  id: string
  renderOrder: number
  style: ResolvedEntityPresentation
}

export const resolveFlowHighlightLayers = (
  profile: PresentationProfile,
  flowPaths: readonly FlowPathStatus[],
  deviceState?: DeviceState,
  diagnosticStyle?: HighlightStyle,
  activeFlowPathId?: string
): FlowHighlightLayer[] => {
  const overridingStyle = resolveEntityPresentation(profile, {
    deviceState,
    diagnosticStyle
  })
  if (overridingStyle.source === 'diagnostic' || overridingStyle.source === 'device') {
    return [{
      id: `${overridingStyle.source}:${deviceState?.key ?? 'entity'}`,
      renderOrder: FLOW_HIGHLIGHT_RENDER_ORDER,
      style: overridingStyle
    }]
  }

  if (flowPaths.length === 0) {
    return deviceState
      ? [{
        id: `default:${deviceState.key}`,
        renderOrder: FLOW_HIGHLIGHT_RENDER_ORDER,
        style: overridingStyle
      }]
      : []
  }

  const primaryFlow = resolvePrimaryFlowHighlight(
    flowPaths.map(flowPath => ({
      flowPathId: flowPath.id,
      priority: flowPath.priority ?? 0,
      style: resolveEntityPresentation(profile, { flowPath })
    })),
    activeFlowPathId
  )
  return primaryFlow
    ? [{
      id: primaryFlow.flowPathId,
      renderOrder: FLOW_HIGHLIGHT_RENDER_ORDER,
      style: primaryFlow.style
    }]
    : []
}