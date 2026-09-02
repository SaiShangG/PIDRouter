import { AlertTriangle, FileJson, X } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { createModalFocusController } from '../ui/modalFocus'

export type HighlightStyleImportMode = 'merge' | 'replace'

export interface HighlightStyleImportAnalysis {
  deviceCount: number
  stateCount: number
  utilityCount: number
  duplicateDevices: string[]
  duplicateStates: string[]
  errors: string[]
}

export interface HighlightStyleImportPreviewOptions {
  locale: AppLocale
  analysis: HighlightStyleImportAnalysis
  onConfirm(mode: HighlightStyleImportMode): void
  onClose(): void
}

export class HighlightStyleImportPreviewModal {
  readonly element = document.createElement('div')
  private mode: HighlightStyleImportMode = 'merge'
  private readonly focusController = createModalFocusController(this.element)

  constructor(private readonly options: HighlightStyleImportPreviewOptions) {
    this.element.className = 'phase-workspace-modal highlight-import-preview-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'highlightImportPreviewTitle')
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    })
    document.body.append(this.element)
    this.render()
  }

  open() {
    this.element.hidden = false
    this.focusController.activate(
      this.element.querySelector<HTMLButtonElement>('.highlight-import-cancel')
    )
  }

  private render() {
    const en = this.options.locale === 'en'
    const { analysis } = this.options
    const shell = document.createElement('section')
    shell.className = 'phase-workspace-modal-dialog highlight-import-preview-dialog'

    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'highlightImportPreviewTitle'
    title.append(createPhaseIcon(FileJson), en ? 'Import preview' : '导入预览')
    const close = this.iconButton(en ? 'Close import preview' : '关闭导入预览', X, () => this.close())
    header.append(title, close)

    const body = document.createElement('div')
    body.className = 'highlight-import-preview-body'
    const summary = document.createElement('div')
    summary.className = 'highlight-import-summary'
    summary.append(
      this.metric(en ? 'Devices' : '设备', analysis.deviceCount),
      this.metric(en ? 'States' : '状态', analysis.stateCount),
      this.metric('Utility', analysis.utilityCount)
    )
    body.append(summary)

    const issues = [
      ...analysis.errors.map(message => ({ kind: 'error', message })),
      ...analysis.duplicateDevices.map(value => ({
        kind: 'warning',
        message: en ? `Existing device: ${value}` : `重复设备：${value}`
      })),
      ...analysis.duplicateStates.map(value => ({
        kind: 'warning',
        message: en ? `Existing or duplicate state: ${value}` : `重复状态：${value}`
      }))
    ]
    if (issues.length > 0) {
      const issueList = document.createElement('ul')
      issueList.className = 'highlight-import-issues'
      issues.forEach(issue => {
        const item = document.createElement('li')
        item.className = `is-${issue.kind}`
        item.append(createPhaseIcon(AlertTriangle), issue.message)
        issueList.append(item)
      })
      body.append(issueList)
    } else {
      const valid = document.createElement('p')
      valid.className = 'highlight-import-valid'
      valid.textContent = en ? 'No duplicate devices or states found.' : '未发现重复设备或状态。'
      body.append(valid)
    }

    const modes = document.createElement('div')
    modes.className = 'highlight-import-modes'
    modes.setAttribute('role', 'radiogroup')
    modes.setAttribute('aria-label', en ? 'Import mode' : '导入方式')
    modes.append(
      this.modeButton('merge', en ? 'Merge with current configuration' : '合并现有配置'),
      this.modeButton('replace', en ? 'Replace all configuration' : '替换全部配置')
    )
    body.append(modes)

    const footer = document.createElement('footer')
    footer.className = 'phase-workspace-modal-actions highlight-import-actions'
    const cancel = this.button(en ? 'Cancel' : '取消', () => this.close())
    cancel.className = 'highlight-import-cancel'
    const confirm = this.button(en ? 'Confirm import' : '确认导入', () => {
      this.options.onConfirm(this.mode)
      this.close(false)
    })
    confirm.classList.add('phase-workspace-primary')
    confirm.disabled = analysis.errors.length > 0
    footer.append(cancel, confirm)
    shell.append(header, body, footer)
    this.element.append(shell)
  }

  private metric(label: string, value: number) {
    const item = document.createElement('div')
    const count = document.createElement('strong')
    count.textContent = String(value)
    const text = document.createElement('span')
    text.textContent = label
    item.append(count, text)
    return item
  }

  private modeButton(mode: HighlightStyleImportMode, label: string) {
    const button = this.button(label, () => {
      this.mode = mode
      this.element.querySelectorAll('[role="radio"]').forEach(item =>
        item.setAttribute('aria-checked', String(item === button)))
    })
    button.setAttribute('role', 'radio')
    button.setAttribute('aria-checked', String(this.mode === mode))
    return button
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

  private close(notify = true) {
    if (this.element.hidden) return
    this.element.hidden = true
    this.focusController.deactivate()
    this.element.remove()
    if (notify) this.options.onClose()
  }
}
