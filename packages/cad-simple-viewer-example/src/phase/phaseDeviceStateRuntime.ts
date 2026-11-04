import type {
  DeviceState,
  DeviceStateStyleDefinition,
  PresentationProfile
} from './types'

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
