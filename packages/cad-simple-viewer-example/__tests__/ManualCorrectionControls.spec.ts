/** @jest-environment jsdom */

import {
  ManualCorrectionControls,
  type ManualCorrectionControlState
} from '../src/brush/ManualCorrectionControls'
import type { AppLocale } from '../src/locale'

const ready = (): ManualCorrectionControlState => ({
  scopeKey: 'phase:1:activation:1',
  enabled: true, additions: 3, exclusions: 2, canUndo: true, canRedo: false
})

const fixture = () => {
  let locale: AppLocale = 'zh'
  const undo = jest.fn()
  const redo = jest.fn()
  const clear = jest.fn()
  const controls = new ManualCorrectionControls({
    getLocale: () => locale, undo, redo, clear
  })
  document.body.append(controls.element)
  const button = (action: string) =>
    controls.element.querySelector<HTMLButtonElement>(`[data-correction-action="${action}"]`)!
  const confirm = () =>
    document.querySelector<HTMLButtonElement>('.confirmation-modal-confirm')!.click()
  const cancel = () =>
    document.querySelector<HTMLButtonElement>('.confirmation-modal-cancel')!.click()
  return {
    controls, undo, redo, clear, button, confirm, cancel,
    setLocale: (value: AppLocale) => { locale = value }
  }
}

describe('ManualCorrectionControls', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.classList.remove('confirmation-modal-open')
  })

  it('displays counts, enables available history and invokes separate correction actions', () => {
    const { controls, undo, redo, button } = fixture()
    expect(button('undo').disabled).toBe(true)
    controls.update(ready())
    expect(controls.element.textContent).toContain('人工修正：补充 3 项，排除 2 项')
    button('undo').click()
    button('redo').click()
    expect(undo).toHaveBeenCalledTimes(1)
    expect(redo).not.toHaveBeenCalled()
    controls.update({ ...ready(), canUndo: false, canRedo: true })
    button('redo').click()
    expect(redo).toHaveBeenCalledTimes(1)
  })

  it('disables controls during drawing/loading and when corrections are empty', () => {
    const { controls, button, clear, undo } = fixture()
    controls.update({ ...ready(), enabled: false })
    for (const action of ['undo', 'redo', 'clear']) {
      expect(button(action).disabled).toBe(true)
      button(action).click()
    }
    expect(clear).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
    controls.update({ ...ready(), additions: 0, exclusions: 0 })
    expect(button('clear').disabled).toBe(true)
  })

  it('localizes counts, button names and clear confirmation', () => {
    const { controls, button, setLocale, cancel } = fixture()
    setLocale('en')
    controls.update(ready())
    expect(controls.element.textContent).toContain('Manual corrections: 3 additions, 2 exclusions')
    expect(button('undo').getAttribute('aria-label')).toBe('Undo correction')
    button('clear').click()
    expect(document.querySelector('.confirmation-modal')!.textContent)
      .toContain('Clear current manual corrections?')
    cancel()
  })

  it('does nothing on cancellation and clears only after explicit confirmation', async () => {
    const { controls, button, clear, confirm, cancel } = fixture()
    controls.update(ready())
    button('clear').click()
    expect(clear).not.toHaveBeenCalled()
    expect(button('clear').disabled).toBe(true)
    cancel()
    await Promise.resolve()
    expect(clear).not.toHaveBeenCalled()
    expect(button('clear').disabled).toBe(false)
    button('clear').click()
    button('clear').click()
    confirm()
    await Promise.resolve()
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('never applies an old confirmation to another phase or a new activation of the same phase', async () => {
    const { controls, button, clear, confirm } = fixture()
    controls.update(ready())
    button('clear').click()
    controls.update({ ...ready(), scopeKey: 'phase:2:activation:2' })
    controls.update({ ...ready(), scopeKey: 'phase:1:activation:3' })
    confirm()
    await Promise.resolve()
    expect(clear).not.toHaveBeenCalled()
    expect(button('clear').disabled).toBe(false)
  })

  it('does not clear when a workspace starts loading while confirmation is open', async () => {
    const { controls, button, clear, confirm } = fixture()
    controls.update(ready())
    button('clear').click()
    controls.update({ ...ready(), enabled: false })
    confirm()
    await Promise.resolve()
    expect(clear).not.toHaveBeenCalled()
    expect(button('clear').disabled).toBe(true)
  })
})
