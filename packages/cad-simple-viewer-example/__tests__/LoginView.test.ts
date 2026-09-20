/** @jest-environment jsdom */
import { createDemoAuthService } from '../src/auth/authService'
import { LoginView } from '../src/auth/LoginView'
import { saveAppLocale } from '../src/locale'

describe('LoginView', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    localStorage.clear()
    jest.useFakeTimers()
  })
  afterEach(() => jest.useRealTimers())

  function setup(outcome: 'success' | 'invalid' | 'network' = 'success') {
    const service = createDemoAuthService({ enabled: true, delayMs: 100, outcome })
    const login = jest.spyOn(service, 'login')
    const onAuthenticated = jest.fn().mockResolvedValue(undefined)
    const view = new LoginView(service, onAuthenticated)
    view.mount()
    const username = document.querySelector<HTMLInputElement>('#login-username')!
    const password = document.querySelector<HTMLInputElement>('#login-password')!
    const form = document.querySelector('form')!
    const submit = () => form.dispatchEvent(new Event('submit', { cancelable: true }))
    return { view, username, password, submit, login, onAuthenticated }
  }

  it('validates before authenticating and focuses the missing field', () => {
    const { submit, login, username } = setup()
    submit()
    expect(login).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(username)
    expect(username.getAttribute('aria-invalid')).toBe('true')
    expect(document.querySelector('#login-status')!.textContent).toBeTruthy()
  })

  it('separates the photo and login panel and localizes the image description', () => {
    setup()
    const image = document.querySelector<HTMLImageElement>('.login-media img')!
    expect(image.getAttribute('src')).toBe('./biopharma-login.jpg')
    expect(image.alt).toBe('生物医药实验室中的研究人员与实验设备')
    expect(document.querySelector('.login-panel form')).not.toBeNull()
    document.querySelector<HTMLButtonElement>('header button')!.click()
    expect(image.alt).toBe('Researchers and laboratory equipment in a biomedical laboratory')
  })

  it('switches language without clearing values and toggles password visibility', () => {
    const { username, password } = setup()
    username.value = 'operator'
    password.value = ' demo '
    document.querySelector<HTMLButtonElement>('.login-visibility')!.click()
    expect(password.type).toBe('text')
    document.querySelector<HTMLButtonElement>('header button')!.click()
    expect(document.documentElement.lang).toBe('en')
    expect(document.querySelector('h1')!.textContent).toBe('Sign in')
    expect(username.value).toBe('operator')
    expect(password.value).toBe(' demo ')
  })

  it('blocks duplicate submissions and opens the workspace only after login', async () => {
    const { username, password, submit, login, onAuthenticated, view } = setup()
    username.value = ' operator '
    password.value = ' demo '
    submit()
    submit()
    expect(login).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith({ username: 'operator', password: ' demo ' })
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true)
    await jest.runAllTimersAsync()
    expect(onAuthenticated).toHaveBeenCalledWith({ id: 'demo', name: 'operator' })
    expect(password.value).toBe('')
    expect(view.element.isConnected).toBe(false)
  })

  it.each(['invalid', 'network'] as const)('retains username and allows retry after %s', async outcome => {
    saveAppLocale('en')
    const { username, password, submit, login, onAuthenticated } = setup(outcome)
    username.value = 'operator'
    password.value = 'demo'
    submit()
    await jest.runAllTimersAsync()
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(username.value).toBe('operator')
    expect(password.value).toBe('')
    expect(document.querySelector('.login-status.is-error')!.textContent).toMatch(/Incorrect|Cannot connect/)
    password.value = 'demo'
    submit()
    await jest.runAllTimersAsync()
    expect(login).toHaveBeenCalledTimes(2)
  })

  it('offers reload instead of creating another workspace after startup failure', async () => {
    saveAppLocale('en')
    const { username, password, submit, onAuthenticated } = setup()
    onAuthenticated.mockRejectedValue(new Error('startup failed'))
    username.value = 'operator'
    password.value = 'demo'
    submit()
    await jest.runAllTimersAsync()
    expect(document.querySelector('[type="submit"]')!.textContent).toBe('Reload')
    expect(document.querySelector('.login-status.is-error')!.textContent).toMatch(/workspace/)
  })
})