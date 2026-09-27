import { LogOut, Settings, UserRound } from 'lucide'

import { loadAppLocale, translate } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { translateUiText } from '../uiTranslations'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { reportMessage } from '../ui/Toast'
import type { AuthService, AuthUser } from './authService'

export class AccountControls {
  readonly element = document.createElement('div')
  private readonly name = document.createElement('span')
  private readonly logout = document.createElement('button')
  private readonly trigger = document.createElement('button')
  private readonly menu = document.createElement('div')
  private readonly settings = document.createElement('button')
  private readonly confirmation = new ConfirmationModal(loadAppLocale)

  constructor(
    private readonly service: AuthService,
    private readonly user: AuthUser,
    private readonly reload: () => void = () => window.location.reload(),
    private readonly openSettings?: () => void
  ) {
    this.element.className = 'auth-account'
    this.name.className = 'auth-account-name'
    this.name.translate = false
    this.trigger.type = 'button'
    this.trigger.className = 'auth-account-trigger'
    this.trigger.setAttribute('aria-haspopup', 'menu')
    this.trigger.setAttribute('aria-expanded', 'false')
    this.trigger.append(createPhaseIcon(UserRound), this.name)
    this.menu.className = 'auth-account-menu'
    this.menu.hidden = true
    this.menu.setAttribute('role', 'menu')
    this.settings.type = 'button'
    this.settings.className = 'auth-account-settings'
    this.settings.setAttribute('role', 'menuitem')
    this.settings.hidden = !openSettings
    this.settings.addEventListener('click', () => {
      this.closeMenu()
      this.openSettings?.()
    })
    this.trigger.addEventListener('click', () => {
      if (!this.menu.hidden) return this.closeMenu()
      this.menu.hidden = false
      this.trigger.setAttribute('aria-expanded', 'true')
      const rect = this.trigger.getBoundingClientRect()
      this.menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - this.menu.offsetHeight - 8)}px`
      this.menu.style.left = `${Math.max(8, Math.min(rect.right - this.menu.offsetWidth, window.innerWidth - this.menu.offsetWidth - 8))}px`
        ; (this.settings.hidden ? this.logout : this.settings).focus()
    })
    this.menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        this.closeMenu()
        if (event.key === 'Escape') event.stopPropagation()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next = document.activeElement === this.settings || this.settings.hidden ? this.logout : this.settings
        next.focus()
      }
    })
    document.addEventListener('pointerdown', event => {
      if (!this.menu.hidden && event.target instanceof Node && !this.menu.contains(event.target) && !this.trigger.contains(event.target)) this.closeMenu(false)
    })
    this.logout.type = 'button'
    this.logout.className = 'auth-account-logout'
    this.logout.setAttribute('role', 'menuitem')
    this.logout.addEventListener('click', () => {
      this.closeMenu()
      void this.signOut()
    })
    this.menu.append(this.settings, this.logout)
    document.body.append(this.menu)
    this.element.append(this.trigger)
    this.refreshLocale()
  }

  refreshLocale() {
    const locale = loadAppLocale()
    this.name.textContent = this.user.name
    this.name.title = `${translate(locale, 'loginUser')}: ${this.user.name}`
    this.trigger.title = this.name.title
    this.trigger.setAttribute('aria-label', this.name.title)
    this.menu.setAttribute('aria-label', this.name.title)
    this.settings.replaceChildren(createPhaseIcon(Settings), translateUiText(locale, '功能配置'))
    this.logout.replaceChildren(createPhaseIcon(LogOut), translate(locale, 'loginLogout'))
    this.logout.title = `${translate(locale, 'loginLogout')} (${this.user.name})`
    this.logout.setAttribute('aria-label', this.logout.title)
  }

  private closeMenu(restoreFocus = true) {
    this.menu.hidden = true
    this.trigger.setAttribute('aria-expanded', 'false')
    if (restoreFocus) this.trigger.focus()
  }

  private async signOut() {
    if (this.logout.disabled) return
    this.logout.disabled = true
    const locale = loadAppLocale()
    try {
      const confirmed = await this.confirmation.confirm({
        title: translate(locale, 'loginLogout'),
        message: translate(locale, 'loginLogoutConfirm'),
        confirmLabel: translate(locale, 'loginLogout'),
        cancelLabel: translate(locale, 'loginCancel'),
        tone: 'danger'
      })
      if (!confirmed) return
      await this.service.logout()
      this.reload()
    } catch {
      reportMessage(translate(loadAppLocale(), 'loginLogoutFailed'), 'error')
    } finally {
      this.logout.disabled = false
    }
  }
}