/** @jest-environment jsdom */

import type { ValveDebugView } from '../src/flow/types'
import {
  defaultValveDebugLabels,
  ValveDebugFeature,
  type ValveDebugFeatureOptions
} from '../src/flow/ValveDebugFeature'

const createFeature = (options: Partial<ValveDebugFeatureOptions> = {}) => {
  const host = document.createElement('div')
  document.body.append(host)
  const zoomTo = jest.fn()
  const view: ValveDebugView = {
    canvas: document.createElement('canvas'),
    width: 800,
    height: 600,
    viewportToCanvas: point => point,
    screenToWorld: point => point,
    pick: () => [],
    zoomTo,
    isDirty: false
  }
  const overlays: Array<{ setVisible: jest.Mock; dispose: jest.Mock }> = []
  const createOverlay = jest.fn(() => {
    const overlay = { setVisible: jest.fn(), dispose: jest.fn() }
    overlays.push(overlay)
    return overlay
  })
  const requestStateChange = jest.fn(() => true)
  const feature = new ValveDebugFeature({
    enabled: false,
    brushDebugEnabled: true,
    panelHost: host,
    graphDocument: {},
    getView: () => view,
    resolveObjectId: key => key,
    resolveHandleKeys: id => [String(id)],
    createOverlay,
    getLabels: defaultValveDebugLabels,
    getLocale: () => 'en',
    requestStateChange,
    ...options
  })
  const entity = (id: string) =>
    host.querySelector<HTMLButtonElement>(`[data-entity-id="${id}"]`)!
  const mode = (value: string) =>
    host.querySelector<HTMLButtonElement>(`[data-debug-mode="${value}"]`)!
  return {
    feature,
    host,
    entity,
    mode,
    overlays,
    createOverlay,
    zoomTo,
    requestStateChange
  }
}

