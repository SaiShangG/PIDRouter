import { createDemoAuthService } from './auth/authService'
import { startLogin } from './auth/startLogin'
import { ensureRandomUUID } from './browserCompatibility'
import { preloadDrawingParser } from './drawing-library/preloadDrawingParser'

ensureRandomUUID()
void Promise.allSettled([
  preloadDrawingParser('drawing.dwg'),
  preloadDrawingParser('drawing.dxf')
])

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