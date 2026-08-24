import {
  type AcEdBaseView,
  AcEdCorsorType,
  AcEdViewMode
} from '@mlightcad/cad-simple-viewer'
import type { AcDbObjectId } from '@mlightcad/data-model'

import type { ResolvedEntityPresentation } from '../presentation/presentationStyleResolver'

export type BrushOperation = 'paint' | 'erase'

export interface BrushHighlightOverlay {
  dispose(): void
}

export interface BrushHighlightFeatureOptions {
  getView(): AcEdBaseView | undefined
  getHighlightStyle(
    objectId?: AcDbObjectId,
    fallbackStyle?: ResolvedEntityPresentation
  ): ResolvedEntityPresentation
  createOverlay(
    objectIds: readonly AcDbObjectId[],
    style: ResolvedEntityPresentation
  ): BrushHighlightOverlay | null
  setOperationCursor?(view: AcEdBaseView, operation: BrushOperation): void
  radiusPx?: number
  sampleSpacingPx?: number
  onActiveChanged?(): void
}

const DEFAULT_RADIUS_PX = 8
const DEFAULT_SAMPLE_SPACING_PX = 6

export class BrushHighlightFeature {
  private readonly radiusPx: number
  private readonly sampleSpacingPx: number
  private readonly brushStyles = new Map<
    AcDbObjectId,
    ResolvedEntityPresentation
  >()
  private readonly overlays = new Set<BrushHighlightOverlay>()
  private attachedView?: AcEdBaseView
  private active = false
  private operation: BrushOperation = 'paint'
  private previousMode?: AcEdViewMode
  private previousCursor?: AcEdCorsorType
  private pointerId?: number
  private strokeStyle?: ResolvedEntityPresentation
  private lastCanvasPoint?: { x: number; y: number }
  private disposed = false

  constructor(private readonly options: BrushHighlightFeatureOptions) {
    this.radiusPx = Math.max(1, options.radiusPx ?? DEFAULT_RADIUS_PX)
    this.sampleSpacingPx = Math.max(
      1,
      options.sampleSpacingPx ?? DEFAULT_SAMPLE_SPACING_PX
    )
  }

  attach() {
    if (this.disposed) return
    const view = this.options.getView()
    if (!view || view === this.attachedView) return
    if (this.active) this.deactivate()
    this.disposeOverlays()
    this.detachView()
    this.attachedView = view
    this.syncOverlays()
  }

  activate(operation: BrushOperation) {
    if (this.disposed) return false
    const view = this.options.getView()
    if (!view) return false
    this.attach()
    if (!this.attachedView) return false

    if (this.active && this.operation === operation) {
      this.deactivate()
      return false
    }

    this.operation = operation
    if (!this.active) {
      this.previousMode = view.mode
      this.previousCursor = view.editor.currentCursor
      view.mode = AcEdViewMode.BRUSH
      view.setCursor(AcEdCorsorType.Crosshair)
      this.active = true
      this.addPointerListeners()
      document.addEventListener('keydown', this.handleKeyDown, true)
    }
    this.options.setOperationCursor?.(view, this.operation)
    this.options.onActiveChanged?.()
    return true
  }

  deactivate() {
    if (!this.active) return
    this.removePointerListeners()
    this.releasePointer()
    document.removeEventListener('keydown', this.handleKeyDown, true)

    const view = this.attachedView
    if (view?.mode === AcEdViewMode.BRUSH) {
      view.mode = this.previousMode ?? AcEdViewMode.SELECTION
    }
    if (view && this.previousCursor !== undefined) {
      view.setCursor(this.previousCursor)
    }

    this.active = false
    this.previousMode = undefined
    this.previousCursor = undefined
    this.options.onActiveChanged?.()
  }

  reset() {
    this.deactivate()
    this.disposeOverlays()
    this.brushStyles.clear()
  }

  dispose() {
    if (this.disposed) return
    this.reset()
    this.detachView()
    this.disposed = true
  }

  get isActive() {
    return this.active
  }

  get currentOperation() {
    return this.operation
  }

  get highlightedIds() {
    return [...this.brushStyles.keys()]
  }

  private addPointerListeners() {
    const canvas = this.attachedView?.canvas
    if (!canvas) return
    canvas.addEventListener('pointerdown', this.handlePointerDown, true)
    canvas.addEventListener('pointermove', this.handlePointerMove, true)
    canvas.addEventListener('pointerup', this.handlePointerUp, true)
    canvas.addEventListener('pointercancel', this.handlePointerCancel, true)
    canvas.addEventListener('lostpointercapture', this.handlePointerCancel, true)
    canvas.addEventListener('contextmenu', this.handleContextMenu, true)
  }

  private removePointerListeners() {
    const canvas = this.attachedView?.canvas
    if (!canvas) return
    canvas.removeEventListener('pointerdown', this.handlePointerDown, true)
    canvas.removeEventListener('pointermove', this.handlePointerMove, true)
    canvas.removeEventListener('pointerup', this.handlePointerUp, true)
    canvas.removeEventListener('pointercancel', this.handlePointerCancel, true)
    canvas.removeEventListener('lostpointercapture', this.handlePointerCancel, true)
    canvas.removeEventListener('contextmenu', this.handleContextMenu, true)
  }

