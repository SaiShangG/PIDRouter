import { ML_UI_COMPACT_MAX_WIDTH } from '@mlightcad/cad-simple-viewer'

import {
  clampPhaseSidebarWidth,
  getKeyboardResizeWidth,
  PHASE_SIDEBAR_DEFAULT_WIDTH
} from './phaseSidebarResizeUtils'

const STORAGE_KEY = 'cad-example-phase-sidebar-width'
const compactMediaQuery = `(max-width: ${ML_UI_COMPACT_MAX_WIDTH}px)`

function readStoredWidth(): number | undefined {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(value) && value > 0
      ? clampPhaseSidebarWidth(value)
      : undefined
  } catch {
    return undefined
  }
}

function persistWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(width))
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export function setupPhaseSidebarResize(
  sidebar: HTMLElement,
  handle: HTMLElement
) {
  let pointerId: number | undefined
  let startX = 0
  let startWidth = PHASE_SIDEBAR_DEFAULT_WIDTH

  const isCompact = () => window.matchMedia(compactMediaQuery).matches
  const applyWidth = (width: number) => {
    const clamped = clampPhaseSidebarWidth(width)
    sidebar.style.flexBasis = `${clamped}px`
    handle.setAttribute('aria-valuenow', String(clamped))
    return clamped
  }
  const currentWidth = () =>
    clampPhaseSidebarWidth(
      sidebar.getBoundingClientRect().width ||
        Number.parseFloat(sidebar.style.flexBasis) ||
        PHASE_SIDEBAR_DEFAULT_WIDTH
    )
  const syncLayout = () => {
    if (isCompact()) {
      sidebar.style.removeProperty('flex-basis')
      handle.removeAttribute('aria-valuenow')
      return
    }
    applyWidth(readStoredWidth() ?? PHASE_SIDEBAR_DEFAULT_WIDTH)
  }
  const finishResize = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return
    pointerId = undefined
    persistWidth(currentWidth())
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId)
    }
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', finishResize)
    document.removeEventListener('pointercancel', finishResize)
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
  }
  const onPointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return
    event.preventDefault()
    applyWidth(startWidth + event.clientX - startX)
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || isCompact()) return
    event.preventDefault()
    pointerId = event.pointerId
    startX = event.clientX
    startWidth = currentWidth()
    handle.setPointerCapture(event.pointerId)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', finishResize)
    document.addEventListener('pointercancel', finishResize)
  })
  handle.addEventListener('keydown', event => {
    if (isCompact()) return
    const width = getKeyboardResizeWidth(currentWidth(), event.key)
    if (width === undefined) return
    event.preventDefault()
    persistWidth(applyWidth(width))
  })
  window.addEventListener('resize', syncLayout)
  syncLayout()
}