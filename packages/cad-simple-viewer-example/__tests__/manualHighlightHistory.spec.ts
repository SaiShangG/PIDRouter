import { ManualHighlightCorrectionState } from '../src/phase/manualHighlightCorrections'
import type { FlowPathStyleSource } from '../src/phase/types'

const water: FlowPathStyleSource = { kind: 'utility', utilityId: 'water' }
const steam: FlowPathStyleSource = { kind: 'utility', utilityId: 'steam' }

const paintStroke = (
  state: ManualHighlightCorrectionState,
  handles: string[],
  source: FlowPathStyleSource = water
) => {
  state.beginStroke()
  state.paint(handles, source)
  return state.endStroke()
}

describe('manual correction history', () => {
  it('groups all samples in a stroke into one undo and redo operation', () => {
    const state = new ManualHighlightCorrectionState()
    state.beginStroke()
    state.paint(['A'], water)
    state.paint(['B'], water)
    state.paint(['C'], water)
    expect(state.canUndo).toBe(false)
    expect(state.endStroke()).toBe(true)
    const painted = state.snapshot()
    expect(state.additionCount).toBe(3)
    expect(state.undo()).toBe(true)
    expect(state.snapshot()).toEqual({ additions: [], exclusions: [] })
    expect(state.undo()).toBe(false)
    expect(state.redo()).toBe(true)
    expect(state.snapshot()).toEqual(painted)
    expect(state.redo()).toBe(false)
  })

  it('restores recoloring, exclusions and overlap exactly', () => {
    const state = new ManualHighlightCorrectionState()
    paintStroke(state, ['A', 'B'])
    paintStroke(state, ['A'], steam)
    const recolored = state.snapshot()
    state.beginStroke()
    state.erase([
      { handleKey: 'A', hasAutomaticFlow: true },
      { handleKey: 'B', hasAutomaticFlow: false }
    ])
    state.endStroke()
    expect(state.additionCount).toBe(0)
    expect(state.exclusionCount).toBe(1)
    const erased = state.snapshot()
    state.undo()
    expect(state.snapshot()).toEqual(recolored)
    state.undo()
    expect(state.getAddition('A')?.styleSource).toEqual(water)
    state.redo()
    expect(state.getAddition('A')?.styleSource).toEqual(steam)
    state.redo()
    expect(state.snapshot()).toEqual(erased)
  })

  it('does not create entries or discard redo for empty and no-op strokes', () => {
    const state = new ManualHighlightCorrectionState()
    paintStroke(state, ['A'])
    state.undo()
    state.beginStroke()
    expect(state.endStroke()).toBe(false)
    state.beginStroke()
    state.erase([{ handleKey: 'B', hasAutomaticFlow: false }])
    expect(state.endStroke()).toBe(false)
    expect(state.canRedo).toBe(true)
    state.redo()
    expect(paintStroke(state, ['A'])).toBe(false)
    expect(state.undo()).toBe(true)
    expect(state.canUndo).toBe(false)
  })

  it('discards redo only after a new changed stroke', () => {
    const state = new ManualHighlightCorrectionState()
    paintStroke(state, ['A'])
    state.undo()
    expect(state.canRedo).toBe(true)
    paintStroke(state, ['B'])
    expect(state.canRedo).toBe(false)
    expect(state.redo()).toBe(false)
    expect(state.additionHandleKeys).toEqual(['B'])
  })

  it('ignores net-zero changes and entry ordering', () => {
    const state = new ManualHighlightCorrectionState()
    state.restore({
      additions: [
        { handleKey: 'A', styleSource: water },
        { handleKey: 'B', styleSource: steam }
      ],
      exclusions: []
    })
    state.beginStroke()
    state.erase([{ handleKey: 'A', hasAutomaticFlow: false }])
    state.paint(['A'], water)
    expect(state.endStroke()).toBe(false)
    expect(state.canUndo).toBe(false)
  })

  it('clears both history stacks when switching/restoring a phase', () => {
    const state = new ManualHighlightCorrectionState()
    paintStroke(state, ['A'])
    paintStroke(state, ['B'])
    state.undo()
    expect(state.canUndo).toBe(true)
    expect(state.canRedo).toBe(true)
    state.restore({
      additions: [{ handleKey: 'C', styleSource: steam }],
      exclusions: ['D']
    })
    expect(state.canUndo).toBe(false)
    expect(state.canRedo).toBe(false)
    expect(state.undo()).toBe(false)
    expect(state.getAddition('C')?.styleSource).toEqual(steam)
    expect(state.isExcluded('D')).toBe(true)
  })

  it('clears corrections and history without allowing old operations to revive marks', () => {
    const state = new ManualHighlightCorrectionState()
    paintStroke(state, ['A'])
    state.beginStroke()
    state.erase([{ handleKey: 'B', hasAutomaticFlow: true }])
    state.endStroke()
    state.undo()
    state.clear()
    expect(state.snapshot()).toEqual({ additions: [], exclusions: [] })
    expect(state.additionCount).toBe(0)
    expect(state.exclusionCount).toBe(0)
    expect(state.undo()).toBe(false)
    expect(state.redo()).toBe(false)
  })

  it('keeps custom style snapshots independent from inputs and exported snapshots', () => {
    const state = new ManualHighlightCorrectionState()
    const source: FlowPathStyleSource = {
      kind: 'custom',
      style: { color: 0x123456, lineWidthPx: 4, opacity: 0.5, visible: true }
    }
    paintStroke(state, ['A'], source)
    source.style.color = 0
    const exported = state.snapshot()
    const custom = exported.additions[0].styleSource
    if (custom.kind !== 'custom') throw new Error('Expected custom source')
    custom.style.color = 0xffffff
    state.undo()
    state.redo()
    expect(state.getAddition('A')?.styleSource).toEqual({
      kind: 'custom',
      style: { color: 0x123456, lineWidthPx: 4, opacity: 0.5, visible: true }
    })
  })

  it('rejects nested strokes and completes interrupted strokes once', () => {
    const state = new ManualHighlightCorrectionState()
    state.beginStroke()
    expect(() => state.beginStroke()).toThrow('already active')
    state.paint(['A'], water)
    expect(state.endStroke()).toBe(true)
    expect(state.endStroke()).toBe(false)
    state.undo()
    expect(state.canUndo).toBe(false)
  })

  it('counts normalized distinct handles, including unresolved saved corrections', () => {
    const state = new ManualHighlightCorrectionState()
    state.restore({
      additions: [
        { handleKey: '00ab', styleSource: water },
        { handleKey: 'AB', styleSource: steam },
        { handleKey: 'DEAD', styleSource: water }
      ],
      exclusions: ['00CD', 'CD']
    })
    expect(state.additionCount).toBe(2)
    expect(state.exclusionCount).toBe(1)
  })
})
