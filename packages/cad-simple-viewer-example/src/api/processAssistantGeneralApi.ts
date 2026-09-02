import { ProcessAssistantClient } from './processAssistantClient'

export interface RunGeneralSkillRequest {
  projectId: number
}

export class ProcessAssistantGeneralApi {
  constructor(private readonly client: ProcessAssistantClient) { }

  run(request: RunGeneralSkillRequest, signal?: AbortSignal) {
    return this.client.request<unknown>('POST', '/api/v1/Skill/general', {
      body: request,
      signal
    })
  }
}