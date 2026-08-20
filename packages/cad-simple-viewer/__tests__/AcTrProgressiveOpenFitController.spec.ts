// @ts-nocheck
import { AcTrProgressiveOpenFitController } from '../src/view/AcTrProgressiveOpenFitController'

describe('AcTrProgressiveOpenFitController', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame
  let now: jest.SpyInstance
  let requestAnimationFrameMock: jest.Mock

  beforeEach(() => {
    now = jest.spyOn(performance, 'now')
    requestAnimationFrameMock = jest.fn(callback => {
      callback(0)
      return 1
    })
    globalThis.requestAnimationFrame = requestAnimationFrameMock
  })

  afterEach(() => {
    now.mockRestore()
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
  })

  it('keeps converting within the main-thread frame budget', async () => {
    now.mockReturnValueOnce(100).mockReturnValueOnce(107)
    const controller = new AcTrProgressiveOpenFitController(jest.fn())

    controller.begin(1000)
    await controller.yieldForRender(1)

    expect(requestAnimationFrameMock).not.toHaveBeenCalled()
  })

  it('yields to the next frame when conversion reaches the budget', async () => {
    now
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(108)
      .mockReturnValueOnce(109)
    const controller = new AcTrProgressiveOpenFitController(jest.fn())

    controller.begin(1000)
    await controller.yieldForRender(1)

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1)
  })
})