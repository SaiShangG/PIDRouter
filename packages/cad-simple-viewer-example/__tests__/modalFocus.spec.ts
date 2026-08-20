/** @jest-environment jsdom */

import { createModalFocusController } from '../src/ui/modalFocus'

describe('modal focus controller', () => {
  it('traps focus and restores the trigger', () => {
    const trigger = document.createElement('button')
    const modal = document.createElement('div')
    const first = document.createElement('button')
    const last = document.createElement('button')
    modal.append(first, last)
    document.body.append(trigger, modal)
    trigger.focus()
    const controller = createModalFocusController(modal)

    controller.activate(first)
    expect(document.activeElement).toBe(first)
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    controller.deactivate()
    expect(document.activeElement).toBe(trigger)
  })
})