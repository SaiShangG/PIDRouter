const DATABASE_NAME = 'cad-simple-viewer-example'
const DATABASE_VERSION = 1
const STORE_NAME = 'drawing-assets'

export interface StoredDrawingAsset {
  id: string
  fileName: string
  content: ArrayBuffer
  updatedAt: string
}

export class DrawingAssetStore {
  async put(asset: StoredDrawingAsset): Promise<void> {
    const database = await this.openDatabase()
    await this.request(
      database
        .transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME)
        .put(asset)
    )
    database.close()
  }

  async get(id: string): Promise<StoredDrawingAsset | undefined> {
    const database = await this.openDatabase()
    const asset = await this.request<StoredDrawingAsset | undefined>(
      database.transaction(STORE_NAME).objectStore(STORE_NAME).get(id)
    )
    database.close()
    return asset
  }

  async delete(id: string): Promise<void> {
    const database = await this.openDatabase()
    await this.request(
      database
        .transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME)
        .delete(id)
    )
    database.close()
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' })
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
}