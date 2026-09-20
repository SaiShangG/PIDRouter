export interface AuthUser {
  id: string
  name: string
}

export interface AuthCredentials {
  username: string
  password: string
}

export interface AuthService {
  readonly mode: 'demo' | 'remote'
  login(credentials: AuthCredentials): Promise<AuthUser>
  logout(): Promise<void>
  getSession(): Promise<AuthUser | null>
}

export type AuthErrorCode = 'required' | 'invalid' | 'network' | 'unavailable'

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code)
  }
}

export function createDemoAuthService(options: {
  enabled: boolean
  delayMs?: number
  outcome?: 'success' | 'invalid' | 'network'
}): AuthService {
  let user: AuthUser | null = null
  return {
    mode: 'demo',
    async login(credentials) {
      if (!options.enabled) throw new AuthError('unavailable')
      const username = credentials.username.trim()
      if (!username || !credentials.password) throw new AuthError('required')
      await new Promise(resolve => setTimeout(resolve, options.delayMs ?? 350))
      if (options.outcome && options.outcome !== 'success') {
        throw new AuthError(options.outcome)
      }
      user = { id: 'demo', name: username }
      return { ...user }
    },
    async logout() {
      user = null
    },
    async getSession() {
      return user ? { ...user } : null
    }
  }
}