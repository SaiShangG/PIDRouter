import type { ProcessAssistantFileApi } from '../api/processAssistantFileApi'
import type { ProcessAssistantOperationApi } from '../api/processAssistantOperationApi'
import type { ProcessAssistantPhaseApi } from '../api/processAssistantPhaseApi'
import type { ProcessAssistantProcedureApi } from '../api/processAssistantProcedureApi'
import type {
  OperationDto,
  PhaseDto,
  ProcedureDto,
  UploadFileDto
} from '../api/processAssistantTypes'
import {
  createDefaultPresentationProfile,
  PhaseWorkspaceStore
} from './phaseWorkspaceStore'

const toHexColor = (color: number) =>
  `#${Math.round(color).toString(16).padStart(6, '0').slice(-6).toUpperCase()}`

export interface PersistedPresentationProfile {
  deviceStyles: Array<{
    id: string
    deviceType: string
    deviceState: string
    displayName: string
    color: string
    lineWidthPx: number
    opacity: number
    autoHighlightFlow: boolean
    flowBehavior: 'conducting' | 'blocking' | 'neutral'
  }>
  utilities: Array<{
    id: string
    name: string
    color: string
    lineWidthPx: number
    opacity: number
  }>
}

export const toPersistedPresentationProfile = (
  profile: PresentationProfile
): PersistedPresentationProfile => ({
  deviceStyles: profile.devices.flatMap(device =>
    device.states.map(state => ({
      id: state.id,
      deviceType: device.name,
      deviceState: state.key,
      displayName: state.displayName,
      color: toHexColor(state.color),
      lineWidthPx: state.lineWidthPx,
      opacity: state.opacity,
      autoHighlightFlow: state.autoHighlightFlow,
      flowBehavior: state.flowBehavior
    }))
  ),
  utilities: profile.utilities.map(utility => ({
    id: utility.id,
    name: utility.name,
    color: toHexColor(utility.style.color),
    lineWidthPx: utility.style.lineWidthPx,
    opacity: utility.style.opacity
  }))
})
import {
  type DeviceState,
  type DrawingAssetRef,
  type FlowPathStatus,
  type FlowStateSnapshot,
  PHASE_WORKSPACE_SCHEMA_VERSION,
  type PhaseDrawingAssociation,
  type PhaseSnapshot,
  type PhaseWorkspaceState,
  type PresentationProfile,
  type ProcessDefinition,
  type SequenceDefinition
} from './types'

export interface PhaseWorkspaceRepositoryOptions {
  baseUrl: string
  projectId: number
  projectConfigure?: Record<string, unknown>
  files: Pick<ProcessAssistantFileApi, 'list' | 'upload'>
  procedures: Pick<
    ProcessAssistantProcedureApi,
    'list' | 'create' | 'update' | 'delete'
  >
  operations: Pick<
    ProcessAssistantOperationApi,
    'list' | 'create' | 'update' | 'delete'
  >
  phases: Pick<
    ProcessAssistantPhaseApi,
    'list' | 'create' | 'update' | 'delete'
  >
  now?: () => string
}

export interface CreateBackendSequenceInput {
  processId: string
  number: number
  name: string
  orderIndex?: number
}

export interface PersistedPhaseData {
  schemaVersion: 1
  drawing?: {
    fileId: number
    displayName: string
  }
  sourcePhaseId?: number
  flowState: PhaseSnapshot['flowState']
}

export interface CreateBackendPhaseInput {
  sequenceId: string
  number: number
  name: string
  orderIndex?: number
  data?: PersistedPhaseData
}

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasId = <T extends { id?: number }>(value: T): value is T & { id: number } =>
  Number.isInteger(value.id) && (value.id ?? 0) > 0

