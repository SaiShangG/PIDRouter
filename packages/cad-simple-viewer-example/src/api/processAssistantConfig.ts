export interface ProcessAssistantConfig {
  baseUrl: string
  projectId: number
}

declare global {
  interface Window {
    PID_VIEWER_CONFIG?: {
      processAssistantApiUrl?: string
    }
  }
}

const runtimeApiUrl =
  typeof window === 'undefined'
    ? ''
    : window.PID_VIEWER_CONFIG?.processAssistantApiUrl?.trim() || ''

export const PROCESS_ASSISTANT_TARGET_URL =
  runtimeApiUrl ||
  import.meta.env.VITE_PROCESS_ASSISTANT_API_URL?.trim() ||
  'http://localhost:5153'

export const PROCESS_ASSISTANT_API_URL =
  import.meta.env.DEV &&
  import.meta.env.VITE_PROCESS_ASSISTANT_USE_PROXY !== 'false'
    ? ''
    : PROCESS_ASSISTANT_TARGET_URL

export const PROCESS_ASSISTANT_PROJECT_ID = Number(
  import.meta.env.VITE_PROCESS_ASSISTANT_PROJECT_ID?.trim() || '1'
)

export function getProcessAssistantConfig(): ProcessAssistantConfig {
  if (
    !Number.isInteger(PROCESS_ASSISTANT_PROJECT_ID) ||
    PROCESS_ASSISTANT_PROJECT_ID < 1
  ) {
    throw new Error(
      'VITE_PROCESS_ASSISTANT_PROJECT_ID must be a positive integer'
    )
  }

  return {
    baseUrl: PROCESS_ASSISTANT_API_URL,
    projectId: PROCESS_ASSISTANT_PROJECT_ID
  }
}