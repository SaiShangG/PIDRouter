import { ProcessAssistantClient } from './processAssistantClient'
import type { OperationDto } from './processAssistantTypes'

export class ProcessAssistantOperationApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  list(procedureId: number, signal?: AbortSignal): Promise<OperationDto[]> {
    const query = new URLSearchParams({ procedureId: String(procedureId) })
    return this.client.request('GET', `/api/v1/Operation?${query}`, { signal })
  }

  create(operation: OperationDto, signal?: AbortSignal): Promise<number> {
    return this.client.request('POST', '/api/v1/Operation', {
      body: operation,
      signal
    })
  }

  get(id: number, signal?: AbortSignal): Promise<OperationDto> {
    return this.client.request('GET', `/api/v1/Operation/${id}`, { signal })
  }

  update(
    id: number,
    operation: OperationDto,
    signal?: AbortSignal
  ): Promise<void> {
    return this.client.request('PUT', `/api/v1/Operation/${id}`, {
      body: operation,
      signal
    })
  }

  delete(id: number, signal?: AbortSignal): Promise<void> {
    return this.client.request('DELETE', `/api/v1/Operation/${id}`, {
      signal
    })
  }
}