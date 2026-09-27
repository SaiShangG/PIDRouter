import { PhaseSaveState, phaseSaveStatusText } from '../src/phase/phaseSaveState'
import type { PhaseSnapshot } from '../src/phase/types'
import { TextAttachmentPoint } from '../src/phase/types'

const phase = (): PhaseSnapshot => ({
  id: 'phase-1', number: 1, name: 'Rinse', drawing: { kind: 'unassigned' },
  flowState: { flowPaths: [] }, createdAt: 'initial', updatedAt: 'initial'
})

describe('PhaseSaveState', () => {
  it('ignores absent optional fields added by workspace snapshot cloning', () => {
    const tracker = new PhaseSaveState()
    const original = phase()
    original.flowState.flowPaths = [{ id: 'flow', name: 'Flow', handleKeys: ['A'] }]
    tracker.accept(original)
    original.flowState.flowPaths[0].styleSource = undefined
    original.flowState.flowPaths[0].styleOverride = undefined
    expect(tracker.get(original).saved).toBe(true)
    tracker.accept(original)
    expect(tracker.get(original).saved).toBe(true)
  })

  it.each(['zh', 'en'] as const)('describes unsaved sections and save results in %s', locale => {
    const tracker = new PhaseSaveState()
    const original = phase()
    tracker.accept(original)
    expect(phaseSaveStatusText(locale, tracker.get(original))).toBe(locale === 'zh' ? '阶段已保存' : 'Phase saved')
    original.name = 'Edited'
    const dirty = phaseSaveStatusText(locale, tracker.get(original))
    expect(dirty).toContain(locale === 'zh' ? '阶段信息' : 'Phase details')
    expect(dirty).toContain(locale === 'zh' ? '请点击保存' : 'Please click Save')
    tracker.begin(original.id)
    expect(phaseSaveStatusText(locale, tracker.get(original))).toContain(locale === 'zh' ? '正在保存' : 'Saving Phase')
    tracker.finish(original.id, true)
    expect(phaseSaveStatusText(locale, tracker.get(original))).toContain(locale === 'zh' ? '阶段保存失败' : 'Failed to save Phase')
  })

  it('includes order and shared style changes until acknowledged', () => {
    const tracker = new PhaseSaveState()
    const original = phase()
    tracker.accept(original, 1)
    tracker.acceptStyles({ color: 'red' })
    tracker.beginStyles()
    tracker.finishStyles(true)
    expect(tracker.get(original, { styles: { color: 'red' } }).changes).toEqual(['styles'])
    expect(tracker.get(original, { orderIndex: 2, styles: { color: 'blue' } }).changes).toEqual(['order', 'styles'])
    tracker.accept(original, 2)
    tracker.beginStyles()
    tracker.finishStyles(true)
    expect(tracker.get(original, { styles: { color: 'blue' } })).toMatchObject({ saved: false, failed: true })
    tracker.beginStyles()
    tracker.acceptStyles({ color: 'blue' })
    tracker.finishStyles()
    expect(tracker.get(original, { orderIndex: 2, styles: { color: 'blue' } }).saved).toBe(true)
  })

  it('does not report an unknown Phase as saved', () => {
    expect(new PhaseSaveState().get(phase()).saved).toBe(false)
  })

  it('tracks device and text changes independently of highlights', () => {
    const tracker = new PhaseSaveState()
    const original = phase()
    tracker.accept(original)
    original.flowState.deviceStates = { valve: { key: 'A', stateKey: 'open', deviceType: 'valve', highlightStyleRefId: 'open-style' } }
    original.textNotes = [{ id: 'note', contents: 'Check pressure', location: { x: 1, y: 2, z: 0 }, width: 10, height: 2, attachmentPoint: TextAttachmentPoint.TopLeft, visible: true, createdAt: 'now', updatedAt: 'now' }]
    expect(tracker.get(original).changes).toEqual(['devices', 'notes'])
    tracker.accept(original)
    original.textNotes = []
    expect(tracker.get(original).changes).toEqual(['notes'])
  })

  it('tracks each changed section and ignores timestamps', () => {
    const tracker = new PhaseSaveState()
    const original = phase()
    tracker.accept(original)
    expect(tracker.get({ ...original, updatedAt: 'later' }).saved).toBe(true)
    original.name = 'Changed'
    original.drawing = { kind: 'assigned', assetId: 'drawing', displayName: 'PID' }
    original.flowState.flowPaths.push({ id: 'flow', name: 'Flow', handleKeys: ['A'] })
    expect(tracker.get(original).changes).toEqual(['details', 'drawing', 'highlights'])
  })

  it('keeps edits made during a save dirty after that request succeeds', () => {
    const tracker = new PhaseSaveState()
    const original = phase()
    tracker.accept(original)
    const submitted = { ...original, name: 'First edit' }
    tracker.begin(original.id)
    expect(tracker.get(original).saved).toBe(false)
    tracker.accept(submitted)
    tracker.finish(original.id)
    expect(tracker.get({ ...submitted, name: 'Second edit' }).changes).toEqual(['details'])
    expect(tracker.get(submitted).saved).toBe(true)
  })

  it('retains dirty state after failure and clears it only on successful retry', () => {
    const tracker = new PhaseSaveState()
    const original = phase()
    tracker.accept(original)
    const changed = { ...original, tankId: 'tank-2' }
    tracker.begin(changed.id)
    tracker.finish(changed.id, true)
    expect(tracker.get(changed)).toMatchObject({ failed: true, saved: false, changes: ['details'] })
    tracker.begin(changed.id)
    tracker.accept(changed)
    tracker.finish(changed.id)
    expect(tracker.get(changed)).toMatchObject({ failed: false, saved: true })
  })

  it('isolates Phases and resets when the workspace is replaced', () => {
    const tracker = new PhaseSaveState()
    const first = phase()
    const second = { ...first, id: 'phase-2' }
    tracker.reset([first, second])
    tracker.begin(first.id)
    expect(tracker.get(second).saved).toBe(true)
    tracker.reset([second])
    expect(tracker.get(first)).toMatchObject({ saved: false, saving: false })
  })
})