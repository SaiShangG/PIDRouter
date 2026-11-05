import type {
  DeviceState,
  FlowPathStatus,
  HighlightMode,
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
  kind?: 'device-warning'
  renderOrder: number
  style: ResolvedEntityPresentation
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
  if (overridingStyle.source === 'invalid-device-state') {
    return [{
      id: `invalid-device-state:${deviceState?.key ?? 'entity'}`,
      kind: 'device-warning',
      renderOrder: 25000,
      style: overridingStyle
    }]
  }
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
  manual?: ManualEntityHighlight,
  highlightMode: HighlightMode = 'auto'
): FlowHighlightLayer[] => {
  const device = Boolean(deviceState || manual?.device)
  const manualMode = highlightMode === 'manual'
  const addition = manual?.excluded || (!manualMode && device) ? undefined : manual?.addition
  const automaticLayers = resolveAutomaticFlowHighlightLayers(
    profile,
    manual?.excluded || addition ? [] : flowPaths,
    deviceState,
    diagnosticStyle,
    activeFlowPathId
  )
  const diagnosticLayers = automaticLayers.filter(layer =>
    layer.style.source === 'invalid-device-state' || layer.style.source === 'diagnostic'
  )
  if (manualMode && manual?.excluded) return diagnosticLayers
  if (!addition) return automaticLayers
  const manualLayer: FlowHighlightLayer = {
    id: `manual:flow:${addition.handleKey}`,
    renderOrder: 20000,
    style: resolveEntityPresentation(profile, {
      flowPath: {
        id: `manual:${addition.handleKey}`,
        name: 'Manual correction',
        handleKeys: [addition.handleKey],
        highlightStyleRefId: addition.highlightStyleRefId
      }
    })
  }
  return manualMode ? [manualLayer, ...diagnosticLayers] : [manualLayer]
}