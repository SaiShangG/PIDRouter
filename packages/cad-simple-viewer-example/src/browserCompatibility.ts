import { v4 as uuidv4 } from 'uuid'

export function ensureRandomUUID(cryptoApi: Crypto = globalThis.crypto): void {
  if (typeof cryptoApi?.randomUUID === 'function') return
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is unavailable in this browser')
  }

  Object.defineProperty(cryptoApi, 'randomUUID', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: () => uuidv4({ random: cryptoApi.getRandomValues(new Uint8Array(16)) })
  })
}