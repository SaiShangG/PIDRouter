/** @jest-environment jsdom */

import { reportMessage, type ToastTone } from '../src/ui/Toast'

describe('Toast', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    document.body.replaceChildren()
  })

  it.each<ToastTone>(['success', 'info', 'warning', 'error'])('logs %s messages without creating a popup', tone => {
    const method = tone === 'error' ? 'error' : tone === 'warning' ? 'warn' : 'info'
    const logger = jest.spyOn(console, method).mockImplementation(() => { })
    reportMessage('Drawing status', tone)
    expect(logger).toHaveBeenCalledWith('Drawing status')
    expect(document.body.childElementCount).toBe(0)
  })
})