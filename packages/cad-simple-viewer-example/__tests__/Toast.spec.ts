/** @jest-environment jsdom */

import { Toast } from '../src/ui/Toast'

describe('Toast', () => {
  afterEach(() => {
    jest.useRealTimers()
    document.body.replaceChildren()
  })

  it('announces messages and exposes an accessible close control', () => {
    const toast = new Toast(() => 'Close')
    toast.show('Drawing loaded', 'success')

    const element = document.querySelector<HTMLElement>('.app-toast')
    expect(element?.getAttribute('role')).toBe('status')
    expect(element?.getAttribute('aria-live')).toBe('polite')
    expect(element?.textContent).toContain('Drawing loaded')
    expect(element?.querySelector('button')?.getAttribute('aria-label')).toBe('Close')
  })

  it('uses assertive announcements for errors and supports manual dismissal', () => {
    const toast = new Toast(() => '关闭')
    toast.show('加载失败', 'error')

    const element = document.querySelector<HTMLElement>('.app-toast')
    expect(element?.getAttribute('role')).toBe('alert')
    expect(element?.getAttribute('aria-live')).toBe('assertive')
    element?.querySelector<HTMLButtonElement>('button')?.click()
    expect(document.querySelector('.app-toast')).toBeNull()
  })
})