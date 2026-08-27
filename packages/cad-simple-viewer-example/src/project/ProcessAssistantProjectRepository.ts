import type { ProcessAssistantProjectApi } from '../api/processAssistantProjectApi'
import type { ProjectDto } from '../api/processAssistantTypes'
import type { ProjectInput, ProjectRecord, ProjectRepository } from './types'

interface ProjectJsonData {
  schemaVersion: 1
  description: string
  configure?: Record<string, unknown>
}

interface ProjectJsonDataUpdate extends ProjectJsonData {
  fileIds: number[]
}

const normalizeFileIds = (values: number[]): number[] => [
  ...new Set(values.filter(value => Number.isInteger(value) && value > 0))
]

const normalizeInput = (input: ProjectInput): ProjectInput => {
  const name = input.name.trim()
  if (!name) throw new Error('请输入 Project 名称')
  return {
    name,
    description: input.description.trim(),
    fileIds: normalizeFileIds(input.fileIds)
  }
}

const parseJsonData = (value: string | null | undefined): ProjectJsonData => {
  if (!value) return { schemaVersion: 1, description: '' }
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { schemaVersion: 1, description: '' }
    }
    const data = parsed as Record<string, unknown>
    return {
      schemaVersion: 1,
      description: typeof data.description === 'string' ? data.description : '',
      configure:
        data.Configure && typeof data.Configure === 'object' &&
          !Array.isArray(data.Configure)
          ? data.Configure as Record<string, unknown>
          : undefined
    }
  } catch {
    return { schemaVersion: 1, description: '' }
  }
}

const parseFileIds = (value: number[] | string | null | undefined): number[] => {
  if (Array.isArray(value)) return normalizeFileIds(value)
  if (!value?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? normalizeFileIds(
        parsed.filter((item): item is number => typeof item === 'number')
      )
      : []
  } catch {
    return []
  }
}

const serializeJsonData = (
  input: ProjectInput,
  configure?: Record<string, unknown>
): string =>
  JSON.stringify({
    schemaVersion: 1,
    description: input.description,
    fileIds: input.fileIds,
    ...(configure ? { Configure: configure } : {})
  } satisfies ProjectJsonDataUpdate)

const toProjectRecord = (project: ProjectDto): ProjectRecord | undefined => {
  if (!Number.isInteger(project.id) || (project.id ?? 0) < 1) return undefined
  const data = parseJsonData(project.jsonData)
  return {
    id: project.id!,
    name: project.name?.trim() || `Project ${project.id}`,
    description: data.description,
    fileIds: parseFileIds(project.fileIds),
    ...(data.configure ? { configure: data.configure } : {})
  }
}

export class ProcessAssistantProjectRepository implements ProjectRepository {
  constructor(private readonly api: ProcessAssistantProjectApi) { }

  async list(): Promise<ProjectRecord[]> {
    return (await this.api.list())
      .map(toProjectRecord)
      .filter((project): project is ProjectRecord => project !== undefined)
  }

  async get(id: number): Promise<ProjectRecord> {
    const project = toProjectRecord(await this.api.get(id))
    if (!project) throw new Error('Project API 返回了无效数据')
    return project
  }

  async create(input: ProjectInput): Promise<ProjectRecord> {
    const normalized = normalizeInput(input)
    const id = await this.api.addV2(normalized)
    return this.get(id)
  }

  async update(id: number, input: ProjectInput): Promise<ProjectRecord> {
    const normalized = normalizeInput(input)
    const existingData = parseJsonData((await this.api.get(id)).jsonData)
    await this.api.update(id, {
      id,
      name: normalized.name,
      jsonData: serializeJsonData(normalized, existingData.configure)
    })
    return this.get(id)
  }

  delete(id: number): Promise<void> {
    return this.api.delete(id)
  }
}