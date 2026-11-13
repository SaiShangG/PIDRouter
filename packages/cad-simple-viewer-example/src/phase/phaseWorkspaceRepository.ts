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
import { composeFinalFlowPaths } from './composeFinalFlowPaths'
import { normalizeManualHighlightCorrections } from './manualHighlightCorrections'
import { mergeHighlightedValveStates } from './phaseDeviceStateRuntime'
import {
  parsePhasePidOverlay,
  type PhasePidOverlay
} from './phasePidOverlay'
import {
  createDefaultPresentationProfile,
  normalizePresentationProfile,
  PhaseWorkspaceStore
} from './phaseWorkspaceStore'

const toHexColor = (color: number) =>
  `#${Math.round(color).toString(16).padStart(6, '0').slice(-6).toUpperCase()}`

export interface PersistedPresentationProfile {
  defaultStyleSeed?: PresentationProfile['defaultStyleSeed']
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

interface PersistedTextAnnotation {
  id: string
  content: string
  position: { X: number; Y: number; Z: number }
  width: number
  height: number
  lineSpacingFactor: number
  attachmentPoint: number
  style?: { id: string }
}

export const toPersistedPresentationProfile = (
  profile: PresentationProfile
): PersistedPresentationProfile => ({
  ...(profile.defaultStyleSeed ? { defaultStyleSeed: { ...profile.defaultStyleSeed } } : {}),
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
  type MergedDeviceState,
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
  getPresentationProfile?: () => PresentationProfile
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
    'list' | 'get' | 'create' | 'update' | 'delete'
  >
  now?: () => string
}

export interface CreateBackendSequenceInput {
  processId: string
  number: number
  name: string
  orderIndex?: number
}

export type PersistedPhaseData = Omit<PhasePidOverlay, 'deviceStates' | 'flowPaths' | 'textNotes'> & {
  Comment: string | null
  drawing?: PhasePidOverlay['drawing']
  deviceStates: PhasePidOverlay['deviceStates'] | null
  mergedDeviceStates: MergedDeviceState[]
  flowPaths: PhasePidOverlay['flowPaths'] | null
  textNotes: PersistedTextAnnotation[]
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
  private readonly sequenceWrites = new Map<string, Promise<void>>()

  constructor(private readonly options: PhaseWorkspaceRepositoryOptions) {
    this.now = options.now ?? (() => new Date().toISOString())
  }

  private runSequenceWrite<T>(sequenceId: string, write: () => Promise<T>): Promise<T> {
    const previous = this.sequenceWrites.get(sequenceId) ?? Promise.resolve()
    const task = previous.then(write)
    const pending = task.then(() => undefined, () => undefined)
    this.sequenceWrites.set(sequenceId, pending)
    return task.finally(() => {
      if (this.sequenceWrites.get(sequenceId) === pending) this.sequenceWrites.delete(sequenceId)
    })
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

  async loadPhase(
    phaseId: string,
    drawingAssets: Record<string, DrawingAssetRef>,
    position: number,
    signal?: AbortSignal
  ): Promise<PhaseSnapshot> {
    const dto = await this.options.phases.get(
      this.requireBackendId(phaseId, 'Phase'),
      signal
    )
    if (!hasId(dto)) throw new Error('Phase API 返回了无效数据')
    return this.mapPhase(dto, position, drawingAssets)
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
    const changedDrawing = drawing && (
      phase.drawing.kind !== 'assigned' ||
      this.readFileId(phase.drawing.assetId) !== drawing.fileId
    )
    return {
      ...this.toPersistedPhaseData(changedDrawing
        ? { ...phase, manualCorrections: undefined }
        : phase),
      ...(drawing ? { drawing } : {})
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

  createPhase(input: CreateBackendPhaseInput, signal?: AbortSignal): Promise<number> {
    return this.runSequenceWrite(input.sequenceId, () => this.createOrderedPhase(input, signal))
  }

  private async createOrderedPhase(
    input: CreateBackendPhaseInput,
    signal?: AbortSignal
  ): Promise<number> {
    const data = input.data ?? this.createEmptyPhaseData()
    const records = await this.options.phases.list(
      this.requireBackendId(input.sequenceId, 'Sequence'), signal
    )
    this.validatePhaseOrders(records)
    const orderIndex = input.orderIndex ?? Math.max(0, ...records.map(phase => phase.orderIndex!)) + 1
    this.requirePhaseOrder(orderIndex)
    if (records.some(phase => phase.orderIndex === orderIndex)) {
      throw new Error(`Phase OrderIndex ${orderIndex} already exists`)
    }
    const phase: PhaseDto = {
      name: this.requireName(input.name, 'Phase'),
      index: this.requirePositiveInteger(input.number, 'Phase number'),
      orderIndex,
      operationId: this.requireBackendId(input.sequenceId, 'Sequence'),
      jsonData: JSON.stringify({
        ...data,
        Index: input.number,
        OrderId: orderIndex,
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
    return this.runSequenceWrite(sequenceId, () => this.writePhase(sequenceId, phase, orderIndex, signal))
  }

  updatePhaseContent(
    sequenceId: string,
    phase: PhaseSnapshot,
    signal?: AbortSignal
  ): Promise<void> {
    return this.runSequenceWrite(sequenceId, () => this.writePhaseContent(sequenceId, phase, signal))
  }

  private async writePhaseContent(
    sequenceId: string,
    phase: PhaseSnapshot,
    signal?: AbortSignal
  ): Promise<void> {
    const current = await this.options.phases.get(
      this.requireBackendId(phase.id, 'Phase'),
      signal
    )
    const orderIndex = this.requirePhaseOrder(current.orderIndex)
    await this.writePhase(sequenceId, phase, orderIndex, signal)
  }

  private requirePhaseOrder(orderIndex: number | undefined): number {
    if (!Number.isSafeInteger(orderIndex) || orderIndex! < 0) {
      throw new Error('Phase OrderIndex is missing or invalid; repair the Sequence order first')
    }
    return orderIndex!
  }

  reorderPhases(sequenceId: string, phaseIds: string[], signal?: AbortSignal, expectedPhaseIds?: string[]): Promise<void> {
    return this.runSequenceWrite(sequenceId, () => this.writePhaseOrder(sequenceId, phaseIds, signal, expectedPhaseIds))
  }

  private async writePhaseOrder(
    sequenceId: string,
    phaseIds: string[],
    signal?: AbortSignal,
    expectedPhaseIds?: string[]
  ): Promise<void> {
    const operationId = this.requireBackendId(sequenceId, 'Sequence')
    const records = await this.options.phases.list(operationId, signal)
    this.validatePhaseOrders(records)
    const ids = phaseIds.map(id => this.requireBackendId(id, 'Phase'))
    if (new Set(ids).size !== ids.length || records.length !== ids.length ||
      records.some(record => record.id === undefined || !ids.includes(record.id))) {
      throw new Error('Phase order must contain every Phase in the Sequence exactly once')
    }
    const sorted = [...records].sort((left, right) => left.orderIndex! - right.orderIndex!)
    if (expectedPhaseIds && (expectedPhaseIds.length !== sorted.length ||
      sorted.some((record, index) => String(record.id) !== expectedPhaseIds[index]))) {
      throw new Error('Sequence order changed; refresh before retrying')
    }
    const originals = new Map(records.map(record => [record.id!, record]))
    const ordered = ids.map(id => originals.get(id)!)
    const withOrder = (record: PhaseDto, orderIndex: number): PhaseDto => {
      this.requirePhaseOrder(orderIndex)
      const data: unknown = JSON.parse(record.jsonData || '{}')
      if (!isRecord(data)) throw new Error('Phase JSON must be an object')
      return { ...record, orderIndex, jsonData: JSON.stringify({ ...data, OrderId: orderIndex }) }
    }
    const final = ordered.map((record, index) => withOrder(record, sorted[index].orderIndex!))
      .filter(record => record.orderIndex !== originals.get(record.id!)!.orderIndex)
    if (!final.length) return
    const applyOrders = async (current: PhaseDto[], updates: PhaseDto[], writeSignal?: AbortSignal) => {
      const occupied = new Map(current.map(record => [record.orderIndex!, record.id!]))
      const positions = new Map(current.map(record => [record.id!, record.orderIndex!]))
      const pending = new Map(updates.map(record => [record.id!, record]))
      const temporaryOrder = this.requirePhaseOrder(Math.max(...current.map(record => record.orderIndex!),
        ...updates.map(record => record.orderIndex!)) + 1)
      const write = async (record: PhaseDto) => {
        await this.options.phases.update(record.id!, record, writeSignal)
        occupied.delete(positions.get(record.id!)!)
        occupied.set(record.orderIndex!, record.id!)
        positions.set(record.id!, record.orderIndex!)
      }
      while (pending.size) {
        const available = [...pending.values()].find(record => !occupied.has(record.orderIndex!))
        if (available) {
          await write(available)
          pending.delete(available.id!)
        } else {
          const record = pending.values().next().value!
          await write(withOrder(record, temporaryOrder))
        }
      }
    }
    try {
      await applyOrders(records, final, signal)
    } catch (error) {
      try {
        const current = await this.options.phases.list(operationId)
        if (current.length !== records.length || current.some(record => !originals.has(record.id!))) {
          throw new Error('Sequence membership changed during reorder')
        }
        this.validatePhaseOrders(current)
        const restore = current.filter(record => record.orderIndex !== originals.get(record.id!)!.orderIndex)
          .map(record => withOrder(record, originals.get(record.id!)!.orderIndex!))
        if (restore.length) await applyOrders(current, restore)
      } catch (recoveryError) {
        throw new Error(`Phase reorder failed and rollback failed: ${String(error)}; ${String(recoveryError)}`)
      }
      throw error
    }
  }

  private validatePhaseOrders(phases: PhaseDto[]): void {
    const orders = new Set<number>()
    for (const phase of phases) {
      const orderIndex = this.requirePhaseOrder(phase.orderIndex)
      if (orders.has(orderIndex)) throw new Error(`Phase OrderIndex ${orderIndex} already exists`)
      orders.add(orderIndex)
    }
  }

  private async writePhase(
    sequenceId: string,
    phase: PhaseSnapshot,
    orderIndex: number,
    signal?: AbortSignal
  ): Promise<void> {
    const id = this.requireBackendId(phase.id, 'Phase')
    this.requirePhaseOrder(orderIndex)
    const records = await this.options.phases.list(this.requireBackendId(sequenceId, 'Sequence'), signal)
    this.validatePhaseOrders(records)
    if (records.some(record => record.id !== id && record.orderIndex === orderIndex)) {
      throw new Error(`Phase OrderIndex ${orderIndex} already exists`)
    }
    const jsonData = JSON.stringify(this.toPersistedPhaseData(phase, orderIndex))
    console.log('[Phase] Payload prepared for backend / 已准备好提交后台的阶段数据：', {
      id,
      name: phase.name,
      index: phase.number,
      orderIndex,
      operationId: this.requireBackendId(sequenceId, 'Sequence'),
      jsonData: JSON.parse(jsonData),
      textNotes: JSON.parse(jsonData).textNotes
    })
    return this.options.phases.update(
      id,
      {
        id,
        name: this.requireName(phase.name, 'Phase'),
        index: this.requirePositiveInteger(phase.number, 'Phase number'),
        orderIndex,
        operationId: this.requireBackendId(sequenceId, 'Sequence'),
        jsonData
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
    const phases = await this.loadSequencePhases(String(operation.id), drawingAssets, signal)
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

  async loadSequencePhases(
    sequenceId: string,
    drawingAssets: Record<string, DrawingAssetRef>,
    signal?: AbortSignal
  ): Promise<PhaseSnapshot[]> {
    await this.sequenceWrites.get(sequenceId)
    const phaseDtos = await this.options.phases.list(this.requireBackendId(sequenceId, 'Sequence'), signal)
    return phaseDtos.filter(hasId)
      .sort((left, right) =>
        (left.orderIndex ?? Number.MAX_SAFE_INTEGER) - (right.orderIndex ?? Number.MAX_SAFE_INTEGER) ||
        left.id - right.id)
      .map((phase, index) => this.mapPhase(phase, index, drawingAssets))
  }

  private mapPhase(
    phase: PhaseDto & { id: number },
    position: number,
    drawingAssets: Record<string, DrawingAssetRef>
  ): PhaseSnapshot {
    const parsed = parsePhasePidOverlay(phase.jsonData ?? '')
    if (parsed.status !== 'valid' || parsed.warnings.some(warning =>
      warning.code === 'invalid-manual-corrections' || warning.code === 'invalid-auto-flow-path' ||
      warning.code === 'invalid-flow-path')) {
      throw new Error(`Phase ${phase.id} contains invalid highlight snapshot data`)
    }
    const timestamp = this.now()
    const overlay = parsed.status === 'valid' ? parsed.overlay : undefined
    return {
      id: String(phase.id),
      number: toNumber(phase.index, position + 1),
      name: phase.name?.trim() || `Phase ${phase.id}`,
      tankId: overlay?.tankId,
      drawing: this.readDrawing(overlay?.drawing, drawingAssets),
      flowState: overlay ? this.readFlowState(overlay) : { flowPaths: [] },
      ...(overlay?.manualCorrections
        ? {
          manualCorrections: normalizeManualHighlightCorrections({
            additions: overlay.manualCorrections.additions.map(addition => ({
              ...addition,
              handleKey: this.fromPersistedHandleKey(addition.handleKey)
            })),
            exclusions: overlay.manualCorrections.exclusions.map(handleKey =>
              this.fromPersistedHandleKey(handleKey)
            )
          })
        }
        : {}),
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
      globalThis.location?.href
    return baseUrl ? new URL(path, `${baseUrl.replace(/\/$/, '')}/`).href : path
  }

  private readPresentationProfile(): PresentationProfile {
    const configure = isRecord(this.options.projectConfigure)
      ? this.options.projectConfigure
      : undefined
    const profile = isRecord(configure?.presentationProfile)
      ? configure.presentationProfile
      : configure
    return profile ? normalizePresentationProfile(profile) : createDefaultPresentationProfile()
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
    const flowPaths: FlowPathStatus[] = overlay.autoFlowPaths.map(
      flowPath => {
        return {
          ...flowPath,
          handleKeys: flowPath.handleKeys.map(handle => this.fromPersistedHandleKey(handle)),
          ...(flowPath.ownerHandleKey !== undefined
            ? { ownerHandleKey: this.fromPersistedHandleKey(flowPath.ownerHandleKey) } : {})
        }
      }
    )
    const deviceStates = overlay.deviceStates.length > 0
      ? Object.fromEntries(
        overlay.deviceStates.map(deviceState => [
          this.fromPersistedHandleKey(deviceState.handleKey),
          {
            key: this.fromPersistedHandleKey(deviceState.handleKey),
            stateKey: deviceState.stateKey,
            deviceType: deviceState.deviceType ??
              this.resolvePersistedDeviceType(
                deviceState.highlightStyleRefId,
                'UNKNOWN'
              ),
            highlightStyleRefId: deviceState.highlightStyleRefId
          } satisfies DeviceState
        ])
      )
      : undefined
    return {
      flowPaths,
      activeFlowPathId: overlay.activeFlowPathId,
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
      flowPaths: [],
      autoFlowPaths: [],
      deviceStates: null,
      mergedDeviceStates: [],
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
    const profile = this.options.getPresentationProfile?.() ?? this.readPresentationProfile()
    const autoFlowPaths = phase.flowState.flowPaths.map(path => {
      if (typeof path.highlightStyleRefId !== 'string' || !path.highlightStyleRefId.trim()) {
        throw new Error('Flow path highlightStyleRefId is required')
      }
      return {
        id: path.id,
        name: path.name,
        handleKeys: [...new Set(path.handleKeys.map(handle => this.requirePersistedHandleKey(handle)))],
        highlightStyleRefId: path.highlightStyleRefId.trim(),
        ...(path.priority !== undefined ? { priority: path.priority } : {}),
        ...(path.ownerHandleKey !== undefined
          ? { ownerHandleKey: this.requirePersistedHandleKey(path.ownerHandleKey) } : {})
      }
    })
    const flowPaths = composeFinalFlowPaths(phase, profile).map(path => ({
      ...path, handleKey: this.requirePersistedHandleKey(path.handleKey)
    }))
    const deviceStates = Object.values(phase.flowState.deviceStates ?? {}).flatMap(
      deviceState => {
        const handleKey = this.toPersistedHandleKey(deviceState.key)
        const stateKey = deviceState.stateKey
        const highlightStyleRefId = deviceState.highlightStyleRefId
        const deviceType = this.resolvePersistedDeviceType(
          highlightStyleRefId,
          deviceState.deviceType
        )
        return handleKey && stateKey && highlightStyleRefId && deviceType
          ? [{ handleKey, stateKey, highlightStyleRefId, deviceType }]
          : []
      }
    )
    const manualCorrections = phase.manualCorrections === undefined
      ? undefined
      : normalizeManualHighlightCorrections(
        phase.manualCorrections,
        value => typeof value === 'string'
          ? this.toPersistedHandleKey(value)
          : undefined
      )
    return {
      Index: phase.number,
      OrderId: orderIndex,
      Name: phase.name,
      Comment: null,
      ...(phase.tankId ? { tankId: phase.tankId } : {}),
      drawing:
        fileId !== undefined && phase.drawing.kind === 'assigned'
          ? {
            fileId,
            displayName: phase.drawing.displayName
          }
          : undefined,
      flowPaths,
      autoFlowPaths,
      ...(phase.flowState.activeFlowPathId ? { activeFlowPathId: phase.flowState.activeFlowPathId } : {}),
      deviceStates: deviceStates.length > 0 ? deviceStates : null,
      mergedDeviceStates: mergeHighlightedValveStates(deviceStates, manualCorrections, profile),
      ...(manualCorrections ? { manualCorrections } : {}),
      textNotes: phase.textNotes?.flatMap(note => {
        const linkedObjectHandleKey = note.linkedObjectHandleKey === undefined
          ? undefined
          : this.toPersistedHandleKey(note.linkedObjectHandleKey)
        if (note.linkedObjectHandleKey !== undefined && !linkedObjectHandleKey) {
          return []
        }
        return [{
          id: note.id,
          content: note.contents,
          position: {
            X: note.location.x,
            Y: note.location.y,
            Z: note.location.z
          },
          width: note.width,
          height: note.height ?? 0,
          lineSpacingFactor: note.lineSpacingFactor ?? 1,
          attachmentPoint: note.attachmentPoint,
          ...(note.textStyleRefId
            ? { style: { id: note.textStyleRefId } }
            : {})
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

  private requirePersistedHandleKey(value: string): string {
    const handleKey = this.toPersistedHandleKey(value)
    if (handleKey === undefined) throw new Error(`Invalid CAD highlight handle: ${value}`)
    return handleKey
  }

  private resolvePersistedDeviceType(
    highlightStyleRefId: string,
    fallbackDeviceType: string
  ): string {
    const configure = this.options.projectConfigure
    const rawStyles = configure && Array.isArray(configure.deviceStyles)
      ? configure.deviceStyles
      : []
    const style = rawStyles.find(candidate =>
      isRecord(candidate) && String(candidate.id) === highlightStyleRefId
    )
    if (isRecord(style) && typeof style.deviceType === 'string' && style.deviceType.trim()) {
      return style.deviceType.trim()
    }
    return fallbackDeviceType
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
