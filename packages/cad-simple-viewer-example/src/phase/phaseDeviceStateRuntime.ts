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
  deviceState: Pick<DeviceState, 'highlightStyleRefId'>
): ResolvedDeviceStateDefinition | undefined => {
  if (!deviceState.highlightStyleRefId) return undefined
  for (const device of profile.devices) {
    const state = device.states.find(
      candidate => candidate.id === deviceState.highlightStyleRefId
    )
    if (state) return { state, deviceType: device.name }
  }
  return undefined
}
