import { ensureRandomUUID } from '../src/browserCompatibility'

describe('ensureRandomUUID', () => {
  it('preserves the native implementation when available', () => {
    const nativeRandomUUID = jest.fn()
    const cryptoApi = { randomUUID: nativeRandomUUID } as unknown as Crypto

    ensureRandomUUID(cryptoApi)

    expect(cryptoApi.randomUUID).toBe(nativeRandomUUID)
    expect(nativeRandomUUID).not.toHaveBeenCalled()
  })

  it('uses getRandomValues for each UUID when randomUUID is unavailable', () => {
    const getRandomValues = jest.fn(function (this: Crypto, bytes: Uint8Array): Uint8Array {
      expect(this).toBe(cryptoApi)
      return bytes.fill(getRandomValues.mock.calls.length === 1 ? 255 : 0)
    })
    const cryptoApi = { getRandomValues } as unknown as Crypto

    ensureRandomUUID(cryptoApi)

    expect(cryptoApi.randomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    expect(cryptoApi.randomUUID()).toBe('00000000-0000-4000-8000-000000000000')
    expect(getRandomValues).toHaveBeenCalledTimes(2)
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(16)
    expect(getRandomValues.mock.calls[1][0]).not.toBe(getRandomValues.mock.calls[0][0])
  })

  it('does not replace an already installed fallback', () => {
    const cryptoApi = { getRandomValues: jest.fn() } as unknown as Crypto
    ensureRandomUUID(cryptoApi)
    const installed = cryptoApi.randomUUID

    ensureRandomUUID(cryptoApi)

    expect(cryptoApi.randomUUID).toBe(installed)
  })

  it('fails explicitly instead of using a non-cryptographic random source', () => {
    expect(() => ensureRandomUUID({} as Crypto)).toThrow(
      'Secure random number generation is unavailable in this browser'
    )
  })
})