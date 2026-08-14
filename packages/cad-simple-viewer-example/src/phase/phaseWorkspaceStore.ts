import {
  type CreatePhaseInput,
  type DrawingAssetRef,
  PHASE_WORKSPACE_SCHEMA_VERSION,
  type PhaseDrawingAssociation,
  type PhaseSnapshot,
  type PhaseWorkspaceState,
  type ProcessDefinition,
  type SequenceDefinition
} from './types'

export const PHASE_WORKSPACE_STORAGE_KEY =
  'cad-simple-viewer-example-phase-workspace'

const DEFAULT_SEQUENCE_NAME = '默认序列'

interface LegacyPhaseSnapshot extends Omit<PhaseSnapshot, 'drawing'> {
  drawingAssetId: string
  drawingDisplayName: string
}

interface LegacyProcessDefinition {
  id: string
  name: string
  phases: LegacyPhaseSnapshot[]
  activePhaseId?: string
  createdAt: string
  updatedAt: string
}

interface LegacyPhaseWorkspaceState {
  version: 1
  processes: LegacyProcessDefinition[]
  drawingAssets: Record<string, DrawingAssetRef>
  activeProcessId?: string
}

interface V2SequenceDefinition extends Omit<SequenceDefinition, 'phases'> {
  phases: LegacyPhaseSnapshot[]
}

interface V2ProcessDefinition extends Omit<ProcessDefinition, 'sequences'> {
  sequences: V2SequenceDefinition[]
}

interface V2PhaseWorkspaceState {
  version: 2
  processes: V2ProcessDefinition[]
  drawingAssets: Record<string, DrawingAssetRef>
  activeProcessId?: string
}

const createEmptyState = (): PhaseWorkspaceState => ({
  version: PHASE_WORKSPACE_SCHEMA_VERSION,
  processes: [],
  drawingAssets: {}
})

const clonePhase = (phase: PhaseSnapshot): PhaseSnapshot => ({
  id: phase.id,
  number: phase.number,
  name: phase.name,
  drawing: { ...phase.drawing },
  sourcePhaseId: phase.sourcePhaseId,
  flowState: {
    openBoundaryHandleKeys: [...phase.flowState.openBoundaryHandleKeys]
  },
  deviceStates: Object.fromEntries(
    Object.entries(phase.deviceStates).map(([key, device]) => [key, { ...device }])
  ),
  createdAt: phase.createdAt,
  updatedAt: phase.updatedAt
})

const cloneSequence = (sequence: SequenceDefinition): SequenceDefinition => ({
  ...sequence,
  phases: sequence.phases.map(clonePhase)
})

