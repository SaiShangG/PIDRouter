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
  diagnosticStyle?: HighlightStyle
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

  return flowPaths.map((flowPath, index) => ({
    id: flowPath.id,
    renderOrder: FLOW_HIGHLIGHT_RENDER_ORDER + index,
    style: resolveEntityPresentation(profile, { flowPath })
  }))
}