import {
  collectHighlightHandleKeys,
  findStaleHighlightRootIds,
  retainUnresolvedFlowPaths
} from '../src/phase/phaseFlowPathRuntime'

describe('collectHighlightHandleKeys', () => {
  it('captures every highlighted object as one normalized Handle', () => {
    expect(collectHighlightHandleKeys(
      ['valve', 'pipe-a', 'pipe-b', 'duplicate'],
      objectId => ({
        valve: ['1a'],
        'pipe-a': [' 2b '],
        'pipe-b': ['0x3c', '3c'],
        duplicate: ['2B']
      })[objectId] ?? []
    )).toEqual(['1A', '2B', '3C'])
  })

  it('skips objects without a valid hexadecimal Handle', () => {
    expect(collectHighlightHandleKeys(['missing'], () => ['not-a-handle']))
      .toEqual([])
  })
})

describe('findStaleHighlightRootIds', () => {
  it('removes roots that are no longer referenced after a Phase switch', () => {
    const phaseARootIds = ['flow-a-1', 'flow-a-2', 'shared-device']
    const phaseBReferencedIds = new Set(['flow-b-1', 'shared-device'])

    expect(findStaleHighlightRootIds(
      phaseARootIds,
      phaseBReferencedIds
    )).toEqual(['flow-a-1', 'flow-a-2'])
  })

  it('removes every old device root when the next Phase has no device states', () => {
    expect(findStaleHighlightRootIds(
      ['device-a-1', 'device-a-2'],
      new Set<string>()
    )).toEqual(['device-a-1', 'device-a-2'])
  })
})

describe('retainUnresolvedFlowPaths', () => {
  it('retains only handles that cannot be resolved in the current drawing', () => {
    const flowPaths = [{
      id: 'flow-1',
      name: 'Transfer',
      handleKeys: ['1A', '2B'],
      styleSource: { kind: 'utility' as const, utilityId: 'water' }
    }]

    expect(retainUnresolvedFlowPaths(
      flowPaths,
      handleKey => handleKey === '1A'
    )).toEqual([{
      id: 'flow-1',
      name: 'Transfer',
      handleKeys: ['2B'],
      styleSource: { kind: 'utility', utilityId: 'water' }
    }])
    expect(flowPaths[0].handleKeys).toEqual(['1A', '2B'])
  })

  it('drops a retained record when every handle resolves', () => {
    expect(retainUnresolvedFlowPaths([{
      id: 'flow-1',
      name: 'Transfer',
      handleKeys: ['1A']
    }], () => true)).toEqual([])
  })
})