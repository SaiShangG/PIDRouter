/** @jest-environment jsdom */

import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { toPersistedPresentationProfile } from '../src/phase/phaseWorkspaceRepository'
import { HighlightStyleDialog } from '../src/presentation/HighlightStyleDialog'

const value = () => ({
  presentationProfile: createDefaultPresentationProfile()
})

describe('HighlightStyleDialog', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.classList.remove('highlight-style-open')
  })

  it('ignores implicit close interactions and closes from the close button', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const onClose = jest.fn()
    const dialog = new HighlightStyleDialog({ value: value(), onClose })

    dialog.open()
    expect(dialog.element.parentElement).toBe(document.body)
    expect(dialog.element.hidden).toBe(false)
      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent?.includes('新增设备'))!
        .click()
    const input = dialog.element.querySelector<HTMLInputElement>('input')!
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    dialog.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    dialog.element.click()
    dialog.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )

    expect(dialog.element.isConnected).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    dialog.element.querySelector<HTMLButtonElement>(
      'button[aria-label="关闭对话框"]'
    )!.click()

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
    const color = dialog.element.querySelector<HTMLInputElement>(
      '[aria-label="高亮颜色"]'
    )!
    color.value = '#123456'
    color.dispatchEvent(new Event('input'))
      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent === '应用')!
        .click()

    expect(onClose).not.toHaveBeenCalled()
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        presentationProfile: expect.objectContaining({
          utilities: [expect.objectContaining({
            id: 'utility-1',
            style: expect.objectContaining({ color: 0x123456 })
          })]
        })
      })
    )
    const appliedDraft = onApply.mock.calls[0][0]
    expect(toPersistedPresentationProfile(appliedDraft.presentationProfile).utilities)
      .toEqual([expect.objectContaining({ color: '#123456' })])
    expect(
      dialog.element.querySelector<HTMLInputElement>('input[aria-label="Utility 名称"]')
        ?.value
    ).toBe('Utility 1')
  })

  it('adds a device with the default OPEN and CLOSE states', () => {
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
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(2)
    expect(dialog.element.querySelector('[aria-label="状态 key"]')).not.toBeNull()
    expect(dialog.element.querySelector('[aria-label="右键显示名称"]')).not.toBeNull()
    expect(
      dialog.element.querySelector<HTMLInputElement>(
        '[aria-label="高亮透明度"]'
      )
    ).not.toBeNull()

    const stateKeys = [...dialog.element.querySelectorAll<HTMLInputElement>(
      '[aria-label="状态 key"]'
    )].map(input => input.value)
    const autoHighlightFlow = dialog.element.querySelectorAll<HTMLInputElement>(
      '[aria-label="自动高亮流路"]'
    )
    const flowBehaviors = dialog.element.querySelectorAll<HTMLSelectElement>(
      '[aria-label="流路行为"]'
    )
    expect(stateKeys).toEqual(['OPEN', 'CLOSE'])
    expect(autoHighlightFlow[0].checked).toBe(true)
    expect(autoHighlightFlow[1].checked).toBe(false)
    expect(flowBehaviors[0].value).toBe('conducting')
    expect(flowBehaviors[1].value).toBe('blocking')

      ;[...dialog.element.querySelectorAll('button')]
        .find(button => button.textContent === '应用')!
        .click()
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(2)
  })

  it('copies devices and states with independent IDs and valid state keys', () => {
    let id = 0
    const onApply = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: value(),
      createId: () => `copied-${++id}`,
      onApply,
      onClose: jest.fn()
    })
    dialog.open()
    ;[...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent?.includes('新增设备'))!
      .click()

    dialog.element.querySelector<HTMLButtonElement>('[aria-label="复制设备"]')!
      .click()
    expect(dialog.element.querySelectorAll('.highlight-device-card')).toHaveLength(2)
    expect([...dialog.element.querySelectorAll<HTMLInputElement>('[aria-label="设备名称"]')]
      .map(input => input.value)).toEqual(['设备 1', '设备 1 副本'])

    dialog.element.querySelector<HTMLButtonElement>('[aria-label="复制设备状态"]')!
      .click()
    expect(dialog.element.querySelectorAll('.highlight-device-row')).toHaveLength(5)
    expect([...dialog.element.querySelectorAll<HTMLInputElement>('[aria-label="状态 key"]')]
      .map(input => input.value)).toEqual(['OPEN', 'OPEN_COPY', 'CLOSE', 'OPEN', 'CLOSE'])

    ;[...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent === '应用')!
      .click()
    const devices = onApply.mock.calls[0][0].presentationProfile.devices
    expect(new Set(devices.map((device: { id: string }) => device.id)).size).toBe(2)
    expect(new Set(devices.flatMap((device: { states: Array<{ id: string }> }) =>
      device.states.map(state => state.id))).size).toBe(5)
  })

  it('downloads and imports highlight styles as JSON', async () => {
    const createObjectURL = jest.fn(() => 'blob:highlight-styles')
    const revokeObjectURL = jest.fn()
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL }
    })
    const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const dialog = new HighlightStyleDialog({ value: value(), onClose: jest.fn() })
    dialog.open()

    dialog.element.querySelector<HTMLButtonElement>(
      '[aria-label="下载高亮样式 JSON"]'
    )!.click()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:highlight-styles')

    const importedFile = {
      text: async () => JSON.stringify({
        presentationProfile: {
          deviceStyles: [{
            id: 'filter-open',
            deviceType: 'Filter',
            deviceState: 'OPEN',
            displayName: 'OPEN',
            color: '#00C853',
            lineWidthPx: 3,
            opacity: 1,
            autoHighlightFlow: true,
            flowBehavior: 'conducting'
          }],
          utilities: []
        }
      })
    } as File
    await (dialog as unknown as { importStyles(file: File): Promise<void> })
      .importStyles(importedFile)

    expect(dialog.element.querySelector<HTMLInputElement>(
      '[aria-label="设备名称"]'
    )?.value).toBe('Filter')
    expect(dialog.element.querySelector<HTMLInputElement>(
      '[aria-label="状态 key"]'
    )?.value).toBe('OPEN')

    delete (URL as Partial<typeof URL>).createObjectURL
    delete (URL as Partial<typeof URL>).revokeObjectURL
    anchorClick.mockRestore()
  })
})