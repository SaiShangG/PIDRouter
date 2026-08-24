/** @jest-environment jsdom */

import { defaultValveDebugLabels, ValveDebugFeature } from '../src/flow/ValveDebugFeature'
import type { ValveDebugOverlay, ValveDebugView } from '../src/flow/types'

describe('ValveDebugFeature', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addListener: () => undefined, removeListener: () => undefined })
    })
  })

  it('opens a valve from the canvas context menu and updates its path overlay', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const canvas = document.createElement('canvas')
    const overlays: Array<{ ids: readonly string[]; kind: string; disposed: boolean }> = []
    let zoomCalls = 0
    const view: ValveDebugView = {
      canvas,
      width: 100,
      height: 100,
      viewportToCanvas: point => point,
      pick: () => [{ id: 'V1' }],
      screenToWorld: point => point,
      zoomTo: () => undefined,
      isDirty: false
    }
    const feature = new ValveDebugFeature({
      panelHost: host,
      graphDocument: {
        Areas: [{
          Id: 'A-1',
          ControlModules: [{ CadHandle: 1, Id: 'V-1', Name: 'Valve' }],
          ContainCadEntityHandles: [1, 2, 3]
        }],
        Map: {
          Graph: {
            Vertices: [1, 2, 3],
            Edges: [{ Source: 1, Target: 2 }, { Source: 2, Target: 3 }]
          }
        }
      },
      getView: () => view,
      resolveObjectId: key => key,
      resolveHandleKeys: objectId => objectId === 'V1' ? ['2'] : [],
      createOverlay: (ids, kind): ValveDebugOverlay => {
        const overlay = { ids: ids.map(String), kind, disposed: false }
        overlays.push(overlay)
        return { dispose: () => { overlay.disposed = true } }
      },
      zoomToObject: () => {
        zoomCalls++
        return true
      },
      getLabels: locale => defaultValveDebugLabels(locale),
      getLocale: () => 'en'
    })

    feature.attach()
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
    const menu = document.querySelector<HTMLDivElement>('.valve-debug-context-menu')!
    expect(menu.hidden).toBe(false)
    const openButton = menu.querySelector<HTMLButtonElement>('[data-valve-action="open"]')!
    const closeButton = menu.querySelector<HTMLButtonElement>('[data-valve-action="close"]')!
    expect(openButton.textContent).toBe('Open')
    expect(closeButton.textContent).toBe('Close')
    expect(openButton.disabled).toBe(false)
    expect(closeButton.disabled).toBe(true)

    openButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(host.querySelector('.valve-debug-tree-label')?.textContent).toBe('V-1')
    expect(overlays.some(item => item.kind === 'path' && item.ids.includes('1') && item.ids.includes('2'))).toBe(true)
    host.querySelector<HTMLButtonElement>('[data-handle-key="2"]')?.click()
    expect(zoomCalls).toBe(0)

    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
    expect(openButton.textContent).toBe('Open')
    expect(closeButton.textContent).toBe('Close')
    expect(openButton.disabled).toBe(true)
    expect(closeButton.disabled).toBe(false)
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(overlays.find(item => item.kind === 'path')?.disposed).toBe(true)
    feature.dispose()
  })

  it('keeps a valve closed when style selection is canceled', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const canvas = document.createElement('canvas')
    const onStateChanged = jest.fn()
    const feature = new ValveDebugFeature({
      panelHost: host,
      graphDocument: {
        Areas: [{
          Id: 'A-1',
          ControlModules: [{ CadHandle: 1, Id: 'V-1', Name: 'Valve' }]
        }],
        Map: { Graph: { Vertices: [1], Edges: [] } }
      },
      getView: () => ({
        canvas,
        width: 100,
        height: 100,
        viewportToCanvas: point => point,
        pick: () => [{ id: 'V1' }],
        screenToWorld: point => point,
        zoomTo: () => undefined,
        isDirty: false
      }),
      resolveObjectId: key => key,
      resolveHandleKeys: () => ['1'],
      createOverlay: () => null,
      getLabels: locale => defaultValveDebugLabels(locale),
      getLocale: () => 'en',
      requestStateChange: async () => false,
      onStateChanged
    })

    feature.attach()
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })
    )
    document
      .querySelector<HTMLButtonElement>('[data-valve-action="open"]')!
      .click()
    await Promise.resolve()

    expect(onStateChanged).not.toHaveBeenCalled()
    expect(host.querySelector('.valve-debug-tree-label')).toBeNull()
    feature.dispose()
  })
})
