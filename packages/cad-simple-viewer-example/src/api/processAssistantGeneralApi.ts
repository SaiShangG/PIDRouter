import { ProcessAssistantClient } from './processAssistantClient'

export interface RunGeneralSkillRequest {
  files: File[]
  projectId: number
  selection?: object
  name: string
  skillName: string
  jsonArgs?: string
}

export interface RunGeneralSkillResponse {
  success: boolean
  message: string | null
  result: string | null
}

interface GeneralSkillTask {
  id: string
  status: 0 | 1 | 2 | 3 | 4
  result: { success: boolean; message?: string | null } | null
}

export class ProcessAssistantGeneralApi {
  constructor(private readonly client: ProcessAssistantClient) { }

  async runAndWait(request: RunGeneralSkillRequest, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const response = await this.run(request, signal)
    if (!response?.success || !response.result?.trim()) {
      throw new Error(response?.message || 'Skill submission did not return a task ID')
    }

    const taskId = response.result
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      const tasks = await this.client.request<GeneralSkillTask[]>(
        'GET',
        `/api/v1/PeriodicTask?${new URLSearchParams({ id: taskId })}`,
        { signal }
      )
      const task = tasks.find(item => item.id === taskId)
      if (task) {
        switch (task.status) {
          case 0: // Pending
          case 1: // Running
            break
          case 2: // Completed
            if (task.result?.success !== true) {
              throw new Error(task.result?.message || 'Skill execution failed')
            }
            return
          case 3: // Failed
            throw new Error('Skill task failed')
          case 4: // Cancelled
            throw new Error('Skill task was canceled')
          default:
            throw new Error('Skill task returned an invalid status')
        }
      }
      await new Promise<void>((resolve, reject) => {
        signal?.throwIfAborted()
        const handleAbort = () => {
          clearTimeout(timeout)
          reject(new DOMException('Skill task wait canceled', 'AbortError'))
        }
        const timeout = setTimeout(() => {
          signal?.removeEventListener('abort', handleAbort)
          resolve()
        }, Math.min(1000, Math.max(0, deadline - Date.now())))
        signal?.addEventListener('abort', handleAbort, { once: true })
      })
    }
    throw new Error('Timed out waiting for the skill task')
  }

  run(request: RunGeneralSkillRequest, signal?: AbortSignal) {
    const body = new FormData()
    for (const file of request.files) body.append('files', file)
    body.append('ProjectId', String(request.projectId))
    body.append('Selection', JSON.stringify(request.selection ?? {}))
    body.append('Name', request.name)
    body.append('SkillName', request.skillName)
    body.append('JsonArgs', request.jsonArgs ?? '{}')
    return this.client.request<RunGeneralSkillResponse>('POST', '/api/v1/Skill/general', {
      body,
      signal
    })
  }
}