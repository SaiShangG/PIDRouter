/** @jest-environment jsdom */

import type { AcEdBaseView } from '@mlightcad/cad-simple-viewer'

import {
  BrushHighlightFeature,
  type BrushOperation
} from '../src/brush/BrushHighlightFeature'
import { HighlightRenderScheduler } from '../src/brush/HighlightRenderScheduler'
import { defaultValveDebugLabels, ValveDebugFeature } from '../src/flow/ValveDebugFeature'
import { ManualHighlightCorrectionState } from '../src/phase/manualHighlightCorrections'

jest.mock('@mlightcad/cad-simple-viewer', () => ({
  AcEdCorsorType: { Crosshair: 0 },
  AcEdViewMode: { SELECTION: 0, PAN: 1, BRUSH: 2 }
}))

const pointer = (
  type: string,
  x = 0,
  buttons = 1
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: 0 },
    buttons: { value: buttons },
    clientX: { value: x },
    clientY: { value: 0 },
    isPrimary: { value: true },
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' }
  })
  return event
}

const createView = () => {
  const canvas = document.createElement('canvas')
  let captured = false
  canvas.setPointerCapture = jest.fn(() => { captured = true })
  canvas.hasPointerCapture = jest.fn(() => captured)
  canvas.releasePointerCapture = jest.fn(() => {
    captured = false
    canvas.dispatchEvent(pointer('lostpointercapture'))
  })
  const selectedIds = new Set(['A'])
  const view = {
    canvas,
    mode: 0,
    editor: { currentCursor: 0 },
    selectionSet: { has: (id: string) => selectedIds.has(id) },
    viewportToCanvas: (point: { x: number; y: number }) => point,
    screenToWorld: (point: { x: number; y: number }) => point,
    pick: (point: { x: number; y: number }) =>
      [{ id: point.x < 8 ? 'A' : point.x < 16 ? 'B' : 'C' }],
    setCursor: (value: number) => {
      canvas.style.cursor = value === 0 ? 'crosshair' : `cursor-${value}`
    }
  } as unknown as AcEdBaseView
  canvas.addEventListener('mouseup', event => {
    if (event.button === 1) view.setCursor(0)
  })
  return { canvas, view, selectedIds }
}

const stroke = (canvas: HTMLCanvasElement, x: number) => {
  canvas.dispatchEvent(pointer('pointerdown', x))
  canvas.dispatchEvent(pointer('pointerup', x, 0))
}

