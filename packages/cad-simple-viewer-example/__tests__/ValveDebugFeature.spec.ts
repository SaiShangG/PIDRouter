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

  it('enables and disables debug interactions without losing valve state', () => {
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
      enabled: false,
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

    const menu = document.querySelector<HTMLDivElement>('.valve-debug-context-menu')!
    feature.attach()
    const disabledEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    canvas.dispatchEvent(disabledEvent)
    expect(disabledEvent.defaultPrevented).toBe(false)
    expect(menu.hidden).toBe(true)
    expect(feature.panel.element.hidden).toBe(true)

    feature.setEnabled(true)
    expect(feature.panel.element.hidden).toBe(false)
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
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

    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    feature.setEnabled(false)
    expect(menu.hidden).toBe(true)
    expect(feature.panel.element.hidden).toBe(true)
    expect(overlays.every(item => item.disposed)).toBe(true)
    feature.attach()
    feature.resize()
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(menu.hidden).toBe(true)
    expect(overlays.every(item => item.disposed)).toBe(true)
    feature.setEnabled(true)
    feature.setEnabled(true)
    expect(feature.panel.element.hidden).toBe(false)
    expect(host.querySelector('.valve-debug-tree-label')?.textContent).toBe('1')

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

  it.each([undefined, 'running'])('requires an explicit state selection with current state=%s', currentStateKey => {
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
    const alternateState = {
      ...configuredState,
      id: 'state-idle',
      key: 'idle',
      displayName: 'Idle',
      color: 0xffcc00,
      order: 1
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
      getConfiguredStates: () => [configuredState, alternateState],
      getConfiguredStateKey: () => currentStateKey,
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
    const stateRadios = document.querySelectorAll<HTMLInputElement>(
      '[data-valve-state-radio="true"]'
    )
    const utilitySelect = document.querySelector<HTMLSelectElement>(
      '[data-valve-utility-select="true"]'
    )!
    expect(stateRadios).toHaveLength(2)
    expect([...stateRadios].every(input => !input.checked)).toBe(true)
    const applyButton = document.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!
    expect(applyButton.disabled).toBe(true)
    applyButton.click()
    expect(requestConfiguredStateChange).not.toHaveBeenCalled()
    expect(stateRadios[0].parentElement?.textContent).toContain('Running')
    stateRadios[1].click()
    expect(applyButton.disabled).toBe(false)
    expect(stateRadios[0].checked).toBe(false)
    expect(stateRadios[1].checked).toBe(true)
    expect(utilitySelect.options).toHaveLength(1)
    expect(utilitySelect.value).toBe('process-water')
    document
      .querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!
      .click()

    expect(requestConfiguredStateChange).toHaveBeenCalledWith(
      '1',
      alternateState,
      'process-water'
    )
    expect(onStateChanged).not.toHaveBeenCalled()
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(document.querySelector('input[data-valve-state-radio="true"]:checked')).toBeNull()
    expect(applyButton.disabled).toBe(true)
    feature.dispose()
  })

  it.each([true, false])('opens configured states for a dynamically resolved PP device with debug enabled=%s', enabled => {
    const host = document.createElement('div')
    document.body.append(host)
    const canvas = document.createElement('canvas')
    const configuredState = {
      id: 'state-running',
      key: 'running',
      displayName: 'Running',
      color: 0x00ff00,
      lineWidthPx: 3,
      opacity: 1,
      enabled: true,
      autoHighlightFlow: false,
      flowBehavior: 'neutral' as const,
      order: 0
    }
    const requestConfiguredStateChange = jest.fn(() => true)
    const feature = new ValveDebugFeature({
      enabled,
      panelHost: host,
      graphDocument: {
        Areas: [{
          Id: 'A-1',
          ControlModules: [{ CadHandle: 2, Id: 'PP-1', Name: 'PP' }]
        }],
        Map: { Graph: { Vertices: [2], Edges: [] } }
      },
      getView: () => ({
        canvas,
        width: 100,
        height: 100,
        viewportToCanvas: point => point,
        pick: () => [{ id: 'PP1' }],
        screenToWorld: point => point,
        zoomTo: () => undefined,
        isDirty: false
      }),
      resolveObjectId: key => key,
      resolveHandleKeys: () => ['2'],
      createOverlay: () => null,
      getLabels: locale => defaultValveDebugLabels(locale),
      getLocale: () => 'en',
      resolveConfiguredDeviceKey: () => '2',
      getConfiguredStates: () => [configuredState],
      requestConfiguredStateChange
    })

    feature.attach()
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })
    )

    expect(document.querySelector<HTMLDivElement>('.valve-debug-context-menu')?.hidden).toBe(false)
    expect(document.body.textContent).toContain('Device state')
    expect(document.body.textContent).toContain('Running')
    expect(feature.panel.element.hidden).toBe(!enabled)
    document.querySelector<HTMLInputElement>('[data-valve-state-radio="true"]')!.click()
    document.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!.click()
    expect(requestConfiguredStateChange).toHaveBeenCalledWith('2', configuredState, undefined)

    feature.setEnabled(!enabled)
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(document.querySelector<HTMLDivElement>('.valve-debug-context-menu')?.hidden).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector<HTMLDivElement>('.valve-debug-context-menu')?.hidden).toBe(true)
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
    document.querySelector<HTMLInputElement>('[data-valve-state-radio="true"]')!.click()
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
