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
    expect(modal.element.querySelector('input[name^="export"]')).toBeNull()
    modal.element.querySelector<HTMLInputElement>('input[name="rev-cloud"]')!.click()
    modal.element.querySelector<HTMLInputElement>('input[name="valveDebugEnabled"]')!.click()
    expect(save).not.toHaveBeenCalled()
    expect(preferences.hiddenIds).toEqual([])
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-save')!.click()
    expect(save).toHaveBeenCalledWith({ ...preferences, hiddenIds: ['rev-cloud'], valveDebugEnabled: true })
    expect(modal.element.hidden).toBe(true)
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
    modal.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(save).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
    modal.open(defaultToolbarPreferences(), [])
    expect(modal.element.querySelector<HTMLInputElement>('input[name="visible"]')!.checked).toBe(true)
    expect(modal.element.querySelector<HTMLInputElement>('input[name="valveDebugEnabled"]')!.checked).toBe(false)
  })

  it('nests all non-development settings in collapsible Viewer groups and keeps edits when collapsed', () => {
    const save = jest.fn()
    const modal = new ToolbarPreferencesModal(() => 'en', item => item.id, save)
    modal.open(defaultToolbarPreferences(), [
      { id: 'select' }, { id: 'layer' }, { id: 'measure' },
      { id: 'brush-highlight' }, { id: 'switch-bg' }, { id: 'agent' }
    ])
    const sections = modal.element.querySelectorAll<HTMLDetailsElement>(
      '.toolbar-preferences-body > details'
    )
    expect(sections).toHaveLength(2)
    const [viewer, development] = sections
    expect(viewer.open).toBe(true)
    expect(development.open).toBe(false)
    expect(viewer.querySelector('input[name="valveDebugEnabled"]')).toBeNull()
    expect(development.querySelectorAll('input')).toHaveLength(1)
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
    modal.open({ ...defaultToolbarPreferences(), hiddenIds: ['rev-cloud'], visible: false, valveDebugEnabled: true }, [{ id: 'annotation', children: [{ id: 'rev-cloud' }] }])
    const parent = modal.element.querySelector<HTMLInputElement>('input[name="annotation"]')!
    parent.click()
    expect(modal.element.querySelector<HTMLFieldSetElement>('.toolbar-preferences-children')!.disabled).toBe(true)
    parent.click()
    expect(modal.element.querySelector<HTMLInputElement>('input[name="rev-cloud"]')!.checked).toBe(false)
    modal.element.querySelector<HTMLButtonElement>('.toolbar-preferences-reset')!.click()
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