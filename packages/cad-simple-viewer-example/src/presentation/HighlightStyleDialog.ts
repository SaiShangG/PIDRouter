import { Download, Plus, Trash2, Upload, X } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import type {
  DeviceStateStyleDefinition,
  DeviceStyleDefinition,
  HighlightStyle,
  PresentationProfile
} from '../phase/types'
import { toPersistedPresentationProfile } from '../phase/phaseWorkspaceRepository'
import { normalizePresentationProfile } from '../phase/phaseWorkspaceStore'
import { ConfirmationModal } from '../ui/ConfirmationModal'
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export class HighlightStyleDialog {
  readonly element = document.createElement('div')
  private draft: HighlightStyleDraft
  private activeTab: 'device' | 'utility' = 'device'
  private readonly focusController = createModalFocusController(this.element)
  private readonly confirmationModal = new ConfirmationModal()

  constructor(private readonly options: HighlightStyleDialogOptions) {
    this.draft = cloneDraft(options.value)
    this.element.className = 'phase-workspace-modal highlight-style-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'highlightStyleDialogTitle')
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

  private canApply() {
    return this.validateDeviceStateKeys()
  }

  private validateDeviceStateKeys() {
    let valid = true
    this.draft.presentationProfile.devices.forEach(device => {
      const keys = new Set<string>()
      device.states.forEach(state => {
        const key = state.key.trim()
        const stateInput = [...this.element.querySelectorAll<HTMLInputElement>('[data-state-id]')]
          .find(input => input.dataset.stateId === state.id)
        const stateValid = Boolean(key) && !keys.has(key)
        if (!stateValid) valid = false
        if (stateInput) {
          stateInput.setAttribute('aria-invalid', String(!stateValid))
          stateInput.title = stateValid
            ? ''
            : '状态 key 不能为空，且同一设备内不能重复'
        }
        keys.add(key)
      })
    })
    return valid
  }

  private render() {
    this.element.replaceChildren()
    const dialog = document.createElement('section')
    dialog.className = 'phase-workspace-modal-dialog highlight-style-dialog'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'highlightStyleDialogTitle'
    title.textContent = '高亮样式设置'
    const headerActions = document.createElement('div')
    headerActions.className = 'highlight-style-header-actions'
    const importStyles = this.iconButton('导入高亮样式 JSON', Upload, () => {
      this.selectImportFile()
    })
    const exportStyles = this.iconButton('下载高亮样式 JSON', Download, () => {
      this.downloadStyles()
    })
    const close = this.iconButton('关闭对话框', X, () => this.close())
    headerActions.append(importStyles, exportStyles, close)
    header.append(title, headerActions)

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
    const apply = this.button('应用', () => {
      if (this.canApply()) this.options.onApply?.(cloneDraft(this.draft))
    })
    const applyClose = this.button('应用并关闭', () => {
      if (!this.canApply()) return
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
        const locale = this.options.getLocale?.() ?? 'zh'
        void this.confirmationModal.confirm({
          title: locale === 'en' ? 'Delete device' : '删除设备',
          message: locale === 'en'
            ? `Delete device "${device.name}" and all of its states?`
            : `确定删除设备“${device.name}”及其全部状态吗？`,
          confirmLabel: locale === 'en' ? 'Delete' : '删除',
          cancelLabel: locale === 'en' ? 'Cancel' : '取消',
          tone: 'danger'
        }).then(confirmed => {
          if (!confirmed) return
          this.draft.presentationProfile.devices = devices.filter(item => item.id !== device.id)
          this.emitPreview()
          this.render()
        })
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
          autoHighlightFlow: false,
          flowBehavior: 'neutral',
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
      devices.push(this.createDefaultDevice(index, devices.length))
      this.emitPreview()
      this.render()
    })
    addDevice.prepend(createPhaseIcon(Plus))
    section.append(addDevice)
    return section
  }

  private createDefaultDevice(index: number, order: number): DeviceStyleDefinition {
    return {
      id: this.newId(`device-${index}`),
      name: `设备 ${index}`,
      states: [
        {
          id: this.newId(`device-${index}-open`),
          key: 'OPEN',
          displayName: 'OPEN',
          color: 0x00c853,
          lineWidthPx: 3,
          opacity: 1,
          enabled: true,
          autoHighlightFlow: true,
          flowBehavior: 'conducting',
          order: 0
        },
        {
          id: this.newId(`device-${index}-close`),
          key: 'CLOSE',
          displayName: 'CLOSE',
          color: 0xb8b8b8,
          lineWidthPx: 3,
          opacity: 1,
          enabled: true,
          autoHighlightFlow: false,
          flowBehavior: 'blocking',
          order: 1
        }
      ],
      order
    }
  }

  private downloadStyles() {
    const presentationProfile = toPersistedPresentationProfile(
      this.draft.presentationProfile
    )
    const blob = new Blob([
      JSON.stringify({ presentationProfile }, null, 2)
    ], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'highlight-styles.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  private selectImportFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) void this.importStyles(file)
    })
    input.click()
  }

  private async importStyles(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isRecord(parsed) || !isRecord(parsed.presentationProfile)) {
        throw new Error('Invalid highlight style file')
      }
      const profile = parsed.presentationProfile
      if (!Array.isArray(profile.deviceStyles) || !Array.isArray(profile.utilities)) {
        throw new Error('Invalid highlight style file')
      }
      this.draft.presentationProfile = normalizePresentationProfile(profile)
      this.emitPreview()
      this.render()
    } catch {
      const locale = this.options.getLocale?.() ?? 'zh'
      window.alert(locale === 'en'
        ? 'Failed to import highlight styles. Select a valid JSON file.'
        : '高亮样式导入失败，请选择有效的 JSON 文件。')
    }
  }

  private renderDeviceState(
    device: DeviceStyleDefinition,
    state: DeviceStateStyleDefinition
  ) {
    const row = document.createElement('div')
    row.className = 'highlight-device-row'
    const key = document.createElement('input')
    key.value = state.key
    key.dataset.stateId = state.id
    key.setAttribute('aria-label', '状态 key')
    key.addEventListener('input', () => {
      state.key = key.value
      this.validateDeviceStateKeys()
      this.emitPreview()
    })
    const displayName = document.createElement('input')
    displayName.value = state.displayName
    displayName.setAttribute('aria-label', '右键显示名称')
    displayName.addEventListener('input', () => {
      state.displayName = displayName.value
      this.emitPreview()
    })
    const autoHighlightFlow = document.createElement('input')
    autoHighlightFlow.type = 'checkbox'
    autoHighlightFlow.checked = state.autoHighlightFlow
    autoHighlightFlow.setAttribute('aria-label', '自动高亮流路')
    autoHighlightFlow.addEventListener('change', () => {
      state.autoHighlightFlow = autoHighlightFlow.checked
      this.emitPreview()
    })
    const autoHighlightFlowLabel = document.createElement('label')
    autoHighlightFlowLabel.className = 'highlight-checkbox'
    autoHighlightFlowLabel.append(autoHighlightFlow, '选择此状态时自动高亮流路')
    const flowBehavior = document.createElement('select')
    flowBehavior.setAttribute('aria-label', '流路行为')
    flowBehavior.add(new Option('允许继续', 'conducting'))
    flowBehavior.add(new Option('停止', 'blocking'))
    flowBehavior.add(new Option('不参与', 'neutral'))
    flowBehavior.value = state.flowBehavior
    flowBehavior.addEventListener('change', () => {
      state.flowBehavior = flowBehavior.value as DeviceStateStyleDefinition['flowBehavior']
      this.emitPreview()
    })
    const style = this.asHighlightStyle(state)
    const remove = this.iconButton('删除设备状态', Trash2, () => {
      const locale = this.options.getLocale?.() ?? 'zh'
      void this.confirmationModal.confirm({
        title: locale === 'en' ? 'Delete device state' : '删除设备状态',
        message: locale === 'en'
          ? `Delete device state "${state.displayName}"?`
          : `确定删除设备状态“${state.displayName}”吗？`,
        confirmLabel: locale === 'en' ? 'Delete' : '删除',
        cancelLabel: locale === 'en' ? 'Cancel' : '取消',
        tone: 'danger'
      }).then(confirmed => {
        if (!confirmed) return
        device.states = device.states.filter(item => item.id !== state.id)
        this.emitPreview()
        this.render()
      })
    })
    row.append(
      this.field('状态 key', key),
      this.field('右键名称', displayName),
      this.styleControls(style, changed => {
        Object.assign(state, changed)
        this.emitPreview()
      }),
      remove,
      autoHighlightFlowLabel,
      this.field('流路行为', flowBehavior)
    )
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
      .forEach(utility => {
        const row = document.createElement('div')
        row.className = 'highlight-style-row utility-style-row'
        const name = document.createElement('input')
        name.value = utility.name
        name.setAttribute('aria-label', 'Utility 名称')
        name.addEventListener('input', () => {
          utility.name = name.value
          this.emitPreview()
        })
        const remove = this.iconButton('删除 Utility', Trash2, () => {
          const locale = this.options.getLocale?.() ?? 'zh'
          void this.confirmationModal.confirm({
            title: locale === 'en' ? 'Delete Utility' : '删除 Utility',
            message: locale === 'en'
              ? `Delete Utility "${utility.name}"?`
              : `确定删除 Utility“${utility.name}”吗？`,
            confirmLabel: locale === 'en' ? 'Delete' : '删除',
            cancelLabel: locale === 'en' ? 'Cancel' : '取消',
            tone: 'danger'
          }).then(confirmed => {
            if (!confirmed) return
            this.draft.presentationProfile.utilities = this.draft.presentationProfile.utilities
              .filter(item => item.id !== utility.id)
            this.emitPreview()
            this.render()
          })
        })
        row.append(this.field('Utility 名称', name), this.styleControls(utility.style, changed => {
          Object.assign(utility.style, changed)
          this.emitPreview()
        }), remove)
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
    opacity.max = '100'
    opacity.step = '5'
    opacity.value = String(Math.round(style.opacity * 100))
    opacity.disabled = disabled
    opacity.setAttribute('aria-label', '高亮透明度')
    opacity.addEventListener('input', () =>
      change({ opacity: Math.min(1, Math.max(0, Number(opacity.value) / 100)) })
    )
    group.append(
      this.field('颜色', color),
      this.field('十六进制', hex),
      this.field('线宽 (px)', width),
      this.field('透明度 (%)', opacity)
    )
    return group
  }

  private field(labelText: string, input: HTMLInputElement | HTMLSelectElement) {
    const label = document.createElement('label')
    label.className = 'highlight-style-field'
    const text = document.createElement('span')
    text.textContent = labelText
    label.append(text, input)
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