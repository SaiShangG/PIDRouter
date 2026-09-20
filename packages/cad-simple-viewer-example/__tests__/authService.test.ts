import { AuthError, createDemoAuthService } from '../src/auth/authService'

describe('demo authentication', () => {
  it('keeps the session in memory and clears it on logout', async () => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0 })
    expect(await service.getSession()).toBeNull()
    expect(await service.login({ username: ' operator ', password: ' ' }))
      .toEqual({ id: 'demo', name: 'operator' })
    const session = await service.getSession()
    session!.name = 'changed'
    expect((await service.getSession())?.name).toBe('operator')
    expect(await createDemoAuthService({ enabled: true }).getSession()).toBeNull()
    await service.logout()
    expect(await service.getSession()).toBeNull()
  })

  it('does not allow login unless explicitly enabled', async () => {
    const service = createDemoAuthService({ enabled: false, delayMs: 0 })
    await expect(service.login({ username: 'operator', password: 'demo' }))
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

  it.each(['invalid', 'network'] as const)('supports %s failures', async outcome => {
    const service = createDemoAuthService({ enabled: true, delayMs: 0, outcome })
    await expect(service.login({ username: 'operator', password: 'demo' }))
      .rejects.toEqual(new AuthError(outcome))
    expect(await service.getSession()).toBeNull()
  })
})