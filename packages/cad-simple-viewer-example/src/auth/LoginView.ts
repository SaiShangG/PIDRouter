import { Eye, EyeOff, Languages, LogIn } from 'lucide'

import { type AppMessageKey, loadAppLocale, saveAppLocale, toggleAppLocale, translate } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { AuthError, type AuthService, type AuthUser } from './authService'

export class LoginView {
  readonly element = document.createElement('main')
  private locale = loadAppLocale()
  private pending = false
  private startFailed = false
  private statusKey?: AppMessageKey
  private readonly form = document.createElement('form')
  private readonly username = document.createElement('input')
  private readonly password = document.createElement('input')
  private readonly visibility = document.createElement('button')
  private readonly submit = document.createElement('button')
  private readonly submitLabel = document.createElement('span')
  private readonly status = document.createElement('p')
  private readonly language = document.createElement('button')
  private readonly languageLabel = document.createElement('span')
  private readonly title = document.createElement('h1')
  private readonly usernameLabel = document.createElement('label')
  private readonly passwordLabel = document.createElement('label')

  constructor(
    private readonly service: AuthService,
    private readonly onAuthenticated: (user: AuthUser) => Promise<void>
  ) {
    this.element.className = 'login-page'
    this.element.setAttribute('aria-labelledby', 'login-title')
    this.element.innerHTML = '<aside class="login-media"><img class="login-photo" src="./biopharma-login.jpg" alt="" fetchpriority="high" /></aside><div class="login-panel"><header class="login-header"><div class="login-brand"><span class="login-mark" aria-hidden="true">PID</span><strong>PID Viewer Lite</strong></div></header><section class="login-content"><div class="login-form-wrap"></div></section></div>'
    this.language.type = 'button'
    this.language.className = 'login-icon-button login-language'
    this.language.append(createPhaseIcon(Languages), this.languageLabel)
    this.language.addEventListener('click', () => {
      this.locale = toggleAppLocale(this.locale)
      saveAppLocale(this.locale)
      this.renderLabels()
    })
    this.element.querySelector('header')!.append(this.language)
    this.title.id = 'login-title'
    this.form.noValidate = true
    this.username.id = 'login-username'
    this.username.name = 'username'
    this.username.autocomplete = 'username'
    this.username.required = true
    this.username.maxLength = 128
    this.username.spellcheck = false
    this.username.setAttribute('autocapitalize', 'none')
    this.usernameLabel.htmlFor = this.username.id
    this.password.id = 'login-password'
    this.password.name = 'password'
    this.password.type = 'password'
    this.password.autocomplete = 'current-password'
    this.password.required = true
    this.passwordLabel.htmlFor = this.password.id
    this.visibility.type = 'button'
    this.visibility.className = 'login-icon-button login-visibility'
    this.visibility.setAttribute('aria-controls', this.password.id)
    this.visibility.addEventListener('click', () => {
      this.password.type = this.password.type === 'password' ? 'text' : 'password'
      this.renderLabels()
    })
    const passwordField = document.createElement('div')
    passwordField.className = 'login-password-field'
    passwordField.append(this.password, this.visibility)
    this.submit.type = 'submit'
    this.submit.className = 'login-submit'
    this.submit.append(createPhaseIcon(LogIn), this.submitLabel)
    this.status.id = 'login-status'
    this.status.className = 'login-status'
    this.status.setAttribute('role', 'status')
    this.status.setAttribute('aria-live', 'polite')
    for (const input of [this.username, this.password]) {
      input.setAttribute('aria-describedby', this.status.id)
      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid')
        if (!this.pending) {
          this.statusKey = undefined
          this.renderLabels()
        }
      })
    }
    this.form.append(this.usernameLabel, this.username, this.passwordLabel, passwordField, this.submit, this.status)
    this.form.addEventListener('submit', event => {
      event.preventDefault()
      void this.signIn()
    })
    this.element.querySelector('.login-form-wrap')!.append(this.title, this.form)
    this.renderLabels()
  }

  mount() {
    document.body.append(this.element)
    this.username.focus()
  }

  private renderLabels() {
    const text = (key: AppMessageKey) => translate(this.locale, key)
    document.documentElement.lang = this.locale === 'zh' ? 'zh-CN' : 'en'
    this.title.textContent = text('loginTitle')
    this.element.querySelector<HTMLImageElement>('.login-photo')!.alt = text('loginPhotoAlt')
    this.usernameLabel.textContent = text('loginUsername')
    this.passwordLabel.textContent = text('loginPassword')
    this.languageLabel.textContent = text('loginLanguageTarget')
    this.languageLabel.lang = this.locale === 'zh' ? 'en' : 'zh-CN'
    this.language.title = text('languageButton')
    this.language.setAttribute('aria-label', `${this.languageLabel.textContent}: ${this.language.title}`)
    const visible = this.password.type === 'text'
    this.visibility.title = text(visible ? 'loginHidePassword' : 'loginShowPassword')
    this.visibility.setAttribute('aria-label', this.visibility.title)
    this.visibility.setAttribute('aria-pressed', String(visible))
    this.visibility.replaceChildren(createPhaseIcon(visible ? EyeOff : Eye))
    this.submitLabel.textContent = text(this.startFailed ? 'loginReload' : this.pending ? 'loginSubmitting' : 'loginSubmit')
    this.status.textContent = this.statusKey ? text(this.statusKey) : ''
    this.status.classList.toggle('is-error', !!this.statusKey && !this.pending)
  }

  private setPending(pending: boolean) {
    this.pending = pending
    this.form.setAttribute('aria-busy', String(pending))
    this.submit.disabled = pending
    this.username.disabled = pending
    this.password.disabled = pending
    this.visibility.disabled = pending
    this.language.disabled = pending
    this.renderLabels()
  }

  private async signIn() {
    if (this.pending) return
    if (this.startFailed) {
      window.location.reload()
      return
    }
    const username = this.username.value.trim()
    if (!username || !this.password.value) {
      this.statusKey = 'loginRequired'
      this.username.setAttribute('aria-invalid', String(!username))
      this.password.setAttribute('aria-invalid', String(!this.password.value))
      this.renderLabels()
        ; (!username ? this.username : this.password).focus()
      return
    }
    this.statusKey = undefined
    this.setPending(true)
    let authenticated = false
    try {
      const user = await this.service.login({ username, password: this.password.value })
      authenticated = true
      this.password.value = ''
      this.statusKey = 'loginStarting'
      this.renderLabels()
      await this.onAuthenticated(user)
      this.element.remove()
    } catch (error) {
      this.password.value = ''
      if (authenticated) {
        this.startFailed = true
        this.statusKey = 'loginStartFailed'
      } else {
        const code = error instanceof AuthError ? error.code : 'network'
        const errorKeys = { required: 'loginRequired', invalid: 'loginInvalid', network: 'loginNetwork', unavailable: 'loginUnavailable' } as const
        this.statusKey = errorKeys[code]
      }
    } finally {
      this.setPending(false)
      if (this.element.isConnected) {
        if (this.startFailed) this.submit.focus()
        else this.password.focus()
      }
    }
  }
}