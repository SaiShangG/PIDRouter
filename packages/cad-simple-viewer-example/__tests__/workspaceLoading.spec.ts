import { WorkspaceLoading, type WorkspaceLoadingTask } from '../src/phase/workspaceLoading'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

describe('workspace loading', () => {
  const setup = () => {
    const host = {
      show: jest.fn(),
      setMessage: jest.fn(),
      hide: jest.fn(),
      changed: jest.fn()
    }
    return { host, loading: new WorkspaceLoading(host) }
  }

  it('shows before work starts and keeps the empty state hidden until completion', async () => {
    const { host, loading } = setup()
    const download = deferred()
    const work = loading.run('Downloading', async task => {
      expect(host.show).toHaveBeenCalledWith('Downloading')
      expect(loading.active).toBe(true)
      await download.promise
      task.setMessage('Extracting')
    })
    expect(host.hide).not.toHaveBeenCalled()
    download.resolve()
    await work
    expect(host.setMessage).toHaveBeenCalledWith('Extracting')
    expect(host.hide).toHaveBeenCalledTimes(1)
    expect(loading.active).toBe(false)
    expect(host.changed).toHaveBeenLastCalledWith(false)
  })

  it('cleans up failures and allows another attempt', async () => {
    const { host, loading } = setup()
    await expect(loading.run('Downloading', async () => {
      throw new Error('Download failed')
    })).rejects.toThrow('Download failed')
    expect(loading.active).toBe(false)
    await loading.run('Retrying', async () => true)
    expect(host.show).toHaveBeenCalledTimes(2)
    expect(host.hide).toHaveBeenCalledTimes(2)
  })

  it('ignores stale updates, handoffs and completion while a newer request is pending', async () => {
    const { host, loading } = setup()
    const first = deferred()
    const second = deferred()
    let oldTask!: WorkspaceLoadingTask
    const oldWork = loading.run('First', async task => {
      oldTask = task
      await first.promise
      task.setMessage('Stale')
      task.handoff()
    })
    const newWork = loading.run('Second', () => second.promise)
    expect(oldTask.isCurrent()).toBe(false)
    first.resolve()
    await oldWork
    expect(host.setMessage).toHaveBeenLastCalledWith('Second')
    expect(host.show).toHaveBeenCalledTimes(1)
    expect(host.hide).not.toHaveBeenCalled()
    expect(loading.active).toBe(true)
    second.resolve()
    await newWork
    expect(host.hide).toHaveBeenCalledTimes(1)
  })

  it('hands off to parser progress without exposing the empty state or double-hiding', async () => {
    const { host, loading } = setup()
    await loading.run('Preparing', async task => {
      task.handoff()
      task.handoff()
      expect(host.hide).toHaveBeenCalledTimes(1)
      expect(loading.active).toBe(true)
      task.setMessage('Ignored after handoff')
    })
    expect(host.setMessage).not.toHaveBeenCalled()
    expect(host.hide).toHaveBeenCalledTimes(1)
    expect(loading.active).toBe(false)
    await loading.run('Next', async () => undefined)
    expect(host.show).toHaveBeenCalledTimes(2)
  })

  it('lets a nested phase own completion without double-hiding the project overlay', async () => {
    const { host, loading } = setup()
    await loading.run('Project', async () => {
      await loading.run('Phase', async () => undefined)
    })
    expect(host.show).toHaveBeenCalledTimes(1)
    expect(host.hide).toHaveBeenCalledTimes(1)
    expect(host.changed.mock.calls.filter(([active]) => !active)).toHaveLength(1)
  })
})