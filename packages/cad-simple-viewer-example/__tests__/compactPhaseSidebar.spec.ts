/** @jest-environment jsdom */

import { setupCompactPhaseSidebar } from '../src/compactPhaseSidebar'

describe('compact phase sidebar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
    })
  })

  it('opens, closes with Escape, and restores focus', () => {
    const sidebar = document.createElement('aside')
    const firstButton = document.createElement('button')
    sidebar.append(firstButton)
    const toggle = document.createElement('button')
    const scrim = document.createElement('button')
    document.body.append(sidebar, toggle, scrim)

    setupCompactPhaseSidebar(sidebar, toggle, scrim, 960)
    expect(sidebar.inert).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    toggle.click()
    expect(sidebar.classList.contains('is-compact-open')).toBe(true)
    expect(document.activeElement).toBe(firstButton)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(sidebar.classList.contains('is-compact-open')).toBe(false)
    expect(document.activeElement).toBe(toggle)
  })
})