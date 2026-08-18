export async function startProcessAssistantMock(): Promise<void> {
  if (
    !import.meta.env.DEV ||
    import.meta.env.VITE_PROCESS_ASSISTANT_MOCK !== 'true'
  ) {
    return
  }

  const { processAssistantMockWorker } = await import('./browser')
  await processAssistantMockWorker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`
    }
  })
}
