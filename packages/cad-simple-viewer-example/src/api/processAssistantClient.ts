import { ProcessAssistantApiError } from './processAssistantTypes'

export interface ProcessAssistantClientOptions {
  baseUrl: string
  fetch?: typeof fetch
}

export interface ApiRequestOptions
  extends Omit<RequestInit, 'body' | 'method'> {
  body?: unknown
}

export interface ApiFileResponse {
  blob: Blob
  fileName?: string
}

export class ProcessAssistantClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ProcessAssistantClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async request<T>(
    method: string,
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const response = await this.send(method, path, options)
    if (response.status === 204) return undefined as T

    const text = await response.text()
    if (!text) return undefined as T

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('json')) return JSON.parse(text) as T
    return text as T
  }

  async requestBlob(
    method: string,
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<Blob> {
    return (await this.requestFile(method, path, options)).blob
  }

  async requestFile(
    method: string,
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiFileResponse> {
    const response = await this.send(method, path, options)
    return {
      blob: await response.blob(),
      fileName: this.getDownloadFileName(response.headers.get('content-disposition'))
    }
  }

  private async send(
    method: string,
    path: string,
    options: ApiRequestOptions
  ): Promise<Response> {
    const url = this.createUrl(path)
    const { body, headers: inputHeaders, ...requestInit } = options
    const headers = new Headers(inputHeaders)
    const requestBody = this.createBody(body, headers)

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        ...requestInit,
        method,
        headers,
        body: requestBody
      })
    } catch (cause) {
      throw new ProcessAssistantApiError(
        `${method} ${url} failed before receiving a response`,
        { method, url, cause }
      )
    }

    if (response.ok) return response

    throw new ProcessAssistantApiError(
      `${method} ${url} failed with ${response.status} ${response.statusText}`,
      {
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        responseBody: await this.readErrorBody(response)
      }
    )
  }

  private createUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path
    return `${this.baseUrl}/${path.replace(/^\//, '')}`
  }

  private createBody(body: unknown, headers: Headers): BodyInit | undefined {
    if (body === undefined) return undefined
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof URLSearchParams ||
      typeof body === 'string'
    ) {
      return body
    }
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return JSON.stringify(body)
  }

  private getDownloadFileName(contentDisposition: string | null) {
    if (!contentDisposition) return undefined
    const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    if (encoded) {
      try {
        return decodeURIComponent(encoded.replace(/^"|"$/g, ''))
      } catch {
        return encoded.replace(/^"|"$/g, '')
      }
    }
    return contentDisposition
      .match(/filename="?([^";]+)"?/i)?.[1]
      ?.trim()
  }

  private async readErrorBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return undefined
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }
}