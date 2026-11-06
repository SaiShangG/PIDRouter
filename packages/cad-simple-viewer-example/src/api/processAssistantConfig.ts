import {
  NETWORK_DEFAULTS,
  readHttpUrl,
  readPositiveInteger,
  readProxySetting
} from '../networkConfig'

export interface ProcessAssistantConfig {
  baseUrl: string
  projectId: number
}

export const PROCESS_ASSISTANT_TARGET_URL = readHttpUrl(
  import.meta.env.VITE_PROCESS_ASSISTANT_API_URL,
  'VITE_PROCESS_ASSISTANT_API_URL'
)

export const PROCESS_ASSISTANT_API_URL =
  import.meta.env.DEV &&
  readProxySetting(import.meta.env.VITE_PROCESS_ASSISTANT_USE_PROXY)
    ? ''
    : PROCESS_ASSISTANT_TARGET_URL

export const PROCESS_ASSISTANT_PROJECT_ID = readPositiveInteger(
  import.meta.env.VITE_PROCESS_ASSISTANT_PROJECT_ID,
  'VITE_PROCESS_ASSISTANT_PROJECT_ID',
  NETWORK_DEFAULTS.projectId
)

export function getProcessAssistantConfig(): ProcessAssistantConfig {
  return {
    baseUrl: PROCESS_ASSISTANT_API_URL,
    projectId: PROCESS_ASSISTANT_PROJECT_ID
  }
}
