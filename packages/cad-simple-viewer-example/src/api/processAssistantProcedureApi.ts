import { ProcessAssistantClient } from './processAssistantClient'
import type { ProcedureDto } from './processAssistantTypes'

export class ProcessAssistantProcedureApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  list(projectId: number, signal?: AbortSignal): Promise<ProcedureDto[]> {
    const query = new URLSearchParams({ projectId: String(projectId) })
    return this.client.request('GET', `/api/v1/Procedure?${query}`, { signal })
  }

  create(procedure: ProcedureDto, signal?: AbortSignal): Promise<number> {
    return this.client.request('POST', '/api/v1/Procedure', {
      body: procedure,
      signal
    })
  }

  get(id: number, signal?: AbortSignal): Promise<ProcedureDto> {
    return this.client.request('GET', `/api/v1/Procedure/${id}`, { signal })
  }

  update(
    id: number,
    procedure: ProcedureDto,
    signal?: AbortSignal
  ): Promise<void> {
    return this.client.request('PUT', `/api/v1/Procedure/${id}`, {
      body: procedure,
      signal
    })
  }

  delete(id: number, signal?: AbortSignal): Promise<void> {
    return this.client.request('DELETE', `/api/v1/Procedure/${id}`, {
      signal
    })
  }
}