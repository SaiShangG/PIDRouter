import type {
  DeviceState,
  DeviceStateStyleDefinition,
  DeviceStyleDefinition,
  PresentationProfile
} from './types'

export interface ResolvedDeviceStateDefinition {
  device: DeviceStyleDefinition
  state: DeviceStateStyleDefinition
}

export const resolveDeviceStateDefinition = (
  profile: PresentationProfile,
  deviceState: Pick<DeviceState, 'deviceDefinitionId' | 'stateKey'>
): ResolvedDeviceStateDefinition | undefined => {
  if (!deviceState.deviceDefinitionId || !deviceState.stateKey) return undefined
  const device = profile.devices.find(
    candidate => candidate.id === deviceState.deviceDefinitionId
  )
  const state = device?.states.find(
    candidate => candidate.key === deviceState.stateKey
  )
  return device && state ? { device, state } : undefined
}
