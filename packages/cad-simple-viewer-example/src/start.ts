import { createDemoAuthService } from './auth/authService'
import { startLogin } from './auth/startLogin'

const service = createDemoAuthService({
  enabled: import.meta.env.DEV || import.meta.env.VITE_AUTH_DEMO === 'true'
})

startLogin(
  service,
  async user => {
    const { bootstrap } = await import('./main')
    await bootstrap(service, user)
  },
  async () => {
    const { prepareWorkspaceStyles } = await import('./main')
    prepareWorkspaceStyles()
  }
)