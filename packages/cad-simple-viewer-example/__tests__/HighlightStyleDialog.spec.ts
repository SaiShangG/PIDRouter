/** @jest-environment jsdom */

import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { HighlightStyleDialog } from '../src/presentation/HighlightStyleDialog'

const value = () => ({
  presentationProfile: createDefaultPresentationProfile()
})

describe('HighlightStyleDialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.classList.remove('highlight-style-open')
  })

  it('opens independently, closes with Escape, and restores focus', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const onClose = jest.fn()
    const dialog = new HighlightStyleDialog({ value: value(), onClose })

    dialog.open()
    expect(dialog.element.parentElement).toBe(document.body)
    expect(dialog.element.hidden).toBe(false)
    dialog.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )

    expect(dialog.element.isConnected).toBe(false)
    expect(document.activeElement).toBe(trigger)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps edits local and closes without applying them', () => {
    const onClose = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: value(),
      onClose
    })
    dialog.open()

    expect(dialog.element.textContent).toContain('新增设备')
    expect(dialog.element.textContent).not.toContain('显示高亮')
    expect(dialog.element.querySelector('[aria-label="流路名称"]')).toBeNull()
      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent?.includes('新增设备'))!
        .click()
      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent?.includes('新增状态'))!
        .click()

    const color = dialog.element.querySelector<HTMLInputElement>(
      '[aria-label="高亮颜色"]'
    )!
    color.value = '#123456'
    color.dispatchEvent(new Event('input'))
      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent === '取消')!
        .click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('switches tabs and keeps utility changes inside the dialog', () => {
    const onClose = jest.fn()
    const onApply = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: value(),
      createId: () => 'utility-1',
      onApply,
      onClose
    })
    dialog.open()

    const utilityTab = [...dialog.element.querySelectorAll('button')].find(
      button => button.textContent === 'Utility'
    )!
    utilityTab.click()
    expect(utilityTab.getAttribute('role')).toBe('tab')
      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent === '新增 Utility')!
        .click()
      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent === '应用')!
        .click()

    expect(onClose).not.toHaveBeenCalled()
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationProfile: expect.objectContaining({
          utilities: [expect.objectContaining({ id: 'utility-1' })]
        })
      })
    )
    expect(
      dialog.element.querySelector<HTMLInputElement>('input[aria-label="Utility 名称"]')
        ?.value
    ).toBe('Utility 1')
  })

  it('adds a device and nested state configuration', () => {
    const dialog = new HighlightStyleDialog({
      value: value(),
      onClose: jest.fn()
    })
    dialog.open()

      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent === '设备')!
        .click()
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(0)

      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent?.includes('新增设备'))!
        .click()
    expect(dialog.element.querySelectorAll('.highlight-device-card')).toHaveLength(1)

      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent?.includes('新增状态'))!
        .click()
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(1)
    expect(dialog.element.querySelector('[aria-label="状态 key"]')).not.toBeNull()
    expect(dialog.element.querySelector('[aria-label="右键显示名称"]')).not.toBeNull()
    expect(
      dialog.element.querySelector<HTMLInputElement>(
        '[aria-label="高亮透明度"]'
      )
    ).not.toBeNull()

      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent === '应用')!
        .click()
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(1)
  })
})