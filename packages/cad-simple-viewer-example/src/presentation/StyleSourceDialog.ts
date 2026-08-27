import { X } from 'lucide'

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

export const resolveDevicePresetStyle = (
  profile: PresentationProfile,
  deviceId: string,
  stateId: string
): HighlightStyle | undefined => {
  const state = profile.devices
    .find(device => device.id === deviceId)
    ?.states.find(candidate => candidate.id === stateId && candidate.enabled)
  if (!state) return undefined
  return {
    color: state.color,
    lineWidthPx: state.lineWidthPx,
    opacity: state.opacity,
    visible: true
  }
}

export interface StyleSourceSelection {
  kind: 'utility' | 'device-state'
  utilityId?: string
  deviceId?: string
  stateId?: string
}

export interface StyleSourceDialogOptions {
  mode: 'brush' | 'flow'
  profile: PresentationProfile
  initialValue?: StyleSourceSelection
  getLocale?: () => AppLocale
  onApply(value: StyleSourceSelection): void
  onClose(): void
}

const toHex = (color: number) =>
  `#${color.toString(16).padStart(6, '0').slice(-6)}`

const cloneSelection = (
  value: StyleSourceSelection
): StyleSourceSelection => ({ ...value })

export class StyleSourceDialog {
  readonly element = document.createElement('div')
  private readonly focusController = createModalFocusController(this.element)
  private selection: StyleSourceSelection

