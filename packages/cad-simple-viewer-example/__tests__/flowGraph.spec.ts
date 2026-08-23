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

  it('uses Org Valve components as the authoritative valve classification', () => {
    const graph = buildFlowGraphIndex(
      documentWithGraph({
        Dsl: {
          Entities: {
            $values: [
              { Handle: 1, $type: 'Demo.Polyline, Demo' },
              { Handle: 2, $type: 'Demo.Block, Demo', LayerName: 'Valve' },
              { Handle: 3, $type: 'Demo.Block, Demo' }
            ]
          }
        },
        Map: {
          Maps: {
            $values: [
              {
                Graph: {
                  Edges: {
                    $values: [{ From: 1, To: { $values: [2, 3] } }]
                  }
                }
              }
            ]
          }
        },
        Org: {
          Areas: {
            $values: [{ Components: { $values: [{ Handle: 2, Id: 'V-2', Name: 'Valve' }] } }]
          }
        }
      })
    )

    expect(graph.nodes.get('1')?.kind).toBe('line')
    expect(graph.nodes.get('2')?.kind).toBe('valve')
    expect(graph.nodes.get('2')?.label).toBe('V-2')
    expect(graph.nodes.get('3')?.kind).toBe('equipment')
    expect(graph.valveKeys).toEqual(new Set(['2']))
  })

  it('builds a deduplicated directed adjacency index and ignores negative roots', () => {
    const graph = buildFlowGraphIndex({
      Map: {
        Maps: {
          $values: [
            {
              Graph: {
                Edges: {
                  $values: [
                    { From: -1, To: { $values: [1] } },
                    { From: 1, To: { $values: [2, 2] } }
                  ]
                }
              }
            }
          ]
        }
      }
    })

    expect(graph.adjacency.get('1')).toEqual(['2'])
    expect(graph.adjacency.get('2')).toEqual([])
    expect(graph.nodes.has('FFFF')).toBe(false)
  })
})
