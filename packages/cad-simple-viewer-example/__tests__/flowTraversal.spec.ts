import { buildFlowGraphIndex } from '../src/flow/flowGraph'
import {
  countFlowTreeNodes,
  countFlowTreeStops,
  mergeFlowHighlightKeys,
  traverseFlowFromValve
} from '../src/flow/flowTraversal'

const graph = buildFlowGraphIndex({
  Areas: [{
    Id: 'A-1',
    ControlModules: [
      { CadHandle: 1, Id: 'V-1', Name: 'Valve' },
      { CadHandle: 4, Id: 'V-4', Name: 'Valve' },
      { CadHandle: 7, Id: 'V-7', Name: 'Valve' }
    ],
    ContainCadEntityHandles: [1, 2, 3, 4, 5, 6, 7]
  }],
  Map: {
    Graph: {
      Vertices: [1, 2, 3, 4, 5, 6, 7],
      Edges: [
        { Source: 1, Target: 2 },
        { Source: 2, Target: 3 },
        { Source: 3, Target: 4 },
        { Source: 3, Target: 5 },
        { Source: 5, Target: 6 },
        { Source: 6, Target: 1 },
        { Source: 4, Target: 7 }
      ]
    }
  }
})

describe('flowTraversal', () => {
  it('walks lines and equipment, stops at closed valves, and omits revisits', () => {
    const states = new Map([
      ['1', 'open' as const],
      ['4', 'closed' as const],
      ['7', 'open' as const]
    ])
    const result = traverseFlowFromValve(graph, '1', states)
    const flatten = (node: typeof result.root): typeof result.root[] => [
      node,
      ...node.children.flatMap(flatten)
    ]
    const nodes = flatten(result.root)

    expect(result.highlightedKeys).toEqual(new Set(['1', '2', '6', '3', '5']))
    expect(result.stoppedValveKeys).toEqual(new Set(['4']))
    expect(nodes.some(node => node.key === '4' && node.status === 'closed')).toBe(true)
    expect(result.visitedKeys).toEqual(new Set(['1', '2', '3', '4', '5', '6']))
    expect(result.visitedEdges).toEqual(
      new Set(['1|2', '1|6', '2|3', '5|6', '3|4', '3|5'])
    )
    expect(countFlowTreeNodes(result.root)).toBe(result.visitedKeys.size)
    expect(new Set(nodes.map(node => node.key))).toEqual(result.visitedKeys)
  })

  it('follows connections in both directions and stops at closed valves', () => {
    const result = traverseFlowFromValve(graph, '4', new Map([['4', 'open' as const]]))

    expect(result.visitedKeys).toEqual(new Set(['4', '3', '7', '2', '5', '1', '6']))
    expect(result.root.children.map(child => child.key)).toEqual(['3', '7'])
    expect(result.stoppedValveKeys).toEqual(new Set(['1', '7']))
  })

  it('returns a closed start without expanding it', () => {
    const result = traverseFlowFromValve(graph, '1', new Map([['1', 'closed' as const]]))
    expect(result.root.status).toBe('closed')
    expect(result.root.children).toHaveLength(0)
    expect(result.highlightedKeys).toEqual(new Set())
    expect(countFlowTreeStops(result.root)).toBe(1)
  })

  it('merges highlighted lines from multiple open roots', () => {
    const states = new Map([
      ['1', 'open' as const],
      ['4', 'open' as const],
      ['7', 'open' as const]
    ])
    const first = traverseFlowFromValve(graph, '1', states)
    const second = traverseFlowFromValve(graph, '4', states)
    expect(mergeFlowHighlightKeys([first, second])).toEqual(
      new Set(['1', '2', '6', '3', '5', '4', '7'])
    )
  })
})
