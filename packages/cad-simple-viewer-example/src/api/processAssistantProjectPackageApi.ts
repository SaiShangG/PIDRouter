import { ProcessAssistantClient } from './processAssistantClient'
import { ProcessAssistantApiError } from './processAssistantTypes'

export interface ProjectPackageImportResult {
  projectId: number
  projectKey: string
  name: string
  action: 'created' | 'replaced'
}

export interface ProjectPackageDownload {
  blob: Blob
  fileName: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function getProjectPackageErrorMessage(error: unknown): string {
  if (error instanceof ProcessAssistantApiError) {
    if (isRecord(error.responseBody) &&
      typeof error.responseBody.message === 'string' &&
      error.responseBody.message.trim()) {
      return error.responseBody.message
    }
    if (error.status === 404 || error.status === 501) {
      return '项目包接口或项目不可用，请确认后台已部署项目包接口。'
    }
    if (error.status === 413) return '项目包超过后台允许的大小。'
    if (error.status === undefined) return '无法连接后台，请检查网络及后台服务。'
  }
  return error instanceof Error ? error.message : String(error)
}

export class ProcessAssistantProjectPackageApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  async exportPackage(
    projectId: number,
    signal?: AbortSignal
  ): Promise<ProjectPackageDownload> {
    if (!Number.isSafeInteger(projectId) || projectId < 1) {
      throw new Error('后台项目 ID 无效。')
    }
    const result = await this.client.requestFile(
      'POST',
      '/api/v1/Project/export-package',
      { body: { projectId }, headers: { Accept: 'application/zip' }, signal }
    )
    const type = result.blob.type.split(';')[0].trim().toLowerCase()
    if (!['application/zip', 'application/octet-stream', 'application/x-zip-compressed'].includes(type)) {
      throw new Error('后台未返回有效的项目包文件。')
    }
    const header = new Uint8Array(await result.blob.slice(0, 4).arrayBuffer())
    if (header.length !== 4 ||
      header[0] !== 0x50 || header[1] !== 0x4b ||
      header[2] !== 0x03 || header[3] !== 0x04) {
      throw new Error('后台未返回有效的项目包文件。')
    }
    const fileName = result.fileName?.trim()
    if (!fileName || !/^.+\.zip$/i.test(fileName) || /[\\/]/.test(fileName)) {
      throw new Error('后台未返回有效的项目包文件名，请检查 Content-Disposition 和跨域配置。')
    }
    return { blob: result.blob, fileName }
  }

  async importPackage(
    file: File,
    requestId: string,
    signal?: AbortSignal
  ): Promise<ProjectPackageImportResult> {
    if (!/^.+\.zip$/i.test(file.name) || file.size === 0) {
      throw new Error('请选择非空的 ZIP 项目包。')
    }
    if (!requestId.trim()) throw new Error('项目包导入请求标识不能为空。')
    const body = new FormData()
    body.append('file', file)
    const result = await this.client.request<unknown>(
      'POST',
      '/api/v1/Project/import-package',
      { body, headers: { 'Idempotency-Key': requestId }, signal }
    )
    if (!isRecord(result) ||
      typeof result.projectId !== 'number' ||
      !Number.isSafeInteger(result.projectId) || result.projectId < 1 ||
      typeof result.projectKey !== 'string' || !result.projectKey.trim() ||
      typeof result.name !== 'string' || !result.name.trim() ||
      (result.action !== 'created' && result.action !== 'replaced')) {
      throw new Error('后台返回了无效的项目导入结果，请检查项目列表或使用相同请求标识重试。')
    }
    return {
      projectId: result.projectId,
      projectKey: result.projectKey,
      name: result.name,
      action: result.action
    }
  }
}
