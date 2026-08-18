export interface ProjectRecord {
  id: string
  name: string
  drawingIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  name: string
  drawingIds: string[]
}

export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>
  create(input: ProjectInput): Promise<ProjectRecord>
  update(id: string, input: ProjectInput): Promise<ProjectRecord>
  delete(id: string): Promise<void>
}