import type {
  OperationDto,
  PhaseDto,
  ProcedureDto,
  UploadFileDto
} from '../../api/processAssistantTypes'
import {
  operationFixtures,
  phaseFixtures,
  procedureFixtures,
  uploadFileFixtures
} from './fixtures'

interface MockFileRecord {
  metadata: UploadFileDto
  content: Blob
}

const copy = <T extends object>(value: T): T => ({ ...value })

const nextId = (items: Array<{ id?: number }>): number =>
  Math.max(0, ...items.map(item => item.id ?? 0)) + 1

export class ProcessAssistantMockStore {
  private procedures: ProcedureDto[] = []
  private operations: OperationDto[] = []
  private phases: PhaseDto[] = []
  private files: MockFileRecord[] = []
  private procedureId = 1
  private operationId = 1
  private phaseId = 1
  private fileId = 1

  constructor() {
    this.reset()
  }

  reset(): void {
    this.procedures = procedureFixtures.map(copy)
    this.operations = operationFixtures.map(copy)
    this.phases = phaseFixtures.map(copy)
    this.files = uploadFileFixtures.map(fixture => ({
      metadata: copy(fixture.metadata),
      content: new Blob([fixture.content], { type: fixture.contentType })
    }))
    this.procedureId = nextId(this.procedures)
    this.operationId = nextId(this.operations)
    this.phaseId = nextId(this.phases)
    this.fileId = nextId(this.files.map(file => file.metadata))
  }

  listProcedures(projectId: number): ProcedureDto[] {
    return this.procedures
      .filter(procedure => procedure.projectId === projectId)
      .map(copy)
  }

  getProcedure(id: number): ProcedureDto | undefined {
    const procedure = this.procedures.find(item => item.id === id)
    return procedure && copy(procedure)
  }

  createProcedure(input: ProcedureDto): number {
    const id = this.procedureId++
    this.procedures.push({ ...input, id })
    return id
  }

  updateProcedure(id: number, input: ProcedureDto): boolean {
    const index = this.procedures.findIndex(item => item.id === id)
    if (index < 0) return false
    this.procedures[index] = { ...input, id }
    return true
  }

  deleteProcedure(id: number): boolean {
    if (!this.getProcedure(id)) return false
    const operationIds = this.operations
      .filter(operation => operation.procedureId === id)
      .map(operation => operation.id)
      .filter((value): value is number => value !== undefined)
    this.procedures = this.procedures.filter(item => item.id !== id)
    this.operations = this.operations.filter(item => item.procedureId !== id)
    this.phases = this.phases.filter(
      item => !operationIds.includes(item.operationId ?? -1)
    )
    return true
  }

  listOperations(procedureId: number): OperationDto[] {
    return this.operations
      .filter(operation => operation.procedureId === procedureId)
      .map(copy)
  }

  getOperation(id: number): OperationDto | undefined {
    const operation = this.operations.find(item => item.id === id)
    return operation && copy(operation)
  }

  createOperation(input: OperationDto): number {
    const id = this.operationId++
    this.operations.push({ ...input, id })
    return id
  }

  updateOperation(id: number, input: OperationDto): boolean {
    const index = this.operations.findIndex(item => item.id === id)
    if (index < 0) return false
    this.operations[index] = { ...input, id }
    return true
  }

  deleteOperation(id: number): boolean {
    if (!this.getOperation(id)) return false
    this.operations = this.operations.filter(item => item.id !== id)
    this.phases = this.phases.filter(item => item.operationId !== id)
    return true
  }

  listPhases(operationId: number): PhaseDto[] {
    return this.phases
      .filter(phase => phase.operationId === operationId)
      .map(copy)
  }

  getPhase(id: number): PhaseDto | undefined {
    const phase = this.phases.find(item => item.id === id)
    return phase && copy(phase)
  }

  createPhase(input: PhaseDto): number {
    const id = this.phaseId++
    this.phases.push({ ...input, id })
    return id
  }

  updatePhase(id: number, input: PhaseDto): boolean {
    const index = this.phases.findIndex(item => item.id === id)
    if (index < 0) return false
    this.phases[index] = { ...input, id }
    return true
  }

  deletePhase(id: number): boolean {
    if (!this.getPhase(id)) return false
    this.phases = this.phases.filter(item => item.id !== id)
    return true
  }

  listFiles(): UploadFileDto[] {
    return this.files.map(file => copy(file.metadata))
  }

  getFile(id: number): UploadFileDto | undefined {
    const file = this.files.find(item => item.metadata.id === id)
    return file && copy(file.metadata)
  }

  getFileContent(storedFileName: string): Blob | undefined {
    return this.files.find(
      item => item.metadata.storedFileName === storedFileName
    )?.content
  }

  createFile(file: File, comment?: string): UploadFileDto {
    const id = this.fileId++
    const storedFileName = `${id}-${file.name}`
    const metadata: UploadFileDto = {
      id,
      originalFileName: file.name,
      storedFileName,
      url: `/api/v1/File/download/${encodeURIComponent(storedFileName)}`,
      comment: comment ?? null,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    }
    this.files.push({ metadata, content: file })
    return copy(metadata)
  }

  updateFileComment(id: number, comment: string): boolean {
    const file = this.files.find(item => item.metadata.id === id)
    if (!file) return false
    file.metadata.comment = comment
    return true
  }

  deleteFile(storedFileName: string): boolean {
    const originalLength = this.files.length
    this.files = this.files.filter(
      item => item.metadata.storedFileName !== storedFileName
    )
    return this.files.length !== originalLength
  }
}

export const processAssistantMockStore = new ProcessAssistantMockStore()
