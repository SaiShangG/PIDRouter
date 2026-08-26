export interface ProjectRecord {
  id: number
  name: string
  description: string
  fileIds: number[]
}

export interface ProjectInput {
  name: string
  description: string
  fileIds: number[]
}

export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>
  get(id: number): Promise<ProjectRecord>
  create(input: ProjectInput): Promise<ProjectRecord>
  update(id: number, input: ProjectInput): Promise<ProjectRecord>
  delete(id: number): Promise<void>
}