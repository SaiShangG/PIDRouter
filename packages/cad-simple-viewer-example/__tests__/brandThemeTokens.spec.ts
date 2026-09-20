/** @jest-environment jsdom */
import { injectBrandThemeTokens } from '../src/brandThemeTokens'

describe('shared select theme', () => {
  beforeEach(() => {
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it('injects the shared control and picker styles only once', () => {
    injectBrandThemeTokens()
    injectBrandThemeTokens()
    const styles = document.querySelectorAll('#pid-viewer-brand-theme-tokens')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toContain('select:focus-visible')
    expect(styles[0].textContent).toContain('select:disabled')
    expect(styles[0].textContent).toContain('select[aria-invalid="true"]')
    expect(styles[0].textContent).toContain('@supports (appearance: base-select)')
    expect(styles[0].textContent).toContain('select::picker(select)')
    expect(styles[0].textContent).toContain('background: var(--app-accent)')
  })

  it('leaves native selection, events and dynamically added controls intact', () => {
    injectBrandThemeTokens()
    const select = document.createElement('select')
    select.add(new Option('All Tanks', 'all'))
    select.add(new Option('Vessel_1', 'vessel-1'))
    document.body.append(select)
    const changed = jest.fn()
    select.addEventListener('change', changed)
    select.value = 'vessel-1'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(select.value).toBe('vessel-1')
    expect(changed).toHaveBeenCalledTimes(1)
    expect(select.options).toHaveLength(2)
  })
})