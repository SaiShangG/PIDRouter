export interface WorkspaceLoadingTask {
  isCurrent(): boolean
  setMessage(message: string): void
  handoff(): void
}

interface WorkspaceLoadingHost {
  show(message: string): void
  setMessage(message: string): void
  hide(): void
  changed(active: boolean): void
}

export class WorkspaceLoading {
  private token = 0
  private visible = false
  active = false

  constructor(private readonly host: WorkspaceLoadingHost) { }

  async run<Result>(
    message: string,
    work: (task: WorkspaceLoadingTask) => Promise<Result>
  ): Promise<Result> {
    const token = ++this.token
    this.active = true
    if (this.visible) {
      this.host.setMessage(message)
    } else {
      this.visible = true
      this.host.show(message)
    }
    this.host.changed(true)
    const task: WorkspaceLoadingTask = {
      isCurrent: () => token === this.token,
      setMessage: message => {
        if (token === this.token && this.visible) this.host.setMessage(message)
      },
      handoff: () => {
        if (token === this.token) this.hide()
      }
    }
    try {
      return await work(task)
    } finally {
      if (token === this.token) {
        this.hide()
        this.active = false
        this.host.changed(false)
      }
    }
  }

  private hide(): void {
    if (!this.visible) return
    this.visible = false
    this.host.hide()
  }
}