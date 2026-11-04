import type {
  DeviceState,
  FlowPathStatus,
  ManualHighlightCorrections,
  PresentationProfile
} from './types'

export type PhaseOverlayStyleWarning =
  | {
    kind: 'missing-manual-style'
    handleKey: string
    styleRefId: string
  }
  | {
    kind: 'missing-flow-style'
    flowPathId: string
    styleRefId: string
  }
  | {
    kind: 'missing-device-definition'
    handleKey: string
    deviceType: string
  }
  | {
    kind: 'missing-device-state-style'
    handleKey: string
    deviceType: string
    styleRefId: string
  }
  | {
    kind: 'missing-device-state'
    handleKey: string
    deviceType: string
    stateKey: string
  }

export const findPhaseOverlayStyleWarnings = (
  profile: PresentationProfile,
  flowPaths: readonly FlowPathStatus[],
  deviceStates: Readonly<Record<string, DeviceState>> = {},
  manualCorrections?: ManualHighlightCorrections
): PhaseOverlayStyleWarning[] => {
  const deviceStyles = profile.devices.flatMap(device =>
    device.states.map(state => ({ device, state }))
  )
  const styleIds = new Set([
    ...profile.utilities.map(utility => utility.id),
    ...deviceStyles.map(candidate => candidate.state.id)
  ])
  const warnings: PhaseOverlayStyleWarning[] = []
  manualCorrections?.additions.forEach(addition => {
    const styleRefId = addition.highlightStyleRefId
    if (!styleIds.has(styleRefId)) {
      warnings.push({
        kind: 'missing-manual-style',
        handleKey: addition.handleKey,
        styleRefId
      })
    }
  })

  flowPaths.forEach(flowPath => {
    const styleRefId = flowPath.highlightStyleRefId
    if (!styleIds.has(styleRefId)) {
      warnings.push({
        kind: 'missing-flow-style',
        flowPathId: flowPath.id,
        styleRefId
      })
    }
  })

  Object.values(deviceStates).forEach(deviceState => {
    const deviceType = deviceState.deviceType
    const style = deviceStyles.find(
      candidate => candidate.state.id === deviceState.highlightStyleRefId
    )
    if (!style) {
      warnings.push({
        kind: 'missing-device-state-style',
        handleKey: deviceState.key,
        deviceType,
        styleRefId: deviceState.highlightStyleRefId
      })
      return
    }
    const stateKey = deviceState.stateKey
    if (style.state.key !== stateKey || style.device.name !== deviceType) {
      warnings.push({
        kind: 'missing-device-state',
        handleKey: deviceState.key,
        deviceType,
        stateKey
      })
    }
  })

  return warnings
}