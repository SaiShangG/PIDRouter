import { ProcessAssistantClient } from './processAssistantClient'

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
  isPdfMerge: boolean
}

export interface CreateFlowPathPdfResponse {
  success: boolean
  message: string | null
  result: string | null
}

export interface FlowPathResultDto {
  fileSystemPath: string
  url: string
  name: string
}

export class ProcessAssistantMatrixApi {
  constructor(private readonly client: ProcessAssistantClient) { }

  create(request: CreateValveMatrixRequest, signal?: AbortSignal) {
    return this.client.requestFile(
      'POST',
      '/api/v1/Skill/valve-matrix',
      { body: request, signal }
    )
  }
}

export class ProcessAssistantFlowPathApi {
  constructor(private readonly client: ProcessAssistantClient) { }

  create(request: CreateFlowPathPdfRequest, signal?: AbortSignal) {
    return this.client.request<CreateFlowPathPdfResponse>(
      'POST',
      '/api/v1/Skill/flow-path',
      { body: request, signal }
    )
  }

  result(id: string, signal?: AbortSignal): Promise<FlowPathResultDto | undefined> {
    return this.client.request<FlowPathResultDto | undefined>(
      'GET',
      `/api/v1/Skill/flow-path/result?id=${encodeURIComponent(id)}`,
      { signal }
    )
  }

  download(url: string, signal?: AbortSignal) {
    return this.client.requestFile('GET', url, { signal })
  }
}