/** @jest-environment jsdom */

import type { AcEdBaseView } from '@mlightcad/cad-simple-viewer'

import {
  BrushHighlightFeature,
  type BrushOperation
} from '../src/brush/BrushHighlightFeature'
import { HighlightRenderScheduler } from '../src/brush/HighlightRenderScheduler'
import { buildFlowGraphIndex } from '../src/flow/flowGraph'
import { defaultValveDebugLabels, ValveDebugFeature } from '../src/flow/ValveDebugFeature'
import { ManualHighlightCorrectionState } from '../src/phase/manualHighlightCorrections'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type { DeviceState, FlowPathStatus } from '../src/phase/types'
import { resolveFlowHighlightLayers } from '../src/presentation/resolveFlowHighlightLayers'

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

  it('toggles valves once per stroke while continuing to paint non-valve entities', () => {
    const { canvas, view } = createView()
    const highlighted = new Set<string>()
    const onEntitiesChanged = jest.fn((operation: BrushOperation, ids: readonly string[]) => {
      ids.forEach(id => operation === 'paint' ? highlighted.add(id) : highlighted.delete(id))
    })
    const feature = new BrushHighlightFeature({
      getView: () => view,
      shouldToggleEntity: id => id === 'A',
      isEntityHighlighted: id => highlighted.has(id),
      onEntitiesChanged
    })
    feature.activate('paint', 'valve-toggle')
    canvas.dispatchEvent(pointer('pointerdown', 0))
    canvas.dispatchEvent(pointer('pointermove', 10))
    canvas.dispatchEvent(pointer('pointermove', 0))
    canvas.dispatchEvent(pointer('pointerup', 0, 0))
    expect(onEntitiesChanged.mock.calls).toEqual([
      ['paint', ['A']], ['paint', ['B']]
    ])
    expect([...highlighted]).toEqual(['A', 'B'])

    onEntitiesChanged.mockClear()
    canvas.dispatchEvent(pointer('pointerdown', 0))
    canvas.dispatchEvent(pointer('pointermove', 10))
    canvas.dispatchEvent(pointer('pointermove', 0))
    canvas.dispatchEvent(pointer('pointerup', 0, 0))
    expect(onEntitiesChanged.mock.calls).toEqual([
      ['erase', ['A']], ['paint', ['B']]
    ])
    expect([...highlighted]).toEqual(['B'])
    stroke(canvas, 0)
    expect(highlighted.has('A')).toBe(true)
    feature.dispose()
  })

  it('separates mixed toggle hits and ignores duplicate picks within one stroke', () => {
    const { canvas, view } = createView()
    view.pick = jest.fn(() => ['A', 'B', 'C', 'A'].map(id => ({
      id, minX: 0, minY: 0, maxX: 1, maxY: 1
    })))
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({
      getView: () => view,
      shouldToggleEntity: id => id !== 'B',
      isEntityHighlighted: id => id !== 'C',
      onEntitiesChanged
    })
    feature.activate('paint', 'valve-toggle')
    stroke(canvas, 0)
    expect(onEntitiesChanged.mock.calls).toEqual([
      ['erase', ['A']], ['paint', ['B', 'C']]
    ])
    feature.dispose()
  })

  it('never applies valve toggling to the standard brush or eraser', () => {
    const { canvas, view } = createView()
    const shouldToggleEntity = jest.fn(() => true)
    const isEntityHighlighted = jest.fn(() => true)
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({
      getView: () => view, shouldToggleEntity, isEntityHighlighted, onEntitiesChanged
    })
    feature.activate('paint')
    stroke(canvas, 0)
    stroke(canvas, 0)
    feature.activate('erase', 'valve-toggle')
    stroke(canvas, 10)
    expect(feature.currentPaintMode).toBe('standard')
    expect(onEntitiesChanged.mock.calls).toEqual([
      ['paint', ['A']], ['paint', ['A']], ['erase', ['B']]
    ])
    expect(shouldToggleEntity).not.toHaveBeenCalled()
    expect(isEntityHighlighted).not.toHaveBeenCalled()
    feature.dispose()
  })

  it('paints normally when the application disallows toggling a hit', () => {
    const { canvas, view } = createView()
    const isEntityHighlighted = jest.fn(() => true)
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({
      getView: () => view,
      shouldToggleEntity: () => false,
      isEntityHighlighted,
      onEntitiesChanged
    })
    feature.activate('paint', 'valve-toggle')
    stroke(canvas, 0)
    expect(onEntitiesChanged).toHaveBeenCalledWith('paint', ['A'])
    expect(isEntityHighlighted).not.toHaveBeenCalled()
    feature.dispose()
  })

  it('finishes the active stroke when switching brush modes and toggles only the same tool off', () => {
    const { canvas, view } = createView()
    const onStrokeEnded = jest.fn()
    const feature = new BrushHighlightFeature({
      getView: () => view, onEntitiesChanged: jest.fn(), onStrokeEnded
    })
    feature.activate('paint')
    canvas.dispatchEvent(pointer('pointerdown'))
    expect(feature.activate('paint', 'valve-toggle')).toBe(true)
    expect(onStrokeEnded).toHaveBeenCalledTimes(1)
    expect(feature.isDrawing).toBe(false)
    expect(feature.currentPaintMode).toBe('valve-toggle')
    expect(view.mode).toBe(2)
    expect(feature.activate('paint')).toBe(true)
    expect(feature.currentPaintMode).toBe('standard')
    expect(feature.activate('paint', 'valve-toggle')).toBe(true)
    expect(feature.activate('paint', 'valve-toggle')).toBe(false)
    expect(view.mode).toBe(0)
    feature.dispose()
  })

  it('keeps only the valve brush enabled while suspending same-drawing phase switches', () => {
    const { canvas, view } = createView()
    const onEntitiesChanged = jest.fn()
    const onStrokeEnded = jest.fn()
    let loading = false
    const feature = new BrushHighlightFeature({
      getView: () => loading ? undefined : view,
      onEntitiesChanged,
      onStrokeEnded,
      setOperationCursor: target => { target.canvas.style.cursor = 'valve-cursor' }
    })
    feature.activate('paint', 'valve-toggle')
    canvas.dispatchEvent(pointer('pointerdown'))
    loading = true
    feature.suspend()
    feature.suspend()
    expect(feature.isEnabled).toBe(true)
    expect(feature.isActive).toBe(false)
    expect(feature.isDrawing).toBe(false)
    expect(onStrokeEnded).toHaveBeenCalledTimes(1)
    expect(view.mode).toBe(0)
    stroke(canvas, 10)
    expect(onEntitiesChanged).toHaveBeenCalledTimes(1)
    expect(feature.resume()).toBe(false)
    expect(feature.isEnabled).toBe(true)

    loading = false
    expect(feature.resume()).toBe(true)
    expect(feature.resume()).toBe(false)
    expect(feature.isActive).toBe(true)
    expect(feature.currentPaintMode).toBe('valve-toggle')
    expect(view.mode).toBe(2)
    expect(canvas.style.cursor).toBe('valve-cursor')
    stroke(canvas, 10)
    expect(onEntitiesChanged.mock.calls).toEqual([
      ['paint', ['A']], ['paint', ['B']]
    ])
    feature.dispose()
  })

  it('rebinds a suspended valve brush to a different drawing without retaining old canvas listeners', () => {
    const first = createView()
    const second = createView()
    let view = first.view
    const onEntitiesChanged = jest.fn()
    const feature = new BrushHighlightFeature({
      getView: () => view, onEntitiesChanged
    })
    feature.activate('paint', 'valve-toggle')
    feature.suspend()
    view = second.view
    feature.attach()
    expect(feature.isEnabled).toBe(true)
    expect(feature.isActive).toBe(false)
    expect(feature.resume()).toBe(true)
    stroke(first.canvas, 0)
    expect(onEntitiesChanged).not.toHaveBeenCalled()
    stroke(second.canvas, 10)
    expect(onEntitiesChanged).toHaveBeenCalledWith('paint', ['B'])
    expect(first.view.mode).toBe(0)
    expect(second.view.mode).toBe(2)
    feature.dispose()
    expect(second.view.mode).toBe(0)
  })

  it('retains the valve brush intent if the attached view is replaced before suspension', () => {
    const first = createView()
    const second = createView()
    let view = first.view
    const feature = new BrushHighlightFeature({
      getView: () => view, onEntitiesChanged: jest.fn()
    })
    feature.activate('paint', 'valve-toggle')
    view = second.view
    feature.attach()
    expect(feature.isEnabled).toBe(true)
    expect(feature.isActive).toBe(false)
    expect(first.view.mode).toBe(0)
    expect(feature.resume()).toBe(true)
    expect(second.view.mode).toBe(2)
    feature.dispose()
  })

  it.each(['paint', 'erase'] as const)('does not resume the ordinary %s tool after a phase switch', operation => {
    const { view } = createView()
    const feature = new BrushHighlightFeature({
      getView: () => view, onEntitiesChanged: jest.fn()
    })
    feature.activate(operation)
    feature.suspend()
    expect(feature.isEnabled).toBe(false)
    expect(feature.resume()).toBe(false)
    expect(view.mode).toBe(0)
    feature.dispose()
  })

  it.each(['escape', 'deactivate', 'toggle off', 'reset', 'dispose'])(
    'cancels the suspended valve brush on %s instead of restoring it later',
    action => {
      const { view } = createView()
      let loading = false
      const feature = new BrushHighlightFeature({
        getView: () => loading ? undefined : view, onEntitiesChanged: jest.fn()
      })
      feature.activate('paint', 'valve-toggle')
      loading = true
      feature.suspend()
      if (action === 'escape') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      } else if (action === 'toggle off') {
        expect(feature.activate('paint', 'valve-toggle')).toBe(false)
      } else if (action === 'reset') {
        feature.reset()
      } else if (action === 'dispose') {
        feature.dispose()
      } else {
        feature.deactivate()
      }
      loading = false
      expect(feature.isEnabled).toBe(false)
      expect(feature.resume()).toBe(false)
      feature.dispose()
    }
  )

  it.each(['paint', 'erase'] as const)('cancels suspended valve continuation when switching to ordinary %s', operation => {
    const { view } = createView()
    const feature = new BrushHighlightFeature({
      getView: () => view, onEntitiesChanged: jest.fn()
    })
    feature.activate('paint', 'valve-toggle')
    feature.suspend()
    expect(feature.activate(operation)).toBe(true)
    expect(feature.currentPaintMode).toBe('standard')
    feature.suspend()
    expect(feature.resume()).toBe(false)
    feature.dispose()
  })

  it('keeps phase highlights and undo history independent while continuing the valve brush', () => {
    const { canvas, view } = createView()
    const phases = [new ManualHighlightCorrectionState(), new ManualHighlightCorrectionState()]
    let phase = phases[0]
    const feature = new BrushHighlightFeature({
      getView: () => view,
      shouldToggleEntity: () => true,
      isEntityHighlighted: id => phase.getAddition(id) !== undefined,
      onStrokeStarted: () => phase.beginStroke(),
      onStrokeEnded: () => { phase.endStroke() },
      onEntitiesChanged: (operation, ids) => {
        if (operation === 'paint') phase.paint(ids, 'steam')
        else phase.erase(ids.map(handleKey => ({ handleKey, hasAutomaticFlow: false })))
      }
    })
    feature.activate('paint', 'valve-toggle')
    stroke(canvas, 0)
    feature.suspend()
    phase = phases[1]
    feature.resume()
    expect(phase.additionCount).toBe(0)
    expect(phase.canUndo).toBe(false)
    stroke(canvas, 0)
    expect(phase.getAddition('A')?.highlightStyleRefId).toBe('steam')
    feature.suspend()
    phase = phases[0]
    feature.resume()
    stroke(canvas, 0)
    expect(phase.additionCount).toBe(0)
    expect(phases[1].additionCount).toBe(1)
    feature.dispose()
  })

  it('toggles saved valve and flow highlights with undo, redo and restored corrections without changing states', () => {
    const { canvas, view } = createView()
    const state = new ManualHighlightCorrectionState()
    const profile = createDefaultPresentationProfile()
    profile.utilities.push({
      id: 'water', name: 'Water', enabled: true, order: 0,
      style: { color: 0x123456, lineWidthPx: 3, opacity: 1, visible: true }
    })
    profile.devices.push({
      id: 'valve', name: 'Valve', order: 0,
      states: [{
        id: 'closed', key: 'CLOSE', displayName: 'Closed', enabled: true,
        color: 0x888888, lineWidthPx: 3, opacity: 1,
        autoHighlightFlow: false, flowBehavior: 'blocking', order: 0
      }]
    })
    const device: DeviceState = {
      key: 'A', stateKey: 'CLOSE', deviceType: 'Valve', highlightStyleRefId: 'closed'
    }
    const flow: FlowPathStatus = {
      id: 'flow', name: 'Flow', handleKeys: ['C'], highlightStyleRefId: 'water'
    }
    const graph = buildFlowGraphIndex({
      Areas: [{
        Id: 'area',
        ControlModules: [{ CadHandle: 10, Name: 'Valve' }, { CadHandle: 12, Name: 'Valve' }],
        ContainCadEntityHandles: [10, 11, 12]
      }],
      Map: { Graph: { Edges: [{ Source: 10, Target: 11 }] } }
    })
    expect(graph.primaryHandleByCadHandle.get('B')).toBe('A')
    const before = JSON.stringify({ device, flow })
    const layers = (id: string) => resolveFlowHighlightLayers(
      profile, id === 'C' ? [flow] : [], id === 'A' ? device : undefined,
      undefined, undefined,
      { addition: state.getAddition(id), excluded: state.isExcluded(id) }
    )
    const feature = new BrushHighlightFeature({
      getView: () => view,
      shouldToggleEntity: id => graph.valveKeys.has(id),
      isEntityHighlighted: id =>
        layers(id).some(layer => layer.style.visible && layer.style.opacity > 0),
      onStrokeStarted: () => state.beginStroke(),
      onStrokeEnded: () => { state.endStroke() },
      onEntitiesChanged: (operation, ids) => {
        if (operation === 'paint') state.paint(ids, 'water')
        else state.erase(ids.map(handleKey => ({
          handleKey, hasAutomaticFlow: handleKey === 'C', hasDeviceHighlight: handleKey === 'A'
        })))
      }
    })
    feature.activate('paint', 'valve-toggle')
    stroke(canvas, 0)
    expect(layers('A')).toEqual([])
    expect(state.snapshot().exclusions).toEqual(['A'])
    stroke(canvas, 0)
    expect(layers('A')[0].id).toBe('manual:flow:A')
    stroke(canvas, 20)
    expect(layers('C')).toEqual([])
    state.undo()
    expect(layers('C')[0].id).toBe('flow')
    state.redo()
    expect(layers('C')).toEqual([])
    state.restore(state.snapshot())
    stroke(canvas, 20)
    expect(layers('C')[0].id).toBe('manual:flow:C')
    stroke(canvas, 10)
    stroke(canvas, 10)
    expect(layers('B')[0].id).toBe('manual:flow:B')
    expect(JSON.stringify({ device, flow })).toBe(before)
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
