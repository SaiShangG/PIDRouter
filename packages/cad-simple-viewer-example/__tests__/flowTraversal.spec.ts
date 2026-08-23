import { buildFlowGraphIndex } from '../src/flow/flowGraph'
import {
  countFlowTreeNodes,
  countFlowTreeStops,
  mergeFlowHighlightKeys,
  traverseFlowFromValve
} from '../src/flow/flowTraversal'

const graph = buildFlowGraphIndex({
  Dsl: {
    Entities: {
      $values: [
        { Handle: 1, $type: 'Demo.Block, Demo' },
        { Handle: 2, $type: 'Demo.Polyline, Demo' },
        { Handle: 3, $type: 'Demo.Polyline, Demo' },
        { Handle: 4, $type: 'Demo.Block, Demo' },
        { Handle: 5, $type: 'Demo.Block, Demo' },
        { Handle: 6, $type: 'Demo.Polyline, Demo' },
        { Handle: 7, $type: 'Demo.Block, Demo' }
      ]
    }
  },
  Map: {
    Maps: {
      $values: [
        {
          Graph: {
            Edges: {
              $values: [
                { From: 1, To: { $values: [2] } },
                { From: 2, To: { $values: [3] } },
                { From: 3, To: { $values: [4, 5] } },
                { From: 5, To: { $values: [6] } },
                { From: 6, To: { $values: [1] } },
                { From: 4, To: { $values: [7] } }
              ]
            }
          }
        }
      ]
    }
  },
  Org: {
    Areas: {
      $values: [{ Components: { $values: [{ Handle: 1, Id: 'V-1', Name: 'Valve' }, { Handle: 4, Id: 'V-4', Name: 'Valve' }, { Handle: 7, Id: 'V-7', Name: 'Valve' }] } }]
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

    expect(result.highlightedKeys).toEqual(new Set(['1', '2', '3', '6']))
    expect(result.stoppedValveKeys).toEqual(new Set(['4']))
    expect(nodes.some(node => node.key === '4' && node.status === 'closed')).toBe(true)
    expect(result.visitedKeys).toEqual(new Set(['1', '2', '3', '4', '5', '6']))
    expect(result.visitedEdges).toEqual(
      new Set(['1|2', '2|3', '3|4', '3|5', '5|6', '6|1'])
    )
    expect(countFlowTreeNodes(result.root)).toBe(result.visitedKeys.size)
    expect(new Set(nodes.map(node => node.key))).toEqual(result.visitedKeys)
  })

  it('follows only outgoing connections', () => {
    const result = traverseFlowFromValve(graph, '4', new Map([['4', 'open' as const]]))

    expect(result.visitedKeys).toEqual(new Set(['4', '7']))
    expect(result.visitedEdges).toEqual(new Set(['4|7']))
    expect(result.root.children.map(child => child.key)).toEqual(['7'])
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
      new Set(['1', '2', '3', '4', '6'])
    )
  })
})
