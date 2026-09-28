describe('preloadDrawingParser', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    jest.resetModules()
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:parser-test')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('shares a download and waits for the complete body before resolving', async () => {
    let finishBody!: (value: ArrayBuffer) => void
    const body = new Promise<ArrayBuffer>(resolve => { finishBody = resolve })
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/javascript' }),
      arrayBuffer: () => body
    })
    globalThis.fetch = fetchMock
    const { preloadDrawingParser } = await import('../src/drawing-library/preloadDrawingParser')
    const first = preloadDrawingParser('first.DWG')
    const second = preloadDrawingParser('second.dwg')
    expect(second).toBe(first)
    let completed = false
    void first.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)
    finishBody(new ArrayBuffer(16))
    await expect(first).resolves.toBe('blob:parser-test')
    expect(completed).toBe(true)
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('./workers/libredwg-parser-worker.js', {
      credentials: 'same-origin',
      signal: expect.any(AbortSignal)
    })
    await preloadDrawingParser('third.dwg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('uses the DXF worker and ignores unsupported file types', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('worker', {
      headers: { 'content-type': 'text/javascript; charset=utf-8' }
    }))
    globalThis.fetch = fetchMock
    const { preloadDrawingParser } = await import('../src/drawing-library/preloadDrawingParser')
    await preloadDrawingParser('archive.pdi')
    expect(fetchMock).not.toHaveBeenCalled()
    await preloadDrawingParser('drawing.dxf')
    expect(fetchMock.mock.calls[0][0]).toBe('./workers/dxf-parser-worker.js')
  })

  it('allows retry after a failed download', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('worker', {
        headers: { 'content-type': 'application/javascript' }
      }))
    globalThis.fetch = fetchMock
    const { preloadDrawingParser } = await import('../src/drawing-library/preloadDrawingParser')
    await expect(preloadDrawingParser('drawing.dwg')).rejects.toThrow('404')
    await expect(preloadDrawingParser('drawing.dwg')).resolves.toBe('blob:parser-test')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects a fallback HTML page instead of treating it as a worker', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(new Response('<html></html>', {
      headers: { 'content-type': 'text/html' }
    }))
    const { preloadDrawingParser } = await import('../src/drawing-library/preloadDrawingParser')
    await expect(preloadDrawingParser('drawing.dwg')).rejects.toThrow('content type')
  })

  it('allows retry after a network failure', async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('worker', {
        headers: { 'content-type': 'application/javascript' }
      }))
    globalThis.fetch = fetchMock
    const { preloadDrawingParser } = await import('../src/drawing-library/preloadDrawingParser')
    await expect(preloadDrawingParser('drawing.dwg')).rejects.toThrow('Failed to fetch')
    await expect(preloadDrawingParser('drawing.dwg')).resolves.toBe('blob:parser-test')
  })
})