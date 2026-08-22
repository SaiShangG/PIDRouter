export interface FlowDebugTraversalEdge {
  from: number
  to: number
}

export interface FlowDebugTraversalStep {
  edge: FlowDebugTraversalEdge
  blocked: boolean
  processedCount: number
  discoveredCount: number
  pendingCount: number
}

export interface FlowDebugTraversalOptions {
  startKeys: string[]
  getEdges: (handleKey: string) => readonly FlowDebugTraversalEdge[]
  getHandleKeys: (handle: number) => string[]
  isBlocked: (handle: number) => boolean
}

export class FlowDebugTraversal {
  private readonly pending: FlowDebugTraversalEdge[] = []
  private readonly discoveredHandles = new Set<number>()
  private readonly expandedHandleKeys = new Set<string>()
  private processed = 0

  constructor(private readonly options: FlowDebugTraversalOptions) {
    this.enqueueEdges(options.startKeys)
  }

  get pendingEdges(): readonly FlowDebugTraversalEdge[] {
    return this.pending
  }

  get processedCount(): number {
    return this.processed
  }

  get discoveredCount(): number {
    return this.discoveredHandles.size
  }

  next(): FlowDebugTraversalStep | undefined {
    const edge = this.pending.shift()
    if (!edge) return undefined

    this.processed += 1
    const blocked = this.options.isBlocked(edge.to)
    if (!blocked) {
      this.enqueueEdges(this.options.getHandleKeys(edge.to))
    }

    return {
      edge,
      blocked,
      processedCount: this.processed,
      discoveredCount: this.discoveredCount,
      pendingCount: this.pending.length
    }
  }

  private enqueueEdges(handleKeys: string[]) {
    handleKeys.forEach(handleKey => {
      if (this.expandedHandleKeys.has(handleKey)) return

      this.expandedHandleKeys.add(handleKey)
      this.options.getEdges(handleKey).forEach(edge => {
        if (this.discoveredHandles.has(edge.to)) return

        this.discoveredHandles.add(edge.to)
        this.pending.push(edge)
      })
    })
  }
}
