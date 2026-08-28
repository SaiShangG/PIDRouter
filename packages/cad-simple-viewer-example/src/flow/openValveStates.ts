import type { DeviceState, PresentationProfile } from '../phase/types'
import { resolveDeviceStateDefinition } from '../phase/phaseDeviceStateRuntime'

export const getOpenValveHandleKeys = (
  profile: PresentationProfile,
  deviceStates: Iterable<DeviceState>
) => {
  const keys = new Set<string>()
  for (const deviceState of deviceStates) {
    if (resolveDeviceStateDefinition(profile, deviceState)?.state.flowBehavior === 'conducting') {
      keys.add(deviceState.key)
    }
  }
  return keys
}