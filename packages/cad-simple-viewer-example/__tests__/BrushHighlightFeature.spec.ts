/** @jest-environment jsdom */

import type { AcEdBaseView } from '@mlightcad/cad-simple-viewer'
import type { AcDbObjectId } from '@mlightcad/data-model'

import {
  BrushHighlightFeature,
  type BrushOperation
} from '../src/brush/BrushHighlightFeature'
import type { ResolvedEntityPresentation } from '../src/presentation/presentationStyleResolver'

jest.mock('@mlightcad/cad-simple-viewer', () => ({
  AcEdCorsorType: { Crosshair: 0 },
  AcEdViewMode: { SELECTION: 0, PAN: 1, BRUSH: 2 }
}))

const SELECTION_VIEW_MODE = 0
const BRUSH_VIEW_MODE = 2

const createPointerEvent = (
  type: string,
  clientX: number,
  clientY: number,
  buttons: number
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: 0 },
    buttons: { value: buttons },
    clientX: { value: clientX },
    clientY: { value: clientY },
    isPrimary: { value: true },
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' }
  })
  return event
}

const createView = () => {
  const canvas = document.createElement('canvas')
  const selectedIds = new Set<AcDbObjectId>()
  const selectionRemovedListeners = new Set<
    (args: { ids: AcDbObjectId[] }) => void
  >()
  const selectionSet = {
    has: (id: AcDbObjectId) => selectedIds.has(id),
    add: (id: AcDbObjectId) => selectedIds.add(id),
    remove: (id: AcDbObjectId) => {
      selectedIds.delete(id)
      selectionRemovedListeners.forEach(listener => listener({ ids: [id] }))
    },
    events: {
      selectionRemoved: {
        addEventListener: (listener: (args: { ids: AcDbObjectId[] }) => void) =>
          selectionRemovedListeners.add(listener),
        removeEventListener: (listener: (args: { ids: AcDbObjectId[] }) => void) =>
          selectionRemovedListeners.delete(listener)
      }
    }
  }
  const overlays: Array<{
    ids: AcDbObjectId[]
    style: ResolvedEntityPresentation
    disposed: boolean
  }> = []
  let mode = SELECTION_VIEW_MODE
  let cursor = 0

  const view = {
    canvas,
    editor: { get currentCursor() { return cursor } },
    get mode() {
      return mode
    },
    set mode(value: number) {
      mode = value
    },
    selectionSet,
    viewportToCanvas: (point: { x: number; y: number }) => point,
    screenToWorld: (point: { x: number; y: number }) => point,
    pick: (point: { x: number; y: number }) => {
      if (point.x < 8) return [{ id: 'A' }]
      if (point.x < 16) return [{ id: 'B' }]
      return [{ id: 'C' }]
    },
    setCursor: (value: number) => {
      cursor = value
      canvas.style.cursor = value === 0 ? 'crosshair' : `cursor-${value}`
    }
  } as unknown as AcEdBaseView

  return { canvas, view, overlays, selectionSet }
}

