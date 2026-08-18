import { AlertTriangle, X } from 'lucide'

import { createPhaseIcon } from '../phase/phaseIcons'

export interface ConfirmationModalOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export class ConfirmationModal {
  readonly element = document.createElement('div')
  private resolve?: (confirmed: boolean) => void

  constructor() {
    this.element.className = 'confirmation-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.addEventListener('pointerdown', event => {
      if (event.target === this.element) this.close(false)
    })
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.close(false)
    })
    document.body.append(this.element)
  }

  confirm(options: ConfirmationModalOptions): Promise<boolean> {
    this.close(false)
    this.render(options)
    this.element.hidden = false
    document.body.classList.add('confirmation-modal-open')
    this.element.querySelector<HTMLButtonElement>('.confirmation-modal-cancel')?.focus()
    return new Promise(resolve => {
      this.resolve = resolve
    })
  }

  private render(options: ConfirmationModalOptions) {
    this.element.replaceChildren()
    this.element.setAttribute('aria-labelledby', 'confirmationModalTitle')
    this.element.setAttribute('aria-describedby', 'confirmationModalMessage')

    const shell = document.createElement('section')
    shell.className = `confirmation-modal-shell is-${options.tone ?? 'default'}`
    const header = document.createElement('header')
    const icon = document.createElement('span')
    icon.className = 'confirmation-modal-symbol'
    icon.append(createPhaseIcon(AlertTriangle))
    const title = document.createElement('h2')
    title.id = 'confirmationModalTitle'
    title.textContent = options.title
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'confirmation-modal-close'
    close.title = '关闭'
    close.setAttribute('aria-label', '关闭')
    close.append(createPhaseIcon(X))
    close.addEventListener('click', () => this.close(false))
    header.append(icon, title, close)

    const message = document.createElement('p')
    message.id = 'confirmationModalMessage'
    message.textContent = options.message

    const actions = document.createElement('footer')
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'confirmation-modal-cancel'
    cancel.textContent = options.cancelLabel ?? '取消'
    cancel.addEventListener('click', () => this.close(false))
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = 'confirmation-modal-confirm'
    confirm.textContent = options.confirmLabel ?? '确认'
    confirm.addEventListener('click', () => this.close(true))
    actions.append(cancel, confirm)
    shell.append(header, message, actions)
    this.element.append(shell)
  }

  private close(confirmed: boolean) {
    if (this.element.hidden) return
    this.element.hidden = true
    document.body.classList.remove('confirmation-modal-open')
    const resolve = this.resolve
    this.resolve = undefined
    resolve?.(confirmed)
  }
}