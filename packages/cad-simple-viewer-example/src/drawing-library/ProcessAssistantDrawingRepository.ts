import type { ProcessAssistantFileApi } from '../api/processAssistantFileApi'
import type { UploadFileDto } from '../api/processAssistantTypes'
import type {
  DrawingRecord,
  DrawingRepository,
  DrawingUploadInput
} from './types'

interface StoredDrawingMetadata {
  name?: string
  drawingNumber?: string
}

const isCadFile = (fileName: string) => /\.(dwg|dxf)$/i.test(fileName)

export class ProcessAssistantDrawingRepository implements DrawingRepository {
  private readonly filesById = new Map<number, UploadFileDto>()

  constructor(
    private readonly files: Pick<
      ProcessAssistantFileApi,
      'list' | 'get' | 'upload' | 'download' | 'delete'
    >
  ) {}

  async list(): Promise<DrawingRecord[]> {
    const files = await this.files.list()
    this.filesById.clear()
    return files
      .flatMap(file => {
        if (!this.hasId(file)) return []
        this.filesById.set(file.id, file)
        return [this.toRecord(file)]
      })
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
  }

  async upload(
    file: File,
    input: DrawingUploadInput,
    onProgress?: (record: DrawingRecord) => void
  ): Promise<DrawingRecord> {
    const name = input.name.trim()
    if (!name) throw new Error('请输入图纸名称')
    const uploaded = await this.files.upload({
      file,
      comment: JSON.stringify({
        name,
        drawingNumber: input.drawingNumber?.trim() || undefined
      } satisfies StoredDrawingMetadata)
    })
    if (!this.hasId(uploaded)) {
      throw new Error('后台上传未返回有效文件 ID')
    }
    this.filesById.set(uploaded.id, uploaded)
    const record = this.toRecord(uploaded)
    onProgress?.(record)
    return record
  }

  async getContent(drawingId: string): Promise<ArrayBuffer> {
    const file = await this.requireFile(drawingId)
    const storedFileName = file.storedFileName?.trim()
    if (!storedFileName) throw new Error('后台文件缺少存储文件名')
    return (await this.files.download(storedFileName)).arrayBuffer()
  }

  retryParse(_drawingId: string): Promise<DrawingRecord> {
    return Promise.reject(new Error('当前后台 API 不支持重新解析文件'))
  }

  async delete(drawingId: string): Promise<void> {
    const file = await this.requireFile(drawingId)
    const storedFileName = file.storedFileName?.trim()
    if (!storedFileName) throw new Error('后台文件缺少存储文件名')
    await this.files.delete(storedFileName)
    this.filesById.delete(Number(drawingId))
  }

  private async requireFile(drawingId: string): Promise<UploadFileDto> {
    const id = Number(drawingId)
    if (!Number.isInteger(id) || id < 1) throw new Error('后台文件 ID 无效')
    const cached = this.filesById.get(id)
    if (cached) return cached
    const file = await this.files.get(id)
    this.filesById.set(id, file)
    return file
  }

  private toRecord(file: UploadFileDto & { id: number }): DrawingRecord {
    const metadata = this.parseMetadata(file.comment)
    const originalFileName =
      file.originalFileName?.trim() ||
      file.storedFileName?.trim() ||
      `File ${file.id}`
    return {
      id: String(file.id),
      drawingNumber: metadata.drawingNumber,
      name: metadata.name || originalFileName,
      originalFileName,
      fileSize: file.fileSize ?? 0,
      uploadedBy: 'Backend',
      uploadedAt: file.uploadedAt ?? new Date(0).toISOString(),
      status: isCadFile(originalFileName) ? 'READY' : 'UPLOADED',
      progress: 100
    }
  }

  private parseMetadata(comment?: string | null): StoredDrawingMetadata {
    if (!comment) return {}
    try {
      const parsed: unknown = JSON.parse(comment)
      if (typeof parsed !== 'object' || parsed === null) return { name: comment }
      const metadata = parsed as Record<string, unknown>
      return {
        name: typeof metadata.name === 'string' ? metadata.name : undefined,
        drawingNumber:
          typeof metadata.drawingNumber === 'string'
            ? metadata.drawingNumber
            : undefined
      }
    } catch {
      return { name: comment }
    }
  }

  private hasId(file: UploadFileDto): file is UploadFileDto & { id: number } {
    return Number.isInteger(file.id) && (file.id ?? 0) > 0
  }
}