const cloneState = (state: PhaseWorkspaceState): PhaseWorkspaceState => ({
  ...state,
  drawingAssets: Object.fromEntries(
    Object.entries(state.drawingAssets).map(([key, asset]) => [key, { ...asset }])
  ),
  processes: state.processes.map(process => ({
    ...process,
    sequences: process.sequences.map(cloneSequence)
  }))
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const isWorkspaceState = (value: unknown): value is PhaseWorkspaceState => {
  if (!isRecord(value)) return false
  return (
    value.version === PHASE_WORKSPACE_SCHEMA_VERSION &&
    Array.isArray(value.processes) &&
    value.processes.every(
      process => isRecord(process) && Array.isArray(process.sequences)
    ) &&
    isRecord(value.drawingAssets)
  )
}

const isLegacyWorkspaceState = (
  value: unknown
): value is LegacyPhaseWorkspaceState => {
  if (!isRecord(value)) return false
  return (
    value.version === 1 &&
    Array.isArray(value.processes) &&
    value.processes.every(
      process => isRecord(process) && Array.isArray(process.phases)
    ) &&
    isRecord(value.drawingAssets)
  )
}

const isV2WorkspaceState = (value: unknown): value is V2PhaseWorkspaceState => {
  if (!isRecord(value)) return false
  return (
    value.version === 2 &&
    Array.isArray(value.processes) &&
    value.processes.every(
      process => isRecord(process) && Array.isArray(process.sequences)
    ) &&
    isRecord(value.drawingAssets)
  )
}

const migrateDrawing = (
  phase: LegacyPhaseSnapshot,
  drawingAssets: Record<string, DrawingAssetRef>
): PhaseDrawingAssociation =>
  drawingAssets[phase.drawingAssetId]
    ? {
        kind: 'assigned',
        assetId: phase.drawingAssetId,
        displayName: phase.drawingDisplayName
      }
    : { kind: 'unassigned' }

const migratePhase = (
  phase: LegacyPhaseSnapshot,
  drawingAssets: Record<string, DrawingAssetRef>
): PhaseSnapshot => ({
  id: phase.id,
  number: phase.number,
  name: phase.name,
  drawing: migrateDrawing(phase, drawingAssets),
  sourcePhaseId: phase.sourcePhaseId,
  flowState: {
    openBoundaryHandleKeys: [...phase.flowState.openBoundaryHandleKeys]
  },
  deviceStates: Object.fromEntries(
    Object.entries(phase.deviceStates).map(([key, device]) => [key, { ...device }])
  ),
  createdAt: phase.createdAt,
  updatedAt: phase.updatedAt
})

const migrateLegacyState = (
  legacy: LegacyPhaseWorkspaceState
): PhaseWorkspaceState => ({
  version: PHASE_WORKSPACE_SCHEMA_VERSION,
  activeProcessId: legacy.activeProcessId,
  drawingAssets: Object.fromEntries(
    Object.entries(legacy.drawingAssets).map(([key, asset]) => [key, { ...asset }])
  ),
  processes: legacy.processes.map(process => {
    const sequenceId = `sequence-default-${process.id}`
    const activePhaseId = process.phases.some(
      phase => phase.id === process.activePhaseId
    )
      ? process.activePhaseId
      : undefined
    return {
      id: process.id,
      name: process.name,
      sequences: [
        {
          id: sequenceId,
          number: 1,
          name: DEFAULT_SEQUENCE_NAME,
          phases: process.phases.map(phase =>
            migratePhase(phase, legacy.drawingAssets)
          ),
          activePhaseId,
          createdAt: process.createdAt,
          updatedAt: process.updatedAt
        }
      ],
      activeSequenceId: sequenceId,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt
    }
  })
})

const migrateV2State = (legacy: V2PhaseWorkspaceState): PhaseWorkspaceState => ({
  version: PHASE_WORKSPACE_SCHEMA_VERSION,
  activeProcessId: legacy.activeProcessId,
  drawingAssets: Object.fromEntries(
    Object.entries(legacy.drawingAssets).map(([key, asset]) => [key, { ...asset }])
  ),
  processes: legacy.processes.map(process => ({
    ...process,
    sequences: process.sequences.map(sequence => ({
      ...sequence,
      phases: sequence.phases.map(phase =>
        migratePhase(phase, legacy.drawingAssets)
      )
    }))
  }))
})

export class PhaseWorkspaceStore {
  private state: PhaseWorkspaceState

  constructor(
    initialState: PhaseWorkspaceState = createEmptyState(),
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString()
  ) {
    this.state = cloneState(initialState)
  }

  static load(storage: Pick<Storage, 'getItem'> = localStorage) {
    try {
      const raw = storage.getItem(PHASE_WORKSPACE_STORAGE_KEY)
      if (!raw) return new PhaseWorkspaceStore()
      const parsed: unknown = JSON.parse(raw)
      if (isWorkspaceState(parsed)) return new PhaseWorkspaceStore(parsed)
      if (isV2WorkspaceState(parsed)) {
        return new PhaseWorkspaceStore(migrateV2State(parsed))
      }
      if (isLegacyWorkspaceState(parsed)) {
        return new PhaseWorkspaceStore(migrateLegacyState(parsed))
      }
      return new PhaseWorkspaceStore()
    } catch {
      return new PhaseWorkspaceStore()
    }
  }

  snapshot(): PhaseWorkspaceState {
    return cloneState(this.state)
  }

  persist(storage: Pick<Storage, 'setItem'> = localStorage): boolean {
    try {
      storage.setItem(PHASE_WORKSPACE_STORAGE_KEY, JSON.stringify(this.state))
      return true
    } catch {
      return false
    }
  }

  createProcess(name: string): ProcessDefinition {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Process name is required')
    const timestamp = this.now()
    const sequence: SequenceDefinition = {
      id: this.createId(),
      number: 1,
      name: DEFAULT_SEQUENCE_NAME,
      phases: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const process: ProcessDefinition = {
      id: this.createId(),
      name: normalizedName,
      sequences: [sequence],
      activeSequenceId: sequence.id,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    this.state.processes.push(process)
    this.state.activeProcessId = process.id
    return { ...process, sequences: [cloneSequence(sequence)] }
  }

  deleteProcess(processId: string) {
    const index = this.state.processes.findIndex(process => process.id === processId)
    if (index < 0) throw new Error('Process was not found')
    const [deleted] = this.state.processes.splice(index, 1)
    if (this.state.activeProcessId === processId) {
      this.state.activeProcessId =
        this.state.processes[Math.min(index, this.state.processes.length - 1)]?.id
    }
    this.removeUnusedDrawings(
      deleted.sequences.flatMap(sequence =>
        sequence.phases.flatMap(phase =>
          phase.drawing.kind === 'assigned' ? [phase.drawing.assetId] : []
        )
      )
    )
    return {
      ...deleted,
      sequences: deleted.sequences.map(cloneSequence)
    }
  }

  createSequence(
    processId: string,
    number: number,
    name: string
  ): SequenceDefinition {
    const process = this.requireProcess(processId)
    const normalizedName = name.trim()
    if (!Number.isInteger(number) || number < 1) {
      throw new Error('Sequence number must be a positive integer')
    }
    if (!normalizedName) throw new Error('Sequence name is required')
    if (process.sequences.some(sequence => sequence.number === number)) {
      throw new Error(`Sequence ${number} already exists`)
    }
    const timestamp = this.now()
    const sequence: SequenceDefinition = {
      id: this.createId(),
      number,
      name: normalizedName,
      phases: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }
    process.sequences.push(sequence)
    process.activeSequenceId = sequence.id
    process.updatedAt = timestamp
    return cloneSequence(sequence)
  }

  copySequence(
    processId: string,
    sequenceId: string,
    number: number,
    name: string
  ): SequenceDefinition {
    const source = this.requireSequence(processId, sequenceId)
    const copy = this.createSequence(processId, number, name)
    const target = this.requireSequence(processId, copy.id)
    const phaseIds = new Map(source.phases.map(phase => [phase.id, this.createId()]))
    const timestamp = this.now()
    target.phases = source.phases.map(phase => ({
      ...clonePhase(phase),
      id: phaseIds.get(phase.id)!,
      sourcePhaseId: phase.sourcePhaseId
        ? phaseIds.get(phase.sourcePhaseId)
        : undefined,
      createdAt: timestamp,
      updatedAt: timestamp
    }))
    target.activePhaseId = source.activePhaseId
      ? phaseIds.get(source.activePhaseId)
      : undefined
    target.updatedAt = timestamp
    return cloneSequence(target)
  }

  renameSequence(processId: string, sequenceId: string, name: string) {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Sequence name is required')
    const sequence = this.requireSequence(processId, sequenceId)
    sequence.name = normalizedName
    sequence.updatedAt = this.now()
  }

  deleteSequence(processId: string, sequenceId: string) {
    const process = this.requireProcess(processId)
    const index = process.sequences.findIndex(item => item.id === sequenceId)
    if (index < 0) throw new Error('Sequence was not found')
    const [deleted] = process.sequences.splice(index, 1)
    if (process.activeSequenceId === sequenceId) {
      process.activeSequenceId =
        process.sequences[Math.min(index, process.sequences.length - 1)]?.id
    }
    this.removeUnusedDrawings(
      deleted.phases.flatMap(phase =>
        phase.drawing.kind === 'assigned' ? [phase.drawing.assetId] : []
      )
    )
    process.updatedAt = this.now()
    return cloneSequence(deleted)
  }

  reorderSequence(processId: string, sequenceId: string, targetIndex: number) {
    const process = this.requireProcess(processId)
    const currentIndex = process.sequences.findIndex(item => item.id === sequenceId)
    if (currentIndex < 0) throw new Error('Sequence was not found')
    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= process.sequences.length
    ) {
      throw new Error('Sequence target index is out of range')
    }
    if (currentIndex === targetIndex) return
    const [sequence] = process.sequences.splice(currentIndex, 1)
    process.sequences.splice(targetIndex, 0, sequence)
    process.updatedAt = this.now()
  }

  createPhase(input: CreatePhaseInput): PhaseSnapshot {
    const process = this.requireProcess(input.processId)
    const sequence = this.requireSequence(input.processId, input.sequenceId)
    const normalizedName = input.name.trim()
    if (!Number.isInteger(input.number) || input.number < 1) {
      throw new Error('Phase number must be a positive integer')
    }
    if (!normalizedName) throw new Error('Phase name is required')
    if (sequence.phases.some(phase => phase.number === input.number)) {
      throw new Error(`Phase ${input.number} already exists`)
    }

    let sourcePhase: PhaseSnapshot | undefined
    let phaseDrawing: PhaseDrawingAssociation
    if (input.source.kind === 'new') {
      const drawing = { ...input.source.drawing }
      const displayName = input.source.displayName.trim()
      if (!displayName) throw new Error('Drawing display name is required')
      this.state.drawingAssets[drawing.id] = drawing
      phaseDrawing = { kind: 'assigned', assetId: drawing.id, displayName }
    } else if (input.source.kind === 'unassigned') {
      phaseDrawing = { kind: 'unassigned' }
    } else {
      if (input.source.kind === 'previous') {
        sourcePhase = sequence.phases[sequence.phases.length - 1]
      } else {
        const sourcePhaseId = input.source.phaseId
        sourcePhase = sequence.phases.find(
          phase => phase.id === sourcePhaseId
        )
      }
      if (!sourcePhase) throw new Error('Source phase was not found')
      if (sourcePhase.drawing.kind === 'assigned') {
        this.requireDrawing(sourcePhase.drawing.assetId)
        phaseDrawing = {
          ...sourcePhase.drawing,
          displayName:
            input.source.displayName?.trim() || sourcePhase.drawing.displayName
        }
      } else {
        phaseDrawing = { kind: 'unassigned' }
      }
    }

    const timestamp = this.now()
    const phase: PhaseSnapshot = {
      id: this.createId(),
      number: input.number,
      name: normalizedName,
      drawing: phaseDrawing,
      sourcePhaseId: sourcePhase?.id,
      flowState: sourcePhase
        ? { openBoundaryHandleKeys: [...sourcePhase.flowState.openBoundaryHandleKeys] }
        : { openBoundaryHandleKeys: [] },
      deviceStates: sourcePhase
        ? Object.fromEntries(
            Object.entries(sourcePhase.deviceStates).map(([key, device]) => [
              key,
              { ...device }
            ])
          )
        : {},
      createdAt: timestamp,
      updatedAt: timestamp
    }
    sequence.phases.push(phase)
    sequence.activePhaseId = phase.id
    sequence.updatedAt = timestamp
    process.activeSequenceId = sequence.id
    process.updatedAt = timestamp
    return clonePhase(phase)
  }

  updatePhaseState(
    processId: string,
    sequenceId: string,
    phaseId: string,
    state: Pick<PhaseSnapshot, 'flowState' | 'deviceStates'>
  ) {
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    phase.flowState = {
      openBoundaryHandleKeys: [...state.flowState.openBoundaryHandleKeys]
    }
    phase.deviceStates = Object.fromEntries(
      Object.entries(state.deviceStates).map(([key, device]) => [key, { ...device }])
    )
    phase.updatedAt = this.now()
  }

  renameDrawing(
    processId: string,
    sequenceId: string,
    phaseId: string,
    displayName: string
  ) {
    const normalizedName = displayName.trim()
    if (!normalizedName) throw new Error('Drawing display name is required')
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    if (phase.drawing.kind !== 'assigned') {
      throw new Error('Phase has no drawing association')
    }
    phase.drawing.displayName = normalizedName
    phase.updatedAt = this.now()
  }

  associateDrawing(
    processId: string,
    sequenceId: string,
    phaseId: string,
    drawing: DrawingAssetRef,
    displayName: string
  ): DrawingAssetRef | undefined {
    const normalizedName = displayName.trim()
    if (!normalizedName) throw new Error('Drawing display name is required')
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    const previousAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    this.state.drawingAssets[drawing.id] = { ...drawing }
    phase.drawing = {
      kind: 'assigned',
      assetId: drawing.id,
      displayName: normalizedName
    }
    phase.updatedAt = this.now()
    return previousAssetId
      ? this.removeUnusedDrawing(previousAssetId)
      : undefined
  }

  associateMarkedPhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    sourceProcessId: string,
    sourceSequenceId: string,
    sourcePhaseId: string
  ): DrawingAssetRef | undefined {
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    const sourcePhase = this.requirePhase(
      sourceProcessId,
      sourceSequenceId,
      sourcePhaseId
    )
    if (sourcePhase.drawing.kind !== 'assigned') {
      throw new Error('Source phase has no drawing association')
    }
    this.requireDrawing(sourcePhase.drawing.assetId)
    const previousAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    phase.drawing = { ...sourcePhase.drawing }
    phase.sourcePhaseId = sourcePhase.id
    phase.flowState = {
      openBoundaryHandleKeys: [...sourcePhase.flowState.openBoundaryHandleKeys]
    }
    phase.deviceStates = Object.fromEntries(
      Object.entries(sourcePhase.deviceStates).map(([key, device]) => [
        key,
        { ...device }
      ])
    )
    phase.updatedAt = this.now()
    return previousAssetId
      ? this.removeUnusedDrawing(previousAssetId)
      : undefined
  }

  clearDrawingAssociation(
    processId: string,
    sequenceId: string,
    phaseId: string
  ): DrawingAssetRef | undefined {
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    const previousAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    phase.drawing = { kind: 'unassigned' }
    phase.updatedAt = this.now()
    return previousAssetId
      ? this.removeUnusedDrawing(previousAssetId)
      : undefined
  }

  renamePhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    name: string
  ) {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Phase name is required')
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    phase.name = normalizedName
    phase.updatedAt = this.now()
  }

  deletePhase(processId: string, sequenceId: string, phaseId: string) {
    const sequence = this.requireSequence(processId, sequenceId)
    const phaseIndex = sequence.phases.findIndex(phase => phase.id === phaseId)
    if (phaseIndex < 0) throw new Error('Phase was not found')
    const [deletedPhase] = sequence.phases.splice(phaseIndex, 1)
    if (sequence.activePhaseId === phaseId) {
      sequence.activePhaseId =
        sequence.phases[Math.min(phaseIndex, sequence.phases.length - 1)]?.id
    }
    if (deletedPhase.drawing.kind === 'assigned') {
      this.removeUnusedDrawings([deletedPhase.drawing.assetId])
    }
    sequence.updatedAt = this.now()
    return clonePhase(deletedPhase)
  }

  reorderPhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    targetIndex: number
  ) {
    const sequence = this.requireSequence(processId, sequenceId)
    const currentIndex = sequence.phases.findIndex(phase => phase.id === phaseId)
    if (currentIndex < 0) throw new Error('Phase was not found')
    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= sequence.phases.length
    ) {
      throw new Error('Phase target index is out of range')
    }
    if (currentIndex === targetIndex) return
    const [phase] = sequence.phases.splice(currentIndex, 1)
    sequence.phases.splice(targetIndex, 0, phase)
    sequence.updatedAt = this.now()
  }

  activate(processId: string, sequenceId?: string, phaseId?: string) {
    const process = this.requireProcess(processId)
    const sequence = sequenceId
      ? this.requireSequence(processId, sequenceId)
      : undefined
    if (phaseId) {
      if (!sequence) throw new Error('Sequence is required to activate a phase')
      this.requirePhase(processId, sequence.id, phaseId)
    }
    this.state.activeProcessId = processId
    process.activeSequenceId = sequence?.id
    if (sequence) sequence.activePhaseId = phaseId
  }

  private removeUnusedDrawings(assetIds: string[]) {
    for (const assetId of new Set(assetIds)) {
      this.removeUnusedDrawing(assetId)
    }
  }

  private removeUnusedDrawing(assetId: string): DrawingAssetRef | undefined {
    const drawingStillUsed = this.state.processes.some(process =>
      process.sequences.some(sequence =>
        sequence.phases.some(
          phase =>
            phase.drawing.kind === 'assigned' &&
            phase.drawing.assetId === assetId
        )
      )
    )
    if (drawingStillUsed) return undefined
    const drawing = this.state.drawingAssets[assetId]
    delete this.state.drawingAssets[assetId]
    return drawing ? { ...drawing } : undefined
  }

  private requireProcess(processId: string) {
    const process = this.state.processes.find(item => item.id === processId)
    if (!process) throw new Error('Process was not found')
    return process
  }

  private requireSequence(processId: string, sequenceId: string) {
    const sequence = this.requireProcess(processId).sequences.find(
      item => item.id === sequenceId
    )
    if (!sequence) throw new Error('Sequence was not found')
    return sequence
  }

  private requirePhase(
    processId: string,
    sequenceId: string,
    phaseId: string
  ) {
    const phase = this.requireSequence(processId, sequenceId).phases.find(
      item => item.id === phaseId
    )
    if (!phase) throw new Error('Phase was not found')
    return phase
  }

  private requireDrawing(assetId: string) {
    const drawing = this.state.drawingAssets[assetId]
    if (!drawing) throw new Error('Drawing asset was not found')
    return drawing
  }
}
