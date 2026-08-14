import {
  clampPhaseSidebarWidth,
  getKeyboardResizeWidth,
  PHASE_SIDEBAR_MAX_WIDTH,
  PHASE_SIDEBAR_MIN_WIDTH
} from '../src/phaseSidebarResizeUtils'

describe('phaseSidebarResize', () => {
  it('clamps desktop widths to the supported range', () => {
    expect(clampPhaseSidebarWidth(100)).toBe(PHASE_SIDEBAR_MIN_WIDTH)
    expect(clampPhaseSidebarWidth(360)).toBe(360)
    expect(clampPhaseSidebarWidth(900)).toBe(PHASE_SIDEBAR_MAX_WIDTH)
  })

  it('maps accessible keyboard controls to bounded widths', () => {
    expect(getKeyboardResizeWidth(320, 'ArrowLeft')).toBe(310)
    expect(getKeyboardResizeWidth(320, 'ArrowRight')).toBe(330)
    expect(getKeyboardResizeWidth(320, 'Home')).toBe(PHASE_SIDEBAR_MIN_WIDTH)
    expect(getKeyboardResizeWidth(320, 'End')).toBe(PHASE_SIDEBAR_MAX_WIDTH)
    expect(getKeyboardResizeWidth(320, 'Enter')).toBeUndefined()
  })
})