/** @jest-environment jsdom */

import {
  APP_LOCALE_STORAGE_KEY,
  loadAppLocale,
  saveAppLocale,
  toggleAppLocale,
  translate
} from '../src/locale'
import { localizeDom, translateUiText } from '../src/uiTranslations'

describe('app locale', () => {
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
    expect(translateUiText('zh', 'Successfully loaded: Area-1.dwg')).toBe(
      '加载成功：Area-1.dwg'
    )
    expect(translateUiText('en', '确认删除序列 03 · Rinse？')).toBe(
      'Delete sequence 03 · Rinse?'
    )
  })
})
