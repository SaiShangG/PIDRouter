/** @jest-environment jsdom */

import { reportMessage, showWarningToast, type ToastTone } from '../src/ui/Toast'

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
    document.body.replaceChildren()
  })

  it.each<ToastTone>(['success', 'info', 'warning', 'error'])('logs %s messages without creating a popup', tone => {
    const method = tone === 'error' ? 'error' : tone === 'warning' ? 'warn' : 'info'
    const logger = jest.spyOn(console, method).mockImplementation(() => { })
    reportMessage('Drawing status', tone)
    expect(logger).toHaveBeenCalledWith('Drawing status')
    expect(document.body.childElementCount).toBe(0)
  })

  it('shows an accessible warning without stealing focus and removes it after five seconds', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => { })
    const active = document.createElement('button')
    document.body.append(active)
    active.focus()
    showWarningToast('Close <deleted>: select a valid state.')
    const toast = document.querySelector('.app-device-state-warning-toast')!
    expect(toast.getAttribute('role')).toBe('status')
    expect(toast.getAttribute('aria-live')).toBe('polite')
    expect(toast.textContent).toBe('Close <deleted>: select a valid state.')
    expect(toast.querySelector('deleted')).toBeNull()
    expect(document.activeElement).toBe(active)
    jest.advanceTimersByTime(4999)
    expect(toast.isConnected).toBe(true)
    jest.advanceTimersByTime(1)
    expect(toast.isConnected).toBe(false)
  })

  it('replaces an existing warning instead of stacking repeated popups', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => { })
    showWarningToast('First warning')
    jest.advanceTimersByTime(4000)
    showWarningToast('New invalid reference')
    expect(document.querySelectorAll('.app-device-state-warning-toast')).toHaveLength(1)
    jest.advanceTimersByTime(1000)
    expect(document.querySelector('.app-device-state-warning-toast')?.textContent)
      .toBe('New invalid reference')
    jest.advanceTimersByTime(4000)
    expect(document.querySelector('.app-device-state-warning-toast')).toBeNull()
  })
})