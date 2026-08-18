import { ProcessAssistantClient } from './processAssistantClient'
import type { PhaseDto } from './processAssistantTypes'

export class ProcessAssistantPhaseApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  list(operationId: number, signal?: AbortSignal): Promise<PhaseDto[]> {
    const query = new URLSearchParams({ operationId: String(operationId) })
    return this.client.request('GET', `/api/v1/Phase?${query}`, { signal })
  }

  create(phase: PhaseDto, signal?: AbortSignal): Promise<number> {
    return this.client.request('POST', '/api/v1/Phase', {
      body: phase,
      signal
    })
  }

  get(id: number, signal?: AbortSignal): Promise<PhaseDto> {
    return this.client.request('GET', `/api/v1/Phase/${id}`, { signal })
  }

  update(id: number, phase: PhaseDto, signal?: AbortSignal): Promise<void> {
    return this.client.request('PUT', `/api/v1/Phase/${id}`, {
      body: phase,
      signal
    })
  }

  delete(id: number, signal?: AbortSignal): Promise<void> {
    return this.client.request('DELETE', `/api/v1/Phase/${id}`, { signal })
  }
}