  private releasePointer() {
    const canvas = this.attachedView?.canvas
    const pointerId = this.pointerId
    this.pointerId = undefined
    this.strokeStyle = undefined
    this.lastCanvasPoint = undefined
    if (
      canvas &&
      pointerId !== undefined &&
      canvas.hasPointerCapture?.(pointerId)
    ) {
      canvas.releasePointerCapture(pointerId)
    }
  }

  private detachView() {
    if (!this.attachedView) return
    this.attachedView = undefined
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.active || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    this.deactivate()
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (
      !this.active ||
      !event.isPrimary ||
      event.button !== 0 ||
      this.pointerId !== undefined
    ) {
      return
    }
    this.suppressEvent(event)
    this.pointerId = event.pointerId
    this.strokeStyle =
      this.operation === 'paint' ? this.options.getHighlightStyle() : undefined
    this.lastCanvasPoint = this.toCanvasPoint(event)
    this.attachedView?.canvas.setPointerCapture?.(event.pointerId)
    this.applyAt(this.lastCanvasPoint)
  }

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.isActivePointer(event)) return
    if (event.buttons === 0 && event.pointerType === 'mouse') return
    this.suppressEvent(event)
    const nextPoint = this.toCanvasPoint(event)
    this.applySegment(nextPoint)
  }

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (!this.isActivePointer(event)) return
    this.suppressEvent(event)
    this.applySegment(this.toCanvasPoint(event))
    this.releasePointer()
  }

  private readonly handlePointerCancel = (event: PointerEvent) => {
    if (!this.isActivePointer(event)) return
    this.suppressEvent(event)
    this.releasePointer()
  }

  private readonly handleContextMenu = (event: MouseEvent) => {
    if (!this.active) return
    event.preventDefault()
    event.stopPropagation()
  }

  private isActivePointer(event: PointerEvent) {
    return this.active && event.isPrimary && event.pointerId === this.pointerId
  }

  private toCanvasPoint(event: PointerEvent) {
    const point = this.attachedView!.viewportToCanvas({
      x: event.clientX,
      y: event.clientY
    })
    return { x: point.x, y: point.y }
  }

  private applySegment(nextPoint: { x: number; y: number }) {
    const previousPoint = this.lastCanvasPoint
    if (!previousPoint) {
      this.lastCanvasPoint = nextPoint
      this.applyAt(nextPoint)
      return
    }

    const distance = Math.hypot(
      nextPoint.x - previousPoint.x,
      nextPoint.y - previousPoint.y
    )
    const steps = Math.max(1, Math.ceil(distance / this.sampleSpacingPx))
    for (let index = 1; index <= steps; index++) {
      const ratio = index / steps
      this.applyAt({
        x: previousPoint.x + (nextPoint.x - previousPoint.x) * ratio,
        y: previousPoint.y + (nextPoint.y - previousPoint.y) * ratio
      })
    }
    this.lastCanvasPoint = nextPoint
  }

  private applyAt(canvasPoint: { x: number; y: number }) {
    const view = this.attachedView
    if (!view) return
    const worldPoint = view.screenToWorld(canvasPoint)
    const ids = [
      ...new Set(view.pick(worldPoint, this.radiusPx, false).map(item => item.id))
    ]
    if (ids.length === 0) return

    if (this.operation === 'paint') {
      const style = this.strokeStyle
      if (!style) return
      const idsToHighlight = ids.filter(id => !this.brushStyles.has(id))
      if (idsToHighlight.length === 0) return
      idsToHighlight.forEach(id => {
        this.brushStyles.set(
          id,
          this.options.getHighlightStyle(id, style)
        )
      })
      this.syncOverlays()
      return
    }

    const idsToErase = ids.filter(id => this.brushStyles.has(id))
    if (idsToErase.length === 0) return
    idsToErase.forEach(id => this.brushStyles.delete(id))
    this.syncOverlays()
  }

  private syncOverlays() {
    this.disposeOverlays()
    if (this.brushStyles.size === 0) return

    const groups = new Map<
      string,
      { ids: AcDbObjectId[]; style: ResolvedEntityPresentation }
    >()
    this.brushStyles.forEach((style, objectId) => {
      const group = groups.get(style.key)
      if (group) {
        group.ids.push(objectId)
      } else {
        groups.set(style.key, { ids: [objectId], style })
      }
    })

    groups.forEach(({ ids, style }) => {
      const overlay = this.options.createOverlay(ids, style)
      if (overlay) this.overlays.add(overlay)
    })
  }

  private disposeOverlays() {
    this.overlays.forEach(overlay => overlay.dispose())
    this.overlays.clear()
  }

  private suppressEvent(event: Event) {
    event.preventDefault()
    event.stopPropagation()
  }
}