  constructor(private readonly options: StyleSourceDialogOptions) {
    const enabledUtilities = this.availableUtilities()
    const initial = options.initialValue
    this.selection = initial
      ? cloneSelection(initial)
      : { kind: 'utility', utilityId: enabledUtilities[0]?.id }
    this.normalizeSelection()

    this.element.className = 'phase-workspace-modal style-source-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'styleSourceDialogTitle')
    this.element.addEventListener('click', event => {
      if (event.target === this.element) this.close()
    })
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      this.close()
    })
    document.body.append(this.element)
    this.render()
  }

  open() {
    if (!this.element.isConnected) document.body.append(this.element)
    this.element.hidden = false
    this.focusController.activate(
      this.element.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
    )
  }

  private normalizeSelection() {
    const utilityId = this.selection.utilityId
    if (!this.availableUtilities().some(utility => utility.id === utilityId)) {
      this.selection.utilityId = this.availableUtilities()[0]?.id
    }
    if (this.options.mode === 'flow') {
      this.selection.kind = 'utility'
      delete this.selection.deviceId
      delete this.selection.stateId
      return
    }
    const device = this.availableDevices().find(
      candidate => candidate.id === this.selection.deviceId
    )
    const stateExists = device?.states.some(
      state => state.id === this.selection.stateId && state.enabled
    )
    if (!stateExists) {
      const firstDevice = this.availableDevices()[0]
      this.selection.deviceId = firstDevice?.id
      this.selection.stateId = firstDevice
        ? this.availableDeviceStates(firstDevice)[0]?.id
        : undefined
      if (!firstDevice && this.selection.kind === 'device-state') {
        this.selection.kind = 'utility'
      }
    }
  }

  private close() {
    if (this.element.hidden) return
    this.element.hidden = true
    this.focusController.deactivate()
    this.element.remove()
    this.options.onClose()
  }

  private apply() {
    this.options.onApply(cloneSelection(this.selection))
    this.close()
  }

  private render() {
    this.element.replaceChildren()
    const dialog = document.createElement('section')
    dialog.className = 'phase-workspace-modal-dialog style-source-dialog'

    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'styleSourceDialogTitle'
    title.textContent =
      this.options.mode === 'brush' ? '选择画笔样式' : '选择连通流路样式'
    const close = this.iconButton('关闭样式选择对话框', () => this.close())
    header.append(title, close)

    const body = document.createElement('div')
    body.className = 'style-source-body'
    const sourceGroup = document.createElement('div')
    sourceGroup.className = 'style-source-segments'
    sourceGroup.setAttribute('role', 'radiogroup')
    sourceGroup.setAttribute('aria-label', '样式来源')
    sourceGroup.append(this.sourceButton('utility', 'Utility 预设'))
    if (this.options.mode === 'brush') {
      sourceGroup.append(this.sourceButton('device-state', '设备样式预设'))
    }
    body.append(sourceGroup, this.renderSourceControls(), this.renderPreview())

    const footer = document.createElement('footer')
    footer.className = 'phase-workspace-modal-actions style-source-actions'
    const cancel = this.button('取消', () => this.close())
    const apply = this.button('应用', () => this.apply())
    apply.classList.add('phase-workspace-primary')
    footer.append(cancel, apply)

    dialog.append(header, body, footer)
    this.element.append(dialog)
    localizeDom(this.element, this.options.getLocale?.() ?? 'zh')
  }

  private sourceButton(
    kind: StyleSourceSelection['kind'],
    label: string
  ) {
    const button = this.button(label, () => {
      if (kind === 'utility') {
        this.selection = {
          ...this.selection,
          kind: 'utility',
          utilityId:
            this.selection.utilityId ?? this.availableUtilities()[0]?.id
        }
      } else {
        const device = this.availableDevices()[0]
        const state = device && this.availableDeviceStates(device)[0]
        if (!device || !state) return
        this.selection = {
          ...this.selection,
          kind: 'device-state',
          deviceId: this.selection.deviceId ?? device.id,
          stateId: this.selection.stateId ?? state.id
        }
      }
      this.render()
    })
    const selected = this.selection.kind === kind
    button.setAttribute('role', 'radio')
    button.setAttribute('aria-checked', String(selected))
    return button
  }

  private renderSourceControls() {
    const section = document.createElement('section')
    section.className = 'style-source-controls'
    if (this.selection.kind === 'utility') {
      const label = document.createElement('label')
      label.textContent = 'Utility 样式'
      const select = document.createElement('select')
      select.setAttribute('aria-label', 'Utility 样式')
      this.availableUtilities()
        .forEach(utility => select.add(new Option(utility.name, utility.id)))
      select.value = this.selection.utilityId ?? ''
      select.addEventListener('change', () => {
        this.selection = {
          ...this.selection,
          kind: 'utility',
          utilityId: select.value || undefined
        }
        this.render()
      })
      label.append(select)
      section.append(label)
      return section
    }
    if (this.selection.kind === 'device-state') {
      const selection = this.selection
      const deviceLabel = document.createElement('label')
      deviceLabel.textContent = '设备样式'
      const deviceSelect = document.createElement('select')
      deviceSelect.setAttribute('aria-label', '设备样式')
      this.availableDevices().forEach(device =>
        deviceSelect.add(new Option(device.name, device.id))
      )
      deviceSelect.value = selection.deviceId ?? ''
      deviceSelect.addEventListener('change', () => {
        const device = this.availableDevices().find(
          candidate => candidate.id === deviceSelect.value
        )!
        this.selection = {
          ...this.selection,
          kind: 'device-state',
          deviceId: device.id,
          stateId: this.availableDeviceStates(device)[0].id
        }
        this.render()
      })
      deviceLabel.append(deviceSelect)

      const stateLabel = document.createElement('label')
      stateLabel.textContent = '设备状态'
      const stateSelect = document.createElement('select')
      stateSelect.setAttribute('aria-label', '设备状态')
      const device = this.availableDevices().find(
        candidate => candidate.id === selection.deviceId
      )!
      this.availableDeviceStates(device).forEach(state =>
        stateSelect.add(new Option(state.displayName, state.id))
      )
      stateSelect.value = selection.stateId ?? ''
      stateSelect.addEventListener('change', () => {
        this.selection = {
          ...this.selection,
          kind: 'device-state',
          deviceId: device.id,
          stateId: stateSelect.value
        }
        this.render()
      })
      stateLabel.append(stateSelect)
      section.append(deviceLabel, stateLabel)
      return section
    }

    return section
  }

  private renderPreview() {
    const style = this.resolvePreviewStyle()
    const preview = document.createElement('div')
    preview.className = 'style-source-preview'
    const line = document.createElement('span')
    line.style.backgroundColor = toHex(style.color)
    line.style.height = `${style.lineWidthPx}px`
    line.style.opacity = String(style.opacity)
    const description = document.createElement('span')
    description.textContent = `${(this.options.getLocale?.() ?? 'zh') === 'en' ? 'Preview' : '预览'
      } · ${Math.round(style.opacity * 100)}% · ${style.lineWidthPx}px`
    preview.append(line, description)
    return preview
  }

  private resolvePreviewStyle(): HighlightStyle {
    if (this.selection.kind === 'device-state') {
      return resolveDevicePresetStyle(
        this.options.profile,
        this.selection.deviceId ?? '',
        this.selection.stateId ?? ''
      ) ?? this.options.profile.defaultFlowStyle
    }
    const utilityId = this.selection.utilityId
    return (
      this.options.profile.utilities.find(
        utility =>
          utility.id === utilityId
      )?.style ?? this.options.profile.defaultFlowStyle
    )
  }

  private availableUtilities() {
    return [...this.options.profile.utilities]
      .filter(utility => utility.enabled)
      .sort((left, right) => left.order - right.order)
  }

  private availableDevices(): DeviceStyleDefinition[] {
    return [...this.options.profile.devices]
      .filter(device => device.states.some(state => state.enabled))
      .sort((left, right) => left.order - right.order)
  }

  private availableDeviceStates(
    device: DeviceStyleDefinition
  ): DeviceStateStyleDefinition[] {
    return [...device.states]
      .filter(state => state.enabled)
      .sort((left, right) => left.order - right.order)
  }

  private button(label: string, action: () => void) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', action)
    return button
  }

  private iconButton(label: string, action: () => void) {
    const button = this.button('', action)
    button.className = 'phase-icon-button'
    button.title = label
    button.setAttribute('aria-label', label)
    button.append(createPhaseIcon(X))
    return button
  }
}