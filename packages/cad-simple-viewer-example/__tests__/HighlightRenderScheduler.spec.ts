/** @jest-environment jsdom */

import { HighlightRenderScheduler } from '../src/brush/HighlightRenderScheduler'

const frames = () => {
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  const request = jest.fn((callback: FrameRequestCallback) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  })
  const cancel = jest.fn((id: number) => { callbacks.delete(id) })
  const advance = () => {
    const pending = [...callbacks.values()]
    callbacks.clear()
    pending.forEach(callback => callback(0))
  }
  return { request, cancel, advance, callbacks }
}

describe('HighlightRenderScheduler', () => {
  it('batches 1000 samples into one frame and deduplicates affected IDs', () => {
    const host = frames()
    const render = jest.fn()
    const scheduler = new HighlightRenderScheduler<string>(render, host.request, host.cancel)
    for (let index = 0; index < 1000; index++) scheduler.schedule(['A', 'B'])
    scheduler.schedule(['C'])
    expect(host.request).toHaveBeenCalledTimes(1)
    expect(render).not.toHaveBeenCalled()
    host.advance()
    expect(render).toHaveBeenCalledTimes(1)
    expect([...render.mock.calls[0][0]]).toEqual(['A', 'B', 'C'])
    scheduler.schedule(['D'])
    host.advance()
    expect(render).toHaveBeenCalledTimes(2)
    expect([...render.mock.calls[1][0]]).toEqual(['D'])
  })

  it('flushes synchronously at stroke completion and cancels the queued frame, including ID zero', () => {
    const host = frames()
    const render = jest.fn()
    const scheduler = new HighlightRenderScheduler<string>(render, host.request, host.cancel)
    scheduler.schedule(['A'])
    scheduler.flush()
    expect(host.cancel).toHaveBeenCalledWith(0)
    expect(render).toHaveBeenCalledTimes(1)
    host.advance()
    scheduler.flush()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('discards pending old-phase IDs on cancellation', () => {
    const host = frames()
    const render = jest.fn()
    const scheduler = new HighlightRenderScheduler<string>(render, host.request, host.cancel)
    scheduler.schedule(['old-phase'])
    scheduler.cancel()
    host.advance()
    expect(render).not.toHaveBeenCalled()
    scheduler.schedule(['new-phase'])
    host.advance()
    expect([...render.mock.calls[0][0]]).toEqual(['new-phase'])
  })

  it('preserves work scheduled during rendering for the next frame', () => {
    const host = frames()
    const seen: string[][] = []
    const scheduler = new HighlightRenderScheduler<string>(ids => {
      seen.push([...ids])
      if (ids.has('A')) scheduler.schedule(['B'])
    }, host.request, host.cancel)
    scheduler.schedule(['A'])
    host.advance()
    expect(seen).toEqual([['A']])
    expect(host.callbacks.size).toBe(1)
    host.advance()
    expect(seen).toEqual([['A'], ['B']])
  })

  it('does not request a frame for empty input', () => {
    const host = frames()
    const scheduler = new HighlightRenderScheduler(jest.fn(), host.request, host.cancel)
    scheduler.schedule([])
    scheduler.cancel()
    expect(host.request).not.toHaveBeenCalled()
    expect(host.cancel).not.toHaveBeenCalled()
  })

  it('invokes browser frame APIs with their Window receiver', () => {
    const originalRequest = window.requestAnimationFrame
    const originalCancel = window.cancelAnimationFrame
    const request = jest.fn(function (this: Window, _callback: FrameRequestCallback) {
      expect(this).toBe(window)
      return 17
    })
    const cancel = jest.fn(function (this: Window, _id: number) {
      expect(this).toBe(window)
    })
    window.requestAnimationFrame = request
    window.cancelAnimationFrame = cancel
    try {
      const render = jest.fn()
      const scheduler = new HighlightRenderScheduler<string>(render)
      scheduler.schedule(['A'])
      scheduler.flush()
      expect(request).toHaveBeenCalledTimes(1)
      expect(cancel).toHaveBeenCalledWith(17)
      expect(render).toHaveBeenCalledTimes(1)
    } finally {
      window.requestAnimationFrame = originalRequest
      window.cancelAnimationFrame = originalCancel
    }
  })
})
