import {
  NETWORK_DEFAULTS,
  readHttpUrl,
  readPort,
  readPositiveInteger,
  readProxySetting
} from '../src/networkConfig'

describe('network configuration', () => {
  it('shares the default backend URL and accepts an HTTP endpoint', () => {
    expect(readHttpUrl(undefined, 'API_URL')).toBe(
      NETWORK_DEFAULTS.processAssistantApiUrl
    )
    expect(readHttpUrl(' https://api.example.test:5153/ ', 'API_URL')).toBe(
      'https://api.example.test:5153'
    )
  })

  it.each([
    'localhost:5153',
    'ftp://example.test',
    'http://example.test:0',
    'http://example.test/?x=1'
  ])('rejects invalid backend URL %s', value => {
    expect(() => readHttpUrl(value, 'API_URL')).toThrow('API_URL')
  })

  it('validates configured server ports', () => {
    expect(readPort(undefined, 'PORT', NETWORK_DEFAULTS.frontendPort)).toBe(
      5173
    )
    expect(readPort(' 5180 ', 'PORT', NETWORK_DEFAULTS.frontendPort)).toBe(5180)
    for (const value of ['0', '65536', '1.5', 'abc']) {
      expect(() => readPort(value, 'PORT', 5173)).toThrow('PORT')
    }
  })

  it('validates project IDs and proxy settings', () => {
    expect(readPositiveInteger(undefined, 'PROJECT_ID', 1)).toBe(1)
    expect(readPositiveInteger('42', 'PROJECT_ID', 1)).toBe(42)
    expect(() => readPositiveInteger('0', 'PROJECT_ID', 1)).toThrow(
      'PROJECT_ID'
    )
    expect(readProxySetting(undefined)).toBe(true)
    expect(readProxySetting(' false ')).toBe(false)
    expect(() => readProxySetting('yes')).toThrow(
      'VITE_PROCESS_ASSISTANT_USE_PROXY'
    )
  })
})
