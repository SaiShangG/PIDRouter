import type {
  DeviceState,
  DeviceStateStyleDefinition,
  DeviceStyleDefinition,
  ManualHighlightCorrections,
  MergedDeviceState,
  PhasePidOverlayDeviceState,
  PresentationProfile
} from './types'

export const resolveValveBrushStyleRefId = (
  device: DeviceStyleDefinition | undefined,
  currentState?: Pick<DeviceState, 'highlightStyleRefId'>
): string | undefined => {
  const states = device?.states.filter(state => state.enabled)
    .sort((left, right) => left.order - right.order) ?? []
  return (states.find(state => state.id === currentState?.highlightStyleRefId) ??
    states.find(state => state.key.toLowerCase() === 'open') ??
    states.find(state => state.flowBehavior === 'conducting') ??
    states[0])?.id
}

export interface ResolvedDeviceStateDefinition {
  state: DeviceStateStyleDefinition
  deviceType: string
}

export const resolveDeviceStateDefinition = (
  profile: PresentationProfile,
  deviceState: Pick<DeviceState, 'highlightStyleRefId'> & Partial<Pick<DeviceState, 'deviceType'>>
): ResolvedDeviceStateDefinition | undefined => {
  if (!deviceState.highlightStyleRefId) return undefined
  const deviceType = deviceState.deviceType?.trim().toLowerCase()
  for (const device of profile.devices) {
    if (deviceType && device.name.trim().toLowerCase() !== deviceType) continue
    const state = device.states.find(
      candidate => candidate.enabled && candidate.id === deviceState.highlightStyleRefId
    )
    if (state) return { state, deviceType: device.name }
  }
  return undefined
}

export const mergeHighlightedValveStates = (
  deviceStates: readonly PhasePidOverlayDeviceState[],
  manualCorrections: ManualHighlightCorrections | undefined,
  profile: PresentationProfile
): MergedDeviceState[] => {
  const merged = new Map<string, MergedDeviceState>()
  const isValve = (deviceType: string) => /valve/i.test(deviceType)
  deviceStates.forEach(deviceState => {
    const deviceType = deviceState.deviceType ?? ''
    if (!isValve(deviceType)) return
    const configuredDevice = profile.devices.find(device =>
      device.name.trim().toLowerCase() === deviceType.trim().toLowerCase())
    const definition = resolveDeviceStateDefinition(profile, deviceState)
    const isOpen = configuredDevice
      ? definition?.state.flowBehavior === 'conducting'
      : deviceState.stateKey.trim().toUpperCase() === 'OPEN'
    if (!isOpen) return
    merged.set(deviceState.handleKey, { ...deviceState, deviceType, source: 'auto' })
  })
  manualCorrections?.additions.forEach(addition => {
    const deviceState = addition.deviceState
    if (!deviceState || !isValve(deviceState.deviceType)) return
    merged.set(addition.handleKey, {
      handleKey: addition.handleKey,
      ...deviceState,
      highlightStyleRefId: addition.highlightStyleRefId,
      source: 'manual'
    })
  })
  manualCorrections?.exclusions.forEach(handleKey => merged.delete(handleKey))
  return [...merged.values()]
}

export class DeviceStateWarningNotifications {
  private readonly invalidReferencesByScope = new Map<string, Set<string>>()

  update(
    scope: string,
    profile: PresentationProfile,
    deviceStates: readonly DeviceState[]
  ): boolean {
    const invalidReferences = new Set(deviceStates
      .filter(state => !resolveDeviceStateDefinition(profile, state))
      .map(state => JSON.stringify([state.key, state.highlightStyleRefId])))
    const previous = this.invalidReferencesByScope.get(scope)
    const newlyInvalid = [...invalidReferences].some(reference => !previous?.has(reference))
    this.invalidReferencesByScope.set(scope, invalidReferences)
    return newlyInvalid
  }

  clear(): void {
    this.invalidReferencesByScope.clear()
  }
}
