import { setupWorker } from 'msw/browser'

import { processAssistantHandlers } from './handlers'

export const processAssistantMockWorker = setupWorker(
  ...processAssistantHandlers
)
