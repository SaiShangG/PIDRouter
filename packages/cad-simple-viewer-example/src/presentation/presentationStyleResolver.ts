import type {
  DeviceState,
  DeviceStateStyleDefinition,
  FlowPathStatus,
  HighlightStyle,
  PresentationProfile
} from '../phase/types'

export type PresentationSource =
  | 'diagnostic'
  | 'device'
  | 'flow'
  | 'utility'
  | 'default'

export interface ResolvedEntityPresentation extends HighlightStyle {
  key: string
  source: PresentationSource
}

export interface PresentationResolutionContext {
  flowPath?: FlowPathStatus
  deviceState?: DeviceState
  diagnosticStyle?: HighlightStyle
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

export const normalizeHighlightStyle = (
  style: HighlightStyle
): HighlightStyle => ({
  color: Math.round(clamp(style.color, 0, 0xffffff)),
  lineWidthPx: clamp(style.lineWidthPx, 1, 12),
  opacity: clamp(style.opacity, 0, 1),
  visible: Boolean(style.visible)
})

const resolveDeviceStyle = (
  profile: PresentationProfile,
  state?: DeviceState
): HighlightStyle | undefined => {
  if (state?.highlightStyleRefId) {
    const referencedState = profile.devices
      .flatMap(device => device.states)
      .find(candidate => candidate.id === state.highlightStyleRefId)
    return referencedState
      ? deviceStateStyle(referencedState)
      : profile.unknownDeviceStyle ?? undefined
  }
  return undefined
}

const deviceStateStyle = (
  state: DeviceStateStyleDefinition
): HighlightStyle => ({
  color: state.color,
  lineWidthPx: state.lineWidthPx,
  opacity: state.opacity,
  visible: true
})

const styleKey = (style: HighlightStyle) =>
  `${style.color.toString(16).padStart(6, '0')}:${style.lineWidthPx}:${style.opacity}:${style.visible ? 1 : 0}`

export const resolveEntityPresentation = (
  profile: PresentationProfile,
  context: PresentationResolutionContext = {}
): ResolvedEntityPresentation => {
  let source: PresentationSource = 'default'
  const flowPath = context.flowPath
  let style: HighlightStyle = profile.defaultFlowStyle
  if (flowPath) source = 'flow'
  const styleRefId = flowPath?.highlightStyleRefId
  const utility = styleRefId
    ? profile.utilities.find(
      item => item.id === styleRefId
    )
    : undefined
  if (utility) {
    style = utility.style
    source = 'utility'
  } else if (styleRefId) {
    const state = profile.devices.flatMap(device => device.states)
      .find(candidate => candidate.id === styleRefId)
    if (state) style = deviceStateStyle(state)
  }
  const deviceStyle = resolveDeviceStyle(profile, context.deviceState)
  if (deviceStyle) {
    style = deviceStyle
    source = 'device'
  }
  if (context.diagnosticStyle) {
    style = context.diagnosticStyle
    source = 'diagnostic'
  }
  const normalized = normalizeHighlightStyle(style)
  return Object.freeze({
    ...normalized,
    key: styleKey(normalized),
    source
  })
}
