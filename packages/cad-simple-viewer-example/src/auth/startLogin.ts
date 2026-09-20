import type { AuthService, AuthUser } from './authService'
import { injectLoginStyles } from './loginStyles'
import { LoginView } from './LoginView'

export function startLogin(
  service: AuthService,
  startWorkspace: (user: AuthUser) => Promise<void>,
  prepareWorkspace: () => void | Promise<void> = () => { }
) {
  injectLoginStyles()
  document.body.classList.add('login-active')
  const view = new LoginView(service, async user => {
    await prepareWorkspace()
    view.element.remove()
    document.body.classList.remove('login-active', 'app-booting')
    const workspace = document.getElementById('viewerPane')
    workspace?.setAttribute('tabindex', '-1')
    workspace?.setAttribute('aria-busy', 'true')
    workspace?.focus()
    try {
      await startWorkspace(user)
    } catch (error) {
      document.body.classList.add('login-active')
      document.body.append(view.element)
      throw error
    } finally {
      workspace?.removeAttribute('aria-busy')
    }
  })
  view.mount()
  return view
}