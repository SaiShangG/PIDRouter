/** @jest-environment jsdom */

import { agentEn } from '../../cad-agent-plugin/src/i18n/en'
import { agentZh } from '../../cad-agent-plugin/src/i18n/zh'
import { en as toolbarEn } from '../../cad-simple-ui-plugin/src/i18n/en'
import { zh as toolbarZh } from '../../cad-simple-ui-plugin/src/i18n/zh'
import commandEn from '../../cad-simple-viewer/src/i18n/en/command'
import jigEn from '../../cad-simple-viewer/src/i18n/en/jig'
import mainEn from '../../cad-simple-viewer/src/i18n/en/main'
import commandZh from '../../cad-simple-viewer/src/i18n/zh/command'
import jigZh from '../../cad-simple-viewer/src/i18n/zh/jig'
import mainZh from '../../cad-simple-viewer/src/i18n/zh/main'

import {
  APP_LOCALE_STORAGE_KEY,
  loadAppLocale,
  saveAppLocale,
  toggleAppLocale,
  translate
} from '../src/locale'
import { localizeDom, translateUiText } from '../src/uiTranslations'

const flattenMessages = (messages: object, prefix = ''): Record<string, string> =>
  Object.fromEntries(Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string'
      ? [[path, value]]
      : Object.entries(flattenMessages(value, path))
  }))

