export type DrawingProcessingStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PARSING'
  | 'READY'
  | 'FAILED'

export interface ConnectionArtifactSummary {
  id: string
  schemaVersion: number
  parserVersion: string
  completedAt: string
  entityCount: number
  edgeCount: number
  warningCount: number
  warnings: string[]
}

export interface DrawingRecord {
  id: string
  drawingNumber?: string
  name: string
  originalFileName: string
  fileSize: number
  uploadedBy: string
  uploadedAt: string
  status: DrawingProcessingStatus
  progress: number
  parseError?: string
  connectionArtifact?: ConnectionArtifactSummary
}

export interface DrawingUploadInput {
  name: string
  drawingNumber?: string
}

export interface DrawingRepository {
  list(): Promise<DrawingRecord[]>
  upload(
    file: File,
    input: DrawingUploadInput,
    onProgress?: (record: DrawingRecord) => void
  ): Promise<DrawingRecord>
  getContent(drawingId: string): Promise<ArrayBuffer>
  retryParse(drawingId: string): Promise<DrawingRecord>
  delete(drawingId: string): Promise<void>
}