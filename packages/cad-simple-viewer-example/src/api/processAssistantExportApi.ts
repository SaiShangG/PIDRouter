import { ProcessAssistantClient } from './processAssistantClient'

export type MatrixFormat = 'XLSX' | 'CSV'
export type MatrixDeviceType = 'VALVE' | 'PUMP_MOTOR' | 'SENSOR'

export interface CreateValveMatrixRequest {
  projectId: number
  selection: Record<string, Record<string, number[]>>
  name: string
}

export interface CreateValveMatrixResponse {
  success: boolean
  message: string | null
  result: string | null
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

export interface FlowPathTaskResultDto {
  fileSystemPath?: string | null
  url?: string | null
  name?: string | null
  status?: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled'
}

export class ProcessAssistantMatrixApi {
  constructor(private readonly client: ProcessAssistantClient) { }

  create(request: CreateValveMatrixRequest, signal?: AbortSignal) {
    return this.client.request<CreateValveMatrixResponse>(
      'POST',
      '/api/v1/Skill/valve-matrix',
      { body: request, signal }
    )
  }

  result(id: string, signal?: AbortSignal): Promise<FlowPathResultDto | undefined> {
    return this.client.request<FlowPathResultDto | undefined>(
      'GET',
      `/api/v1/Skill/valve-matrix/result?id=${encodeURIComponent(id)}`,
      { signal }
    )
  }

  download(url: string, signal?: AbortSignal) {
    return this.client.requestFile('GET', url, { signal })
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

  result(id: string, signal?: AbortSignal): Promise<FlowPathTaskResultDto | undefined> {
    return this.client.request<FlowPathTaskResultDto | undefined>(
      'GET',
      `/api/v1/Skill/flow-path/result?id=${encodeURIComponent(id)}`,
      { signal }
    )
  }

  async waitForResult(id: string, signal?: AbortSignal) {
    while (true) {
      signal?.throwIfAborted()
      const result = await this.result(id, signal)
      signal?.throwIfAborted()
      if (result) {
        switch (result.status) {
          case 'Pending':
          case 'Running':
            break
          case 'Completed':
            if (!result.url?.trim()) {
              throw new Error('Flow path PDF export completed without a download URL')
            }
            return { ...result, url: result.url }
          case 'Failed':
            throw new Error('Flow path PDF export task failed')
          case 'Cancelled':
            throw new DOMException('Flow path PDF export task was canceled', 'AbortError')
          case undefined:
            // Older backends indicate completion only through the file URL.
            if (result.url?.trim()) return { ...result, url: result.url }
            break
          default:
            throw new Error(`Flow path PDF export task returned an invalid status: ${String(result.status)}`)
        }
      }
      await new Promise<void>((resolve, reject) => {
        const handleAbort = () => {
          clearTimeout(timeout)
          reject(new DOMException('Export canceled', 'AbortError'))
        }
        const timeout = setTimeout(() => {
          signal?.removeEventListener('abort', handleAbort)
          resolve()
        }, 4000)
        signal?.addEventListener('abort', handleAbort, { once: true })
      })
    }
  }

  download(url: string, signal?: AbortSignal) {
    return this.client.requestFile('GET', url, { signal })
  }
}