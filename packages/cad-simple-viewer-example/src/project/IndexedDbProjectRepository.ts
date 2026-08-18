import type { ProjectInput, ProjectRecord, ProjectRepository } from './types'

const DATABASE_NAME = 'pid-projects'
const DATABASE_VERSION = 1
const PROJECT_STORE = 'projects'
const LOCAL_USER = 'Local User'

export class IndexedDbProjectRepository implements ProjectRepository {
  async list(): Promise<ProjectRecord[]> {
    const database = await this.openDatabase()
    const records = await this.request<ProjectRecord[]>(
      database.transaction(PROJECT_STORE).objectStore(PROJECT_STORE).getAll()
    )
    database.close()
    return records.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    )
  }

  async create(input: ProjectInput): Promise<ProjectRecord> {
    const normalized = await this.validateInput(input)
    const timestamp = new Date().toISOString()
    const record: ProjectRecord = {
      id: crypto.randomUUID(),
      ...normalized,
      createdBy: LOCAL_USER,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    await this.put(record)
    return record
  }

  async update(id: string, input: ProjectInput): Promise<ProjectRecord> {
    const existing = await this.get(id)
    if (!existing) throw new Error('Project 不存在')
    const normalized = await this.validateInput(input, id)
    const record: ProjectRecord = {
      ...existing,
      ...normalized,
      updatedAt: new Date().toISOString()
    }
    await this.put(record)
    return record
  }

  async delete(id: string): Promise<void> {
    const database = await this.openDatabase()
    const transaction = database.transaction(PROJECT_STORE, 'readwrite')
    transaction.objectStore(PROJECT_STORE).delete(id)
    await this.transactionComplete(transaction)
    database.close()
  }

  private async validateInput(input: ProjectInput, excludedId?: string) {
    const name = input.name.trim()
    if (!name) throw new Error('请输入 Project 名称')
    const drawingIds = [...new Set(input.drawingIds)]
    if (drawingIds.length === 0) throw new Error('请至少选择一个 PID')
    const duplicate = (await this.list()).some(
      project =>
        project.id !== excludedId &&
        project.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
    if (duplicate) throw new Error('已存在同名 Project')
    return { name, drawingIds }
  }

  private async get(id: string) {
    const database = await this.openDatabase()
    const record = await this.request<ProjectRecord | undefined>(
      database.transaction(PROJECT_STORE).objectStore(PROJECT_STORE).get(id)
    )
    database.close()
    return record
  }

  private async put(record: ProjectRecord) {
    const database = await this.openDatabase()
    const transaction = database.transaction(PROJECT_STORE, 'readwrite')
    transaction.objectStore(PROJECT_STORE).put(record)
    await this.transactionComplete(transaction)
    database.close()
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(PROJECT_STORE)) {
          database.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
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