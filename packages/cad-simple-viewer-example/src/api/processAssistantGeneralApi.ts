import { ProcessAssistantClient } from './processAssistantClient'

export interface RunGeneralSkillRequest {
  files: File[]
  projectId: number
  selection?: object
  name: string
  skillName: string
  jsonArgs?: string
}

export class ProcessAssistantGeneralApi {
  constructor(private readonly client: ProcessAssistantClient) { }

  run(request: RunGeneralSkillRequest, signal?: AbortSignal) {
    const body = new FormData()
    for (const file of request.files) body.append('files', file)
    body.append('ProjectId', String(request.projectId))
    body.append('Selection', JSON.stringify(request.selection ?? {}))
    body.append('Name', request.name)
    body.append('SkillName', request.skillName)
    body.append('JsonArgs', request.jsonArgs ?? '{}')
    return this.client.request<unknown>('POST', '/api/v1/Skill/general', {
      body,
      signal
    })
  }
}