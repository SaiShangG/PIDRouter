import { ProcessAssistantClient } from './processAssistantClient'

export type ExportTaskStatus =
  | 'QUEUED'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'CANCELED'

export interface ExportTaskDto {
  id?: string | number
  reportId?: string | number
  matrixId?: string | number
  status: ExportTaskStatus
  progress?: number
  processedPhases?: number
  totalPhases?: number
  fileName?: string
  error?: string
  message?: string
}

export interface CreateReportRequest {
  processId: number
  mode: 'COMBINED' | 'PER_SEQUENCE'
  sequenceIds: number[]
  includeCover: boolean
  includeValveMatrix: boolean
  pageSize: 'A3'
  orientation: 'LANDSCAPE'
}

export type MatrixFormat = 'XLSX' | 'CSV'
export type MatrixDeviceType = 'VALVE' | 'PUMP_MOTOR' | 'SENSOR'

export interface CreateValveMatrixRequest {
  projectId: number
  selection: Record<string, Record<string, number[]>>
}

export interface CreateFlowPathPdfRequest {
  projectId: number
  selection: Record<string, Record<string, number[]>>
  name: string
}

export class ProcessAssistantReportApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  create(request: CreateReportRequest, signal?: AbortSignal) {
    return this.client.request<ExportTaskDto>('POST', '/api/v1/reports', {
      body: request,
      signal
    })
  }

  get(reportId: string | number, signal?: AbortSignal) {
    return this.client.request<ExportTaskDto>(
      'GET',
      `/api/v1/reports/${encodeURIComponent(reportId)}`,
      { signal }
    )
  }

  download(reportId: string | number, signal?: AbortSignal) {
    return this.client.requestFile(
      'GET',
      `/api/v1/reports/${encodeURIComponent(reportId)}/download`,
      { signal }
    )
  }
}

export class ProcessAssistantMatrixApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  create(request: CreateValveMatrixRequest, signal?: AbortSignal) {
    return this.client.requestFile(
      'POST',
      '/api/v1/Skill/valve-matrix',
      { body: request, signal }
    )
  }
}

export class ProcessAssistantFlowPathApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  create(request: CreateFlowPathPdfRequest, signal?: AbortSignal) {
    return this.client.requestFile(
      'POST',
      '/api/v1/Skill/flow-path',
      { body: request, signal }
    )
  }
}