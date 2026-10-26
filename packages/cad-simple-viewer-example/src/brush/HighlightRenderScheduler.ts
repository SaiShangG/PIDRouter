export class HighlightRenderScheduler<Id> {
  private pending = new Set<Id>()
  private frameId?: number

  constructor(
    private readonly render: (ids: ReadonlySet<Id>) => void,
    private readonly requestFrame = (callback: FrameRequestCallback) => window.requestAnimationFrame(callback),
    private readonly cancelFrame = (id: number) => window.cancelAnimationFrame(id)
  ) {}

  schedule(ids: Iterable<Id>) {
    for (const id of ids) this.pending.add(id)
    if (this.pending.size === 0 || this.frameId !== undefined) return
    this.frameId = this.requestFrame(() => {
      this.frameId = undefined
      this.renderPending()
    })
  }

  flush() {
    if (this.frameId !== undefined) this.cancelFrame(this.frameId)
    this.frameId = undefined
    this.renderPending()
  }

  cancel() {
    if (this.frameId !== undefined) this.cancelFrame(this.frameId)
    this.frameId = undefined
    this.pending.clear()
  }

  private renderPending() {
    if (this.pending.size === 0) return
    const ids = this.pending
    this.pending = new Set()
    this.render(ids)
  }
}
