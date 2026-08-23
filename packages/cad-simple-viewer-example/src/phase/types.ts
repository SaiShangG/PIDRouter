export const PHASE_WORKSPACE_SCHEMA_VERSION = 4

export interface HighlightStyle {
  color: number
  lineWidthPx: number
  opacity: number
  visible: boolean
}

export interface DeviceHighlightStyles {
  valve: {
    open: HighlightStyle | null
    closed: HighlightStyle | null
    pulse: HighlightStyle | null
  }
  motor: {
    start: HighlightStyle | null
    stop: HighlightStyle | null
  }
  processEquipment: {
    active: HighlightStyle | null
  }
}

export interface UtilityStyleDefinition {
  id: string
  name: string
  style: HighlightStyle
  enabled: boolean
  order: number
}

export interface PresentationProfile {
  defaultFlowStyle: HighlightStyle
  unknownDeviceStyle: HighlightStyle | null
  dimmedBaseStyle: {
    color: number
    opacity: number
  }
  deviceStyles: DeviceHighlightStyles
  deviceStylesInitialized: boolean
  utilities: UtilityStyleDefinition[]
}

export interface FlowPathStatus {
  id: string
  name: string
  handleKeys: string[]
  utilityId?: string
  styleOverride?: Partial<HighlightStyle>
}

export type DrawingAssetKind = 'local' | 'url' | 'blank'

export interface DrawingAssetRef {
  id: string
  kind: DrawingAssetKind
  sourceName: string
  url?: string
}

export type DeviceMode =
  | 'open'
  | 'closed'
  | 'pulse'
  | 'start'
  | 'stop'
  | 'active'
  | 'unknown'

export interface DeviceState {
  key: string
  label: string
  mode: DeviceMode
}

export interface FlowStateSnapshot {
  flowPaths: FlowPathStatus[]
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
  presentationProfile: PresentationProfile
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
