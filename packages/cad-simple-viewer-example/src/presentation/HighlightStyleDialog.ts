import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import type { HighlightStyle, PresentationProfile } from '../phase/types'
import { createModalFocusController } from '../ui/modalFocus'
import { localizeDom } from '../uiTranslations'

export interface HighlightStyleDraft {
  presentationProfile: PresentationProfile
}

export interface HighlightStyleDialogOptions {
  value: HighlightStyleDraft
  getLocale?: () => AppLocale
  createId?: () => string
  onApply?(value: HighlightStyleDraft): void
  onClose(): void
}

const cloneDraft = (value: HighlightStyleDraft): HighlightStyleDraft =>
  JSON.parse(JSON.stringify(value)) as HighlightStyleDraft

const toHex = (color: number) =>
  `#${color.toString(16).padStart(6, '0').slice(-6)}`

const parseHex = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : undefined

export class HighlightStyleDialog {
  readonly element = document.createElement('div')
  private draft: HighlightStyleDraft
  private activeTab: 'flow' | 'device' | 'utility' | 'defaults' = 'flow'
  private readonly focusController = createModalFocusController(this.element)

  constructor(private readonly options: HighlightStyleDialogOptions) {
    this.draft = cloneDraft(options.value)
    this.element.className = 'phase-workspace-modal highlight-style-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'highlightStyleDialogTitle')
    this.element.addEventListener('click', event => {
      if (event.target === this.element) this.close()
    })
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    })
    document.body.append(this.element)
    this.render()
  }

  private emitPreview() { }

  open() {
    if (!this.element.isConnected) document.body.append(this.element)
    this.element.hidden = false
    document.body.classList.add('highlight-style-open')
    this.focusController.activate(
      this.element.querySelector<HTMLElement>('[role="tab"]')
    )
  }

  private close() {
    if (this.element.hidden) return
    this.element.hidden = true
    document.body.classList.remove('highlight-style-open')
    this.focusController.deactivate()
    this.element.remove()
    this.options.onClose()
  }

  private render() {
    this.element.replaceChildren()
    const dialog = document.createElement('section')
    dialog.className = 'phase-workspace-modal-dialog highlight-style-dialog'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'highlightStyleDialogTitle'
    title.textContent = '高亮样式设置'
    const close = this.iconButton('关闭对话框', X, () => this.close())
    header.append(title, close)

    const tabs = document.createElement('div')
    tabs.className = 'highlight-style-tabs'
    tabs.setAttribute('role', 'tablist')
    const labels = {
      flow: '流路',
      device: '设备',
      utility: 'Utility',
      defaults: '默认值'
    } as const
    for (const [key, label] of Object.entries(labels)) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-selected', String(this.activeTab === key))
      button.addEventListener('click', () => {
        this.activeTab = key as typeof this.activeTab
        this.render()
      })
      tabs.append(button)
    }

    const content = document.createElement('div')
    content.className = 'highlight-style-content'
    if (this.activeTab === 'flow') content.append(this.renderFlows())
    if (this.activeTab === 'device') content.append(this.renderDevices())
    if (this.activeTab === 'utility') content.append(this.renderUtilities())
    if (this.activeTab === 'defaults') content.append(this.renderDefaults())

    const footer = document.createElement('footer')
    footer.className = 'phase-workspace-modal-actions highlight-style-actions'
    const cancel = this.button('取消', () => this.close())
    const apply = this.button('应用', () => this.options.onApply?.(cloneDraft(this.draft)))
    const applyClose = this.button('应用并关闭', () => {
      this.options.onApply?.(cloneDraft(this.draft))
      this.close()
    })
    apply.classList.add('phase-workspace-primary')
    applyClose.classList.add('phase-workspace-primary')
    footer.append(cancel, apply, applyClose)
    dialog.append(header, tabs, content, footer)
    this.element.append(dialog)
    localizeDom(this.element, this.options.getLocale?.() ?? 'zh')
  }

  private renderFlows() {
    const section = document.createElement('section')
    section.className = 'highlight-defaults'
    const description = document.createElement('p')
    description.textContent = '此样式应用于当前工艺的所有 Phase；已指定 Utility 的流路使用对应 Utility 样式。'
    section.append(description, this.styleField(
      '所有 Phase 的默认流路',
      this.draft.presentationProfile.defaultFlowStyle
    ))
    return section
  }

  private renderDevices() {
    const table = document.createElement('div')
    table.className = 'highlight-device-table'
    const options = this.deviceStyleOptions()
    options.filter(option => option.get() != null).forEach(option => {
      const style = option.get()!
      const row = document.createElement('div')
      row.className = 'highlight-device-row'
      const label = document.createElement('span')
      label.textContent = option.device
      const mode = document.createElement('strong')
      mode.textContent = option.state
      const remove = this.iconButton('删除设备状态', Trash2, () => {
        option.set(null)
        this.emitPreview()
        this.render()
      })
      row.append(label, mode, this.styleControls(style, changed => {
        Object.assign(style, changed)
        this.emitPreview()
      }), remove)
      table.append(row)
    })
    const missing = options.filter(option => option.get() == null)
    if (missing.length > 0) {
      const creator = document.createElement('div')
      creator.className = 'highlight-device-creator'
      const select = document.createElement('select')
      select.setAttribute('aria-label', '新增设备状态类型')
      missing.forEach(option =>
        select.add(new Option(`${option.device} · ${option.state}`, option.key))
      )
      const add = this.button('新增设备状态', () => {
        const option = missing.find(item => item.key === select.value)
        if (!option) return
        option.set({ ...option.defaultStyle })
        this.draft.presentationProfile.deviceStylesInitialized = true
        this.emitPreview()
        this.render()
      })
      add.prepend(createPhaseIcon(Plus))
      creator.append(select, add)
      table.append(creator)
    }
    if (options.every(option => option.get() == null)) {
      const empty = document.createElement('p')
      empty.textContent = '尚未配置设备状态，默认值为 null。'
      table.prepend(empty)
    }
    return table
  }

  private deviceStyleOptions() {
    const profile = this.draft.presentationProfile
    return [
      {
        key: 'valve-open', device: '阀门', state: 'OPEN',
        get: () => profile.deviceStyles.valve.open,
        set: (style: HighlightStyle | null) => { profile.deviceStyles.valve.open = style },
        defaultStyle: { color: 0x00c853, lineWidthPx: 3, opacity: 1, visible: true }
      },
      {
        key: 'valve-closed', device: '阀门', state: 'CLOSED',
        get: () => profile.deviceStyles.valve.closed,
        set: (style: HighlightStyle | null) => { profile.deviceStyles.valve.closed = style },
        defaultStyle: { color: 0xd32f2f, lineWidthPx: 3, opacity: 1, visible: true }
      },
      {
        key: 'valve-pulse', device: '阀门', state: 'PULSE',
        get: () => profile.deviceStyles.valve.pulse,
        set: (style: HighlightStyle | null) => { profile.deviceStyles.valve.pulse = style },
        defaultStyle: { color: 0xf9a825, lineWidthPx: 3, opacity: 1, visible: true }
      },
      {
        key: 'motor-start', device: '泵/电机', state: 'START',
        get: () => profile.deviceStyles.motor.start,
        set: (style: HighlightStyle | null) => { profile.deviceStyles.motor.start = style },
        defaultStyle: { color: 0x00796b, lineWidthPx: 3, opacity: 1, visible: true }
      },
      {
        key: 'motor-stop', device: '泵/电机', state: 'STOP',
        get: () => profile.deviceStyles.motor.stop,
        set: (style: HighlightStyle | null) => { profile.deviceStyles.motor.stop = style },
        defaultStyle: { color: 0x616161, lineWidthPx: 2, opacity: 1, visible: true }
      },
      {
        key: 'equipment-active', device: '其他设备', state: 'ACTIVE',
        get: () => profile.deviceStyles.processEquipment.active,
        set: (style: HighlightStyle | null) => { profile.deviceStyles.processEquipment.active = style },
        defaultStyle: { color: 0x00c853, lineWidthPx: 3, opacity: 1, visible: true }
      },
      {
        key: 'unknown', device: '未知设备', state: 'UNKNOWN',
        get: () => profile.unknownDeviceStyle,
        set: (style: HighlightStyle | null) => { profile.unknownDeviceStyle = style },
        defaultStyle: { color: 0x546e7a, lineWidthPx: 2, opacity: 1, visible: true }
      }
    ]
  }

  private renderUtilities() {
    const section = document.createElement('section')
    section.className = 'highlight-style-list'
    const notice = document.createElement('p')
    notice.textContent = '客户颜色标准尚未确认'
    section.append(notice)
    this.draft.presentationProfile.utilities
      .sort((a, b) => a.order - b.order)
      .forEach((utility, index, utilities) => {
        const row = document.createElement('div')
        row.className = 'highlight-style-row utility-style-row'
        const name = document.createElement('input')
        name.value = utility.name
        name.setAttribute('aria-label', 'Utility 名称')
        name.addEventListener('input', () => {
          utility.name = name.value
          this.emitPreview()
        })
        const enabled = document.createElement('input')
        enabled.type = 'checkbox'
        enabled.checked = utility.enabled
        enabled.setAttribute('aria-label', '启用 Utility')
        enabled.addEventListener('change', () => {
          utility.enabled = enabled.checked
          this.emitPreview()
        })
        const up = this.iconButton('上移 Utility', ArrowUp, () => {
          if (index === 0) return
            ;[utilities[index - 1].order, utility.order] = [utility.order, utilities[index - 1].order]
          this.emitPreview()
          this.render()
        })
        up.disabled = index === 0
        const down = this.iconButton('下移 Utility', ArrowDown, () => {
          if (index === utilities.length - 1) return
            ;[utilities[index + 1].order, utility.order] = [utility.order, utilities[index + 1].order]
          this.emitPreview()
          this.render()
        })
        down.disabled = index === utilities.length - 1
        const remove = this.iconButton('删除 Utility', Trash2, () => {
          this.draft.presentationProfile.utilities = utilities.filter(item => item.id !== utility.id)
          this.emitPreview()
          this.render()
        })
        row.append(name, this.checkboxLabel('启用', enabled), this.styleControls(utility.style, changed => {
          Object.assign(utility.style, changed)
          this.emitPreview()
        }), up, down, remove)
        section.append(row)
      })
    const add = this.button('新增 Utility', () => {
      const id = this.options.createId?.() ?? crypto.randomUUID()
      this.draft.presentationProfile.utilities.push({
        id,
        name: `Utility ${this.draft.presentationProfile.utilities.length + 1}`,
        style: { ...this.draft.presentationProfile.defaultFlowStyle },
        enabled: true,
        order: this.draft.presentationProfile.utilities.length
      })
      this.emitPreview()
      this.render()
    })
    add.prepend(createPhaseIcon(Plus))
    section.append(add)
    return section
  }

  private renderDefaults() {
    const section = document.createElement('section')
    section.className = 'highlight-defaults'
    const opacity = document.createElement('input')
    opacity.type = 'number'
    opacity.min = '0'
    opacity.max = '1'
    opacity.step = '0.05'
    opacity.value = String(this.draft.presentationProfile.dimmedBaseStyle.opacity)
    opacity.setAttribute('aria-label', '非高亮内容透明度')
    opacity.addEventListener('input', () => {
      this.draft.presentationProfile.dimmedBaseStyle.opacity = Math.min(1, Math.max(0, Number(opacity.value)))
      this.emitPreview()
    })
    section.append(this.checkboxLabel('非高亮内容透明度', opacity))
    return section
  }

  private styleField(labelText: string, style: HighlightStyle) {
    const field = document.createElement('label')
    field.className = 'highlight-default-field'
    const label = document.createElement('span')
    label.textContent = labelText
    field.append(label, this.styleControls(style, changed => {
      Object.assign(style, changed)
      this.emitPreview()
    }))
    return field
  }

  private styleControls(
    style: HighlightStyle,
    change: (style: Partial<HighlightStyle>) => void,
    disabled = false
  ) {
    const group = document.createElement('div')
    group.className = 'highlight-style-controls'
    const color = document.createElement('input')
    color.type = 'color'
    color.value = toHex(style.color)
    color.disabled = disabled
    color.setAttribute('aria-label', '高亮颜色')
    const hex = document.createElement('input')
    hex.value = toHex(style.color).toUpperCase()
    hex.pattern = '#[0-9A-Fa-f]{6}'
    hex.disabled = disabled
    hex.setAttribute('aria-label', '十六进制颜色')
    const updateColor = (value: string) => {
      const parsed = parseHex(value)
      if (parsed == null) return
      color.value = toHex(parsed)
      hex.value = toHex(parsed).toUpperCase()
      change({ color: parsed })
    }
    color.addEventListener('input', () => updateColor(color.value))
    hex.addEventListener('change', () => updateColor(hex.value))
    const width = document.createElement('input')
    width.type = 'number'
    width.min = '1'
    width.max = '12'
    width.step = '0.5'
    width.value = String(style.lineWidthPx)
    width.disabled = disabled
    width.setAttribute('aria-label', '高亮线宽')
    width.addEventListener('input', () =>
      change({ lineWidthPx: Math.min(12, Math.max(1, Number(width.value))) })
    )
    const visible = document.createElement('input')
    visible.type = 'checkbox'
    visible.checked = style.visible
    visible.disabled = disabled
    visible.setAttribute('aria-label', '显示高亮')
    visible.addEventListener('change', () => change({ visible: visible.checked }))
    const opacity = document.createElement('input')
    opacity.type = 'number'
    opacity.min = '0'
    opacity.max = '1'
    opacity.step = '0.05'
    opacity.value = String(style.opacity)
    opacity.disabled = disabled
    opacity.setAttribute('aria-label', '高亮透明度')
    opacity.addEventListener('input', () =>
      change({ opacity: Math.min(1, Math.max(0, Number(opacity.value))) })
    )
    group.append(color, hex, opacity, width, visible)
    return group
  }

  private checkboxLabel(text: string, input: HTMLInputElement) {
    const label = document.createElement('label')
    label.className = 'highlight-checkbox'
    const span = document.createElement('span')
    span.textContent = text
    label.append(input, span)
    return label
  }

  private button(label: string, action: () => void) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', action)
    return button
  }

  private iconButton(label: string, icon: Parameters<typeof createPhaseIcon>[0], action: () => void) {
    const button = this.button('', action)
    button.className = 'phase-icon-button'
    button.title = label
    button.setAttribute('aria-label', label)
    button.append(createPhaseIcon(icon))
    return button
  }
}