const parseJsonRecord = (value?: string | null): JsonRecord => {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const toNumber = (value: number | undefined, fallback: number): number =>
  Number.isInteger(value) && (value ?? 0) > 0 ? value! : fallback

const byOrder = <T extends { orderIndex?: number; index?: number; id?: number }>(
  left: T,
  right: T
): number =>
  (left.orderIndex ?? left.index ?? left.id ?? 0) -
  (right.orderIndex ?? right.index ?? right.id ?? 0)

export class PhaseWorkspaceRepository {
  private readonly now: () => string

  constructor(private readonly options: PhaseWorkspaceRepositoryOptions) {
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async load(signal?: AbortSignal): Promise<PhaseWorkspaceState> {
    const [fileDtos, procedureDtos] = await Promise.all([
      this.options.files.list(signal),
      this.options.procedures.list(this.options.projectId, signal)
    ])
    const drawingAssets = this.mapDrawingAssets(fileDtos)
    const procedures = procedureDtos.filter(hasId)
    const processes = await Promise.all(
      procedures.map(procedure =>
        this.mapProcess(procedure, drawingAssets, signal)
      )
    )
    const state: PhaseWorkspaceState = {
      version: PHASE_WORKSPACE_SCHEMA_VERSION,
      processes,
      drawingAssets,
      activeProcessId: processes[0]?.id
    }
    return new PhaseWorkspaceStore(state).snapshot()
  }

  async uploadDrawing(
    file: File,
    comment?: string,
    signal?: AbortSignal
  ): Promise<{ fileId: number; displayName: string }> {
    const uploaded = await this.options.files.upload({ file, comment }, signal)
    if (!hasId(uploaded)) {
      throw new Error('Backend file upload did not return a valid ID')
    }
    return {
      fileId: uploaded.id,
      displayName: uploaded.originalFileName?.trim() || file.name
    }
  }

  createPhaseData(
    phase?: PhaseSnapshot,
    drawing?: { fileId: number; displayName: string }
  ): PersistedPhaseData {
    if (!phase) {
      return {
        ...this.createEmptyPhaseData(),
        drawing
      }
    }
    return {
      ...this.toPersistedPhaseData(phase),
      sourcePhaseId: this.requireBackendId(phase.id, 'Source phase'),
      drawing: drawing ?? this.toPersistedPhaseData(phase).drawing
    }
  }

  createProcess(name: string, signal?: AbortSignal): Promise<number> {
    return this.options.procedures.create(
      {
        name: this.requireName(name, 'Process'),
        projectId: this.options.projectId,
        jsonData: JSON.stringify({ schemaVersion: 1 })
      },
      signal
    )
  }

  updateProcess(
    process: ProcessDefinition,
    signal?: AbortSignal
  ): Promise<void> {
    const id = this.requireBackendId(process.id, 'Process')
    return this.options.procedures.update(
      id,
      {
        id,
        name: this.requireName(process.name, 'Process'),
        projectId: this.options.projectId,
        jsonData: JSON.stringify({ schemaVersion: 1 })
      },
      signal
    )
  }

  deleteProcess(processId: string, signal?: AbortSignal): Promise<void> {
    return this.options.procedures.delete(
      this.requireBackendId(processId, 'Process'),
      signal
    )
  }

  createSequence(
    input: CreateBackendSequenceInput,
    signal?: AbortSignal
  ): Promise<number> {
    return this.options.operations.create(
      {
        name: this.requireName(input.name, 'Sequence'),
        index: this.requirePositiveInteger(input.number, 'Sequence number'),
        orderIndex: input.orderIndex ?? input.number,
        procedureId: this.requireBackendId(input.processId, 'Process'),
        jsonData: JSON.stringify({ schemaVersion: 1 })
      },
      signal
    )
  }

  updateSequence(
    processId: string,
    sequence: SequenceDefinition,
    orderIndex: number,
    signal?: AbortSignal
  ): Promise<void> {
    const id = this.requireBackendId(sequence.id, 'Sequence')
    return this.options.operations.update(
      id,
      {
        id,
        name: this.requireName(sequence.name, 'Sequence'),
        index: this.requirePositiveInteger(sequence.number, 'Sequence number'),
        orderIndex,
        procedureId: this.requireBackendId(processId, 'Process'),
        jsonData: JSON.stringify({ schemaVersion: 1 })
      },
      signal
    )
  }

  deleteSequence(sequenceId: string, signal?: AbortSignal): Promise<void> {
    return this.options.operations.delete(
      this.requireBackendId(sequenceId, 'Sequence'),
      signal
    )
  }

  createPhase(
    input: CreateBackendPhaseInput,
    signal?: AbortSignal
  ): Promise<number> {
    return this.options.phases.create(
      {
        name: this.requireName(input.name, 'Phase'),
        index: this.requirePositiveInteger(input.number, 'Phase number'),
        orderIndex: input.orderIndex ?? input.number,
        operationId: this.requireBackendId(input.sequenceId, 'Sequence'),
        jsonData: JSON.stringify(input.data ?? this.createEmptyPhaseData())
      },
      signal
    )
  }

  updatePhase(
    sequenceId: string,
    phase: PhaseSnapshot,
    orderIndex: number,
    signal?: AbortSignal
  ): Promise<void> {
    const id = this.requireBackendId(phase.id, 'Phase')
    return this.options.phases.update(
      id,
      {
        id,
        name: this.requireName(phase.name, 'Phase'),
        index: this.requirePositiveInteger(phase.number, 'Phase number'),
        orderIndex,
        operationId: this.requireBackendId(sequenceId, 'Sequence'),
        jsonData: JSON.stringify(this.toPersistedPhaseData(phase))
      },
      signal
    )
  }

  deletePhase(phaseId: string, signal?: AbortSignal): Promise<void> {
    return this.options.phases.delete(
      this.requireBackendId(phaseId, 'Phase'),
      signal
    )
  }

  private async mapProcess(
    procedure: ProcedureDto & { id: number },
    drawingAssets: Record<string, DrawingAssetRef>,
    signal?: AbortSignal
  ): Promise<ProcessDefinition> {
    const operationDtos = await this.options.operations.list(procedure.id, signal)
    const operations = operationDtos.filter(hasId).sort(byOrder)
    const sequences = await Promise.all(
      operations.map((operation, index) =>
        this.mapSequence(operation, index, drawingAssets, signal)
      )
    )
    const timestamp = this.now()
    return {
      id: String(procedure.id),
      name: procedure.name?.trim() || `Process ${procedure.id}`,
      presentationProfile: this.readPresentationProfile(),
      sequences,
      activeSequenceId: sequences[0]?.id,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }

  private async mapSequence(
    operation: OperationDto & { id: number },
    position: number,
    drawingAssets: Record<string, DrawingAssetRef>,
    signal?: AbortSignal
  ): Promise<SequenceDefinition> {
    const phaseDtos = await this.options.phases.list(operation.id, signal)
    const phases = phaseDtos
      .filter(hasId)
      .sort(byOrder)
      .map((phase, index) => this.mapPhase(phase, index, drawingAssets))
    const timestamp = this.now()
    return {
      id: String(operation.id),
      number: toNumber(operation.index, position + 1),
      name: operation.name?.trim() || `Sequence ${operation.id}`,
      phases,
      activePhaseId: phases[0]?.id,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }

  private mapPhase(
    phase: PhaseDto & { id: number },
    position: number,
    drawingAssets: Record<string, DrawingAssetRef>
  ): PhaseSnapshot {
    const data = parseJsonRecord(phase.jsonData)
    const timestamp = this.now()
    return {
      id: String(phase.id),
      number: toNumber(phase.index, position + 1),
      name: phase.name?.trim() || `Phase ${phase.id}`,
      drawing: this.readDrawing(data.drawing, drawingAssets),
      sourcePhaseId: this.readSourcePhaseId(data.sourcePhaseId),
      flowState: this.readFlowState(data),
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }

  private mapDrawingAssets(
    files: UploadFileDto[]
  ): Record<string, DrawingAssetRef> {
    return Object.fromEntries(
      files.filter(hasId).map(file => {
        const id = `file:${file.id}`
        const storedFileName = file.storedFileName?.trim()
        const path = storedFileName
          ? `/api/v1/File/download/${encodeURIComponent(storedFileName)}`
          : file.url?.trim()
        return [
          id,
          {
            id,
            kind: 'url',
            sourceName:
              file.originalFileName?.trim() || storedFileName || `File ${file.id}`,
            url: path ? this.resolveUrl(path) : undefined
          }
        ]
      })
    )
  }

  private resolveUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path
    const baseUrl =
      this.options.baseUrl.trim() ||
      globalThis.location?.href ||
      'http://localhost/'
    return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).href
  }

  private readPresentationProfile(): PresentationProfile {
    const profile = isRecord(this.options.projectConfigure)
      ? this.options.projectConfigure
      : undefined
    return profile
      ? (profile as unknown as PresentationProfile)
      : createDefaultPresentationProfile()
  }

  private readDrawing(
    value: unknown,
    drawingAssets: Record<string, DrawingAssetRef>
  ): PhaseDrawingAssociation {
    if (!isRecord(value) || !Number.isInteger(value.fileId)) {
      return { kind: 'unassigned' }
    }
    const assetId = `file:${value.fileId}`
    const asset = drawingAssets[assetId]
    if (!asset) return { kind: 'unassigned' }
    return {
      kind: 'assigned',
      assetId,
      displayName:
        typeof value.displayName === 'string' && value.displayName.trim()
          ? value.displayName.trim()
          : asset.sourceName
    }
  }

  private readSourcePhaseId(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isInteger(value)) return String(value)
    if (typeof value === 'string' && value.trim()) return value.trim()
    return undefined
  }

  private readFlowPaths(value: unknown): FlowPathStatus[] {
    if (!isRecord(value) || !Array.isArray(value.flowPaths)) return []
    return value.flowPaths.filter(isRecord) as unknown as FlowPathStatus[]
  }

  private readFlowState(data: JsonRecord): FlowStateSnapshot {
    const flowState = isRecord(data.flowState) ? data.flowState : {}
    const deviceStates = this.readDeviceStates(
      flowState.deviceStates ?? data.deviceStates
    )
    return {
      flowPaths: this.readFlowPaths(flowState),
      ...(deviceStates ? { deviceStates } : {})
    }
  }

  private readDeviceStates(
    value: unknown
  ): Record<string, DeviceState> | undefined {
    if (!isRecord(value)) return undefined
    const entries = Object.entries(value).flatMap(([recordKey, candidate]) => {
      if (!isRecord(candidate) || typeof candidate.mode !== 'string') return []
      const key =
        typeof candidate.key === 'string' && candidate.key.trim()
          ? candidate.key.trim()
          : recordKey
      return [[
        key,
        {
          key,
          label:
            typeof candidate.label === 'string' && candidate.label.trim()
              ? candidate.label.trim()
              : key,
          mode: candidate.mode
        } as DeviceState
      ] as const]
    })
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }

  private createEmptyPhaseData(): PersistedPhaseData {
    return {
      schemaVersion: 1,
      flowState: { flowPaths: [] }
    }
  }

  private toPersistedPhaseData(phase: PhaseSnapshot): PersistedPhaseData {
    const fileId =
      phase.drawing.kind === 'assigned'
        ? this.readFileId(phase.drawing.assetId)
        : undefined
    const sourcePhaseId = phase.sourcePhaseId
      ? this.requireBackendId(phase.sourcePhaseId, 'Source phase')
      : undefined
    return {
      schemaVersion: 1,
      drawing:
        fileId !== undefined && phase.drawing.kind === 'assigned'
          ? {
            fileId,
            displayName: phase.drawing.displayName
          }
          : undefined,
      sourcePhaseId,
      flowState: phase.flowState
    }
  }

  private readFileId(assetId: string): number | undefined {
    const match = /^file:(\d+)$/.exec(assetId)
    if (!match) return undefined
    const id = Number(match[1])
    return Number.isInteger(id) && id > 0 ? id : undefined
  }

  private requireBackendId(value: string, label: string): number {
    const id = Number(value)
    if (!Number.isInteger(id) || id < 1) {
      throw new Error(`${label} ID must be a positive backend integer`)
    }
    return id
  }

  private requirePositiveInteger(value: number, label: string): number {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${label} must be a positive integer`)
    }
    return value
  }

  private requireName(value: string, label: string): string {
    const name = value.trim()
    if (!name) throw new Error(`${label} name is required`)
    return name
  }
}
