import { shouldHotSwitchPhase } from '../src/phase/phaseActivationUtils'

describe('shouldHotSwitchPhase', () => {
  const ready = {
    loadedAssetId: 'drawing-1',
    targetAssetId: 'drawing-1',
    isLoading: false,
    hasPendingActivation: false
  }

  it('hot switches when the loaded and target drawings match', () => {
    expect(shouldHotSwitchPhase(ready)).toBe(true)
  })

  it.each([
    ['different drawing', { targetAssetId: 'drawing-2' }],
    ['unassigned target', { targetAssetId: undefined }],
    ['drawing load in progress', { isLoading: true }],
    ['pending activation', { hasPendingActivation: true }]
  ])('uses a full load for %s', (_label, override) => {
    expect(shouldHotSwitchPhase({ ...ready, ...override })).toBe(false)
  })
})
