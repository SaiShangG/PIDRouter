import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import type {
  DeviceStateStyleDefinition,
  DeviceStyleDefinition,
  HighlightStyle,
  PresentationProfile
} from '../phase/types'
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
  private activeTab: 'device' | 'utility' = 'device'
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
      device: '设备',
      utility: 'Utility'
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
    if (this.activeTab === 'device') content.append(this.renderDevices())
    if (this.activeTab === 'utility') content.append(this.renderUtilities())

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

  private renderDevices() {
    const section = document.createElement('section')
    section.className = 'highlight-device-table'
    const devices = this.draft.presentationProfile.devices
      .sort((a, b) => a.order - b.order)
    devices.forEach(device => {
      const card = document.createElement('article')
      card.className = 'highlight-device-card'
      const header = document.createElement('header')
      const name = document.createElement('input')
      name.value = device.name
      name.setAttribute('aria-label', '设备名称')
      name.addEventListener('input', () => {
        device.name = name.value
        this.emitPreview()
      })
      const remove = this.iconButton('删除设备', Trash2, () => {
        this.draft.presentationProfile.devices = devices.filter(item => item.id !== device.id)
        this.emitPreview()
        this.render()
      })
      header.append(name, remove)
      card.append(header)
      device.states.sort((a, b) => a.order - b.order).forEach(state =>
        card.append(this.renderDeviceState(device, state))
      )
      const addState = this.button('新增状态', () => {
        const index = device.states.length + 1
        device.states.push({
          id: this.newId(`state-${index}`),
          key: `state-${index}`,
          displayName: `状态 ${index}`,
          color: 0x00c853,
          lineWidthPx: 3,
          opacity: 1,
          enabled: true,
          order: device.states.length
        })
        this.emitPreview()
        this.render()
      })
      addState.prepend(createPhaseIcon(Plus))
      card.append(addState)
      section.append(card)
    })
    const addDevice = this.button('新增设备', () => {
      const index = devices.length + 1
      devices.push({
        id: this.newId(`device-${index}`),
        name: `设备 ${index}`,
        states: [],
        order: devices.length
      })
      this.emitPreview()
      this.render()
    })
    addDevice.prepend(createPhaseIcon(Plus))
    section.append(addDevice)
    return section
  }

  private renderDeviceState(
    device: DeviceStyleDefinition,
    state: DeviceStateStyleDefinition
  ) {
    const row = document.createElement('div')
    row.className = 'highlight-device-row'
    const key = document.createElement('input')
    key.value = state.key
    key.setAttribute('aria-label', '状态 key')
    key.addEventListener('input', () => {
      state.key = key.value
      this.emitPreview()
    })
    const displayName = document.createElement('input')
    displayName.value = state.displayName
    displayName.setAttribute('aria-label', '右键显示名称')
    displayName.addEventListener('input', () => {
      state.displayName = displayName.value
      this.emitPreview()
    })
    const style = this.asHighlightStyle(state)
    const enabled = document.createElement('input')
    enabled.type = 'checkbox'
    enabled.checked = state.enabled
    enabled.setAttribute('aria-label', '启用设备状态')
    enabled.addEventListener('change', () => {
      state.enabled = enabled.checked
      this.emitPreview()
    })
    const remove = this.iconButton('删除设备状态', Trash2, () => {
      device.states = device.states.filter(item => item.id !== state.id)
      this.emitPreview()
      this.render()
    })
    row.append(key, displayName, this.checkboxLabel('启用', enabled), this.styleControls(style, changed => {
      Object.assign(state, changed)
      this.emitPreview()
    }), remove)
    return row
  }

  private asHighlightStyle(state: DeviceStateStyleDefinition): HighlightStyle {
    return {
      color: state.color,
      lineWidthPx: state.lineWidthPx,
      opacity: state.opacity,
      visible: true
    }
  }

  private newId(fallback: string) {
    return this.options.createId?.() ?? `${fallback}-${crypto.randomUUID()}`
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
    group.append(color, hex, opacity, width)
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