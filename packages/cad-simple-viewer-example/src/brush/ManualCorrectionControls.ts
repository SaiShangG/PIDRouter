import { Redo2, RotateCcw, Undo2 } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { translateUiText } from '../uiTranslations'

export interface ManualCorrectionControlState {
  scopeKey?: string
  enabled: boolean
  additions: number
  exclusions: number
  canUndo: boolean
  canRedo: boolean
}

interface ManualCorrectionControlOptions {
  getLocale(): AppLocale
  undo(): void
  redo(): void
  clear(): void
}

export class ManualCorrectionControls {
  readonly element = document.createElement('section')
  private readonly summary = document.createElement('span')
  private readonly undoButton = document.createElement('button')
  private readonly redoButton = document.createElement('button')
  private readonly clearButton = document.createElement('button')
  private readonly confirmation: ConfirmationModal
  private confirming = false
  private state: ManualCorrectionControlState = {
    enabled: false, additions: 0, exclusions: 0, canUndo: false, canRedo: false
  }

  constructor(private readonly options: ManualCorrectionControlOptions) {
    this.element.className = 'manual-correction-controls'
    this.summary.className = 'manual-correction-summary'
    this.summary.setAttribute('role', 'status')
    this.confirmation = new ConfirmationModal(options.getLocale)
    const buttons = [
      { element: this.undoButton, icon: Undo2, action: options.undo, id: 'undo' },
      { element: this.redoButton, icon: Redo2, action: options.redo, id: 'redo' },
      { element: this.clearButton, icon: RotateCcw, action: () => { void this.confirmClear() }, id: 'clear' }
    ]
    buttons.forEach(({ element, icon, action, id }) => {
      element.type = 'button'
      element.dataset.correctionAction = id
      element.append(createPhaseIcon(icon), document.createElement('span'))
      element.addEventListener('click', () => {
        if (!element.disabled) action()
      })
    })
    this.element.append(this.summary, this.undoButton, this.redoButton, this.clearButton)
    this.update(this.state)
  }

  update(state: ManualCorrectionControlState) {
    this.state = { ...state }
    const t = (text: string) => translateUiText(this.options.getLocale(), text)
    this.element.setAttribute('aria-label', t('人工高亮修正'))
    this.summary.textContent = t('人工修正：补充 {additions} 项，排除 {exclusions} 项')
      .replace('{additions}', String(state.additions))
      .replace('{exclusions}', String(state.exclusions))
    const labels = [
      [this.undoButton, '撤销修正'],
      [this.redoButton, '重做修正'],
      [this.clearButton, '清除人工修正']
    ] as const
    labels.forEach(([button, text]) => {
      button.querySelector('span')!.textContent = t(text)
      button.title = t(text)
      button.setAttribute('aria-label', t(text))
    })
    const enabled = state.enabled && !this.confirming
    this.undoButton.disabled = !enabled || !state.canUndo
    this.redoButton.disabled = !enabled || !state.canRedo
    this.clearButton.disabled = !enabled || state.additions + state.exclusions === 0
  }

  private async confirmClear() {
    const scopeKey = this.state.scopeKey
    this.confirming = true
    this.update(this.state)
    try {
      const confirmed = await this.confirmation.confirm({
        title: '清除当前人工修正？',
        message: '将移除全部人工补充和排除，保留设备状态及自动流路，并清空修正撤销记录。此操作无法撤销。',
        confirmLabel: '清除人工修正',
        tone: 'danger'
      })
      if (confirmed && this.state.enabled && this.state.scopeKey === scopeKey) {
        this.options.clear()
      }
    } finally {
      this.confirming = false
      this.update(this.state)
    }
  }
}
