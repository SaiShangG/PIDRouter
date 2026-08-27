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
  const configuredDevices = state?.deviceDefinitionId
    ? profile.devices.filter(device => device.id === state.deviceDefinitionId)
    : profile.devices
  if (state?.highlightStyleRefId) {
    const referencedState = configuredDevices
      .flatMap(device => device.states)
      .find(candidate => candidate.id === state.highlightStyleRefId)
    return referencedState
      ? deviceStateStyle(referencedState)
      : profile.unknownDeviceStyle ?? undefined
  }
  const configuredState = configuredDevices
    .flatMap(device => device.states)
    .find(candidate => candidate.key === (state?.stateKey ?? state?.mode))
  if (configuredState) {
    return deviceStateStyle(configuredState)
  }
  switch (state?.mode) {
    case 'open':
      return profile.deviceStyles.valve.open ?? undefined
    case 'closed':
      return profile.deviceStyles.valve.closed ?? undefined
    case 'pulse':
      return profile.deviceStyles.valve.pulse ?? undefined
    case 'start':
      return profile.deviceStyles.motor.start ?? undefined
    case 'stop':
      return profile.deviceStyles.motor.stop ?? undefined
    case 'active':
      return profile.deviceStyles.processEquipment.active ?? undefined
    case 'unknown':
      return profile.unknownDeviceStyle ?? undefined
    default:
      return undefined
  }
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
  const customStyle =
    flowPath?.styleSource?.kind === 'custom'
      ? flowPath.styleSource.style
      : flowPath?.styleSource == null && flowPath?.styleOverride
        ? { ...profile.defaultFlowStyle, ...flowPath.styleOverride }
        : undefined
  let style: HighlightStyle = customStyle ?? profile.defaultFlowStyle
  if (flowPath) source = 'flow'
  const utilityId =
    flowPath?.styleSource?.kind === 'utility'
      ? flowPath.styleSource.utilityId
      : flowPath?.styleSource == null && !customStyle
        ? flowPath?.utilityId
        : undefined
  const utility = utilityId
    ? profile.utilities.find(
      item => item.id === utilityId
    )
    : undefined
  if (utility) {
    style = utility.style
    source = 'utility'
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
