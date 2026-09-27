import { AuthError, createDemoAuthService } from '../src/auth/authService'

describe('demo authentication', () => {
  it('keeps the session in memory and clears it on logout', async () => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0 })
    expect(await service.getSession()).toBeNull()
    expect(await service.login({ username: 'Admin', password: 'Admin' }))
      .toEqual({ id: 'demo', name: 'Admin' })
    const session = await service.getSession()
    session!.name = 'changed'
    expect((await service.getSession())?.name).toBe('Admin')
    expect(await createDemoAuthService({ enabled: true }).getSession()).toBeNull()
    await service.logout()
    expect(await service.getSession()).toBeNull()
  })

  it('does not allow login unless explicitly enabled', async () => {
    const service = createDemoAuthService({ enabled: false, delayMs: 0 })
    await expect(service.login({ username: 'Admin', password: 'Admin' }))
      .rejects.toEqual(new AuthError('unavailable'))
    expect(await service.getSession()).toBeNull()
  })

  it.each([
    { username: ' ', password: 'demo' },
    { username: 'operator', password: '' }
  ])('rejects empty fields', async credentials => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0 })
    await expect(service.login(credentials)).rejects.toEqual(new AuthError('required'))
  })

  it.each([
    { username: 'operator', password: 'Admin' },
    { username: 'admin', password: 'Admin' },
    { username: 'ADMIN', password: 'Admin' },
    { username: ' Admin', password: 'Admin' },
    { username: 'Admin ', password: 'Admin' },
    { username: 'Admin', password: 'demo' },
    { username: 'Admin', password: 'admin' },
    { username: 'Admin', password: 'ADMIN' },
    { username: 'Admin', password: ' Admin' },
    { username: 'Admin', password: 'Admin ' }
  ])('rejects credentials other than exactly Admin/Admin: %j', async credentials => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0 })
    await expect(service.login(credentials)).rejects.toEqual(new AuthError('invalid'))
    expect(await service.getSession()).toBeNull()
  })

  it.each(['invalid', 'network'] as const)('supports %s failures', async outcome => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0, outcome })
    await expect(service.login({ username: 'Admin', password: 'Admin' }))
      .rejects.toEqual(new AuthError(outcome))
    expect(await service.getSession()).toBeNull()
  })
})