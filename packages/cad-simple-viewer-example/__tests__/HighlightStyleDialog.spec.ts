/** @jest-environment jsdom */

import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { HighlightStyleDialog } from '../src/presentation/HighlightStyleDialog'

const value = () => ({
  presentationProfile: createDefaultPresentationProfile()
})

describe('HighlightStyleDialog', () => {
  afterEach(() => document.body.replaceChildren())

  it('keeps edits local and closes without applying them', () => {
    const onClose = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: value(),
      onClose
    })
    document.body.append(dialog.element)

    expect(dialog.element.textContent).toContain('所有 Phase 的默认流路')
    expect(dialog.element.querySelector('[aria-label="流路名称"]')).toBeNull()

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
    const dialog = new HighlightStyleDialog({
      value: value(),
      createId: () => 'utility-1',
      onClose
    })
    document.body.append(dialog.element)

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
    expect(
      dialog.element.querySelector<HTMLInputElement>('input[aria-label="Utility 名称"]')
        ?.value
    ).toBe('Utility 1')
  })

  it('starts with null device styles and lets the user add one', () => {
    const dialog = new HighlightStyleDialog({
      value: value(),
      onClose: jest.fn()
    })
    document.body.append(dialog.element)

    ;[...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent === '设备')!
      .click()
    expect(dialog.element.textContent).toContain('默认值为 null')
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(0)

    ;[...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent?.includes('新增设备状态'))!
      .click()
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(1)

    ;[...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent === '应用')!
      .click()
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(1)
  })
})