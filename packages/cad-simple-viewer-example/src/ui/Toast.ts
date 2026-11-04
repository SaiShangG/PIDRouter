import { injectToastStyles } from './toastStyles'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

let warningToast: HTMLDivElement | undefined
let warningToastTimeout: number | undefined

export function reportMessage(message: string, tone: ToastTone = 'info') {
  const method = tone === 'error' ? 'error' : tone === 'warning' ? 'warn' : 'info'
  console[method](message)
}

export function showWarningToast(message: string) {
  reportMessage(message, 'warning')
  injectToastStyles()
  warningToast?.remove()
  if (warningToastTimeout !== undefined) window.clearTimeout(warningToastTimeout)
  const toast = document.createElement('div')
  toast.className = 'app-toast is-warning app-device-state-warning-toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  toast.style.pointerEvents = 'none'
  const text = document.createElement('div')
  text.className = 'app-toast-message'
  text.textContent = message
  toast.append(text)
  document.body.append(toast)
  warningToast = toast
  warningToastTimeout = window.setTimeout(() => {
    toast.remove()
    warningToast = undefined
    warningToastTimeout = undefined
  }, 5000)
}