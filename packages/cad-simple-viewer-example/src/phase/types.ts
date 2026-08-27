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

export interface DeviceStateStyleDefinition {
  id: string
  key: string
  displayName: string
  color: number
  lineWidthPx: number
  opacity: number
  enabled: boolean
  autoHighlightFlow: boolean
  flowBehavior: FlowBehavior
  order: number
}

export type FlowBehavior = 'conducting' | 'blocking' | 'neutral'

export interface DeviceStyleDefinition {
  id: string
  name: string
  states: DeviceStateStyleDefinition[]
  order: number
}

export interface UtilityStyleDefinition {
  id: string
  name: string
  style: HighlightStyle
  enabled: boolean
  order: number
}

export type FlowPathStyleSource =
  | { kind: 'utility'; utilityId?: string }
  | { kind: 'custom'; style: HighlightStyle }

export interface PresentationProfile {
  defaultFlowStyle: HighlightStyle
  unknownDeviceStyle: HighlightStyle | null
  dimmedBaseStyle: {
    color: number
    opacity: number
  }
  deviceStyles: DeviceHighlightStyles
  deviceStylesInitialized: boolean
  devices: DeviceStyleDefinition[]
  utilities: UtilityStyleDefinition[]
}

export interface FlowPathStatus {
  id: string
  name: string
  handleKeys: string[]
  priority?: number
  styleSource?: FlowPathStyleSource
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
  stateKey?: string
  deviceDefinitionId?: string
}

export interface FlowStateSnapshot {
  flowPaths: FlowPathStatus[]
  activeFlowPathId?: string
  deviceStates?: Record<string, DeviceState>
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
