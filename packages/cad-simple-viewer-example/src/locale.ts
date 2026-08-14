export type AppLocale = 'en' | 'zh'

export const APP_LOCALE_STORAGE_KEY = 'cad-simple-viewer-example-locale'

export const loadAppLocale = (
  storage: Pick<Storage, 'getItem'> = localStorage
): AppLocale => storage.getItem(APP_LOCALE_STORAGE_KEY) === 'en' ? 'en' : 'zh'

export const saveAppLocale = (
  locale: AppLocale,
  storage: Pick<Storage, 'setItem'> = localStorage
) => storage.setItem(APP_LOCALE_STORAGE_KEY, locale)

export const toggleAppLocale = (locale: AppLocale): AppLocale =>
  locale === 'zh' ? 'en' : 'zh'

const messages = {
  zh: {
    workspaceTitle: '工艺与阶段',
    workspaceAria: '工艺与阶段',
    resizeAria: '调整工艺侧栏宽度',
    contextAria: '当前工艺、序列与阶段',
    process: '工艺',
    sequence: '序列',
    phase: 'PHASE',
    selectProcess: '快速选择工艺',
    selectSequence: '快速选择序列',
    selectPhase: '快速选择阶段',
    noProcess: '尚未创建工艺',
    waitingProcess: '等待创建工艺',
    phaseCount: '个阶段',
    phaseSaved: '阶段已保存',
    noPhase: '尚未创建 Phase',
    switchTo: '切换为英文',
    languageButton: '切换为英文'
  },
  en: {
    workspaceTitle: 'Processes & Phases',
    workspaceAria: 'Processes and phases',
    resizeAria: 'Resize process sidebar',
    contextAria: 'Current process, sequence, and phase',
    process: 'PROCESS',
    sequence: 'SEQUENCE',
    phase: 'PHASE',
    selectProcess: 'Select process',
    selectSequence: 'Select sequence',
    selectPhase: 'Select phase',
    noProcess: 'No process created',
    waitingProcess: 'Waiting for a process',
    phaseCount: 'Phases',
    phaseSaved: 'Phase saved',
    noPhase: 'No Phase created',
    switchTo: '切换为中文',
    languageButton: 'Switch to Chinese'
  }
} as const

export type AppMessageKey = keyof (typeof messages)['zh']

export const translate = (locale: AppLocale, key: AppMessageKey) =>
  messages[locale][key]
