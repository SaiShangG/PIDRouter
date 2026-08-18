/** @jest-environment jsdom */

import { DrawingLibraryModal } from '../src/drawing-library/DrawingLibraryModal'
import type {
  DrawingRecord,
  DrawingRepository
} from '../src/drawing-library/types'

const readyRecord: DrawingRecord = {
  id: 'drawing-ready',
  drawingNumber: 'PID-1001',
  name: 'CIP Supply',
  originalFileName: 'cip-supply.dwg',
  fileSize: 2 * 1024 * 1024,
  uploadedBy: 'Demo User',
  uploadedAt: '2026-08-17T08:30:00Z',
  status: 'READY',
  progress: 100,
  connectionArtifact: {
    id: 'artifact-ready',
    schemaVersion: 1,
    parserVersion: 'PID Mock Parser 1.0.0',
    completedAt: '2026-08-17T08:31:00Z',
    entityCount: 1280,
    edgeCount: 960,
    warningCount: 1,
    warnings: ['发现一个未连接端点']
  }
}

const failedRecord: DrawingRecord = {
  ...readyRecord,
  id: 'drawing-failed',
  name: 'Failed Drawing',
  status: 'FAILED',
  parseError: '模拟 DWG 解析失败'
}

const createHarness = (records: DrawingRecord[] = [readyRecord]) => {
  const repository: jest.Mocked<DrawingRepository> = {
    list: jest.fn(async () => records.map(record => ({ ...record }))),
    upload: jest.fn(),
    getContent: jest.fn(),
    retryParse: jest.fn(async id => ({
      ...(records.find(record => record.id === id) ?? readyRecord),
      status: 'READY' as const,
      parseError: undefined
    })),
    delete: jest.fn(async (_drawingId: string) => undefined)
  }
  const openDrawing = jest.fn(async () => undefined)
  const modal = new DrawingLibraryModal(repository, { open: openDrawing })
  return { modal, repository, openDrawing }
}

const buttonByTitle = (title: string) =>
  document.querySelector<HTMLButtonElement>(`button[title="${title}"]`)

describe('DrawingLibraryModal', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.classList.remove('drawing-library-open')
    document.body.classList.remove('confirmation-modal-open')
    document.body.classList.remove('parsing-details-open')
  })

  it('lists persisted drawing metadata', async () => {
    const { modal } = createHarness()

    await modal.open()

    expect(document.body.textContent).toContain('CIP Supply')
    expect(document.body.textContent).toContain('PID-1001')
    expect(document.body.textContent).toContain('cip-supply.dwg')
    expect(document.body.textContent).toContain('Demo User')
    expect(document.body.textContent).toContain('2.0 MB')
    expect(document.body.textContent).toContain('可查看')
    expect(document.body.textContent).toContain('1,280 实体 · 960 连接')
  })

  it('allows selecting files without an extension filter', async () => {
    const { modal } = createHarness()

    await modal.open()

    const fileInput = document.querySelector<HTMLInputElement>(
      '.drawing-upload-file input[type="file"]'
    )
    expect(fileInput?.accept).toBe('')
    expect(document.body.textContent).toContain('请选择文件')
  })

  it('submits a non-CAD file to the repository', async () => {
    const { modal, repository } = createHarness()
    repository.upload.mockResolvedValue({
      ...readyRecord,
      originalFileName: 'process-notes.pdf',
      status: 'UPLOADED',
      connectionArtifact: undefined
    })
    await modal.open()
    const nameInput = [...document.querySelectorAll<HTMLInputElement>('input')]
      .find(input => input.placeholder === '例如：CIP Supply')!
    const fileInput = document.querySelector<HTMLInputElement>(
      '.drawing-upload-file input[type="file"]'
    )!
    const file = new File(['notes'], 'process-notes.pdf', {
      type: 'application/pdf'
    })
    nameInput.value = 'Process notes'
    nameInput.dispatchEvent(new Event('input'))
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fileInput.dispatchEvent(new Event('change'))

    fileInput.closest('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(repository.upload).toHaveBeenCalledWith(
      file,
      { name: 'Process notes', drawingNumber: '' },
      expect.any(Function)
    )
  })

  it('opens artifact summary in an independent modal', async () => {
    const { modal } = createHarness()
    await modal.open()

    buttonByTitle('查看解析摘要')?.click()

    const details = document.querySelector<HTMLElement>('.parsing-details-modal')
    expect(details?.parentElement).toBe(document.body)
    expect(details?.hidden).toBe(false)
    expect(details?.textContent).toContain('解析结果摘要')
    expect(details?.textContent).toContain('PID Mock Parser 1.0.0')
    expect(details?.textContent).toContain('1,280')
    expect(details?.textContent).toContain('960')
    expect(details?.textContent).toContain('发现一个未连接端点')
  })

  it('shows parse errors without enabling drawing view', async () => {
    const { modal } = createHarness([failedRecord])
    await modal.open()

    expect(document.body.textContent).toContain('处理失败')
    expect(document.body.textContent).toContain('模拟 DWG 解析失败')
    expect(buttonByTitle('查看图纸')?.disabled).toBe(true)
  })

  it('opens a ready drawing and closes the modal', async () => {
    const { modal, openDrawing } = createHarness()
    await modal.open()

    buttonByTitle('查看图纸')?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(openDrawing).toHaveBeenCalledWith(readyRecord)
    expect(modal.element.hidden).toBe(true)
  })

  it('retries a failed parse', async () => {
    const { modal, repository } = createHarness([failedRecord])
    await modal.open()

    buttonByTitle('重试处理')?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(repository.retryParse).toHaveBeenCalledWith('drawing-failed')
  })

  it('deletes a confirmed drawing', async () => {
    const { modal, repository } = createHarness()
    await modal.open()

    buttonByTitle('删除图纸')?.click()
    await Promise.resolve()
    expect(repository.delete).not.toHaveBeenCalled()
    expect(document.querySelector('#confirmationModalTitle')?.textContent).toBe(
      '删除图纸'
    )

    ;[...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === '删除')
      ?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(repository.delete).toHaveBeenCalledWith('drawing-ready')
  })

  it('keeps the drawing when deletion is cancelled', async () => {
    const { modal, repository } = createHarness()
    await modal.open()

    buttonByTitle('删除图纸')?.click()
    await Promise.resolve()
    ;[...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === '取消')
      ?.click()
    await Promise.resolve()

    expect(repository.delete).not.toHaveBeenCalled()
  })
})