/** @jest-environment jsdom */

import { BrushDebugPanel } from '../src/brush/BrushDebugPanel'

describe('BrushDebugPanel', () => {
  it.each(['zh', 'en'] as const)(
    'lists every unique entity and its latest operation in %s',
    locale => {
      const panel = new BrushDebugPanel(locale, {
        onEntityClick: jest.fn(() => true),
        onClear: jest.fn()
      })
      panel.record('paint', [
        { objectId: 'A', handleKey: 'A', entityType: 'LINE', layer: 'Pipes' },
        { objectId: 'B', handleKey: 'B', entityType: 'LWPOLYLINE' },
        { objectId: 'temporary-line' }
      ])
      const button = panel.element.querySelector<HTMLButtonElement>(
        '[data-entity-id="A"]'
      )!
      expect(button.textContent).toContain('LINE')
      expect(button.textContent).toContain('Entity ID: A')
      expect(button.textContent).toContain('Handle: A')
      expect(button.textContent).toContain('Pipes')
      expect(panel.element.textContent).toContain(
        locale === 'en' ? 'No persistent handle' : '无持久化句柄'
      )

      panel.record('erase', [
        { objectId: 'A', handleKey: 'A', entityType: 'LINE' }
      ])
      expect(panel.element.querySelectorAll('[data-entity-id]')).toHaveLength(3)
      expect(panel.element.querySelector('[data-entity-id="A"]')).toBe(button)
      expect(button.textContent).toContain(
        locale === 'en' ? 'Eraser hit' : '橡皮命中'
      )
      expect(panel.element.textContent).toContain(
        locale === 'en' ? 'Entity count: 3' : '实体数量: 3'
      )
    }
  )

  it('locates the exact picked ID, marks failures, and supports retrying', () => {
    const locate = jest.fn(() => false)
    const panel = new BrushDebugPanel('en', {
      onEntityClick: locate,
      onClear: jest.fn()
    })
    panel.record('paint', [{ objectId: 'temporary-line' }, { objectId: 'B' }])
    const first = panel.element.querySelector<HTMLButtonElement>(
      '[data-entity-id="temporary-line"]'
    )!
    first.click()
    expect(locate).toHaveBeenCalledWith('temporary-line')
    expect(first.getAttribute('aria-pressed')).toBe('true')
    expect(first.textContent).toContain('Cannot locate')
    locate.mockReturnValue(true)
    first.click()
    expect(first.textContent).not.toContain('Cannot locate')
    panel.element
      .querySelector<HTMLButtonElement>('[data-entity-id="B"]')!
      .click()
    expect(first.getAttribute('aria-pressed')).toBe('false')
  })

  it('translates retained rows and clears debug history only', () => {
    const clear = jest.fn()
    const panel = new BrushDebugPanel('zh', {
      onEntityClick: () => true,
      onClear: clear
    })
    panel.record('paint', [{ objectId: 'A', entityType: 'LINE' }])
    panel.setLocale('en')
    expect(panel.element.textContent).toContain('Brush hit')
    expect(panel.element.textContent).toContain('Clear list')
    panel.element
      .querySelector<HTMLButtonElement>('[data-brush-debug-clear]')!
      .click()
    expect(clear).toHaveBeenCalledTimes(1)
    expect(panel.element.querySelectorAll('[data-entity-id]')).toHaveLength(0)
    expect(
      panel.element.querySelector<HTMLButtonElement>(
        '[data-brush-debug-clear]'
      )!.disabled
    ).toBe(true)
    expect(
      panel.element.querySelector<HTMLElement>('.valve-debug-panel-empty')!
        .hidden
    ).toBe(false)
    panel.record('paint', [{ objectId: 'A' }])
    expect(panel.element.querySelectorAll('[data-entity-id]')).toHaveLength(1)
  })

  it('renders drawing metadata as text rather than markup', () => {
    const panel = new BrushDebugPanel('en', {
      onEntityClick: () => true,
      onClear: jest.fn()
    })
    panel.record('paint', [
      { objectId: 'A', layer: '<img src=x onerror=alert(1)>' }
    ])
    expect(panel.element.querySelector('img')).toBeNull()
    expect(panel.element.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})
