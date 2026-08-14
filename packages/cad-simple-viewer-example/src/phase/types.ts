export const PHASE_WORKSPACE_SCHEMA_VERSION = 3

export type DrawingAssetKind = 'local' | 'url' | 'blank'

export interface DrawingAssetRef {
  id: string
  kind: DrawingAssetKind
  sourceName: string
  url?: string
}

export type DeviceMode = 'open' | 'closed' | 'start' | 'stop' | 'unknown'

export interface DeviceState {
  key: string
  label: string
  mode: DeviceMode
}

export interface FlowStateSnapshot {
  openBoundaryHandleKeys: string[]
}

export type PhaseDrawingAssociation =
  | { kind: 'assigned'; assetId: string; displayName: string }
  | { kind: 'unassigned' }

export interface PhaseSnapshot {
  id: string
  number: number
  name: string
  drawing: PhaseDrawingAssociation
  sourcePhaseId?: string
  flowState: FlowStateSnapshot
  deviceStates: Record<string, DeviceState>
  createdAt: string
  updatedAt: string
}

export interface SequenceDefinition {
  id: string
  number: number
  name: string
  phases: PhaseSnapshot[]
  activePhaseId?: string
  createdAt: string
  updatedAt: string
}

export interface ProcessDefinition {
  id: string
  name: string
  sequences: SequenceDefinition[]
  activeSequenceId?: string
  createdAt: string
  updatedAt: string
}

export interface PhaseWorkspaceState {
  version: typeof PHASE_WORKSPACE_SCHEMA_VERSION
  processes: ProcessDefinition[]
  drawingAssets: Record<string, DrawingAssetRef>
  activeProcessId?: string
}

export type PhaseSource =
  | { kind: 'new'; drawing: DrawingAssetRef; displayName: string }
  | { kind: 'unassigned' }
  | { kind: 'previous'; displayName?: string }
  | { kind: 'history'; phaseId: string; displayName?: string }

export interface CreatePhaseInput {
  processId: string
  sequenceId: string
  number: number
  name: string
  source: PhaseSource
}