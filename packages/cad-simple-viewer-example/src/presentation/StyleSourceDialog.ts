import { X } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import type { HighlightStyle, PresentationProfile } from '../phase/types'
import { createModalFocusController } from '../ui/modalFocus'
import { localizeDom } from '../uiTranslations'

export type ValveStyleState = 'open' | 'closed' | 'pulse'

export type StyleSourceSelection =
  | { kind: 'utility'; utilityId?: string }
  | { kind: 'valve-state'; state: ValveStyleState }
  | { kind: 'custom'; style: HighlightStyle }

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

const parseHex = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : undefined

const cloneSelection = (
  value: StyleSourceSelection
): StyleSourceSelection =>
  value.kind === 'custom'
    ? { kind: 'custom', style: { ...value.style } }
    : { ...value }

export class StyleSourceDialog {
  readonly element = document.createElement('div')
  private readonly focusController = createModalFocusController(this.element)
  private selection: StyleSourceSelection
  private customStyle: HighlightStyle

  constructor(private readonly options: StyleSourceDialogOptions) {
    const enabledUtilities = this.availableUtilities()
    const initial = options.initialValue
    this.selection = initial
      ? cloneSelection(initial)
      : { kind: 'utility', utilityId: enabledUtilities[0]?.id }
    this.customStyle =
      initial?.kind === 'custom'
        ? { ...initial.style }
        : { ...options.profile.defaultFlowStyle }
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
    if (this.selection.kind === 'utility') {
      const utilityId = this.selection.utilityId
      const utilityExists = this.availableUtilities().some(
        utility => utility.id === utilityId
      )
      if (!utilityExists) {
        this.selection = {
          kind: 'utility',
          utilityId: this.availableUtilities()[0]?.id
        }
      }
      return
    }
    if (this.options.mode === 'flow') {
      this.selection = {
        kind: 'utility',
        utilityId: this.availableUtilities()[0]?.id
      }
      return
    }
    if (
      this.selection.kind === 'valve-state' &&
      !this.hasValveStyle(this.selection.state)
    ) {
      this.selection = { kind: 'utility' }
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
    this.options.onApply(
      this.selection.kind === 'custom'
        ? { kind: 'custom', style: { ...this.customStyle } }
        : cloneSelection(this.selection)
    )
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
      sourceGroup.append(this.sourceButton('valve-state', '阀门状态预设'))
      sourceGroup.append(this.sourceButton('custom', '自定义'))
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
        this.selection = { kind: 'utility' }
      } else if (kind === 'valve-state') {
        const state = this.availableValveStates()[0]
        if (!state) return
        this.selection = { kind: 'valve-state', state }
      } else {
        this.selection = { kind: 'custom', style: this.customStyle }
      }
      this.render()
    })
    const selected = this.selection.kind === kind
    button.setAttribute('role', 'radio')
    button.setAttribute('aria-checked', String(selected))
    button.disabled = kind === 'valve-state' && this.availableValveStates().length === 0
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
          kind: 'utility',
          utilityId: select.value || undefined
        }
        this.render()
      })
      label.append(select)
      section.append(label)
      return section
    }
    if (this.selection.kind === 'valve-state') {
      const label = document.createElement('label')
      label.textContent = '阀门状态'
      const select = document.createElement('select')
      select.setAttribute('aria-label', '阀门状态')
      this.availableValveStates().forEach(state =>
        select.add(new Option(state.toUpperCase(), state))
      )
      select.value = this.selection.state
      select.addEventListener('change', () => {
        this.selection = {
          kind: 'valve-state',
          state: select.value as ValveStyleState
        }
        this.render()
      })
      label.append(select)
      section.append(label)
      return section
    }

    const colorLabel = document.createElement('label')
    colorLabel.textContent = '颜色'
    const color = document.createElement('input')
    color.type = 'color'
    color.value = toHex(this.customStyle.color)
    color.setAttribute('aria-label', '自定义颜色')
    const hex = document.createElement('input')
    hex.value = toHex(this.customStyle.color).toUpperCase()
    hex.setAttribute('aria-label', '自定义十六进制颜色')
    const updateColor = (value: string) => {
      const parsed = parseHex(value)
      if (parsed == null) return
      this.customStyle.color = parsed
      this.render()
    }
    color.addEventListener('input', () => updateColor(color.value))
    hex.addEventListener('change', () => updateColor(hex.value))
    const colorInputs = document.createElement('span')
    colorInputs.className = 'style-source-color-inputs'
    colorInputs.append(color, hex)
    colorLabel.append(colorInputs)

    const opacityLabel = document.createElement('label')
    opacityLabel.textContent = '透明度'
    const opacity = document.createElement('input')
    opacity.type = 'range'
    opacity.min = '0'
    opacity.max = '1'
    opacity.step = '0.05'
    opacity.value = String(this.customStyle.opacity)
    opacity.setAttribute('aria-label', '自定义透明度')
    const opacityValue = document.createElement('output')
    opacityValue.textContent = `${Math.round(this.customStyle.opacity * 100)}%`
    opacity.addEventListener('input', () => {
      this.customStyle.opacity = Number(opacity.value)
      opacityValue.textContent = `${Math.round(this.customStyle.opacity * 100)}%`
    })
    const opacityInputs = document.createElement('span')
    opacityInputs.className = 'style-source-range-inputs'
    opacityInputs.append(opacity, opacityValue)
    opacityLabel.append(opacityInputs)

    const widthLabel = document.createElement('label')
    widthLabel.textContent = '线宽'
    const width = document.createElement('input')
    width.type = 'number'
    width.min = '1'
    width.max = '12'
    width.step = '0.5'
    width.value = String(this.customStyle.lineWidthPx)
    width.setAttribute('aria-label', '自定义线宽')
    width.addEventListener('input', () => {
      this.customStyle.lineWidthPx = Math.min(
        12,
        Math.max(1, Number(width.value) || 1)
      )
    })
    widthLabel.append(width)
    section.append(colorLabel, opacityLabel, widthLabel)
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
    if (this.selection.kind === 'custom') return this.customStyle
    if (this.selection.kind === 'valve-state') {
      return (
        this.options.profile.deviceStyles.valve[this.selection.state] ??
        this.options.profile.defaultFlowStyle
      )
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

  private availableValveStates(): ValveStyleState[] {
    return (['open', 'closed', 'pulse'] as const).filter(state =>
      this.hasValveStyle(state)
    )
  }

  private hasValveStyle(state: ValveStyleState) {
    return this.options.profile.deviceStyles.valve[state] != null
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