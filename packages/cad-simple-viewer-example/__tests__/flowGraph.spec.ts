import {
  buildFlowGraphIndex,
  normalizeFlowHandle
} from '../src/flow/flowGraph'
import type { FlowConnectionDocumentInput } from '../src/flow/types'

const documentWithGraph = (document: FlowConnectionDocumentInput): FlowConnectionDocumentInput =>
  document

describe('flowGraph', () => {
  it('normalizes numeric handles to uppercase hexadecimal keys', () => {
    expect(normalizeFlowHandle(26)).toBe('1A')
    expect(normalizeFlowHandle('0x001a')).toBe('1A')
    expect(normalizeFlowHandle(-1)).toBeUndefined()
  })

  it('indexes ControlModules and infers only unique contained-handle owners', () => {
    const graph = buildFlowGraphIndex(
      documentWithGraph({
        Areas: [{
          Id: 'A-1',
          ControlModules: [
            { CadHandle: 2, Id: 'V-2', Name: 'Valve' },
            { CadHandle: 5, Id: 'P-5', Name: 'Pump' }
          ],
          ContainCadEntityHandles: [2, 3, 4, 5, 6]
        }],
        Map: {
          Graph: {
            Vertices: [2, 3, 4, 5, 6],
            Edges: [
              { Source: 2, Target: 3 },
              { Source: 3, Target: 4 },
              { Source: 4, Target: 5 },
              { Source: 2, Target: 6 },
              { Source: 5, Target: 6 }
            ]
          }
        }
      })
    )

    expect(graph.nodes.get('2')?.kind).toBe('valve')
    expect(graph.nodes.get('2')?.label).toBe('V-2')
    expect(graph.nodes.get('5')?.kind).toBe('pump')
    expect(graph.valveKeys).toEqual(new Set(['2']))
    expect(graph.pumpKeys).toEqual(new Set(['5']))
    expect(graph.primaryHandleByCadHandle.get('3')).toBe('2')
    expect(graph.primaryHandleByCadHandle.get('4')).toBe('5')
    expect(graph.primaryHandleByCadHandle.has('6')).toBe(false)
  })

  it('builds bidirectional adjacency, preserves link metadata, and ignores invalid edges', () => {
    const graph = buildFlowGraphIndex({
      Map: {
        Graph: {
          Vertices: [1, 2],
          Edges: [
            { Source: -1, Target: 1 },
            {
              Source: 1,
              Target: 2,
              LinkTypeName: 'ProcessDrawingInfo.DirectLink, ProcessDrawingInfo',
              LinkJson: '{"Type":1}'
            },
            { Source: 1, Target: 2 }
          ]
        }
      }
    })

    expect(graph.adjacency.get('1')).toEqual(['2'])
    expect(graph.adjacency.get('2')).toEqual(['1'])
    expect(graph.edges[0]).toEqual({
      source: '1',
      target: '2',
      linkTypeName: 'ProcessDrawingInfo.DirectLink, ProcessDrawingInfo',
      linkType: 'DirectLink',
      linkJson: '{"Type":1}'
    })
    expect(graph.nodes.has('FFFF')).toBe(false)
  })
})
