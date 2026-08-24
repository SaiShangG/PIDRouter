import type { DeviceState } from '../phase/types'

export const getOpenValveHandleKeys = (
  deviceStates: Iterable<DeviceState>
) => {
  const keys = new Set<string>()
  for (const deviceState of deviceStates) {
    if (deviceState.mode === 'open') keys.add(deviceState.key)
  }
  return keys
}