/** @jest-environment jsdom */
import { ToolbarPreferencesModal } from '../src/ui/ToolbarPreferencesModal'
import { defaultToolbarPreferences } from '../src/toolbarPreferences'

describe('ToolbarPreferencesModal', () => {
  afterEach(() => document.body.replaceChildren())

  it.each(['zh', 'en'] as const)('saves a draft only on submit in %s', locale => {
    const save = jest.fn()
    const modal = new ToolbarPreferencesModal(() => locale, item => item.label ?? item.id, save)
    const preferences = { ...defaultToolbarPreferences(), hiddenIds: [] }
    modal.open(preferences, [
      { id: 'layer', label: 'Layers' },
      { id: 'annotation', label: 'Annotation', children: [{ id: 'rev-cloud', label: 'Cloud' }] },
      { id: 'export', label: 'Export', children: [{ id: 'export-pdf', label: 'PDF' }] },
      { id: 'export-svg', label: 'SVG' }
    ])
    expect(modal.element.parentElement).toBe(document.body)
    expect(modal.element.querySelector('h2')?.textContent).toBe(locale === 'zh' ? '功能配置' : 'Feature settings')
    expect(modal.element.querySelector('h3')?.textContent).toBe(locale === 'zh' ? '图纸 Viewer 功能配置' : 'Drawing Viewer feature settings')
    expect(modal.element.querySelector('input[name="layer"]')?.closest('details')?.querySelector('h4')?.textContent)
      .toBe(locale === 'zh' ? '图层' : 'Layers')
    expect(modal.element.textContent).toContain(locale === 'zh' ? '开发' : 'Development')
    expect(modal.element.textContent).toContain(locale === 'zh' ? '阀门调试' : 'Valve debug')
    expect(modal.element.textContent).toContain(locale === 'zh' ? '画笔调试' : 'Brush debug')
    const phaseMove = modal.element.querySelector<HTMLInputElement>('input[name="phaseMoveEnabled"]')!
    expect(phaseMove.closest('details')?.querySelector('h3')?.textContent)
      .toBe(locale === 'zh' ? 'Phase 功能配置' : 'Phase feature settings')
    expect(phaseMove.closest('label')?.textContent)
      .toBe(locale === 'zh' ? '启用上移/下移' : 'Enable move up/down')
    expect(phaseMove.checked).toBe(false)
    expect(modal.element.querySelector('input[name^="export"]')).toBeNull()
    modal.element.querySelector<HTMLInputElement>('input[name="rev-cloud"]')!.click()
    modal.element.querySelector<HTMLInputElement>('input[name="valveDebugEnabled"]')!.click()
    modal.element.querySelector<HTMLInputElement>('input[name="brushDebugEnabled"]')!.click()
    phaseMove.click()
    expect(save).not.toHaveBeenCalled()
    expect(preferences.hiddenIds).toEqual([])
    expect(preferences.phaseMoveEnabled).toBe(false)
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-save')!.click()
    expect(save).toHaveBeenCalledWith({ ...preferences, hiddenIds: ['rev-cloud'], valveDebugEnabled: true, brushDebugEnabled: true, phaseMoveEnabled: true })
    expect(modal.element.hidden).toBe(true)
  })

  it.each(['zh', 'en'] as const)('configures valve brush scope under highlights in %s', locale => {
    const save = jest.fn()
    const modal = new ToolbarPreferencesModal(() => locale, item => item.id, save)
    const preferences = defaultToolbarPreferences()
    modal.open(preferences, [{ id: 'brush-valve-toggle' }])
    const scope = modal.element.querySelector<HTMLSelectElement>('select[name="valveBrushScope"]')!
    expect(scope.closest('details')?.querySelector('h4')?.textContent)
      .toBe(locale === 'zh' ? '高亮与标注' : 'Highlights and annotations')
    expect(Array.from(scope.options, option => option.textContent)).toEqual(locale === 'zh'
      ? ['仅阀门', '非阀门实体', '所有实体']
      : ['Valves only', 'Non-valve entities', 'All entities'])
    expect(scope.value).toBe('valves')
    scope.value = 'all'
    scope.dispatchEvent(new Event('change', { bubbles: true }))
    expect(preferences.valveBrushScope).toBe('valves')
    expect(save).not.toHaveBeenCalled()
    modal.close()
    modal.open(preferences, [{ id: 'brush-valve-toggle' }])
    const reopened = modal.element.querySelector<HTMLSelectElement>('select[name="valveBrushScope"]')!
    expect(reopened.value).toBe('valves')
    reopened.value = 'non-valves'
    reopened.dispatchEvent(new Event('change', { bubbles: true }))
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-save')!.click()
    expect(save).toHaveBeenCalledWith({ ...preferences, valveBrushScope: 'non-valves' })
  })

  it('retains the valve brush scope when hidden and resets it with defaults', () => {
    const save = jest.fn()
    const modal = new ToolbarPreferencesModal(() => 'en', item => item.id, save)
    modal.open({ ...defaultToolbarPreferences(), valveBrushScope: 'non-valves', hiddenIds: ['brush-valve-toggle'] }, [{ id: 'brush-valve-toggle' }])
    const fieldset = modal.element.querySelector<HTMLFieldSetElement>('.toolbar-preferences-children')!
    expect(fieldset.disabled).toBe(true)
    expect(fieldset.querySelector<HTMLSelectElement>('select')!.value).toBe('non-valves')
    modal.element.querySelector<HTMLInputElement>('input[name="brush-valve-toggle"]')!.click()
    expect(fieldset.disabled).toBe(false)
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-reset')!.click()
    expect(modal.element.querySelector<HTMLSelectElement>('select[name="valveBrushScope"]')!.value).toBe('valves')
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-save')!.click()
    expect(save).toHaveBeenCalledWith(defaultToolbarPreferences())
  })

  it('cancels with Escape and restores focus without persisting', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const save = jest.fn()
    const modal = new ToolbarPreferencesModal(() => 'en', item => item.id, save)
    modal.open(defaultToolbarPreferences(), [])
    modal.element.querySelector<HTMLInputElement>('input[name="visible"]')!.click()
    modal.element.querySelector<HTMLInputElement>('input[name="valveDebugEnabled"]')!.click()
    modal.element.querySelector<HTMLInputElement>('input[name="brushDebugEnabled"]')!.click()
    modal.element.querySelector<HTMLInputElement>('input[name="phaseMoveEnabled"]')!.click()
    modal.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(save).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
    modal.open(defaultToolbarPreferences(), [])
    expect(modal.element.querySelector<HTMLInputElement>('input[name="visible"]')!.checked).toBe(true)
    expect(modal.element.querySelector<HTMLInputElement>('input[name="valveDebugEnabled"]')!.checked).toBe(false)
    expect(modal.element.querySelector<HTMLInputElement>('input[name="brushDebugEnabled"]')!.checked).toBe(false)
    expect(modal.element.querySelector<HTMLInputElement>('input[name="phaseMoveEnabled"]')!.checked).toBe(false)
  })

  it('separates Viewer, Phase and development settings and keeps edits when collapsed', () => {
    const save = jest.fn()
    const modal = new ToolbarPreferencesModal(() => 'en', item => item.id, save)
    modal.open(defaultToolbarPreferences(), [
      { id: 'select' }, { id: 'layer' }, { id: 'measure' },
      { id: 'brush-highlight' }, { id: 'switch-bg' }, { id: 'agent' }
    ])
    const sections = modal.element.querySelectorAll<HTMLDetailsElement>(
      '.toolbar-preferences-body > details'
    )
    expect(sections).toHaveLength(3)
    const [viewer, phase, development] = sections
    expect(viewer.open).toBe(true)
    expect(phase.open).toBe(false)
    expect(phase.querySelectorAll('input')).toHaveLength(1)
    expect(phase.querySelector('input[name="phaseMoveEnabled"]')).not.toBeNull()
    expect(development.open).toBe(false)
    expect(viewer.querySelector('input[name="valveDebugEnabled"]')).toBeNull()
    expect(development.querySelectorAll('input')).toHaveLength(2)
    expect(development.querySelector('input[name="brushDebugEnabled"]')).not.toBeNull()
    expect(viewer.querySelectorAll(':scope > details')).toHaveLength(7)
    for (const control of viewer.querySelectorAll('input, select')) {
      expect(control.closest('details')?.parentElement).toBe(viewer)
    }
    const general = viewer.querySelector<HTMLDetailsElement>('details')!
    expect(general.open).toBe(false)
    general.querySelector('summary')!.click()
    expect(general.open).toBe(true)
    general.querySelector<HTMLInputElement>('input[name="visible"]')!.click()
    viewer.querySelector('summary')!.click()
    expect(viewer.open).toBe(false)
    expect(save).not.toHaveBeenCalled()
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-save')!.click()
    expect(save).toHaveBeenCalledWith({ ...defaultToolbarPreferences(), visible: false })
  })

  it('expands collapsed ancestors when a setting is invalid', () => {
    const modal = new ToolbarPreferencesModal(() => 'en', item => item.id, jest.fn())
    modal.open(defaultToolbarPreferences(), [])
    const viewer = modal.element.querySelector<HTMLDetailsElement>('.toolbar-preferences-section')!
    const general = viewer.querySelector<HTMLDetailsElement>('details')!
    viewer.open = false
    const offset = general.querySelector<HTMLInputElement>('input[name="edgeOffset"]')!
    offset.value = '-1'
    expect(offset.reportValidity()).toBe(false)
    expect(viewer.open).toBe(true)
    expect(general.open).toBe(true)
  })

  it('restores defaults in the draft and retains child choices when a parent is hidden', () => {
    const save = jest.fn()
    const modal = new ToolbarPreferencesModal(() => 'en', item => item.id, save)
    modal.open({ ...defaultToolbarPreferences(), hiddenIds: ['rev-cloud'], visible: false, valveDebugEnabled: true, phaseMoveEnabled: true }, [{ id: 'annotation', children: [{ id: 'rev-cloud' }] }])
    const parent = modal.element.querySelector<HTMLInputElement>('input[name="annotation"]')!
    parent.click()
    expect(modal.element.querySelector<HTMLFieldSetElement>('.toolbar-preferences-children')!.disabled).toBe(true)
    parent.click()
    expect(modal.element.querySelector<HTMLInputElement>('input[name="rev-cloud"]')!.checked).toBe(false)
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-reset')!.click()
    expect(modal.element.querySelector<HTMLInputElement>('input[name="phaseMoveEnabled"]')!.checked).toBe(false)
    expect(save).not.toHaveBeenCalled()
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-save')!.click()
    expect(save).toHaveBeenCalledWith(defaultToolbarPreferences())
  })

  it('keeps the dialog open and shows an error when saving fails', () => {
    const modal = new ToolbarPreferencesModal(() => 'en', item => item.id, () => { throw new Error('full') })
    modal.open(defaultToolbarPreferences(), [])
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-save')!.click()
    expect(modal.element.hidden).toBe(false)
    expect(modal.element.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(false)
  })
})