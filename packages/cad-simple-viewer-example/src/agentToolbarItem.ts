import type { AcExToolbarItemConfig } from '@mlightcad/cad-simple-ui-plugin'

import { ICON_AGENT } from './icons'
import type { AppLocale } from './locale'
import { translateUiText } from './uiTranslations'

/** Toolbar button that runs the lazy-loaded `agent` command. */
export const createAgentToolbarItem = (
  locale: AppLocale
): AcExToolbarItemConfig => ({
  id: 'agent',
  label: translateUiText(locale, 'Agent'),
  icon: ICON_AGENT,
  command: 'agent',
  requiresDocument: true
})
