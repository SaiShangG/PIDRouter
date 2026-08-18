import type {
  DrawingRecord,
  DrawingRepository,
  DrawingUploadInput
} from './types'

const DATABASE_NAME = 'pid-drawing-library'
const DATABASE_VERSION = 1
const METADATA_STORE = 'drawings'
const CONTENT_STORE = 'drawing-contents'
const MOCK_USER = 'Demo User'
const isCadFile = (fileName: string) => /\.(dwg|dxf)$/i.test(fileName)

interface StoredDrawingContent {
  id: string
  content: ArrayBuffer
}

const wait = (milliseconds: number) =>
  new Promise<void>(resolve => window.setTimeout(resolve, milliseconds))
const createMockArtifact = (record: DrawingRecord) => {
  const sizeFactor = Math.max(1, Math.round(record.fileSize / 1024))
  return {
    id: `artifact_${record.id}`,
    schemaVersion: 1,
    parserVersion: 'PID Mock Parser 1.0.0',
    completedAt: new Date().toISOString(),
    entityCount: Math.max(24, sizeFactor * 3),
    edgeCount: Math.max(18, sizeFactor * 2),
    warningCount: 0,
    warnings: []
  }
}

export class IndexedDbDrawingRepository implements DrawingRepository {
  async list(): Promise<DrawingRecord[]> {
    const database = await this.openDatabase()
    const records = await this.request<DrawingRecord[]>(
      database.transaction(METADATA_STORE).objectStore(METADATA_STORE).getAll()
    )
    database.close()
    return records
      .map(record =>
        record.status === 'READY' && !record.connectionArtifact
          ? { ...record, connectionArtifact: createMockArtifact(record) }
          : record
      )
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
  }

  async upload(
    file: File,
    input: DrawingUploadInput,
    onProgress?: (record: DrawingRecord) => void
  ): Promise<DrawingRecord> {
    const name = input.name.trim()
    if (!name) throw new Error('请输入图纸名称')

    let record: DrawingRecord = {
      id: crypto.randomUUID(),
      drawingNumber: input.drawingNumber?.trim() || undefined,
      name,
      originalFileName: file.name,
      fileSize: file.size,
      uploadedBy: MOCK_USER,
      uploadedAt: new Date().toISOString(),
      status: 'UPLOADING',
      progress: 0
    }
    await this.putMetadata(record)

    for (const progress of [18, 42, 68, 90]) {
      await wait(120)
      record = { ...record, progress }
      await this.putMetadata(record)
      onProgress?.({ ...record })
    }

    await this.putContent({ id: record.id, content: await file.arrayBuffer() })
    record = { ...record, status: 'UPLOADED', progress: 100 }
    await this.putMetadata(record)
    onProgress?.({ ...record })
    return isCadFile(file.name)
      ? this.simulateParse(record, onProgress)
      : record
  }

  async getContent(drawingId: string): Promise<ArrayBuffer> {
    const database = await this.openDatabase()
    const stored = await this.request<StoredDrawingContent | undefined>(
      database.transaction(CONTENT_STORE).objectStore(CONTENT_STORE).get(drawingId)
    )
    database.close()
    if (!stored) throw new Error('图纸文件不存在')
    return stored.content
  }

  async retryParse(drawingId: string): Promise<DrawingRecord> {
    const record = await this.getMetadata(drawingId)
    if (!record) throw new Error('图纸记录不存在')
    return this.simulateParse({ ...record, parseError: undefined }, undefined, true)
  }

  async delete(drawingId: string): Promise<void> {
    const database = await this.openDatabase()
    const transaction = database.transaction(
      [METADATA_STORE, CONTENT_STORE],
      'readwrite'
    )
    transaction.objectStore(METADATA_STORE).delete(drawingId)
    transaction.objectStore(CONTENT_STORE).delete(drawingId)
    await this.transactionComplete(transaction)
    database.close()
  }

  private async simulateParse(
    record: DrawingRecord,
    onProgress?: (record: DrawingRecord) => void,
    forceSuccess = false
  ) {
    let next: DrawingRecord = {
      ...record,
      status: 'PARSING',
      progress: 35,
      connectionArtifact: undefined
    }
    await this.putMetadata(next)
    onProgress?.({ ...next })
    await wait(700)

    next = !forceSuccess && record.originalFileName.toLowerCase().includes('fail')
      ? {
          ...next,
          status: 'FAILED',
          progress: 100,
          parseError: '模拟 DWG 解析失败'
        }
      : {
          ...next,
          status: 'READY',
          progress: 100,
          parseError: undefined,
          connectionArtifact: createMockArtifact(next)
        }
    await this.putMetadata(next)
    onProgress?.({ ...next })
    return next
  }

  private async getMetadata(id: string) {
    const database = await this.openDatabase()
    const record = await this.request<DrawingRecord | undefined>(
      database.transaction(METADATA_STORE).objectStore(METADATA_STORE).get(id)
    )
    database.close()
    return record
  }

  private async putMetadata(record: DrawingRecord) {
    const database = await this.openDatabase()
    await this.request(
      database
        .transaction(METADATA_STORE, 'readwrite')
        .objectStore(METADATA_STORE)
        .put(record)
    )
    database.close()
  }

  private async putContent(content: StoredDrawingContent) {
    const database = await this.openDatabase()
    await this.request(
      database
        .transaction(CONTENT_STORE, 'readwrite')
        .objectStore(CONTENT_STORE)
        .put(content)
    )
    database.close()
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          database.createObjectStore(METADATA_STORE, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(CONTENT_STORE)) {
          database.createObjectStore(CONTENT_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private request<T = undefined>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private transactionComplete(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
}