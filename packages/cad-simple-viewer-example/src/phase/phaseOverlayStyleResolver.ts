import type {
  DeviceState,
  FlowPathStatus,
  PresentationProfile
} from './types'

export type PhaseOverlayStyleWarning =
  | {
    kind: 'missing-flow-utility'
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
  deviceStates: Readonly<Record<string, DeviceState>> = {}
): PhaseOverlayStyleWarning[] => {
  const utilityIds = new Set(profile.utilities.map(utility => utility.id))
  const deviceStyles = profile.devices.flatMap(device =>
    device.states.map(state => ({ device, state }))
  )
  const warnings: PhaseOverlayStyleWarning[] = []

  flowPaths.forEach(flowPath => {
    const styleRefId = flowPath.styleSource?.kind === 'utility'
      ? flowPath.styleSource.utilityId
      : flowPath.utilityId
    if (styleRefId && !utilityIds.has(styleRefId)) {
      warnings.push({
        kind: 'missing-flow-utility',
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