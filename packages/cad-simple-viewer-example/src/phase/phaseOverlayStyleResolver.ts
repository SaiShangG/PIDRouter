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
  const deviceById = new Map(profile.devices.map(device => [device.id, device]))
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
    const deviceType = deviceState.deviceDefinitionId
    if (!deviceType) return
    const device = deviceById.get(deviceType)
    if (!device) {
      warnings.push({
        kind: 'missing-device-definition',
        handleKey: deviceState.key,
        deviceType
      })
      return
    }
    const stateKey = deviceState.stateKey
    if (stateKey && !device.states.some(state => state.key === stateKey)) {
      warnings.push({
        kind: 'missing-device-state',
        handleKey: deviceState.key,
        deviceType,
        stateKey
      })
    }
    const styleRefId = deviceState.highlightStyleRefId
    if (styleRefId && !device.states.some(state => state.id === styleRefId)) {
      warnings.push({
        kind: 'missing-device-state-style',
        handleKey: deviceState.key,
        deviceType,
        styleRefId
      })
    }
  })

  return warnings
}