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
    expect(host.querySelector('.valve-debug-tree-label')?.textContent).toBe('1')
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

  it('applies a configured state with the first enabled Utility', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const canvas = document.createElement('canvas')
    const requestConfiguredStateChange = jest.fn(() => true)
    const onStateChanged = jest.fn()
    const configuredState = {
      id: 'state-running',
      key: 'running',
      displayName: 'Running',
      color: 0x00ff00,
      lineWidthPx: 3,
      opacity: 0.8,
      enabled: true,
      autoHighlightFlow: true,
      flowBehavior: 'conducting' as const,
      order: 0
    }
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
      getConfiguredStates: () => [configuredState],
      getUtilities: () => [
        {
          id: 'disabled-first',
          name: 'Disabled',
          style: { color: 0x999999, lineWidthPx: 2, opacity: 1, visible: true },
          enabled: false,
          order: 0
        },
        {
          id: 'process-water',
          name: 'Process Water',
          style: { color: 0x0088ff, lineWidthPx: 2, opacity: 1, visible: true },
          enabled: true,
          order: 1
        }
      ],
      requestConfiguredStateChange,
      onStateChanged
    })

    feature.attach()
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })
    )
    const stateSelect = document.querySelector<HTMLSelectElement>(
      '[data-valve-state-select="true"]'
    )!
    const utilitySelect = document.querySelector<HTMLSelectElement>(
      '[data-valve-utility-select="true"]'
    )!
    expect(stateSelect.selectedOptions[0]?.textContent).toBe('Running')
    expect(utilitySelect.options).toHaveLength(1)
    expect(utilitySelect.value).toBe('process-water')
    document
      .querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!
      .click()

    expect(requestConfiguredStateChange).toHaveBeenCalledWith(
      '1',
      configuredState,
      'process-water'
    )
    expect(onStateChanged).not.toHaveBeenCalled()
    feature.dispose()
  })

  it('allows applying a configured state when no Utility is available', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const canvas = document.createElement('canvas')
    const configuredState = {
      id: 'state-closed',
      key: 'closed',
      displayName: 'Closed',
      color: 0xff0000,
      lineWidthPx: 3,
      opacity: 1,
      enabled: true,
      autoHighlightFlow: false,
      flowBehavior: 'blocking' as const,
      order: 0
    }
    const requestConfiguredStateChange = jest.fn(() => true)
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
      getConfiguredStates: () => [configuredState],
      getUtilities: () => [],
      requestConfiguredStateChange
    })

    feature.attach()
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })
    )
    expect(document.body.textContent).toContain(
      'No enabled Utility. The state can be applied without a flow highlight.'
    )
    document
      .querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!
      .click()

    expect(requestConfiguredStateChange).toHaveBeenCalledWith(
      '1',
      configuredState,
      undefined
    )
    feature.dispose()
  })
})
