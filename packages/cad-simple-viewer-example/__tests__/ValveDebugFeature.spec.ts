/** @jest-environment jsdom */

import type { DeviceFlowRuntime } from '../src/flow/deviceFlowRuntime'
import { calculateAutomaticFlowPaths, resolveDeviceFlowPolicies } from '../src/flow/deviceFlowRuntime'
import { buildFlowGraphIndex, resolveConfiguredDeviceMatch } from '../src/flow/flowGraph'
import * as flowTraversal from '../src/flow/flowTraversal'
import type { FlowConnectionDocumentInput, ValveDebugOverlay, ValveDebugView } from '../src/flow/types'
import { defaultValveDebugLabels, ValveDebugFeature } from '../src/flow/ValveDebugFeature'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type { DeviceState, DeviceStateStyleDefinition, DeviceStyleDefinition } from '../src/phase/types'

describe('invalid device state menu', () => {
  it.each(['zh', 'en'] as const)('shows the original state and permits explicit repair in %s', initialLocale => {
    let locale = initialLocale
    const graphDocument: FlowConnectionDocumentInput = {
      Areas: [{ ControlModules: [{ CadHandle: 1, Name: 'Valve' }] }],
      Map: { Graph: { Vertices: [1], Edges: [] } }
    }
    const graph = buildFlowGraphIndex(graphDocument)
    const profile = createDefaultPresentationProfile()
    const open: DeviceStateStyleDefinition = {
      id: 'open', key: 'Open', displayName: 'Open', enabled: true,
      color: 0x00c853, lineWidthPx: 3, opacity: 1, order: 0,
      autoHighlightFlow: true, flowBehavior: 'conducting'
    }
    profile.devices = [{ id: 'valve', name: 'Valve', order: 0, states: [open] }]
    let record: DeviceState | undefined = {
      key: '1', deviceType: 'Valve', stateKey: 'Close', highlightStyleRefId: 'deleted-close'
    }
    const original = JSON.stringify(record)
    const host = document.createElement('div')
    document.body.append(host)
    const canvas = document.createElement('canvas')
    const feature = new ValveDebugFeature({
      panelHost: host, graphDocument,
      getView: () => ({
        canvas, width: 100, height: 100, isDirty: false,
        viewportToCanvas: point => point, screenToWorld: point => point,
        pick: () => [{ id: '1' }], zoomTo: () => undefined
      }),
      resolveObjectId: key => key, resolveHandleKeys: () => ['1'],
      createOverlay: () => null,
      getLabels: defaultValveDebugLabels, getLocale: () => locale,
      getConfiguredStates: () => profile.devices[0].states,
      getConfiguredStateKey: () => record?.stateKey,
      getFlowRuntime: () => ({
        policies: resolveDeviceFlowPolicies(graph, profile, record ? [record] : []),
        sourceKeys: new Set<string>()
      }),
      requestConfiguredStateChange: (key, state) => {
        record = { key, deviceType: 'Valve', stateKey: state.key, highlightStyleRefId: state.id }
        return true
      }
    })
    feature.attach()
    const showMenu = () => canvas.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })
    )
    showMenu()
    const warning = document.querySelector<HTMLDivElement>('.valve-debug-context-menu-state-warning')!
    expect(warning.hidden).toBe(false)
    expect(warning.textContent).toContain('Close')
    expect(warning.textContent).toContain(locale === 'zh' ? '已失效' : 'no longer available')
    expect(document.querySelectorAll('[data-valve-state-radio]:checked')).toHaveLength(0)
    expect(JSON.stringify(record)).toBe(original)
    locale = locale === 'zh' ? 'en' : 'zh'
    feature.setLocale(locale)
    expect(warning.textContent).toContain(locale === 'zh' ? '已失效' : 'no longer available')

    profile.devices[0].states = []
    showMenu()
    expect(warning.hidden).toBe(false)
    expect(document.querySelector<HTMLDivElement>('.valve-debug-context-menu-actions')!.hidden)
      .toBe(true)
    expect(document.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!.disabled)
      .toBe(true)
    expect(document.querySelector('[data-valve-state-options]')!.textContent)
      .toContain(locale === 'zh' ? '没有可用状态' : 'No available states')

    profile.devices[0].states = [open]
    showMenu()
    document.querySelector<HTMLInputElement>('[data-valve-state-radio]')!.click()
    document.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!.click()
    showMenu()
    expect(warning.hidden).toBe(true)
    expect(record?.highlightStyleRefId).toBe('open')
    record = undefined
    showMenu()
    expect(warning.hidden).toBe(true)
    feature.dispose()
    host.remove()
  })
})

