import type { DeviceState } from '../src/phase/types'
import { getOpenValveHandleKeys } from '../src/flow/openValveStates'

describe('getOpenValveHandleKeys', () => {
  it('uses all globally open valves regardless of which Utility opened them', () => {
    const states: DeviceState[] = [
      { key: 'a', label: 'A', mode: 'open' },
      { key: 'b', label: 'B', mode: 'open' },
      { key: 'c', label: 'C', mode: 'closed' }
    ]

    expect(getOpenValveHandleKeys(states)).toEqual(new Set(['a', 'b']))
  })

  it('does not treat non-valve device modes as open flow boundaries', () => {
    const states: DeviceState[] = [
      { key: 'motor', label: 'M-1', mode: 'start' },
      { key: 'equipment', label: 'P-1', mode: 'active' }
    ]

    expect(getOpenValveHandleKeys(states)).toEqual(new Set())
  })
})