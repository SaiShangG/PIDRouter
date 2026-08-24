import type { AcDbObjectId } from '@mlightcad/data-model'

export interface FlowConnectionEdgeInput {
  From?: number
  To?: { $values?: number[] }
}

export interface FlowConnectionEntityInput {
  $type?: string
  Handle?: number
  LayerName?: string
  BlockName?: string
  Attributes?: {
    $values?: Array<{ Key?: string; Value?: string }>
  }
  Items?: { $values?: FlowConnectionEntityInput[] }
}

export interface FlowConnectionDocumentInput {
  Areas?: Array<{
    Id?: string
    BoundingBox?: {
      Min?: { X?: number; Y?: number; Z?: number }
      Max?: { X?: number; Y?: number; Z?: number }
    }
    Components?: {
      $values?: Array<{
        Handle?: number
        Id?: string
        Name?: string
      }>
    }
  }>
  Dsl?: {
    Entities?: { $values?: FlowConnectionEntityInput[] }
  }
  Map?: {
    Maps?: {
      $values?: Array<{
        Graph?: { Edges?: { $values?: FlowConnectionEdgeInput[] } }
      }>
    }
  }
  Org?: {
    Areas?: {
      $values?: Array<{
        Id?: string
        Components?: {
          $values?: Array<{
            Handle?: number
            Id?: string
            Name?: string
          }>
        }
      }>
    } | Array<{
      Id?: string
      Components?: {
        $values?: Array<{
          Handle?: number
          Id?: string
          Name?: string
        }>
      }
    }>
  }
}

export type FlowGraphNodeKind = 'valve' | 'line' | 'equipment'

export interface FlowGraphNode {
  key: string
  handle: number
  kind: FlowGraphNodeKind
  label: string
  layerName?: string
  blockName?: string
  componentId?: string
  componentName?: string
  missingEntity?: boolean
}

export interface FlowGraphIndex {
  nodes: ReadonlyMap<string, FlowGraphNode>
  /** Outgoing neighbors in stable JSON order. */
  adjacency: ReadonlyMap<string, readonly string[]>
  valveKeys: ReadonlySet<string>
}

export type FlowTreeNodeStatus =
  | 'start'
  | 'open'
  | 'closed'
  | 'missing'
  | 'equipment'
  | 'line'

export interface FlowDebugTreeNode {
  key: string
  node: FlowGraphNode
  status: FlowTreeNodeStatus
  depth: number
  children: FlowDebugTreeNode[]
}

export interface FlowTraversalResult {
  root: FlowDebugTreeNode
  visitedKeys: ReadonlySet<string>
  /** Directed edge keys visited during the walk (`A|B` means `A → B`). */
  visitedEdges: ReadonlySet<string>
  highlightedKeys: ReadonlySet<string>
  stoppedValveKeys: ReadonlySet<string>
  diagnostics: readonly string[]
}

export type ValveRuntimeState = 'open' | 'closed'

/** Traversal accepts either explicit runtime states or the set of open valves. */
export type ValveRuntimeStateInput =
  | ReadonlyMap<string, ValveRuntimeState>
  | ReadonlySet<string>

export interface ValveDebugOverlay {
  dispose(): void
  setVisible?(visible: boolean): void
}

export interface ValveDebugView {
  canvas: HTMLCanvasElement
  width: number
  height: number
  viewportToCanvas(point: { x: number; y: number }): { x: number; y: number }
  pick(point: { x: number; y: number }): Array<{ id: AcDbObjectId }>
  screenToWorld(point: { x: number; y: number }): { x: number; y: number }
  zoomTo(box: unknown, margin?: number): void
  isDirty: boolean
}

export interface ValveDebugPanelLabels {
  title: string
  empty: string
  currentStart: string
  state: string
  open: string
  close: string
  closed: string
  nodeCount: string
  stoppedCount: string
  locateUnavailable: string
  start: string
  valve: string
  line: string
  equipment: string
  truncated: string
  missing: string
  collapse: string
  expand: string
  resize?: string
}

export interface ValveDebugPanelCallbacks {
  onCollapseChanged(collapsed: boolean): void
  onWidthChanged?(width: number): void
  onNodeClick(key: string): void
}