describe('BrushHighlightFeature', () => {
  it('uses an operation-specific cursor and restores it after deactivation', () => {
    const { canvas, view } = createView()
    const cursors: Record<BrushOperation, string> = {
      paint: 'brush-cursor',
      erase: 'eraser-cursor'
    }
    const feature = new BrushHighlightFeature({
      getView: () => view,
      getHighlightStyle: () => ({
        key: 'purple-flow',
        color: 0x9c27b0,
        lineWidthPx: 3.5,
        opacity: 1,
        visible: true,
        source: 'default'
      }),
      createOverlay: () => null,
      setOperationCursor: (cursorView, operation) => {
        cursorView.canvas.style.cursor = cursors[operation]
      }
    })

    expect(feature.activate('paint')).toBe(true)
    expect(canvas.style.cursor).toBe('brush-cursor')

    expect(feature.activate('erase')).toBe(true)
    expect(canvas.style.cursor).toBe('eraser-cursor')

    feature.deactivate()
    expect(canvas.style.cursor).toBe('crosshair')
  })

  it('highlights interpolated hits and erases only brush highlights', () => {
    const { canvas, view, overlays } = createView()
    const feature = new BrushHighlightFeature({
      getView: () => view,
      getHighlightStyle: () => ({
        key: 'purple-flow',
        color: 0x9c27b0,
        lineWidthPx: 3.5,
        opacity: 1,
        visible: true,
        source: 'default'
      }),
      createOverlay: (ids, style) => {
        const overlay = { ids: [...ids], style, disposed: false }
        overlays.push(overlay)
        return { dispose: () => { overlay.disposed = true } }
      }
    })

    expect(feature.activate('paint')).toBe(true)
    canvas.dispatchEvent(createPointerEvent('pointerdown', 0, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointermove', 20, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 20, 0, 0))

    expect(feature.highlightedIds).toEqual(['A', 'B', 'C'])
    const activeOverlay = overlays.filter(item => !item.disposed)
    expect(activeOverlay[activeOverlay.length - 1]).toMatchObject({
      ids: ['A', 'B', 'C'],
      style: { color: 0x9c27b0, lineWidthPx: 3.5 }
    })
    expect(view.mode).toBe(BRUSH_VIEW_MODE)

    expect(feature.activate('erase')).toBe(true)
    canvas.dispatchEvent(createPointerEvent('pointerdown', 10, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 10, 0, 0))

    expect(feature.highlightedIds).toEqual(['A', 'C'])
    const activeOverlayAfterErase = overlays.filter(item => !item.disposed)
    expect(activeOverlayAfterErase[activeOverlayAfterErase.length - 1]?.ids).toEqual(['A', 'C'])
    feature.deactivate()
    expect(view.mode).toBe(SELECTION_VIEW_MODE)
  })

  it('reports painted and erased hit objects to the host', () => {
    const { canvas, view } = createView()
    const changes: Array<{ operation: BrushOperation; ids: AcDbObjectId[] }> = []
    const feature = new BrushHighlightFeature({
      getView: () => view,
      getHighlightStyle: () => ({
        key: 'purple-flow',
        color: 0x9c27b0,
        lineWidthPx: 3.5,
        opacity: 1,
        visible: true,
        source: 'default'
      }),
      createOverlay: () => null,
      onEntitiesChanged: (operation, ids) => {
        changes.push({ operation, ids: [...ids] })
      }
    })

    feature.activate('paint')
    canvas.dispatchEvent(createPointerEvent('pointerdown', 0, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 0, 0, 0))

    feature.activate('erase')
    canvas.dispatchEvent(createPointerEvent('pointerdown', 10, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 10, 0, 0))

    expect(changes).toEqual([
      { operation: 'paint', ids: ['A'] },
      { operation: 'erase', ids: ['B'] }
    ])
    feature.dispose()
  })

  it('does not remove a normal selection highlight while erasing', () => {
    const { canvas, view, overlays, selectionSet } = createView()
    const feature = new BrushHighlightFeature({
      getView: () => view,
      getHighlightStyle: () => ({
        key: 'purple-flow',
        color: 0x9c27b0,
        lineWidthPx: 3.5,
        opacity: 1,
        visible: true,
        source: 'default'
      }),
      createOverlay: (ids, style) => {
        const overlay = { ids: [...ids], style, disposed: false }
        overlays.push(overlay)
        return { dispose: () => { overlay.disposed = true } }
      }
    })

    feature.activate('paint')
    canvas.dispatchEvent(createPointerEvent('pointerdown', 0, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 0, 0, 0))
    selectionSet.add('A')

    feature.activate('erase')
    canvas.dispatchEvent(createPointerEvent('pointerdown', 0, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 0, 0, 0))

    expect(feature.highlightedIds).toEqual([])
    expect(overlays.filter(item => !item.disposed)).toHaveLength(0)
    feature.dispose()
  })

  it('exits on Escape and keeps painted highlights', () => {
    const { canvas, view, overlays } = createView()
    const feature = new BrushHighlightFeature({
      getView: () => view,
      getHighlightStyle: () => ({
        key: 'purple-flow',
        color: 0x9c27b0,
        lineWidthPx: 3.5,
        opacity: 1,
        visible: true,
        source: 'default'
      }),
      createOverlay: (ids, style) => {
        const overlay = { ids: [...ids], style, disposed: false }
        overlays.push(overlay)
        return { dispose: () => { overlay.disposed = true } }
      }
    })

    feature.activate('paint')
    canvas.dispatchEvent(createPointerEvent('pointerdown', 20, 0, 1))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(feature.isActive).toBe(false)
    expect(feature.highlightedIds).toEqual(['C'])
    expect(view.mode).toBe(SELECTION_VIEW_MODE)
    const activeOverlay = overlays.filter(item => !item.disposed)
    expect(activeOverlay[activeOverlay.length - 1]?.style.color).toBe(0x9c27b0)
    feature.dispose()
  })

  it('freezes the style for each stroke when presets change', () => {
    const { canvas, view, overlays } = createView()
    let color = 0x112233
    const feature = new BrushHighlightFeature({
      getView: () => view,
      getHighlightStyle: () => ({
        key: color.toString(16),
        color,
        lineWidthPx: 3,
        opacity: 1,
        visible: true,
        source: 'utility'
      }),
      createOverlay: (ids, style) => {
        const overlay = { ids: [...ids], style, disposed: false }
        overlays.push(overlay)
        return { dispose: () => { overlay.disposed = true } }
      }
    })

    feature.activate('paint')
    canvas.dispatchEvent(createPointerEvent('pointerdown', 0, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 0, 0, 0))
    color = 0x445566
    canvas.dispatchEvent(createPointerEvent('pointerdown', 10, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 10, 0, 0))

    const activeOverlays = overlays.filter(item => !item.disposed)
    expect(activeOverlays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ids: ['A'], style: expect.objectContaining({ color: 0x112233 }) }),
        expect.objectContaining({ ids: ['B'], style: expect.objectContaining({ color: 0x445566 }) })
      ])
    )
    feature.dispose()
  })

  it('uses an object-specific valve style while painting the surrounding flow', () => {
    const { canvas, view, overlays } = createView()
    const flowStyle: ResolvedEntityPresentation = {
      key: 'flow',
      color: 0x112233,
      lineWidthPx: 3,
      opacity: 1,
      visible: true,
      source: 'utility'
    }
    const valveStyle: ResolvedEntityPresentation = {
      key: 'valve',
      color: 0x445566,
      lineWidthPx: 4,
      opacity: 1,
      visible: true,
      source: 'device'
    }
    const feature = new BrushHighlightFeature({
      getView: () => view,
      getHighlightStyle: (objectId, fallbackStyle) =>
        objectId === 'B' ? valveStyle : fallbackStyle ?? flowStyle,
      createOverlay: (ids, style) => {
        const overlay = { ids: [...ids], style, disposed: false }
        overlays.push(overlay)
        return { dispose: () => { overlay.disposed = true } }
      }
    })

    feature.activate('paint')
    canvas.dispatchEvent(createPointerEvent('pointerdown', 10, 0, 1))
    canvas.dispatchEvent(createPointerEvent('pointerup', 10, 0, 0))

    const activeOverlays = overlays.filter(item => !item.disposed)
    expect(activeOverlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ ids: ['B'], style: valveStyle })
    ]))
    expect(feature.highlightedIds).toEqual(['B'])
    feature.dispose()
  })
})
