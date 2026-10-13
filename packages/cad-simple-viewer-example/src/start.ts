import { ensureRandomUUID } from './browserCompatibility'
import { createDemoAuthService } from './auth/authService'
import { startLogin } from './auth/startLogin'
import { preloadDrawingParser } from './drawing-library/preloadDrawingParser'

ensureRandomUUID()
void Promise.allSettled([
  preloadDrawingParser('drawing.dwg'),
  preloadDrawingParser('drawing.dxf')
])

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