/** Network defaults shared by the Vite server and the browser application. */
export const NETWORK_DEFAULTS = {
  frontendHost: '127.0.0.1',
  frontendPort: 5173,
  processAssistantApiUrl: 'http://127.0.0.1:5153',
  useProxy: true,
  projectId: 1
} as const

export function readHttpUrl(
  value: string | undefined,
  setting: string
): string {
  const raw = value?.trim() || NETWORK_DEFAULTS.processAssistantApiUrl
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${setting} must be an absolute HTTP or HTTPS URL`)
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.port === '0' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${setting} must be an absolute HTTP or HTTPS URL without credentials, query, or fragment`
    )
  }
  return url.href.replace(/\/$/, '')
}

export function readPort(
  value: string | undefined,
  setting: string,
  fallback: number
): number {
  if (!value?.trim()) return fallback
  const port = Number(value)
  if (
    !/^\d+$/.test(value.trim()) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(`${setting} must be an integer between 1 and 65535`)
  }
  return port
}

export function readPositiveInteger(
  value: string | undefined,
  setting: string,
  fallback: number
): number {
  if (!value?.trim()) return fallback
  const number = Number(value)
  if (
    !/^\d+$/.test(value.trim()) ||
    !Number.isSafeInteger(number) ||
    number < 1
  ) {
    throw new Error(`${setting} must be a positive integer`)
  }
  return number
}

export function readProxySetting(value: string | undefined): boolean {
  const setting = value?.trim()
  if (!setting) return NETWORK_DEFAULTS.useProxy
  if (setting === 'true') return true
  if (setting === 'false') return false
  throw new Error('VITE_PROCESS_ASSISTANT_USE_PROXY must be true or false')
}
