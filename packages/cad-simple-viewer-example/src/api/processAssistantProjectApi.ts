import { ProcessAssistantClient } from './processAssistantClient'
import type {
  AddProjectDto,
  ProjectDto
} from './processAssistantTypes'

export class ProcessAssistantProjectApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  list(signal?: AbortSignal): Promise<ProjectDto[]> {
    return this.client.request('GET', '/api/v1/Project', { signal })
  }

  create(project: ProjectDto, signal?: AbortSignal): Promise<number> {
    return this.client.request('POST', '/api/v1/Project', {
      body: project,
      signal
    })
  }

  get(id: number, signal?: AbortSignal): Promise<ProjectDto> {
    return this.client.request('GET', `/api/v1/Project/${id}`, { signal })
  }

  update(
    id: number,
    project: ProjectDto,
    signal?: AbortSignal
  ): Promise<void> {
    return this.client.request('PUT', `/api/v1/Project/${id}`, {
      body: project,
      signal
    })
  }

  delete(id: number, signal?: AbortSignal): Promise<void> {
    return this.client.request('DELETE', `/api/v1/Project/${id}`, { signal })
  }

  addV2(project: AddProjectDto, signal?: AbortSignal): Promise<number> {
    return this.client.request('POST', '/api/v1/Project/add-v2', {
      body: project,
      signal
    })
  }
}