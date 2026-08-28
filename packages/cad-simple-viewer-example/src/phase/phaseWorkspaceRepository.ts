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
  parsePhasePidOverlay,
  type PhasePidOverlay
} from './phasePidOverlay'
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

export type PersistedPhaseData = Omit<PhasePidOverlay, 'deviceStates' | 'flowPaths'> & {
  Comment: string | null
  drawing?: PhasePidOverlay['drawing']
  deviceStates: PhasePidOverlay['deviceStates'] | null
  flowPaths: PhasePidOverlay['flowPaths'] | null
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
      presentationProfile: this.readPresentationProfile(),
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
    const persistedPhase = this.toPersistedPhaseData(phase)
    return {
      ...persistedPhase,
      drawing: drawing ?? persistedPhase.drawing
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

  async createPhase(
    input: CreateBackendPhaseInput,
    signal?: AbortSignal
  ): Promise<number> {
    const data = input.data ?? this.createEmptyPhaseData()
    const phase: PhaseDto = {
      name: this.requireName(input.name, 'Phase'),
      index: this.requirePositiveInteger(input.number, 'Phase number'),
      orderIndex: input.orderIndex ?? input.number,
      operationId: this.requireBackendId(input.sequenceId, 'Sequence'),
      jsonData: JSON.stringify({
        ...data,
        Index: input.number,
        OrderId: input.orderIndex ?? input.number,
        Name: input.name
      })
    }
    const id = await this.options.phases.create(phase, signal)
    await this.options.phases.update(id, { ...phase, id }, signal)
    return id
  }

  updatePhase(
    sequenceId: string,
    phase: PhaseSnapshot,
    orderIndex: number,
    signal?: AbortSignal
  ): Promise<void> {
    return this.writePhase(sequenceId, phase, orderIndex, signal)
  }

  private writePhase(
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
        jsonData: JSON.stringify(this.toPersistedPhaseData(phase, orderIndex))
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
    const parsed = parsePhasePidOverlay(phase.jsonData ?? '')
    const timestamp = this.now()
    const overlay = parsed.status === 'valid' ? parsed.overlay : undefined
    return {
      id: String(phase.id),
      number: toNumber(phase.index, position + 1),
      name: phase.name?.trim() || `Phase ${phase.id}`,
      drawing: this.readDrawing(overlay?.drawing, drawingAssets),
      flowState: overlay ? this.readFlowState(overlay) : { flowPaths: [] },
      textNotes: overlay ? this.readTextNotes(overlay) : [],
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
    const configure = isRecord(this.options.projectConfigure)
      ? this.options.projectConfigure
      : undefined
    const profile = isRecord(configure?.presentationProfile)
      ? configure.presentationProfile
      : configure
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
    return {
      kind: 'assigned',
      assetId,
      displayName:
        typeof value.displayName === 'string' && value.displayName.trim()
          ? value.displayName.trim()
          : asset?.sourceName ?? `File ${value.fileId}`
    }
  }

  private readFlowState(overlay: PhasePidOverlay): FlowStateSnapshot {
    const flowPaths: FlowPathStatus[] = overlay.flowPaths.map(
      (flowPath, index) => {
        const handleKey = this.fromPersistedHandleKey(flowPath.handleKey)
        return {
          id: `persisted-flow-${index + 1}`,
          name: handleKey,
          handleKeys: [handleKey],
          utilityId: flowPath.highlightStyleRefId,
          styleSource: {
            kind: 'utility',
            utilityId: flowPath.highlightStyleRefId
          }
        }
      }
    )
    const deviceStates = overlay.deviceStates.length > 0
      ? Object.fromEntries(
        overlay.deviceStates.map(deviceState => [
          this.fromPersistedHandleKey(deviceState.handleKey),
          {
            key: this.fromPersistedHandleKey(deviceState.handleKey),
            label: this.fromPersistedHandleKey(deviceState.handleKey),
            mode: 'unknown',
            stateKey: deviceState.stateKey,
            deviceDefinitionId: deviceState.deviceType,
            highlightStyleRefId: deviceState.highlightStyleRefId
          } satisfies DeviceState
        ])
      )
      : undefined
    return {
      flowPaths,
      ...(deviceStates ? { deviceStates } : {})
    }
  }

  private readTextNotes(overlay: PhasePidOverlay): PhaseSnapshot['textNotes'] {
    return overlay.textNotes.map(note => ({
      ...note,
      linkedObjectHandleKey: note.linkedObjectHandleKey === undefined
        ? undefined
        : this.fromPersistedHandleKey(note.linkedObjectHandleKey),
      location: { ...note.location }
    }))
  }

  private createEmptyPhaseData(): PersistedPhaseData {
    return {
      Index: 1,
      OrderId: 1,
      Name: '',
      Comment: null,
      flowPaths: null,
      deviceStates: null,
      textNotes: []
    }
  }

  private toPersistedPhaseData(
    phase: PhaseSnapshot,
    orderIndex = phase.number
  ): PersistedPhaseData {
    const fileId =
      phase.drawing.kind === 'assigned'
        ? this.readFileId(phase.drawing.assetId)
        : undefined
    const deviceStateHandles = new Set(
      Object.values(phase.flowState.deviceStates ?? {}).map(deviceState =>
        this.toPersistedHandleKey(deviceState.key)
      )
    )
    const persistedFlowPathKeys = new Set<string>()
    const flowPaths = phase.flowState.flowPaths.flatMap(flowPath => {
      const highlightStyleRefId = flowPath.utilityId ??
        (flowPath.styleSource?.kind === 'utility'
          ? flowPath.styleSource.utilityId
          : undefined)
      if (!highlightStyleRefId) return []
      return flowPath.handleKeys.flatMap(handleKey => {
        const persistedHandleKey = this.toPersistedHandleKey(handleKey)
        if (!persistedHandleKey || deviceStateHandles.has(persistedHandleKey)) {
          return []
        }
        const key = `${persistedHandleKey}:${highlightStyleRefId}`
        if (persistedFlowPathKeys.has(key)) return []
        persistedFlowPathKeys.add(key)
        return [{ handleKey: persistedHandleKey, highlightStyleRefId }]
      })
    })
    const deviceStates = Object.values(phase.flowState.deviceStates ?? {}).flatMap(
      deviceState => {
        const handleKey = this.toPersistedHandleKey(deviceState.key)
        const stateKey = deviceState.stateKey
        const highlightStyleRefId = deviceState.highlightStyleRefId
        const deviceType = deviceState.deviceDefinitionId
        return handleKey && stateKey && highlightStyleRefId && deviceType
          ? [{ handleKey, stateKey, highlightStyleRefId, deviceType }]
          : []
      }
    )
    return {
      Index: phase.number,
      OrderId: orderIndex,
      Name: phase.name,
      Comment: null,
      drawing:
        fileId !== undefined && phase.drawing.kind === 'assigned'
          ? {
            fileId,
            displayName: phase.drawing.displayName
          }
          : undefined,
      flowPaths: flowPaths.length > 0 ? flowPaths : null,
      deviceStates: deviceStates.length > 0 ? deviceStates : null,
      textNotes: phase.textNotes?.flatMap(note => {
        const linkedObjectHandleKey = note.linkedObjectHandleKey === undefined
          ? undefined
          : this.toPersistedHandleKey(note.linkedObjectHandleKey)
        if (note.linkedObjectHandleKey !== undefined && !linkedObjectHandleKey) {
          return []
        }
        return [{
          ...note,
          linkedObjectHandleKey,
          location: { ...note.location }
        }]
      }) ?? []
    }
  }

  private toPersistedHandleKey(value: string): string | undefined {
    const handleKey = value.trim().toUpperCase()
    return /^[0-9A-F]+$/.test(handleKey)
      ? BigInt(`0x${handleKey}`).toString(10)
      : undefined
  }

  private fromPersistedHandleKey(value: string): string {
    return BigInt(value).toString(16).toUpperCase()
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
