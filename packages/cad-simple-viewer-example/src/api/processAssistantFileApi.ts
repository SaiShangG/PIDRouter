import { ProcessAssistantClient } from './processAssistantClient'
import type {
  UploadFileDto,
  UploadFileRequest
} from './processAssistantTypes'

export class ProcessAssistantFileApi {
  constructor(private readonly client: ProcessAssistantClient) {}

  list(signal?: AbortSignal): Promise<UploadFileDto[]> {
    return this.client.request('GET', '/api/v1/File', { signal })
  }

  get(id: number, signal?: AbortSignal): Promise<UploadFileDto> {
    return this.client.request('GET', `/api/v1/File/${id}`, { signal })
  }

  upload(
    request: UploadFileRequest,
    signal?: AbortSignal
  ): Promise<UploadFileDto> {
    const body = new FormData()
    body.append('file', request.file)
    if (request.comment !== undefined) body.append('comment', request.comment)
    return this.client.request('POST', '/api/v1/File/upload', {
      body,
      signal
    })
  }

  uploadMultiple(
    files: File[],
    signal?: AbortSignal
  ): Promise<UploadFileDto[]> {
    const body = new FormData()
    for (const file of files) body.append('files', file)
    return this.client.request('POST', '/api/v1/File/upload-multiple', {
      body,
      signal
    })
  }

  download(storedFileName: string, signal?: AbortSignal): Promise<Blob> {
    return this.client.requestBlob(
      'GET',
      `/api/v1/File/download/${encodeURIComponent(storedFileName)}`,
      { signal }
    )
  }

  updateComment(
    id: number,
    comment: string,
    signal?: AbortSignal
  ): Promise<void> {
    return this.client.request('PUT', `/api/v1/File/${id}/comment`, {
      body: JSON.stringify(comment),
      headers: { 'Content-Type': 'application/json' },
      signal
    })
  }

  delete(storedFileName: string, signal?: AbortSignal): Promise<void> {
    return this.client.request(
      'DELETE',
      `/api/v1/File/${encodeURIComponent(storedFileName)}`,
      { signal }
    )
  }
}