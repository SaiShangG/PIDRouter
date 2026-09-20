import type { FlowConnectionDocumentInput } from '../flow/types'

export interface TankOption {
  id: string
  name: string
  handleKey: string
}

export function readDocumentTanks(
  document: FlowConnectionDocumentInput,
  drawingId: string
): TankOption[] {
  const handles = document.Map?.Data?.Tanks
  if (!Array.isArray(handles)) return []
  const seen = new Set<number>()
  return handles.flatMap((handle, index) => {
    if (!Number.isSafeInteger(handle) || handle <= 0 || seen.has(handle)) return []
    seen.add(handle)
    const handleKey = handle.toString(16).toUpperCase()
    return [{ id: `${drawingId}:${handleKey}`, name: `Vessel_${index + 1}`, handleKey }]
  })
}

interface TankLocatorOverlay {
  setVisible?(visible: boolean): void
  dispose(): void
}

export class TankLocator {
  private overlay?: TankLocatorOverlay
  private timer?: ReturnType<typeof setInterval>

  constructor(private readonly createOverlay: (handleKey: string) => TankLocatorOverlay | undefined) { }

  start(handleKey: string): boolean {
    this.stop()
    this.overlay = this.createOverlay(handleKey)
    if (!this.overlay) return false
    let visible = true
    this.timer = setInterval(() => {
      visible = !visible
      this.overlay?.setVisible?.(visible)
    }, 500)
    return true
  }

  stop() {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    this.overlay?.dispose()
    this.overlay = undefined
  }
}