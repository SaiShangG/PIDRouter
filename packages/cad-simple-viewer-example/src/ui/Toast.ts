import { X } from 'lucide'

import { createPhaseIcon } from '../phase/phaseIcons'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export class Toast {
  private element?: HTMLElement
  private timeout?: number

  constructor(private readonly getCloseLabel: () => string) {}

  show(message: string, tone: ToastTone = 'info') {
    this.clear()
    const toast = document.createElement('div')
    toast.className = `app-toast is-${tone}`
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status')
    toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite')

    const text = document.createElement('span')
    text.className = 'app-toast-message'
    text.textContent = message
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'app-toast-close'
    close.setAttribute('aria-label', this.getCloseLabel())
    close.title = this.getCloseLabel()
    close.append(createPhaseIcon(X))
    close.addEventListener('click', () => this.clear())
    toast.append(text, close)
    document.body.append(toast)
    this.element = toast

    const duration = tone === 'error' ? 6000 : 3000
    this.timeout = window.setTimeout(() => this.clear(), duration)
  }

  clear() {
    if (this.timeout !== undefined) window.clearTimeout(this.timeout)
    this.timeout = undefined
    this.element?.remove()
    this.element = undefined
  }
}