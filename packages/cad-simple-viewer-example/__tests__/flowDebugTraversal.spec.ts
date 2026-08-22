import {
  FlowDebugTraversal,
  type FlowDebugTraversalEdge
} from '../src/flowDebugTraversal'

const keys = (handle: number) => [String(handle)]

const createTraversal = (
  edges: Record<string, FlowDebugTraversalEdge[]>,
  blocked: number[] = []
) =>
  new FlowDebugTraversal({
    startKeys: ['1'],
    getEdges: key => edges[key] ?? [],
    getHandleKeys: keys,
    isBlocked: handle => blocked.includes(handle)
  })

describe('FlowDebugTraversal', () => {
  it('advances exactly one connected target per step in breadth-first order', () => {
    const traversal = createTraversal({
      '1': [
        { from: 1, to: 2 },
        { from: 1, to: 3 }
      ],
      '2': [{ from: 2, to: 4 }]
    })

    expect(traversal.next()?.edge).toEqual({ from: 1, to: 2 })
    expect(traversal.pendingEdges).toEqual([
      { from: 1, to: 3 },
      { from: 2, to: 4 }
    ])
    expect(traversal.next()?.edge).toEqual({ from: 1, to: 3 })
    expect(traversal.next()?.edge).toEqual({ from: 2, to: 4 })
    expect(traversal.next()).toBeUndefined()
  })

  it('does not expand a blocked boundary', () => {
    const traversal = createTraversal(
      {
        '1': [{ from: 1, to: 2 }],
        '2': [{ from: 2, to: 3 }]
      },
      [2]
    )

    expect(traversal.next()).toMatchObject({
      edge: { from: 1, to: 2 },
      blocked: true,
      pendingCount: 0
    })
    expect(traversal.next()).toBeUndefined()
  })

  it('queues duplicate graph targets only once', () => {
    const traversal = createTraversal({
      '1': [
        { from: 1, to: 2 },
        { from: 1, to: 2 }
      ],
      '2': [{ from: 2, to: 1 }]
    })

    expect(traversal.pendingEdges).toHaveLength(1)
    traversal.next()
    expect(traversal.pendingEdges).toEqual([{ from: 2, to: 1 }])
  })
})
