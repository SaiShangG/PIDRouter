export interface UploadFileDto {
  id?: number
  originalFileName?: string | null
  storedFileName?: string | null
  url?: string | null
  comment?: string | null
  fileSize?: number
  uploadedAt?: string
}

export interface ProcedureDto {
  id?: number
  name?: string | null
  jsonData?: string | null
  projectId?: number
}

export interface OperationDto {
  id?: number
  name?: string | null
  index?: number
  orderIndex?: number
  jsonData?: string | null
  procedureId?: number
}

export interface PhaseDto {
  id?: number
  name?: string | null
  index?: number
  orderIndex?: number
  jsonData?: string | null
  operationId?: number
}

export interface UploadFileRequest {
  file: File
  comment?: string
}

export interface ProcessAssistantApiErrorOptions {
  method: string
  url: string
  status?: number
  statusText?: string
  responseBody?: unknown
  cause?: unknown
}

export class ProcessAssistantApiError extends Error {
  readonly method: string
  readonly url: string
  readonly status?: number
  readonly statusText?: string
  readonly responseBody?: unknown
  readonly cause?: unknown

  constructor(message: string, options: ProcessAssistantApiErrorOptions) {
    super(message)
    this.name = 'ProcessAssistantApiError'
    this.method = options.method
    this.url = options.url
    this.status = options.status
    this.statusText = options.statusText
    this.responseBody = options.responseBody
    this.cause = options.cause
  }
}