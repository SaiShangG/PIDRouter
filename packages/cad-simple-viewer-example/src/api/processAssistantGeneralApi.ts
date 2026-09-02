import { ProcessAssistantClient } from './processAssistantClient'

export interface RunGeneralSkillRequest {
  files: File[]
  projectId: number
}

export class ProcessAssistantGeneralApi {
  constructor(private readonly client: ProcessAssistantClient) { }

  run(request: RunGeneralSkillRequest, signal?: AbortSignal) {
    const body = new FormData()
    for (const file of request.files) body.append('files', file)
    body.append('projectId', String(request.projectId))
    return this.client.request<unknown>('POST', '/api/v1/Skill/general', {
      body,
      signal
    })
  }
}