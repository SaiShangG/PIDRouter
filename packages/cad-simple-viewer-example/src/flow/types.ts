import type { AcDbObjectId } from '@mlightcad/data-model'

export interface DocumentInfoInput {
  Name?: string
  Value?: string
}

export interface DocumentControlModuleInput {
  CadHandle?: number
  Id?: string
  Name?: string
  Infos?: DocumentInfoInput[]
}

export interface DocumentAreaInput {
  Id?: string
  CadHandle?: number
  BoundingBox?: {
    Min?: { X?: number; Y?: number; Z?: number }
    Max?: { X?: number; Y?: number; Z?: number }
  }
  ControlModules?: DocumentControlModuleInput[]
  ContainCadEntityHandles?: number[]
}

export interface DocumentGraphEdgeInput {
  Source?: number
  Target?: number
  LinkTypeName?: string
  LinkJson?: string
}

export interface FlowConnectionDocumentInput {
  Areas?: DocumentAreaInput[]
  Map?: {
    Graph?: {
      Vertices?: number[]
      Edges?: DocumentGraphEdgeInput[]
    }
  }
}

export type FlowGraphNodeKind = 'valve' | 'pump' | 'line' | 'equipment'

export interface DocumentControlModule extends DocumentControlModuleInput {
  CadHandle: number
  areaId?: string
  deviceType: Exclude<FlowGraphNodeKind, 'line'>
}

export interface FlowGraphEdge {
  source: string
  target: string
  linkTypeName?: string
  linkType?: string
  linkJson?: string
}

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
  /** Undirected neighbors in stable Document.json order. */
  adjacency: ReadonlyMap<string, readonly string[]>
  edges: readonly FlowGraphEdge[]
  controlModuleByPrimaryHandle: ReadonlyMap<string, DocumentControlModule>
  /** Unique graph-inferred owner for an Area-contained CAD entity. */
  controlModuleByContainedHandle: ReadonlyMap<string, DocumentControlModule>
  primaryHandleByCadHandle: ReadonlyMap<string, string>
  deviceKeysByType: ReadonlyMap<Exclude<FlowGraphNodeKind, 'line'>, ReadonlySet<string>>
  valveKeys: ReadonlySet<string>
  pumpKeys: ReadonlySet<string>
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
  /** Canonical undirected edge keys visited during the walk. */
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
