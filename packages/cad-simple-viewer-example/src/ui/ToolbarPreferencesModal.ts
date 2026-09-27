import type { AcExToolbarItem, AcExToolbarPlacement } from '@mlightcad/cad-simple-ui-plugin'
import { RotateCcw, Save, Settings, X } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { defaultToolbarPreferences, type ToolbarPreferences } from '../toolbarPreferences'
import { translateUiText } from '../uiTranslations'
import { createModalFocusController } from './modalFocus'

export class ToolbarPreferencesModal {
  readonly element = document.createElement('div')
  private readonly focus = createModalFocusController(this.element)
  private draft = defaultToolbarPreferences()
  private items: AcExToolbarItem[] = []

  constructor(
    private readonly getLocale: () => AppLocale,
    private readonly itemLabel: (item: AcExToolbarItem) => string,
    private readonly onSave: (preferences: ToolbarPreferences) => void
  ) {
    this.element.className = 'toolbar-preferences-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'toolbarPreferencesTitle')
    this.element.addEventListener('pointerdown', event => {
      if (event.target === this.element) this.close()
    })
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    })
    document.body.append(this.element)
    if (!document.getElementById('toolbar-preferences-styles')) {
      const style = document.createElement('style')
      style.id = 'toolbar-preferences-styles'
      style.textContent = `
        .toolbar-preferences-modal[hidden] { display: none; }
        .toolbar-preferences-modal { position: fixed; inset: 0; z-index: 16000; display: grid; place-items: center; padding: 16px; background: rgb(0 0 0 / .38); color: var(--app-text, #203638); }
        .toolbar-preferences-shell { box-sizing: border-box; display: flex; flex-direction: column; width: min(600px, 100%); max-height: calc(100dvh - 32px); overflow: hidden; background: var(--app-surface-elevated, #fff); border: 1px solid var(--app-border, #ccd7da); border-radius: 6px; box-shadow: 0 16px 48px #0003; font-size: 14px; }
        .toolbar-preferences-shell header, .toolbar-preferences-shell footer { display: flex; align-items: center; gap: 10px; padding: 14px 18px; flex-shrink: 0; }
        .toolbar-preferences-shell header { border-bottom: 1px solid var(--app-border, #ccd7da); }
        .toolbar-preferences-shell h2 { flex: 1; margin: 0; font-size: 18px; overflow-wrap: anywhere; }
        .toolbar-preferences-shell svg { width: 18px; height: 18px; flex: 0 0 18px; }
        .toolbar-preferences-body { padding: 0 18px; overflow: auto; }
        .toolbar-preferences-section { padding: 6px 0; border-bottom: 1px solid var(--app-border, #ccd7da); }
        .toolbar-preferences-section:last-child { border-bottom: 0; }
        .toolbar-preferences-section > .toolbar-preferences-group { margin-left: 12px; padding-left: 12px; border-left: 1px solid var(--app-border, #ccd7da); }
        .toolbar-preferences-body summary { padding: 10px 0; cursor: pointer; color: var(--app-text, #203638); }
        .toolbar-preferences-body summary::marker { color: var(--app-text-muted, #60767d); }
        .toolbar-preferences-body summary:hover { color: var(--app-accent, #087b58); }
        .toolbar-preferences-body h3, .toolbar-preferences-body h4 { display: inline; margin: 0; font-weight: 600; overflow-wrap: anywhere; }
        .toolbar-preferences-body h3 { font-size: 15px; }
        .toolbar-preferences-body h4 { font-size: 13px; }
        .toolbar-preferences-group[open] { padding-bottom: 8px; }
        .toolbar-preferences-row { display: flex; align-items: center; gap: 10px; min-height: 36px; }
        .toolbar-preferences-row span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .toolbar-preferences-row input[type=checkbox] { width: 16px; height: 16px; flex: 0 0 16px; accent-color: var(--app-accent, #087b58); cursor: pointer; }
        .toolbar-preferences-shell .toolbar-preferences-children { margin: 0 0 8px 28px; padding: 0; border: 0; }
        .toolbar-preferences-children:disabled { opacity: .5; }
        .toolbar-preferences-shell select, .toolbar-preferences-shell input[type=number] { box-sizing: border-box; max-width: 50%; min-height: 32px; border: 1px solid var(--app-border, #ccd7da); border-radius: 4px; color: inherit; background: var(--app-surface-elevated, #fff); padding: 4px 8px; }
        .toolbar-preferences-shell input[type=number] { width: 90px; }
        .toolbar-preferences-shell button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--app-border, #ccd7da); color: inherit; background: var(--app-surface-elevated, #fff); cursor: pointer; }
        .toolbar-preferences-shell button:hover { background: var(--app-success-surface, #edf8f4); }
        .toolbar-preferences-shell :focus-visible { outline: 2px solid var(--app-accent, #087b58); outline-offset: 2px; }
        .toolbar-preferences-shell footer { border-top: 1px solid var(--app-border, #ccd7da); flex-wrap: wrap; }
        .toolbar-preferences-reset { margin-right: auto; }
        .toolbar-preferences-shell .toolbar-preferences-save { background: var(--app-accent, #087b58); color: white; }
        .toolbar-preferences-error { margin: 0 18px 8px; color: var(--app-danger, #b42318); }
      `
      document.head.append(style)
    }
  }

  open(preferences: ToolbarPreferences, items: AcExToolbarItem[]): void {
    if (!this.element.hidden) return
    this.draft = { ...preferences, hiddenIds: [...preferences.hiddenIds] }
    this.items = items
    this.render()
    this.element.hidden = false
    this.focus.activate()
  }

  close(): void {
    if (this.element.hidden) return
    this.element.hidden = true
    this.focus.deactivate()
  }

  private text(value: string): string {
    return translateUiText(this.getLocale(), value)
  }

  private render(): void {
    const shell = document.createElement('form')
    shell.className = 'toolbar-preferences-shell'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'toolbarPreferencesTitle'
    title.textContent = this.text('功能配置')
    const close = this.button('关闭', X, () => this.close(), true)
    header.append(createPhaseIcon(Settings), title, close)
    const body = document.createElement('div')
    body.className = 'toolbar-preferences-body'
    const viewer = this.group('图纸 Viewer 功能配置', true)
    viewer.open = true
    const general = this.group('Viewer 工具栏')
    general.append(
      this.checkbox('显示工具栏', this.draft.visible, value => { this.draft.visible = value }, 'visible'),
      this.checkbox('默认折叠', this.draft.collapsed, value => { this.draft.collapsed = value }, 'collapsed')
    )
    const position = document.createElement('select')
    position.name = 'placement'
    for (const [value, label] of [['top', '顶部'], ['bottom', '底部'], ['left', '左侧'], ['right', '右侧']]) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = this.text(label)
      position.append(option)
    }
    position.value = this.draft.placement
    position.addEventListener('change', () => { this.draft.placement = position.value as AcExToolbarPlacement })
    general.append(this.row('工具栏位置', position))
    const offset = document.createElement('input')
    offset.type = 'number'
    offset.name = 'edgeOffset'
    offset.min = '0'
    offset.max = '80'
    offset.step = '1'
    offset.required = true
    offset.value = String(this.draft.edgeOffset)
    offset.addEventListener('invalid', () => {
      general.open = true
      viewer.open = true
    })
    general.append(this.row('边缘间距（像素）', offset))
    viewer.append(general)
    const groups = new Map<string, HTMLDetailsElement>()
    for (const item of this.items) {
      if (item.type === 'separator' || item.id === 'export' || item.id.startsWith('export-')) continue
      const groupName = this.groupName(item.id)
      let group = groups.get(groupName)
      if (!group) {
        group = this.group(groupName)
        groups.set(groupName, group)
        viewer.append(group)
      }
      this.appendItem(group, item)
    }
    const development = this.group('开发', true)
    development.append(this.checkbox('阀门调试', this.draft.valveDebugEnabled, value => {
      this.draft.valveDebugEnabled = value
    }, 'valveDebugEnabled'))
    body.append(viewer, development)
    const error = document.createElement('p')
    error.className = 'toolbar-preferences-error'
    error.setAttribute('role', 'alert')
    error.hidden = true
    const footer = document.createElement('footer')
    const reset = this.button('恢复默认', RotateCcw, () => {
      this.draft = defaultToolbarPreferences()
      this.render()
      this.element.querySelector<HTMLButtonElement>('.toolbar-preferences-reset')?.focus()
    })
    reset.className = 'toolbar-preferences-reset'
    const cancel = this.button('取消', undefined, () => this.close())
    const save = this.button('保存', Save)
    save.type = 'submit'
    save.className = 'toolbar-preferences-save'
    footer.append(reset, cancel, save)
    shell.addEventListener('submit', event => {
      event.preventDefault()
      if (!offset.reportValidity()) return
      this.draft.edgeOffset = offset.valueAsNumber
      try {
        this.onSave({ ...this.draft, hiddenIds: [...this.draft.hiddenIds] })
        this.close()
      } catch {
        error.textContent = this.text('功能配置保存失败，请重试。')
        error.hidden = false
      }
    })
    shell.append(header, body, error, footer)
    this.element.replaceChildren(shell)
  }

  private groupName(id: string): string {
    if (['select', 'pan', 'zoom-extent', 'zoom-window'].includes(id)) return '浏览'
    if (id === 'layer') return '图层'
    if (['brush-highlight', 'brush-erase', 'annotation', 'rev-vis'].includes(id)) return '高亮与标注'
    if (id === 'measure') return '测量'
    if (['switch-bg', 'monochrome', 'toolbar-placement', 'theme', 'locale'].includes(id)) return '显示设置'
    return '其他功能'
  }

  private appendItem(container: HTMLElement, item: AcExToolbarItem): void {
    if (item.type === 'separator' || item.id === 'export' || item.id.startsWith('export-')) return
    const children = document.createElement('fieldset')
    children.className = 'toolbar-preferences-children'
    children.disabled = this.draft.hiddenIds.includes(item.id)
    const row = this.checkbox(this.itemLabel(item), !children.disabled, checked => {
      this.draft.hiddenIds = this.draft.hiddenIds.filter(id => id !== item.id)
      if (!checked) this.draft.hiddenIds.push(item.id)
      children.disabled = !checked
    }, item.id)
    const icon = item.icon ?? item.toggle?.on.icon ?? item.toggle?.off.icon
    const iconElement = document.createElement('span')
    iconElement.style.flex = '0 0 18px'
    iconElement.setAttribute('aria-hidden', 'true')
    if (typeof icon === 'string') iconElement.innerHTML = icon
    else if (typeof icon === 'function') iconElement.append(icon())
    else if (icon) iconElement.append(icon.cloneNode(true))
    row.insertBefore(iconElement, row.querySelector('span'))
    container.append(row)
    if (item.children?.length) {
      children.setAttribute('aria-label', this.itemLabel(item))
      item.children.forEach(child => this.appendItem(children, child))
      container.append(children)
    }
  }

  private group(label: string, topLevel = false): HTMLDetailsElement {
    const group = document.createElement('details')
    group.className = topLevel ? 'toolbar-preferences-section' : 'toolbar-preferences-group'
    const summary = document.createElement('summary')
    const heading = document.createElement(topLevel ? 'h3' : 'h4')
    heading.textContent = this.text(label)
    summary.append(heading)
    group.append(summary)
    return group
  }

  private row(label: string, control: HTMLElement): HTMLLabelElement {
    const row = document.createElement('label')
    row.className = 'toolbar-preferences-row'
    const text = document.createElement('span')
    text.textContent = this.text(label)
    row.append(text, control)
    return row
  }

  private checkbox(label: string, checked: boolean, change: (checked: boolean) => void, name: string): HTMLLabelElement {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.name = name
    checkbox.checked = checked
    checkbox.addEventListener('change', () => change(checkbox.checked))
    return this.row(label, checkbox)
  }

  private button(label: string, icon?: Parameters<typeof createPhaseIcon>[0], action?: () => void, iconOnly = false): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.title = this.text(label)
    button.setAttribute('aria-label', this.text(label))
    if (icon) button.append(createPhaseIcon(icon))
    if (!iconOnly) button.append(this.text(label))
    if (action) button.addEventListener('click', action)
    return button
  }
}