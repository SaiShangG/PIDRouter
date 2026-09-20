/** @jest-environment jsdom */
import { AccountControls } from '../src/auth/AccountControls'
import { createDemoAuthService } from '../src/auth/authService'
import { startLogin } from '../src/auth/startLogin'
import { saveAppLocale } from '../src/locale'

describe('authentication flow', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="app-shell"><div id="viewerPane"></div></div>'
    document.body.className = 'app-booting'
    saveAppLocale('en')
    jest.useFakeTimers()
  })
  afterEach(() => jest.useRealTimers())

  it('does not start the workspace until authentication succeeds', async () => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0 })
    const startWorkspace = jest.fn().mockResolvedValue(undefined)
    startLogin(service, startWorkspace)
    expect(startWorkspace).not.toHaveBeenCalled()
    expect(document.body.classList.contains('login-active')).toBe(true)
    document.querySelector<HTMLInputElement>('#login-username')!.value = 'operator'
    document.querySelector<HTMLInputElement>('#login-password')!.value = 'demo'
    document.querySelector('form')!.dispatchEvent(new Event('submit'))
    expect(startWorkspace).not.toHaveBeenCalled()
    await jest.runAllTimersAsync()
    expect(startWorkspace).toHaveBeenCalledTimes(1)
    expect(document.body.classList.contains('login-active')).toBe(false)
    expect(document.querySelector('.login-page')).toBeNull()
    expect(document.activeElement?.id).toBe('viewerPane')
  })

  it('shows the main page immediately while workspace initialization is pending', async () => {
    let finishStartup!: () => void
    const startup = new Promise<void>(resolve => { finishStartup = resolve })
    const startWorkspace = jest.fn(() => startup)
    startLogin(createDemoAuthService({ enabled: true, delayMs: 0 }), startWorkspace)
    document.querySelector<HTMLInputElement>('#login-username')!.value = 'operator'
    document.querySelector<HTMLInputElement>('#login-password')!.value = 'demo'
    document.querySelector('form')!.dispatchEvent(new Event('submit'))
    await jest.runAllTimersAsync()
    expect(startWorkspace).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.login-page')).toBeNull()
    expect(document.body.classList.contains('login-active')).toBe(false)
    expect(document.body.classList.contains('app-booting')).toBe(false)
    expect(document.activeElement?.id).toBe('viewerPane')
    expect(document.getElementById('viewerPane')!.getAttribute('aria-busy')).toBe('true')
    finishStartup()
    await jest.runAllTimersAsync()
    expect(document.getElementById('viewerPane')!.hasAttribute('aria-busy')).toBe(false)
  })

  it('keeps the login page until styles are ready without waiting for workspace data', async () => {
    let finishPreparation!: () => void
    let finishStartup!: () => void
    const preparation = new Promise<void>(resolve => { finishPreparation = resolve })
    const startup = new Promise<void>(resolve => { finishStartup = resolve })
    const prepareWorkspace = jest.fn(() => preparation)
    const startWorkspace = jest.fn(() => startup)
    startLogin(createDemoAuthService({ enabled: true, delayMs: 0 }), startWorkspace, prepareWorkspace)
    document.querySelector<HTMLInputElement>('#login-username')!.value = 'operator'
    document.querySelector<HTMLInputElement>('#login-password')!.value = 'demo'
    document.querySelector('form')!.dispatchEvent(new Event('submit'))
    await jest.runAllTimersAsync()
    expect(prepareWorkspace).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.login-page')).not.toBeNull()
    expect(document.body.classList.contains('login-active')).toBe(true)
    expect(document.body.classList.contains('app-booting')).toBe(true)
    expect(startWorkspace).not.toHaveBeenCalled()
    finishPreparation()
    await jest.runAllTimersAsync()
    expect(document.querySelector('.login-page')).toBeNull()
    expect(document.body.classList.contains('app-booting')).toBe(false)
    expect(startWorkspace).toHaveBeenCalledTimes(1)
    expect(document.getElementById('viewerPane')!.getAttribute('aria-busy')).toBe('true')
    finishStartup()
    await jest.runAllTimersAsync()
  })

  it('keeps the login page with a reload action if style preparation fails', async () => {
    const startWorkspace = jest.fn()
    const prepareWorkspace = jest.fn().mockRejectedValue(new Error('module load failed'))
    startLogin(createDemoAuthService({ enabled: true, delayMs: 0 }), startWorkspace, prepareWorkspace)
    document.querySelector<HTMLInputElement>('#login-username')!.value = 'operator'
    document.querySelector<HTMLInputElement>('#login-password')!.value = 'demo'
    document.querySelector('form')!.dispatchEvent(new Event('submit'))
    await jest.runAllTimersAsync()
    expect(startWorkspace).not.toHaveBeenCalled()
    expect(document.body.classList.contains('login-active')).toBe(true)
    expect(document.body.classList.contains('app-booting')).toBe(true)
    expect(document.querySelector('[type="submit"]')!.textContent).toBe('Reload')
  })

  it('restores an actionable error if workspace initialization fails', async () => {
    const startWorkspace = jest.fn().mockRejectedValue(new Error('startup failed'))
    startLogin(createDemoAuthService({ enabled: true, delayMs: 0 }), startWorkspace)
    document.querySelector<HTMLInputElement>('#login-username')!.value = 'operator'
    document.querySelector<HTMLInputElement>('#login-password')!.value = 'demo'
    document.querySelector('form')!.dispatchEvent(new Event('submit'))
    await jest.runAllTimersAsync()
    expect(document.body.classList.contains('login-active')).toBe(true)
    expect(document.querySelector('#login-status')!.textContent).toMatch(/workspace could not start/)
    expect(document.querySelector('[type="submit"]')!.textContent).toBe('Reload')
    expect(document.activeElement).toBe(document.querySelector('[type="submit"]'))
  })

  it('keeps the workspace hidden when demo authentication is disabled', async () => {
    const startWorkspace = jest.fn()
    startLogin(createDemoAuthService({ enabled: false }), startWorkspace)
    document.querySelector<HTMLInputElement>('#login-username')!.value = 'operator'
    document.querySelector<HTMLInputElement>('#login-password')!.value = 'demo'
    document.querySelector('form')!.dispatchEvent(new Event('submit'))
    await jest.runAllTimersAsync()
    expect(startWorkspace).not.toHaveBeenCalled()
    expect(document.body.classList.contains('login-active')).toBe(true)
    expect(document.querySelector('#login-status')!.textContent).toMatch(/not configured/)
  })

  it('cancels logout or clears the session and reloads after confirmation', async () => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0 })
    const login = service.login({ username: '<operator>', password: 'demo' })
    await jest.runAllTimersAsync()
    const user = await login
    const reload = jest.fn()
    const controls = new AccountControls(service, user, reload)
    document.body.append(controls.element)
    expect(controls.element.querySelector('operator')).toBeNull()
    expect(controls.element.textContent).toBe('<operator>')
    controls.element.querySelector('button')!.click()
    document.querySelector<HTMLButtonElement>('.confirmation-modal-cancel')!.click()
    await jest.runAllTimersAsync()
    expect(await service.getSession()).not.toBeNull()
    expect(reload).not.toHaveBeenCalled()
    saveAppLocale('zh')
    controls.refreshLocale()
    expect(controls.element.querySelector('button')!.title).toContain('退出登录')
    controls.element.querySelector('button')!.click()
    document.querySelector<HTMLButtonElement>('.confirmation-modal-confirm')!.click()
    await jest.runAllTimersAsync()
    expect(await service.getSession()).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})