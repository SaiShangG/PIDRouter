export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export function reportMessage(message: string, tone: ToastTone = 'info') {
  const method = tone === 'error' ? 'error' : tone === 'warning' ? 'warn' : 'info'
  console[method](message)
}