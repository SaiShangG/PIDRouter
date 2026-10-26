import { ensureRandomUUID } from './browserCompatibility'
import { createDemoAuthService } from './auth/authService'
import { startLogin } from './auth/startLogin'
import { preloadDrawingParser } from './drawing-library/preloadDrawingParser'

declare const __PID_LOGIN_ENABLED__: boolean

ensureRandomUUID()
void Promise.allSettled([
  preloadDrawingParser('drawing.dwg'),
  preloadDrawingParser('drawing.dxf')
])

if (__PID_LOGIN_ENABLED__) {
  const authService = createDemoAuthService({ enabled: true })
  startLogin(
    authService,
    async user => {
      const { bootstrap } = await import('./main')
      await bootstrap(authService, user)
    },
    async () => {
      const { prepareWorkspaceStyles } = await import('./main')
      prepareWorkspaceStyles()
    }
  )
} else {
  void import('./main')
    .then(({ bootstrap }) => bootstrap())
    .catch(error => {
      console.error('Failed to start workspace:', error)
      document.body.classList.remove('app-booting')
    })
}