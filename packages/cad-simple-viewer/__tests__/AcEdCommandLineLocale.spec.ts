/** @jest-environment jsdom */

import en from '../src/i18n/en/main'
import zh from '../src/i18n/zh/main'
import { AcEdCommandLine } from '../src/editor/input/ui/AcEdCommandLine'

let mockLocale: 'en' | 'zh' = 'en'

jest.mock('../src/app', () => ({}))
jest.mock('../src/editor/input/session', () => ({}))
jest.mock('../src/i18n', () => ({
  AcApI18n: {
    t: (key: string) => {
      const messages = mockLocale === 'en' ? en : zh
      return messages.commandLine[key.split('.').pop() as keyof typeof messages.commandLine]
    }
  }
}))

describe('command line locale', () => {
  it('refreshes button tooltips, accessible names, and placeholders in both languages', () => {
    const commandLine = Object.assign(Object.create(AcEdCommandLine.prototype), {
      msgPanel: document.createElement('div'),
      centerEl: document.createElement('div'),
      textInput: document.createElement('input'),
      closeBtn: document.createElement('button'),
      downBtn: document.createElement('button'),
      upBtn: document.createElement('button'),
      isPromptActive: false
    })
    for (const locale of ['zh', 'en', 'zh'] as const) {
      mockLocale = locale
      commandLine.refreshLocale()
      const messages = locale === 'en' ? en.commandLine : zh.commandLine
      for (const [button, label] of [
        [commandLine.closeBtn, messages.close],
        [commandLine.downBtn, messages.showHistory],
        [commandLine.upBtn, messages.showMessages]
      ] as const) {
        expect(button.title).toBe(label)
        expect(button.getAttribute('aria-label')).toBe(label)
      }
      expect(commandLine.textInput.placeholder).toBe(messages.placeholder)
    }
  })
})