import { LogOut } from 'lucide'

import { loadAppLocale, translate } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { Toast } from '../ui/Toast'
import type { AuthService, AuthUser } from './authService'

export class AccountControls {
  readonly element = document.createElement('div')
  private readonly name = document.createElement('span')
  private readonly logout = document.createElement('button')
  private readonly confirmation = new ConfirmationModal(loadAppLocale)
  private readonly toast = new Toast(() => translate(loadAppLocale(), 'loginCancel'))

  constructor(
    private readonly service: AuthService,
    private readonly user: AuthUser,
    private readonly reload: () => void = () => window.location.reload()
  ) {
    this.element.className = 'auth-account'
    this.name.className = 'auth-account-name'
    this.logout.type = 'button'
    this.logout.append(createPhaseIcon(LogOut))
    this.logout.addEventListener('click', () => void this.signOut())
    this.element.append(this.name, this.logout)
    this.refreshLocale()
  }

  refreshLocale() {
    const locale = loadAppLocale()
    this.name.textContent = this.user.name
    this.name.title = `${translate(locale, 'loginUser')}: ${this.user.name}`
    this.logout.title = `${translate(locale, 'loginLogout')} (${this.user.name})`
    this.logout.setAttribute('aria-label', this.logout.title)
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
      this.toast.show(translate(loadAppLocale(), 'loginLogoutFailed'), 'error')
    } finally {
      this.logout.disabled = false
    }
  }
}