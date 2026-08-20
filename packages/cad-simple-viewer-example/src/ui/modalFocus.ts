const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export function createModalFocusController(element: HTMLElement) {
  let returnTarget: HTMLElement | null = null

  const getFocusable = () =>
    [...element.querySelectorAll<HTMLElement>(focusableSelector)].filter(
      item => !item.hidden && item.getAttribute('aria-hidden') !== 'true'
    )
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const focusable = getFocusable()
    if (focusable.length === 0) {
      event.preventDefault()
      element.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return {
    activate(initialFocus?: HTMLElement | null) {
      returnTarget =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      element.tabIndex = -1
      element.addEventListener('keydown', onKeyDown)
      const target = initialFocus ?? getFocusable()[0] ?? element
      target.focus()
    },
    deactivate() {
      element.removeEventListener('keydown', onKeyDown)
      const target = returnTarget
      returnTarget = null
      if (target?.isConnected) target.focus()
    }
  }
}