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
  profile.devices.push({
    id: 'valve',
    name: 'Valve',
    order: 0,
    states: [
      {
        id: 'valve-open',
        key: 'open',
        displayName: 'Open',
        color: 0x00c853,
        lineWidthPx: 3,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: false,
        flowBehavior: 'conducting',
        order: 0
      },
      {
        id: 'valve-closed',
        key: 'closed',
        displayName: 'Closed',
        color: 0xd32f2f,
        lineWidthPx: 4,
        opacity: 0.75,
        enabled: true,
        autoHighlightFlow: false,
        flowBehavior: 'blocking',
        order: 1
      }
    ]
  })
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
    expect(dialog.element.textContent).toContain('Device style preset')
    expect(dialog.element.textContent).not.toContain('Custom')
    expect(findButton(dialog.element, 'Utility preset').getAttribute('aria-checked'))
      .toBe('true')
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

  it('offers only enabled Utility presets in flow mode', () => {
    const onApply = jest.fn()
    const profile = createProfile()
    profile.utilities.push({
      id: 'disabled',
      name: 'Disabled Utility',
      style: { color: 0x445566, lineWidthPx: 2, opacity: 1, visible: true },
      enabled: false,
      order: -1
    })
    const dialog = new StyleSourceDialog({
      mode: 'flow',
      profile,
      onApply,
      onClose: jest.fn()
    })
    dialog.open()

    expect(dialog.element.textContent).not.toContain('设备样式预设')
    expect(dialog.element.textContent).not.toContain('自定义')
    expect(dialog.element.textContent).not.toContain('默认流路样式')
    const utility = dialog.element.querySelector<HTMLSelectElement>(
      '[aria-label="Utility 样式"]'
    )!
    expect(utility.options).toHaveLength(1)
    expect(utility.value).toBe('water')
    findButton(dialog.element, '应用').click()

    expect(onApply).toHaveBeenCalledWith({ kind: 'utility', utilityId: 'water' })
  })

  it('offers enabled device states from highlight style settings', () => {
    const onApply = jest.fn()
    const profile = createProfile()
    profile.devices[0].states.push({
      id: 'valve-disabled',
      key: 'disabled',
      displayName: 'Disabled',
      color: 0xffffff,
      lineWidthPx: 1,
      opacity: 1,
      enabled: false,
      autoHighlightFlow: false,
      flowBehavior: 'neutral',
      order: 2
    })
    const dialog = new StyleSourceDialog({
      mode: 'brush',
      profile,
      getLocale: () => 'en',
      onApply,
      onClose: jest.fn()
    })
    dialog.open()

    const devicePreset = findButton(dialog.element, 'Device style preset')
    expect(devicePreset.disabled).toBe(false)
    devicePreset.click()
    const deviceState = dialog.element.querySelector<HTMLSelectElement>(
      '[aria-label="Device state"]'
    )!
    expect([...deviceState.options].map(option => option.text)).toEqual([
      'Open',
      'Closed'
    ])
    deviceState.value = 'valve-closed'
    deviceState.dispatchEvent(new Event('change'))
    const preview = dialog.element.querySelector<HTMLElement>(
      '.style-source-preview span'
    )!
    expect(preview.style.backgroundColor).toBe('rgb(211, 47, 47)')
    expect(preview.style.height).toBe('4px')
    expect(preview.style.opacity).toBe('0.75')
    findButton(dialog.element, 'Apply').click()

    expect(onApply).toHaveBeenCalledWith({
      kind: 'device-state',
      deviceId: 'valve',
      stateId: 'valve-closed'
    })
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