describe('BrushHighlightFeature', () => {
  it('restores operation cursors after pan and returns to selection on exit', () => {
    const { canvas, view } = createView()
    const feature = new BrushHighlightFeature({
      getView: () => view,
      onEntitiesChanged: jest.fn(),
      setOperationCursor: (target, operation) => {
        target.canvas.style.cursor = `${operation}-cursor`
      }
    })
    expect(feature.activate('paint')).toBe(true)
    expect(view.mode).toBe(2)
    expect(canvas.style.cursor).toBe('paint-cursor')
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 1 }))
    expect(canvas.style.cursor).toBe('paint-cursor')
    feature.activate('erase')
    expect(canvas.style.cursor).toBe('erase-cursor')
    feature.deactivate()
    expect(canvas.style.cursor).toBe('crosshair')
    expect(view.mode).toBe(0)
    feature.dispose()
  })

  it('interpolates and reports each hit once per stroke without owning highlight state', () => {
    const { canvas, view } = createView()
    const onEntitiesChanged = jest.fn()
    const onStrokeStarted = jest.fn()
    const onStrokeEnded = jest.fn()
    const feature = new BrushHighlightFeature({
      getView: () => view, onEntitiesChanged, onStrokeStarted, onStrokeEnded
    })
    feature.activate('paint')
    canvas.dispatchEvent(pointer('pointerdown', 0))
    canvas.dispatchEvent(pointer('pointermove', 20))
    canvas.dispatchEvent(pointer('pointerup', 20, 0))
    expect(onEntitiesChanged.mock.calls).toEqual([
      ['paint', ['A']], ['paint', ['B']], ['paint', ['C']]
    ])
    expect(onStrokeStarted).toHaveBeenCalledWith('paint')
    expect(onStrokeEnded).toHaveBeenCalledTimes(1)
    expect(canvas.releasePointerCapture).toHaveBeenCalledTimes(1)
    feature.dispose()
  })

  it('reports an existing object again on a new stroke so it can be recolored', () => {
    const { canvas, view } = createView()
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({ getView: () => view, onEntitiesChanged })
    feature.activate('paint')
    stroke(canvas, 0)
    stroke(canvas, 0)
    expect(onEntitiesChanged.mock.calls).toEqual([
      ['paint', ['A']], ['paint', ['A']]
    ])
    feature.dispose()
  })

  it('reports every picked entity, not just the first hit under the brush', () => {
    const { canvas, view } = createView()
    const pick = jest.fn(() => ['A', 'B', 'A', 'C'].map(id => ({
      id, minX: 0, minY: 0, maxX: 1, maxY: 1
    })))
    view.pick = pick
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({ getView: () => view, onEntitiesChanged })
    feature.activate('paint')
    stroke(canvas, 0)
    expect(pick).toHaveBeenCalledWith({ x: 0, y: 0 }, 8, false)
    expect(onEntitiesChanged).toHaveBeenCalledTimes(1)
    expect(onEntitiesChanged).toHaveBeenCalledWith('paint', ['A', 'B', 'C'])
    feature.dispose()
  })

  it('feeds interpolated brush hits into debug and reports unavailable locators', () => {
    const { canvas, view } = createView()
    const host = document.createElement('div')
    const createOverlay = jest.fn(() => ({ dispose: jest.fn(), setVisible: jest.fn() }))
    const debug = new ValveDebugFeature({
      enabled: false,
      brushDebugEnabled: true,
      panelHost: host,
      graphDocument: {},
      getView: () => undefined,
      resolveObjectId: key => key,
      resolveHandleKeys: id => [String(id)],
      isBrushProtectedObject: id => id === 'B',
      createOverlay,
      getLabels: defaultValveDebugLabels,
      getLocale: () => 'en'
    })
    const feature = new BrushHighlightFeature({
      getView: () => view,
      onEntitiesChanged: (operation, ids) => debug.recordBrushEntities(operation, ids)
    })
    feature.activate('paint')
    canvas.dispatchEvent(pointer('pointerdown', 0))
    canvas.dispatchEvent(pointer('pointermove', 20))
    canvas.dispatchEvent(pointer('pointerup', 20, 0))
    expect([...host.querySelectorAll<HTMLElement>('[data-entity-id]')].map(row => row.dataset.entityId))
      .toEqual(['A', 'C'])
    stroke(canvas, 0)
    expect(host.querySelectorAll('[data-entity-id]')).toHaveLength(2)
    feature.activate('erase')
    stroke(canvas, 20)
    const row = host.querySelector<HTMLButtonElement>('[data-entity-id="C"]')!
    expect(row.textContent).toContain('Eraser hit')
    row.click()
    expect(row.textContent).toContain('Cannot locate')
    expect(createOverlay).not.toHaveBeenCalled()
    feature.dispose()
    debug.dispose()
  })

  it('reports unpainted eraser hits to the correction model without changing selection', () => {
    const { canvas, view, selectedIds } = createView()
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({ getView: () => view, onEntitiesChanged })
    feature.activate('erase')
    stroke(canvas, 0)
    expect(onEntitiesChanged).toHaveBeenCalledWith('erase', ['A'])
    expect([...selectedIds]).toEqual(['A'])
    feature.dispose()
  })

  it.each(['pointercancel', 'lostpointercapture', 'escape', 'deactivate', 'reset'])(
    'finishes the current stroke exactly once on %s',
    end => {
      const { canvas, view } = createView()
      const onStrokeEnded = jest.fn()
      const feature = new BrushHighlightFeature({
        getView: () => view, onEntitiesChanged: jest.fn(), onStrokeEnded
      })
      feature.activate('paint')
      canvas.dispatchEvent(pointer('pointerdown'))
      if (end === 'escape') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      } else if (end === 'deactivate') {
        feature.deactivate()
      } else if (end === 'reset') {
        feature.reset()
      } else {
        canvas.dispatchEvent(pointer(end))
      }
      canvas.dispatchEvent(pointer('pointerup', 0, 0))
      feature.dispose()
      expect(onStrokeEnded).toHaveBeenCalledTimes(1)
    }
  )

  it('finishes painting before changing to erasing and ignores movement until the next stroke', () => {
    const { canvas, view } = createView()
    const events: string[] = []
    const feature = new BrushHighlightFeature({
      getView: () => view,
      onStrokeStarted: operation => events.push(`start:${operation}`),
      onStrokeEnded: () => events.push('end'),
      onEntitiesChanged: operation => events.push(`hit:${operation}`)
    })
    feature.activate('paint')
    canvas.dispatchEvent(pointer('pointerdown'))
    feature.activate('erase')
    canvas.dispatchEvent(pointer('pointermove', 10))
    stroke(canvas, 10)
    expect(events).toEqual([
      'start:paint', 'hit:paint', 'end', 'start:erase', 'hit:erase', 'end'
    ])
    feature.dispose()
  })

  it('toggles off and detaches disposed listeners', () => {
    const { canvas, view } = createView()
    const onActiveChanged = jest.fn()
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({
      getView: () => view, onEntitiesChanged, onActiveChanged
    })
    feature.activate('paint')
    expect(feature.activate('paint')).toBe(false)
    stroke(canvas, 0)
    expect(onEntitiesChanged).not.toHaveBeenCalled()
    expect(onActiveChanged).toHaveBeenCalledTimes(2)
    feature.dispose()
    expect(feature.activate('paint')).toBe(false)
    stroke(canvas, 0)
    expect(onEntitiesChanged).not.toHaveBeenCalled()
  })

  it('freezes a style source per stroke and submits only once at stroke completion', () => {
    const { canvas, view } = createView()
    const state = new ManualHighlightCorrectionState()
    let utilityId = 'water'
    let strokeStyle: string = 'water'
    const submit = jest.fn()
    const render = jest.fn()
    const scheduleFrame = jest.fn(() => 1)
    const cancelFrame = jest.fn()
    const scheduler = new HighlightRenderScheduler<string>(render, scheduleFrame, cancelFrame)
    const apply = (operation: BrushOperation, ids: readonly string[]) => {
      const changed = operation === 'paint'
        ? state.paint(ids, strokeStyle)
        : state.erase(ids.map(handleKey => ({ handleKey, hasAutomaticFlow: false })))
      if (changed) scheduler.schedule(ids)
    }
    const feature = new BrushHighlightFeature({
      getView: () => view,
      onStrokeStarted: () => {
        state.beginStroke()
        strokeStyle = utilityId
      },
      onEntitiesChanged: apply,
      onStrokeEnded: () => {
        scheduler.flush()
        if (state.endStroke()) submit(state.snapshot())
      }
    })
    feature.activate('paint')
    canvas.dispatchEvent(pointer('pointerdown', 0))
    expect(feature.isDrawing).toBe(true)
    utilityId = 'steam'
    canvas.dispatchEvent(pointer('pointermove', 10))
    expect(submit).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
    expect(scheduleFrame).toHaveBeenCalledTimes(1)
    canvas.dispatchEvent(pointer('pointerup', 10, 0))
    expect(feature.isDrawing).toBe(false)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledTimes(1)
    expect([...render.mock.calls[0][0]]).toEqual(['A', 'B'])
    expect(state.snapshot().additions.map(item => item.highlightStyleRefId)).toEqual([
      'water',
      'water'
    ])
    stroke(canvas, 0)
    expect(state.getAddition('A')?.highlightStyleRefId).toEqual('steam')
    expect(state.getAddition('B')?.highlightStyleRefId).toEqual('water')
    expect(state.undo()).toBe(true)
    expect(state.getAddition('A')?.highlightStyleRefId).toEqual('water')
    expect(state.undo()).toBe(true)
    expect(state.additionCount).toBe(0)
    expect(state.canUndo).toBe(false)
    feature.dispose()
  })
})