describe('ValveDebugFeature', () => {
  it('blocks configured menus and stale actions in manual mode and restores them in automatic mode', () => {
    let automatic = true
    const canvas = document.createElement('canvas')
    const host = document.createElement('div')
    document.body.append(host)
    const state: DeviceStateStyleDefinition = {
      id: 'open', key: 'Open', displayName: 'Open', color: 0x00ff00,
      lineWidthPx: 3, opacity: 1, enabled: true, order: 0,
      autoHighlightFlow: true, flowBehavior: 'conducting'
    }
    const pick = jest.fn(() => [{ id: '1' }])
    const request = jest.fn(() => true)
    const feature = new ValveDebugFeature({
      enabled: false, panelHost: host, canChangeState: () => automatic,
      graphDocument: {
        Areas: [{ ControlModules: [{ CadHandle: 1, Name: 'Valve' }] }],
        Map: { Graph: { Vertices: [1], Edges: [] } }
      },
      getView: () => ({
        canvas, width: 100, height: 100, isDirty: false,
        viewportToCanvas: point => point, screenToWorld: point => point,
        pick, zoomTo: () => undefined
      }),
      resolveObjectId: key => key, resolveHandleKeys: () => ['1'],
      getConfiguredStates: () => [state], requestConfiguredStateChange: request,
      getLabels: defaultValveDebugLabels, getLocale: () => 'en',
      createOverlay: () => null
    })
    feature.attach()
    const openMenu = () => canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    openMenu()
    document.querySelector<HTMLInputElement>('[data-valve-state-radio]')!.click()
    const apply = document.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!
    automatic = false
    apply.click()
    expect(request).not.toHaveBeenCalled()
    feature.refreshFlowState({ recompute: false })
    expect(document.querySelector<HTMLDivElement>('.valve-debug-context-menu')!.hidden).toBe(true)
    pick.mockClear()
    openMenu()
    expect(pick).not.toHaveBeenCalled()
    automatic = true
    openMenu()
    document.querySelector<HTMLInputElement>('[data-valve-state-radio]')!.click()
    apply.click()
    expect(request).toHaveBeenCalledTimes(1)
    feature.dispose()
    host.remove()
  })

  it('does not apply an asynchronous legacy state confirmation after entering manual mode', async () => {
    let automatic = true
    let confirm: ((value: boolean) => void) | undefined
    const canvas = document.createElement('canvas')
    const host = document.createElement('div')
    document.body.append(host)
    const changed = jest.fn()
    const feature = new ValveDebugFeature({
      panelHost: host, canChangeState: () => automatic,
      graphDocument: {
        Areas: [{ ControlModules: [{ CadHandle: 1, Name: 'Valve' }] }],
        Map: { Graph: { Vertices: [1], Edges: [] } }
      },
      getView: () => ({
        canvas, width: 100, height: 100, isDirty: false,
        viewportToCanvas: point => point, screenToWorld: point => point,
        pick: () => [{ id: '1' }], zoomTo: () => undefined
      }),
      resolveObjectId: key => key, resolveHandleKeys: () => ['1'],
      requestStateChange: () => new Promise<boolean>(resolve => { confirm = resolve }),
      onStateChanged: changed, createOverlay: () => null,
      getLabels: defaultValveDebugLabels, getLocale: () => 'en'
    })
    feature.attach()
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    document.querySelector<HTMLButtonElement>('[data-valve-action="open"]')!.click()
    expect(confirm).toBeDefined()
    automatic = false
    confirm!(true)
    await Promise.resolve()
    expect(changed).not.toHaveBeenCalled()
    feature.dispose()
    host.remove()
  })

  it.each([false, true])('builds debug trees only on demand with debug enabled=%s', enabled => {
    const graphDocument: FlowConnectionDocumentInput = {
      Areas: [{ ControlModules: [{ CadHandle: 1, Name: 'Valve' }, { CadHandle: 3, Name: 'Valve' }] }],
      Map: { Graph: { Vertices: [1, 2, 3, 4], Edges: [
        { Source: 1, Target: 2 }, { Source: 2, Target: 3 }, { Source: 3, Target: 4 }
      ] } }
    }
    const graph = buildFlowGraphIndex(graphDocument)
    const profile = createDefaultPresentationProfile()
    const preset: DeviceStateStyleDefinition = {
      id: 'run', key: 'RUN', displayName: 'Running', enabled: true,
      color: 0x00ff00, lineWidthPx: 3, opacity: 1, order: 0,
      flowBehavior: 'conducting', autoHighlightFlow: true
    }
    profile.devices = [{ id: 'valve', name: 'Valve', order: 0, states: [preset] }]
    profile.utilities = [{ id: 'water', name: 'Water', enabled: true, order: 0,
      style: { color: 0x00ff00, lineWidthPx: 3, opacity: 1, visible: true } }]
    const records: DeviceState[] = ['1', '3'].map(key => ({
      key, deviceType: 'Valve', stateKey: 'RUN', highlightStyleRefId: 'run'
    }))
    let runtime: DeviceFlowRuntime = {
      policies: resolveDeviceFlowPolicies(graph, profile, records),
      sourceKeys: new Set(['1', '3'])
    }
    const canvas = document.createElement('canvas')
    const host = document.createElement('div')
    document.body.append(host)
    const getRuntime = jest.fn(() => runtime)
    const feature = new ValveDebugFeature({
      enabled, panelHost: host, graphDocument, renderPathOverlay: false,
      getView: () => ({
        canvas, width: 100, height: 100, isDirty: false,
        viewportToCanvas: point => point, screenToWorld: point => point,
        pick: () => [{ id: '1' }], zoomTo: () => undefined
      }),
      resolveObjectId: key => key, resolveHandleKeys: id => [String(id)],
      resolveConfiguredDeviceKey: key => graph.controlModuleByPrimaryHandle.has(key) ? key : undefined,
      getConfiguredStates: () => [preset], getConfiguredStateKey: () => 'RUN',
      getUtilities: () => profile.utilities, getFlowRuntime: getRuntime,
      requestConfiguredStateChange: key => {
        const result = calculateAutomaticFlowPaths(graph, profile, records, [], {
          idPrefix: 'test', name: 'Test'
        })
        runtime = { policies: result.policies,
          sourceKeys: new Set(result.paths.flatMap(path => path.ownerHandleKey ? [path.ownerHandleKey] : [])) }
        feature.refreshFlowState({ activeKey: key })
        return true
      },
      createOverlay: jest.fn(), getLabels: defaultValveDebugLabels, getLocale: () => 'en'
    })
    feature.attach()
    const traversal = jest.spyOn(flowTraversal, 'traverseFlowFromDevice')
    const lightweight = jest.spyOn(flowTraversal, 'collectFlowHighlightKeys')
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    document.querySelector<HTMLInputElement>('[data-valve-state-radio]')!.click()
    document.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!.click()
    expect(lightweight).toHaveBeenCalledTimes(2)
    expect(traversal).toHaveBeenCalledTimes(enabled ? 1 : 0)
    feature.refreshFlowState()
    expect(traversal).toHaveBeenCalledTimes(enabled ? 1 : 0)
    feature.setEnabled(false)
    feature.setEnabled(true)
    expect(traversal).toHaveBeenCalledTimes(enabled ? 2 : 1)
    traversal.mockClear()
    feature.refreshFlowState({ activeKey: '3' })
    expect(traversal).toHaveBeenCalledTimes(1)
    feature.refreshFlowState({ activeKey: '1' })
    expect(traversal).toHaveBeenCalledTimes(1)
    traversal.mockClear()
    runtime = { ...runtime, sourceKeys: new Set() }
    feature.refreshFlowState({ activeKey: '1' })
    expect(traversal).toHaveBeenCalledTimes(1)
    expect(traversal.mock.results[0].value.highlightedKeys.size).toBe(0)
    feature.refreshFlowState({ recompute: false })
    traversal.mockClear()
    feature.setEnabled(false)
    feature.setEnabled(true)
    expect(traversal).not.toHaveBeenCalled()
    feature.refreshFlowState({ activeKey: '3' })
    expect(traversal).toHaveBeenCalledTimes(1)
    expect(host.querySelector('.valve-debug-tree-label')?.textContent).toBe('3')
    feature.dispose()
    traversal.mockRestore()
    lightweight.mockRestore()
  })

  it('uses runtime policies and actual sources for debug, preserving Utility selection and snapshot restoration', () => {
    const graphDocument: FlowConnectionDocumentInput = {
      Areas: [{ ControlModules: [{ CadHandle: 1, Name: 'Valve' }, { CadHandle: 3, Name: 'PP' }] }],
      Map: { Graph: { Vertices: [1, 2, 3, 4], Edges: [
        { Source: 1, Target: 2 }, { Source: 2, Target: 3 }, { Source: 3, Target: 4 }
      ] } }
    }
    const graph = buildFlowGraphIndex(graphDocument)
    const profile = createDefaultPresentationProfile()
    const running: DeviceStateStyleDefinition = {
      id: 'run', key: 'RUN', displayName: 'Running', enabled: true,
      color: 0x00ff00, lineWidthPx: 3, opacity: 1,
      flowBehavior: 'conducting', autoHighlightFlow: true, order: 0
    }
    const neutral: DeviceStateStyleDefinition = {
      ...running, id: 'neutral', key: 'NEUTRAL', displayName: 'Neutral',
      flowBehavior: 'neutral', autoHighlightFlow: true
    }
    profile.devices = [
      { id: 'valve', name: 'Valve', order: 0, states: [running] },
      { id: 'pp', name: 'PP', order: 1, states: [neutral] }
    ]
    profile.utilities = ['first', 'retained'].map((id, order) => ({
      id, name: id, order, enabled: true,
      style: { color: 0x00ff00, lineWidthPx: 3, opacity: 1, visible: true }
    }))
    const records: DeviceState[] = [{
      key: '1', deviceType: 'Valve', stateKey: 'RUN', highlightStyleRefId: 'run'
    }]
    let paths = calculateAutomaticFlowPaths(graph, profile, records, [], {
      idPrefix: 'test', name: 'Test'
    }).paths
    let pickedId = '1'
    const canvas = document.createElement('canvas')
    const host = document.createElement('div')
    document.body.append(host)
    const createOverlay = jest.fn(() => ({ dispose: jest.fn() }))
    const request = jest.fn((key: string, state: DeviceStateStyleDefinition) => {
      const previous = records.findIndex(record => record.key === key)
      const record = { key, deviceType: key === '1' ? 'Valve' : 'PP',
        stateKey: state.key, highlightStyleRefId: state.id }
      if (previous < 0) records.push(record)
      else records[previous] = record
      paths = calculateAutomaticFlowPaths(graph, profile, records, paths, {
        idPrefix: 'test', name: 'Test'
      }).paths
      return true
    })
    const feature = new ValveDebugFeature({
      enabled: true, panelHost: host, graphDocument,
      getView: () => ({
        canvas, width: 100, height: 100, isDirty: false,
        viewportToCanvas: point => point, screenToWorld: point => point,
        pick: () => [{ id: pickedId }], zoomTo: () => undefined
      }),
      resolveObjectId: key => key, resolveHandleKeys: id => [String(id)],
      resolveConfiguredDeviceKey: key => graph.controlModuleByPrimaryHandle.has(key) ? key : undefined,
      getConfiguredStates: key => profile.devices[key === '1' ? 0 : 1].states,
      getConfiguredUtilityId: () => 'retained',
      getUtilities: () => profile.utilities,
      getFlowRuntime: () => ({
        policies: calculateAutomaticFlowPaths(graph, profile, records, paths, {
          idPrefix: 'test', name: 'Test'
        }).policies,
        sourceKeys: new Set(paths.map(path => path.ownerHandleKey!))
      }),
      requestConfiguredStateChange: request, createOverlay,
      getLabels: defaultValveDebugLabels, getLocale: () => 'en'
    })
    feature.attach()
    const selectState = () => {
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
      expect(document.querySelector<HTMLSelectElement>('[data-valve-utility-select]')!.value)
        .toBe('retained')
      document.querySelector<HTMLInputElement>('[data-valve-state-radio]')!.click()
      document.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!.click()
    }
    selectState()
    expect(host.querySelector('[data-handle-key="3"]')?.textContent).toContain('No state / blocked')
    expect(createOverlay).toHaveBeenLastCalledWith(['1', '2'], 'path')

    pickedId = '3'
    selectState()
    expect(paths.map(path => path.ownerHandleKey)).toEqual(['1'])
    expect(createOverlay).toHaveBeenLastCalledWith(['1', '2', '3', '4'], 'path')
    expect(host.querySelector('[data-handle-key="3"]')?.textContent).toContain('Non-blocking / no source')

    profile.devices[1].states = []
    feature.refreshFlowState()
    expect(createOverlay).toHaveBeenLastCalledWith(['1', '2'], 'path')
    pickedId = '1'
    selectState()
    expect(host.querySelector('[data-handle-key="3"]')?.textContent).toContain('Invalid state / blocked')
    const calls = createOverlay.mock.calls.length
    feature.refreshFlowState({ recompute: false })
    expect(host.querySelector('.valve-debug-tree-label')).toBeNull()
    expect(createOverlay.mock.calls).toHaveLength(calls)
    feature.dispose()
  })

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
      resolveHandleKeys: objectId => objectId === 'V1' ? ['1'] : [],
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

  it.each([
    ['Valve', true], ['Valve', false],
    ['Pump', true], ['Pump', false],
    ['PP', true], ['PP', false]
  ] as const)(
    'uses the configured %s Title for interaction and brush protection with debug enabled=%s',
    (name, enabled) => {
      const host = document.createElement('div')
      document.body.append(host)
      const canvas = document.createElement('canvas')
      let pickedId = '2'
      const graphDocument: FlowConnectionDocumentInput = {
        Areas: [{
          Id: 'A-1',
          ControlModules: [{ CadHandle: 1, Name: name }],
          ContainCadEntityHandles: [1, 2]
        }],
        Map: { Graph: { Vertices: [1, 2], Edges: [{ Source: 1, Target: 2 }] } }
      }
      const graph = buildFlowGraphIndex(graphDocument)
      const state: DeviceStateStyleDefinition = {
        id: 'configured-on', key: 'ON', displayName: 'On', color: 0x00ff00,
        lineWidthPx: 3, opacity: 1, enabled: true, autoHighlightFlow: false,
        flowBehavior: 'neutral', order: 0
      }
      const devices: DeviceStyleDefinition[] = [{
        id: 'configured-device', name, states: [state], order: 0
      }]
      const match = (key: string) => resolveConfiguredDeviceMatch(graph, key, devices)
      const requestConfiguredStateChange = jest.fn(() => true)
      const feature = new ValveDebugFeature({
        enabled,
        brushDebugEnabled: true,
        panelHost: host,
        graphDocument,
        getView: () => ({
          canvas, width: 100, height: 100, isDirty: false,
          viewportToCanvas: point => point,
          screenToWorld: point => point,
          pick: () => [{ id: pickedId }],
          zoomTo: () => undefined
        }),
        resolveObjectId: key => key,
        resolveHandleKeys: id => [String(id)],
        isBrushProtectedObject: id => match(String(id)) !== undefined,
        resolveConfiguredDeviceKey: key => match(key)?.handleKey,
        getConfiguredStates: key => match(key)?.device.states ?? [],
        requestConfiguredStateChange,
        createOverlay: () => null,
        getLabels: defaultValveDebugLabels,
        getLocale: () => 'en'
      })
      feature.attach()
      const menu = document.querySelector<HTMLDivElement>('.valve-debug-context-menu')!

      expect(graph.primaryHandleByCadHandle.get('2')).toBe('1')
      const pipeClick = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      canvas.dispatchEvent(pipeClick)
      expect(pipeClick.defaultPrevented).toBe(false)
      expect(menu.hidden).toBe(true)
      feature.recordBrushEntities('paint', ['1', '2'])
      expect([...host.querySelectorAll<HTMLElement>('[data-entity-id]')].map(row => row.dataset.entityId))
        .toEqual(['2'])

      pickedId = '1'
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
      expect(menu.hidden).toBe(false)
      menu.querySelector<HTMLInputElement>('[data-valve-state-radio="true"]')!.click()
      menu.querySelector<HTMLButtonElement>('[data-valve-action="apply-configured"]')!.click()
      expect(requestConfiguredStateChange).toHaveBeenCalledWith('1', state, undefined)

      devices[0].name = 'Unmatched Title'
      const unmatchedClick = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      canvas.dispatchEvent(unmatchedClick)
      expect(unmatchedClick.defaultPrevented).toBe(false)
      expect(menu.hidden).toBe(true)
      feature.recordBrushEntities('paint', ['1'])
      expect(host.querySelector('[data-entity-id="1"]')).not.toBeNull()
      feature.dispose()
    }
  )

  it('does not resolve a connected pipe to a valve in legacy debug mode', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const canvas = document.createElement('canvas')
    const feature = new ValveDebugFeature({
      enabled: true,
      panelHost: host,
      graphDocument: {
        Areas: [{
          Id: 'A-1',
          ControlModules: [{ CadHandle: 1, Name: 'Valve' }],
          ContainCadEntityHandles: [1, 2]
        }],
        Map: { Graph: { Vertices: [1, 2], Edges: [{ Source: 1, Target: 2 }] } }
      },
      getView: () => ({
        canvas, width: 100, height: 100, isDirty: false,
        viewportToCanvas: point => point,
        screenToWorld: point => point,
        pick: () => [{ id: '2' }],
        zoomTo: () => undefined
      }),
      resolveObjectId: key => key,
      resolveHandleKeys: id => [String(id)],
      createOverlay: () => null,
      getLabels: defaultValveDebugLabels,
      getLocale: () => 'en'
    })
    feature.attach()
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(document.querySelector<HTMLDivElement>('.valve-debug-context-menu')!.hidden).toBe(true)
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
