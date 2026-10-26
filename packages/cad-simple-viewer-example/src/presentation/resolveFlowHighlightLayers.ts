import type {
  DeviceState,
  FlowPathStatus,
  HighlightStyle,
  ManualHighlightAddition,
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
  geometry?: 'bounds'
}

const resolveAutomaticFlowHighlightLayers = (
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

export interface ManualEntityHighlight {
  addition?: ManualHighlightAddition
  excluded: boolean
  device: boolean
}

export const resolveFlowHighlightLayers = (
  profile: PresentationProfile,
  flowPaths: readonly FlowPathStatus[],
  deviceState?: DeviceState,
  diagnosticStyle?: HighlightStyle,
  activeFlowPathId?: string,
  manual?: ManualEntityHighlight
): FlowHighlightLayer[] => {
  const device = Boolean(deviceState || manual?.device || manual?.addition?.geometry === 'bounds')
  const addition = manual?.excluded || device ? undefined : manual?.addition
  const automaticLayers = resolveAutomaticFlowHighlightLayers(
    profile,
    manual?.excluded || addition ? [] : flowPaths,
    deviceState,
    diagnosticStyle,
    activeFlowPathId
  )
  if (!addition) return automaticLayers
  const manualLayer: FlowHighlightLayer = {
    id: `manual:flow:${addition.handleKey}`,
    renderOrder: 20000,
    style: resolveEntityPresentation(profile, {
      flowPath: {
        id: `manual:${addition.handleKey}`,
        name: 'Manual correction',
        handleKeys: [addition.handleKey],
        styleSource: addition.styleSource
      }
    })
  }
  return [manualLayer]
}