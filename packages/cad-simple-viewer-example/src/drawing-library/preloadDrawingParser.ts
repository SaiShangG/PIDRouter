const pendingDownloads = new Map<string, Promise<string>>()

export function preloadDrawingParser(fileName: string): Promise<string | undefined> {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const workerUrl = extension === 'dwg'
    ? './workers/libredwg-parser-worker.js'
    : extension === 'dxf'
      ? './workers/dxf-parser-worker.js'
      : undefined
  if (!workerUrl) return Promise.resolve(undefined)

  const pending = pendingDownloads.get(workerUrl)
  if (pending) return pending

  const download = (async () => {
    const response = await fetch(workerUrl, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(120_000)
    })
    if (!response.ok) {
      throw new Error(`Parser download failed: ${response.status} ${workerUrl}`)
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!/^(text|application)\/(javascript|ecmascript)(;|$)/i.test(contentType)) {
      throw new Error(`Unexpected parser content type: ${contentType}`)
    }
    const script = await response.arrayBuffer()
    return URL.createObjectURL(new Blob([script], { type: 'application/javascript' }))
  })().catch(error => {
    pendingDownloads.delete(workerUrl)
    throw error
  })
  pendingDownloads.set(workerUrl, download)
  return download
}