describe('brush debug integration', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
    document.body.replaceChildren()
  })

  it('records all non-device hits once, including objects without persistent handles', () => {
    const describe = jest.fn(id => ({
      handleKey: id === 'temporary-line' ? undefined : id,
      entityType: 'LINE',
      layer: 'Pipes'
    }))
    const { feature, host, entity, createOverlay, requestStateChange } =
      createFeature({
        isBrushProtectedObject: id =>
          ['valve', 'pump', 'equipment'].includes(String(id)),
        describeBrushEntity: describe
      })
    feature.recordBrushEntities('paint', [
      'valve',
      'A',
      'pump',
      'B',
      'equipment',
      'A',
      'temporary-line'
    ])
    expect(host.querySelectorAll('[data-entity-id]')).toHaveLength(3)
    expect(describe.mock.calls.map(([id]) => id)).toEqual([
      'A',
      'B',
      'temporary-line'
    ])
    expect(entity('A').textContent).toContain('LINE')
    expect(entity('A').textContent).toContain('Pipes')
    expect(entity('temporary-line').textContent).toContain(
      'No persistent handle'
    )
    feature.recordBrushEntities('erase', ['A', 'pump', 'C'])
    expect(host.querySelectorAll('[data-entity-id]')).toHaveLength(4)
    expect(entity('A').textContent).toContain('Eraser hit')
    expect(createOverlay).not.toHaveBeenCalled()
    expect(requestStateChange).not.toHaveBeenCalled()
    feature.dispose()
  })

  it('does not collect or resolve metadata while brush debugging is disabled', () => {
    const describe = jest.fn()
    const { feature, host } = createFeature({
      brushDebugEnabled: false,
      describeBrushEntity: describe
    })
    feature.recordBrushEntities('paint', ['A'])
    expect(feature.panel.element.hidden).toBe(true)
    expect(host.querySelectorAll('[data-entity-id]')).toHaveLength(0)
    expect(describe).not.toHaveBeenCalled()
    feature.setBrushDebugEnabled(true)
    feature.recordBrushEntities('paint', ['A'])
    expect(feature.panel.element.hidden).toBe(false)
    expect(host.querySelectorAll('[data-entity-id]')).toHaveLength(1)
    feature.dispose()
  })

  it('shares the Debug panel while keeping valve and brush enablement independent', () => {
    const { feature, mode, entity } = createFeature()
    expect(feature.panel.element.getAttribute('aria-label')).toBe('Debug')
    expect(mode('valve').hidden).toBe(true)
    expect(mode('brush').getAttribute('aria-pressed')).toBe('true')
    feature.recordBrushEntities('paint', ['A'])
    feature.setEnabled(true)
    expect(mode('valve').hidden).toBe(false)
    mode('valve').click()
    expect(feature.brushPanel.element.hidden).toBe(true)
    mode('brush').click()
    expect(feature.brushPanel.element.hidden).toBe(false)
    expect(entity('A')).not.toBeNull()
    feature.setEnabled(false)
    expect(feature.panel.element.hidden).toBe(false)
    feature.setBrushDebugEnabled(false)
    expect(feature.panel.element.hidden).toBe(true)
    feature.setEnabled(true)
    expect(feature.panel.element.hidden).toBe(false)
    expect(mode('valve').getAttribute('aria-pressed')).toBe('true')
    feature.dispose()
  })

  it('blinks the exact picked entity at 140ms intervals for 1200ms without zooming or editing state', () => {
    const {
      feature,
      entity,
      overlays,
      createOverlay,
      zoomTo,
      requestStateChange
    } = createFeature()
    feature.recordBrushEntities('paint', ['A'])
    entity('A').click()
    expect(createOverlay).toHaveBeenCalledWith(['A'], 'locator')
    expect(overlays).toHaveLength(1)
    jest.advanceTimersByTime(140)
    expect(overlays[0].setVisible).toHaveBeenLastCalledWith(false)
    jest.advanceTimersByTime(140)
    expect(overlays[0].setVisible).toHaveBeenLastCalledWith(true)
    jest.advanceTimersByTime(919)
    expect(overlays[0].dispose).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(overlays[0].dispose).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
    expect(zoomTo).not.toHaveBeenCalled()
    expect(requestStateChange).not.toHaveBeenCalled()
    feature.dispose()
  })

  it('replaces the previous locator when another row is clicked', () => {
    const { feature, entity, overlays } = createFeature()
    feature.recordBrushEntities('paint', ['A', 'B'])
    entity('A').click()
    jest.advanceTimersByTime(300)
    entity('B').click()
    expect(overlays[0].dispose).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(900)
    expect(overlays[1].dispose).not.toHaveBeenCalled()
    jest.advanceTimersByTime(300)
    expect(overlays[1].dispose).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
    feature.dispose()
  })

  it.each(['reset', 'clear', 'disable', 'switch', 'resize', 'dispose'])(
    'cleans up the locator and all timers on %s',
    action => {
      const { feature, entity, host, mode, overlays } = createFeature({
        enabled: true
      })
      mode('brush').click()
      feature.recordBrushEntities('paint', ['A'])
      entity('A').click()
      if (action === 'reset') feature.reset()
      if (action === 'clear')
        host
          .querySelector<HTMLButtonElement>('[data-brush-debug-clear]')!
          .click()
      if (action === 'disable') feature.setBrushDebugEnabled(false)
      if (action === 'switch') mode('valve').click()
      if (action === 'resize') feature.resize()
      if (action === 'dispose') feature.dispose()
      expect(overlays[0].dispose).toHaveBeenCalledTimes(1)
      expect(jest.getTimerCount()).toBe(0)
      if (action === 'reset' || action === 'clear') {
        expect(host.querySelectorAll('[data-entity-id]')).toHaveLength(0)
      }
      feature.dispose()
    }
  )

  it('reports preview failures explicitly and retries the same ID without requiring a handle', () => {
    const createOverlay = jest.fn<
      ReturnType<ValveDebugFeatureOptions['createOverlay']>,
      Parameters<ValveDebugFeatureOptions['createOverlay']>
    >(() => null)
    const { feature, entity } = createFeature({ createOverlay })
    feature.recordBrushEntities('paint', ['temporary-line'])
    entity('temporary-line').click()
    expect(createOverlay).toHaveBeenCalledWith(['temporary-line'], 'locator')
    expect(entity('temporary-line').textContent).toContain('Cannot locate')
    expect(jest.getTimerCount()).toBe(0)
    createOverlay.mockReturnValue({ dispose: jest.fn(), setVisible: jest.fn() })
    entity('temporary-line').click()
    expect(entity('temporary-line').textContent).not.toContain('Cannot locate')
    feature.dispose()
  })

  it('does not create a stale locator when no view exists', () => {
    const { feature, entity, createOverlay } = createFeature({
      getView: () => undefined
    })
    feature.recordBrushEntities('paint', ['A'])
    entity('A').click()
    expect(createOverlay).not.toHaveBeenCalled()
    expect(entity('A').textContent).toContain('Cannot locate')
    feature.dispose()
  })

  it('relocalizes retained debug rows and mode buttons', () => {
    const { feature, entity, mode } = createFeature()
    feature.recordBrushEntities('paint', ['A'])
    feature.setLocale('zh')
    expect(mode('brush').textContent).toBe('画笔调试')
    expect(entity('A').textContent).toContain('画笔命中')
    feature.dispose()
  })
})
