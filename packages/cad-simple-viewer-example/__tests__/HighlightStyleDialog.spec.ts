/** @jest-environment jsdom */

import { PhaseWorkspaceRepository, toPersistedPresentationProfile } from '../src/phase/phaseWorkspaceRepository'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { HighlightStyleDialog } from '../src/presentation/HighlightStyleDialog'
import defaultStyles from '../src/presentation/defaultDeviceStyles.json'
import { initializeProjectDeviceStyles } from '../src/presentation/defaultDeviceStyles'

const value = () => ({
  presentationProfile: createDefaultPresentationProfile()
})

describe('HighlightStyleDialog', () => {
  it('shows Valve and Utilities when a new project returns empty backend style arrays', async () => {
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '', projectId: 1,
      projectConfigure: { presentationProfile: { deviceStyles: [], utilities: [] } },
      files: { list: jest.fn().mockResolvedValue([]), upload: jest.fn() },
      procedures: { list: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      operations: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      phases: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }
    })
    const workspace = await repository.load()
    const result = initializeProjectDeviceStyles(workspace.presentationProfile)
    expect(result).toBeDefined()
    const onApply = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: { presentationProfile: result!.profile }, onApply, onClose: jest.fn()
    })
    dialog.open()
    expect(dialog.element.querySelector<HTMLInputElement>('[aria-label="设备名称"]')?.value).toBe('Valve')
    expect([...dialog.element.querySelectorAll<HTMLInputElement>('[aria-label="右键显示名称"]')]
      .map(input => input.value)).toEqual(['ON', 'OFF', 'PULSE'])
      ;[...dialog.element.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        .find(button => button.textContent === 'Utility')!.click()
    expect([...dialog.element.querySelectorAll<HTMLInputElement>('[aria-label="Utility 名称"]')]
      .map(input => input.value)).toEqual(['Utility 1', 'Utility 2'])
    expect(onApply).not.toHaveBeenCalled()
  })

  it.each(['zh', 'en'] as const)('previews additions without replacing user settings in %s', locale => {
    const source = value()
    const drawing = { Areas: [{ ControlModules: [{ Name: 'Valve' }, { Name: 'PP' }] }] }
    const onApply = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: source, getLocale: () => locale, getDrawingDocument: () => drawing,
      onApply, onClose: jest.fn()
    })
    dialog.open()
    const supplementLabel = locale === 'en' ? 'Add missing styles from drawing' : '根据图纸补齐'
    dialog.element.querySelector<HTMLButtonElement>(`[aria-label="${supplementLabel}"]`)!.click()
    const preview = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    expect(preview.parentElement).toBe(document.body)
    expect(preview.textContent).toContain('Valve / OPEN')
    expect(preview.textContent).toContain(locale === 'en' ? 'No template: PP' : '未匹配模板：PP')
    expect(preview.querySelector('[role="radiogroup"]')).toBeNull()
    expect(source.presentationProfile.devices).toEqual([])
    expect(onApply).not.toHaveBeenCalled()
      ;[...preview.querySelectorAll('button')].find(button => button.textContent ===
        (locale === 'en' ? 'Confirm additions' : '确认补齐'))!.click()
    expect(dialog.element.querySelectorAll('[data-state-id]')).toHaveLength(3)
    dialog.element.querySelector<HTMLButtonElement>(`[aria-label="${supplementLabel}"]`)!.click()
    const repeat = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    expect([...repeat.querySelectorAll('button')].find(button => button.textContent ===
      (locale === 'en' ? 'Confirm additions' : '确认补齐'))!.disabled).toBe(true)
    expect(source.presentationProfile.devices).toEqual([])
  })

  it('disables supplementation without a drawing', () => {
    const dialog = new HighlightStyleDialog({
      value: value(), getDrawingDocument: () => undefined, onClose: jest.fn()
    })
    expect(dialog.element.querySelector<HTMLButtonElement>('[aria-label="根据图纸补齐"]')!.disabled).toBe(true)
  })

  it('cancels supplementation without editing the draft', () => {
    const onApply = jest.fn()
    const drawing = { Areas: [{ ControlModules: [{ Name: 'Valve' }] }] }
    const dialog = new HighlightStyleDialog({
      value: value(), getDrawingDocument: () => drawing, onApply, onClose: jest.fn()
    })
    dialog.open()
    dialog.element.querySelector<HTMLButtonElement>('[aria-label="根据图纸补齐"]')!.click()
    document.querySelector<HTMLButtonElement>('.highlight-import-cancel')!.click()
    expect(document.querySelector('.highlight-import-preview-modal')).toBeNull()
    expect(dialog.element.querySelectorAll('[data-state-id]')).toHaveLength(0)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('rejects stale drawing previews', () => {
    let drawing: { Areas: Array<{ ControlModules: Array<{ Name: string }> }> } | undefined =
      { Areas: [{ ControlModules: [{ Name: 'Valve' }] }] }
    const dialog = new HighlightStyleDialog({
      value: value(), getDrawingDocument: () => drawing, onClose: jest.fn()
    })
    dialog.open()
    dialog.element.querySelector<HTMLButtonElement>('[aria-label="根据图纸补齐"]')!.click()
    const preview = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    drawing = undefined
      ;[...preview.querySelectorAll('button')].find(button => button.textContent === '确认补齐')!.click()
    expect(dialog.element.querySelectorAll('[data-state-id]')).toHaveLength(0)
    expect(dialog.element.textContent).toContain('图纸已切换')
  })

  it('waits for saving before closing and prevents duplicate submissions', async () => {
    let finishSave!: () => void
    const onApply = jest.fn(() => new Promise<void>(resolve => { finishSave = resolve }))
    const onClose = jest.fn()
    const dialog = new HighlightStyleDialog({ value: value(), onApply, onClose })
    dialog.open()
    const applyClose = [...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent === '应用并关闭')!

    applyClose.click()
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.element.textContent).toContain('正在保存高亮样式')
    applyClose.click()
    expect(onApply).toHaveBeenCalledTimes(1)

    finishSave()
    await Promise.resolve()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each(['zh', 'en'] as const)('shows save failures and allows retry in %s', async locale => {
    const onApply = jest.fn()
      .mockRejectedValueOnce(new Error('Save failed'))
      .mockResolvedValueOnce(undefined)
    const onClose = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: value(), onApply, onClose, getLocale: () => locale
    })
    dialog.open()
    const applyClose = [...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent === (locale === 'en' ? 'Apply and close' : '应用并关闭'))!
    applyClose.click()
    await Promise.resolve()

    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.element.isConnected).toBe(true)
    expect(dialog.element.querySelector('[role="alert"]')?.textContent)
      .toBe(locale === 'en' ? 'Failed to save highlight styles. Please try again.' : '高亮样式保存失败，请重试。')
    expect(applyClose.disabled).toBe(false)

    applyClose.click()
    await Promise.resolve()
    expect(onApply).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reports success without closing when applying styles', async () => {
    const onClose = jest.fn()
    const dialog = new HighlightStyleDialog({
      value: value(), onApply: jest.fn(), onClose, getLocale: () => 'en'
    })
    dialog.open()
    const apply = [...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent === 'Apply')!
    apply.click()
    expect(dialog.element.querySelector('[role="status"]')?.textContent)
      .toBe('Saving highlight styles...')
    await Promise.resolve()
    expect(dialog.element.querySelector('[role="status"]')?.textContent)
      .toBe('Highlight styles saved')
    expect(onClose).not.toHaveBeenCalled()
    expect(apply.disabled).toBe(false)
  })

  it.each(['', 'OPEN'])('reveals and focuses invalid state keys from the Utility tab: %s', invalidKey => {
    const onApply = jest.fn()
    const dialog = new HighlightStyleDialog({ value: value(), onApply, onClose: jest.fn() })
    dialog.open()
    const clickButton = (label: string) => [...dialog.element.querySelectorAll('button')]
      .find(button => button.textContent === label)!.click()
    clickButton('新增设备')
    const key = dialog.element.querySelectorAll<HTMLInputElement>('[data-state-id]')[1]
    key.value = invalidKey
    key.dispatchEvent(new Event('input'))
    clickButton('Utility')
    clickButton('应用')

    expect(onApply).not.toHaveBeenCalled()
    expect(dialog.element.querySelector('[role="alert"]')?.textContent)
      .toBe('状态 key 不能为空，且同一设备内不能重复')
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true')
    expect(dialog.element.querySelector('[role="tab"][aria-selected="true"]')?.textContent)
      .toBe('设备')
  })

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

    expect(dialog.element.querySelector('[aria-label="设备名称"]')).toBeNull()
    const preview = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    expect(preview.textContent).toContain('导入预览')
    expect([...preview.querySelectorAll('.highlight-import-summary strong')]
      .map(item => item.textContent)).toEqual(['1', '1', '0'])
      ;[...preview.querySelectorAll('button')]
        .find(button => button.textContent === '确认导入')!
        .click()
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

  it('checks duplicates by deviceType and deviceState and supports replacement', async () => {
    const existing = value()
    existing.presentationProfile.devices.push({
      id: 'valve',
      name: 'Valve',
      order: 0,
      states: [{
        id: 'valve-open',
        key: 'OPEN',
        displayName: 'OPEN',
        color: 0x00c853,
        lineWidthPx: 3,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: true,
        flowBehavior: 'conducting',
        order: 0
      }]
    })
    const dialog = new HighlightStyleDialog({ value: existing, onClose: jest.fn() })
    dialog.open()
    const importedFile = {
      text: async () => JSON.stringify({
        presentationProfile: {
          deviceStyles: [
            {
              id: 'import-open', deviceType: 'Valve', deviceState: 'OPEN',
              displayName: 'Open imported', color: '#123456', lineWidthPx: 4,
              opacity: 1, autoHighlightFlow: true, flowBehavior: 'conducting'
            },
            {
              id: 'import-close', deviceType: 'Valve', deviceState: 'CLOSE',
              displayName: 'Close imported', color: '#B8B8B8', lineWidthPx: 3,
              opacity: 1, autoHighlightFlow: false, flowBehavior: 'blocking'
            }
          ],
          utilities: [{
            id: 'utility-1', name: 'Utility 1', color: '#C700B6',
            lineWidthPx: 3, opacity: 1
          }]
        }
      })
    } as File
    await (dialog as unknown as { importStyles(file: File): Promise<void> })
      .importStyles(importedFile)

    const preview = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    expect([...preview.querySelectorAll('.highlight-import-summary strong')]
      .map(item => item.textContent)).toEqual(['1', '2', '1'])
    expect(preview.textContent).toContain('重复设备：Valve')
    expect(preview.textContent).toContain('重复状态：Valve / OPEN')
    expect(preview.textContent).not.toContain('重复状态：Valve / CLOSE')

      ;[...preview.querySelectorAll('button')]
        .find(button => button.textContent === '替换全部配置')!
        .click()
      ;[...preview.querySelectorAll('button')]
        .find(button => button.textContent === '确认导入')!
        .click()
    expect([...dialog.element.querySelectorAll<HTMLInputElement>('[aria-label="状态 key"]')]
      .map(input => input.value)).toEqual(['OPEN', 'CLOSE'])
    expect(dialog.element.querySelector<HTMLInputElement>('[aria-label="右键显示名称"]')
      ?.value).toBe('Open imported')
  })

  it('blocks confirmation when a style lacks deviceType or deviceState', async () => {
    const dialog = new HighlightStyleDialog({ value: value(), onClose: jest.fn() })
    dialog.open()
    await (dialog as unknown as { importStyles(file: File): Promise<void> })
      .importStyles({
        text: async () => JSON.stringify({
          presentationProfile: {
            deviceStyles: [{ id: 'invalid', deviceType: 'Valve' }],
            utilities: []
          }
        })
      } as File)

    const preview = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    expect(preview.textContent).toContain(
      '缺少有效的必填字段。 (deviceStyles[0].deviceState)'
    )
    expect([...preview.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === '确认导入')?.disabled).toBe(true)
  })

  it('imports the bundled default file using the same data as project initialization', async () => {
    const dialog = new HighlightStyleDialog({ value: value(), onClose: jest.fn() })
    dialog.open()
    await (dialog as unknown as { importStyles(file: File): Promise<void> }).importStyles({
      text: async () => JSON.stringify(defaultStyles)
    } as File)
    const preview = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    expect([...preview.querySelectorAll('.highlight-import-summary strong')]
      .map(item => item.textContent)).toEqual(['1', '3', '2'])
      ;[...preview.querySelectorAll('button')].find(button => button.textContent === '确认导入')!.click()
    const imported = (dialog as unknown as { draft: ReturnType<typeof value> }).draft.presentationProfile
    const initialized = initializeProjectDeviceStyles(createDefaultPresentationProfile())!.profile
    expect(imported.devices).toEqual(initialized.devices)
    expect(imported.utilities).toEqual(initialized.utilities)
    expect(imported.defaultStyleSeed).toEqual({ status: 'configured' })
  })

  it.each(['zh', 'en'] as const)('rejects invalid Utility values with localized errors in %s', async locale => {
    const source = value()
    const dialog = new HighlightStyleDialog({ value: source, getLocale: () => locale, onClose: jest.fn() })
    dialog.open()
    await (dialog as unknown as { importStyles(file: File): Promise<void> }).importStyles({
      text: async () => JSON.stringify({
        presentationProfile: {
          ...defaultStyles.presentationProfile,
          utilities: [{ ...defaultStyles.presentationProfile.utilities[0], opacity: 2 }]
        }
      })
    } as File)
    const preview = document.querySelector<HTMLElement>('.highlight-import-preview-modal')!
    expect(preview.textContent).toContain(locale === 'en'
      ? 'The field value is invalid or out of range. (utilities[0].opacity)'
      : '字段值无效或超出允许范围。 (utilities[0].opacity)')
    expect([...preview.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === (locale === 'en' ? 'Confirm import' : '确认导入'))?.disabled).toBe(true)
    expect(source.presentationProfile.utilities).toEqual([])
  })
})