describe('app locale', () => {
  it.each([
    ['toolbar', toolbarEn, toolbarZh],
    ['agent', agentEn, agentZh],
    ['core commands', flattenMessages(commandEn), flattenMessages(commandZh)],
    ['core prompts', flattenMessages(jigEn), flattenMessages(jigZh)],
    ['core UI', flattenMessages(mainEn), flattenMessages(mainZh)]
  ] as const)('keeps %s translation keys and placeholders aligned', (_name, en, zh) => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    for (const [key, message] of Object.entries(en)) {
      const translated = (zh as Record<string, string>)[key]
      expect(translated.trim()).not.toBe('')
      expect(translated.match(/\{\w+\}/g)?.sort() ?? []).toEqual(message.match(/\{\w+\}/g)?.sort() ?? [])
    }
  })

  it('defaults invalid or missing values to Chinese', () => {
    expect(loadAppLocale({ getItem: () => null })).toBe('zh')
    expect(loadAppLocale({ getItem: () => 'tr' })).toBe('zh')
  })

  it('loads and saves English', () => {
    const setItem = jest.fn()
    expect(loadAppLocale({ getItem: () => 'en' })).toBe('en')
    saveAppLocale('en', { setItem })
    expect(setItem).toHaveBeenCalledWith(APP_LOCALE_STORAGE_KEY, 'en')
  })

  it('toggles both languages and translates header text', () => {
    expect(toggleAppLocale('zh')).toBe('en')
    expect(toggleAppLocale('en')).toBe('zh')
    expect(translate('zh', 'workspaceTitle')).toBe('工艺与阶段')
    expect(translate('en', 'workspaceTitle')).toBe('Processes & Phases')
    expect(translate('zh', 'appToolbarSubtitle')).toBe('工业 P&ID 工作台')
    expect(translate('en', 'appToolbarSubtitle')).toBe('Industrial P&ID workspace')
    expect(translate('zh', 'phasePanelToggle')).toBe('工艺与阶段')
    expect(translate('en', 'phasePanelToggle')).toBe('Processes & Phases')
    expect(translate('zh', 'noDrawingOpen')).toBe('未打开图纸')
    expect(translate('en', 'noDrawingOpen')).toBe('No drawing open')
    expect(translate('zh', 'addPhasePrompt')).toBe('请添加 Phase')
    expect(translate('en', 'addPhasePrompt')).toBe('Please add a Phase')
  })

  it('localizes hidden text, tooltips, accessibility labels, and placeholders', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div hidden><button title="新增序列" aria-label="新增序列">新增序列</button></div>
      <input placeholder="阶段名称" aria-label="阶段名称" />
    `

    localizeDom(root, 'en')
    expect(root.querySelector('button')?.textContent).toBe('Add sequence')
    expect(root.querySelector('button')?.title).toBe('Add sequence')
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe('Add sequence')
    expect(root.querySelector('input')?.placeholder).toBe('Phase name')

    localizeDom(root, 'zh')
    expect(root.querySelector('button')?.textContent).toBe('新增序列')
    expect(root.querySelector('input')?.placeholder).toBe('阶段名称')
  })

  it('preserves interpolated values in localized runtime messages', () => {
    expect(translateUiText('zh', 'Open File')).toBe('打开文件')
    expect(translateUiText('en', '打开文件')).toBe('Open File')
    expect(translateUiText('en', '复制 Phase')).toBe('Copy Phase')
    expect(translateUiText('en', '目标序列')).toBe('Target sequence')
    expect(translateUiText('zh', 'Successfully loaded: Area-1.dwg')).toBe(
      '加载成功：Area-1.dwg'
    )
    expect(translateUiText('en', '确认删除序列 03 · Rinse？')).toBe(
      'Delete sequence 03 · Rinse?'
    )
  })

  it('does not truncate sequence messages or user-defined labels', () => {
    expect(translateUiText('zh', 'Sequence 3 already exists')).toBe('序列 3 已存在')
    expect(translateUiText('en', '序列 03 · 清洗')).toBe('序列 03 · 清洗')
    expect(translateUiText('zh', 'Sequence 03 · Rinse')).toBe('Sequence 03 · Rinse')
  })

  it.each([
    ['当前 Vessel', 'Current Vessel'],
    ['全部 Vessel', 'All Vessels'],
    ['未分配 Vessel', 'Unassigned Vessel'],
    ['定位 Vessel', 'Locate Vessel'],
    ['停止 Vessel 闪烁', 'Stop Vessel blinking'],
    ['Phase 所属 Vessel', 'Phase Vessel'],
    ['不可用 Vessel', 'Unavailable Vessel'],
    ['此 Vessel 下暂无 Phase。', 'No Phases for this Vessel.'],
    ['无法定位所选 Vessel', 'Unable to locate the selected Vessel'],
    ['Vessel 归属保存失败', 'Failed to save Vessel assignment'],
    ['未找到所选 Vessel', 'Vessel was not found'],
    ['PID 图纸', 'PID drawings'],
    ['高亮样式设置', 'Highlight style settings'],
    ['设备名称', 'Device name'],
    ['新增状态', 'Add state'],
    ['确认', 'Confirm'],
    ['保存', 'Save'],
    ['取消', 'Cancel'],
    ['1,234 实体 · 5,678 连接', '1,234 entities · 5,678 connections'],
    ['生成记录 0', 'Generated files 0'],
    ['生成记录 12', 'Generated files 12'],
    ['12 页', '12 pages'],
    ['PDF 工艺', 'PDF Process'],
    ['Matrix 工艺', 'Matrix Process'],
    ['PID 工作区', 'PID Workspace'],
    ['例如：PID-1001', 'e.g. PID-1001'],
    ['请输入图纸名称', 'Enter a drawing name'],
    ['PDI 压缩包中缺少 Document.json', 'The PDI archive is missing Document.json'],
    ['deviceStyles[2] 缺少有效的 deviceType 或 deviceState。', 'deviceStyles[2] is missing a valid deviceType or deviceState.'],
    ['PDF 导出需要先选择 Project', 'PDF export requires an active Project']
  ])('translates %s in both directions', (zh, en) => {
    expect(translateUiText('en', zh)).toBe(en)
    expect(translateUiText('zh', en)).toBe(zh)
  })

  it('translates error wrappers without changing filenames or identifiers', () => {
    expect(translateUiText('en', 'Error: 请输入图纸名称')).toBe('Error: Enter a drawing name')
    expect(translateUiText('zh', 'Error: Canvas 2D context is unavailable')).toBe('错误：二维画布上下文不可用')
    expect(translateUiText('en', '错误：无法打开 清洗-01.dwg')).toBe('Error: Cannot open 清洗-01.dwg')
  })

  it('restores dynamic source text and root attributes across repeated switches', () => {
    const root = document.createElement('button')
    root.title = '展开序列 3'
    root.textContent = '  2 张图纸  '
    for (let iteration = 0; iteration < 3; iteration++) {
      localizeDom(root, 'en')
      expect(root.title).toBe('Expand sequence 3')
      expect(root.textContent).toBe('  2 drawings  ')
      localizeDom(root, 'zh')
      expect(root.title).toBe('展开序列 3')
      expect(root.textContent).toBe('  2 张图纸  ')
    }
    root.firstChild!.textContent = '4 张图纸'
    localizeDom(root, 'en')
    expect(root.textContent).toBe('4 drawings')
    localizeDom(root, 'zh')
    expect(root.textContent).toBe('4 张图纸')
  })

  it('preserves code, editable text, and explicitly untranslated user content', () => {
    const root = document.createElement('div')
    root.innerHTML = '<script>New</script><style>New</style><textarea>New</textarea><div contenteditable>New</div><span translate="no" title="New">New</span>'
    localizeDom(root, 'zh')
    for (const element of Array.from(root.children)) expect(element.textContent).toBe('New')
    expect(root.querySelector('span')?.title).toBe('New')
  })
})
