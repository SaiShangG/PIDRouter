/** @jest-environment jsdom */

import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { StyleSourceDialog } from '../src/presentation/StyleSourceDialog'

const createProfile = () => {
  const profile = createDefaultPresentationProfile()
  profile.utilities.push({
    id: 'water',
    name: 'Water',
    style: {
      color: 0x112233,
      lineWidthPx: 2,
      opacity: 0.8,
      visible: true
    },
    enabled: true,
    order: 0
  })
  profile.deviceStyles.valve.open = {
    color: 0x00c853,
    lineWidthPx: 3,
    opacity: 1,
    visible: true
  }
  return profile
}

const findButton = (element: HTMLElement, label: string) =>
  [...element.querySelectorAll('button')].find(
    button => button.textContent === label
  )!

describe('StyleSourceDialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('mounts independently and applies a utility selection', () => {
    const onApply = jest.fn()
    const dialog = new StyleSourceDialog({
      mode: 'brush',
      profile: createProfile(),
      getLocale: () => 'en',
      onApply,
      onClose: jest.fn()
    })

    dialog.open()
    expect(dialog.element.parentElement).toBe(document.body)
    expect(dialog.element.textContent).toContain('Valve state preset')
    const utility = dialog.element.querySelector<HTMLSelectElement>(
      '[aria-label="Utility style"]'
    )!
    utility.value = 'water'
    utility.dispatchEvent(new Event('change'))
    findButton(dialog.element, 'Apply').click()

    expect(onApply).toHaveBeenCalledWith({
      kind: 'utility',
      utilityId: 'water'
    })
  })

  it('offers custom flow styles but excludes valve presets', () => {
    const onApply = jest.fn()
    const dialog = new StyleSourceDialog({
      mode: 'flow',
      profile: createProfile(),
      onApply,
      onClose: jest.fn()
    })
    dialog.open()

    expect(dialog.element.textContent).not.toContain('阀门状态预设')
    findButton(dialog.element, '自定义').click()
    const color = dialog.element.querySelector<HTMLInputElement>(
      '[aria-label="自定义颜色"]'
    )!
    color.value = '#445566'
    color.dispatchEvent(new Event('input'))
    findButton(dialog.element, '应用').click()

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'custom',
        style: expect.objectContaining({ color: 0x445566 })
      })
    )
  })

  it('closes on Escape without applying', () => {
    const onApply = jest.fn()
    const onClose = jest.fn()
    const dialog = new StyleSourceDialog({
      mode: 'brush',
      profile: createProfile(),
      onApply,
      onClose
    })
    dialog.open()

    dialog.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )

    expect(onApply).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(dialog.element.isConnected).toBe(false)
  })
})
