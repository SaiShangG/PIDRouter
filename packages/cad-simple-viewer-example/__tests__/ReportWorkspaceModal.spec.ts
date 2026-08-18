/** @jest-environment jsdom */

import type { PhaseWorkspaceState } from '../src/phase/types'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type {
  PhaseReportExportResult,
  PhaseReportOutputMode,
  PhaseReportProgress
} from '../src/report/PhaseReportExporter'
import { ReportManifestStore } from '../src/report/reportManifest'
import { ReportWorkspaceModal } from '../src/report/ReportWorkspaceModal'

type ExportReport = (
  mode: PhaseReportOutputMode,
  signal: AbortSignal,
  onProgress: (progress: PhaseReportProgress) => void
) => Promise<PhaseReportExportResult>

const workspace: PhaseWorkspaceState = {
  version: 4,
  drawingAssets: {
    drawing: { id: 'drawing', kind: 'blank', sourceName: 'Blank.dwg' }
  },
  processes: [
    {
      id: 'process',
      name: 'CIP',
      presentationProfile: createDefaultPresentationProfile(),
      createdAt: 'now',
      updatedAt: 'now',
      sequences: [
        {
          id: 'sequence',
          number: 1,
          name: 'Tank cleaning',
          createdAt: 'now',
          updatedAt: 'now',
          phases: [1, 2].map(number => ({
            id: `phase-${number}`,
            number,
            name: `Step ${number}`,
            drawing: {
              kind: 'assigned' as const,
              assetId: 'drawing',
              displayName: 'Blank.dwg'
            },
            flowState: { flowPaths: [] },
            deviceStates: {},
            createdAt: 'now',
            updatedAt: 'now'
          }))
        }
      ]
    }
  ]
}

const createHarness = (
  locale: 'en' | 'zh' = 'zh',
  state: PhaseWorkspaceState = workspace,
  exportReport: ExportReport = jest.fn(async () => ({
    status: 'completed' as const,
    fileName: 'report.pdf',
    bytes: new Uint8Array([1])
  }))
) => {
  let id = 0
  const store = new ReportManifestStore(
    undefined,
    () => `id-${++id}`,
    () => 'now'
  )
  const preview = jest.fn(async () => undefined)
  const modal = new ReportWorkspaceModal(
    () => JSON.parse(JSON.stringify(state)) as PhaseWorkspaceState,
    store,
    { preview, export: exportReport },
    () => locale
  )
  modal.open()
  return {
    modal,
    store,
    preview,
    exportReport: exportReport as jest.MockedFunction<ExportReport>
  }
}

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(button =>
    button.textContent?.includes(text)
  )

describe('ReportWorkspaceModal', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.classList.remove('report-pdf-exporting')
  })

  it('opens as an independent localized report workspace', () => {
    const { modal } = createHarness('en')

    expect(modal.element.hidden).toBe(false)
    expect(document.querySelector('#reportWorkspaceTitle')?.textContent).toBe(
      'PDF report pages'
    )
    expect(
      document.querySelector<HTMLInputElement>('[type="search"]')?.placeholder
    ).toBe('Search page, sequence, or Phase')
  })

  it('excludes and restores a slot without deleting it', () => {
    const { store } = createHarness()
    const slotId = store.snapshot().pages[0].id

    buttonByText('从报告排除')?.click()
    expect(store.snapshot().pages).toHaveLength(2)
    expect(store.snapshot().pages.find(page => page.id === slotId)?.excluded).toBe(
      true
    )

    buttonByText('恢复到报告')?.click()
    expect(store.snapshot().pages.find(page => page.id === slotId)?.excluded).toBe(
      false
    )
  })

  it('replaces the selected page without changing its slot id or position', () => {
    const { store } = createHarness()
    const before = store.snapshot()
    const replacement = document.querySelector<HTMLSelectElement>(
      '[aria-label="替换页面来源"]'
    )!
    replacement.value = before.pages[1].id
    replacement.dispatchEvent(new Event('change'))
    buttonByText('确认替换')?.click()
    const after = store.snapshot()

    expect(after.pages.map(page => page.id)).toEqual(
      before.pages.map(page => page.id)
    )
    expect(after.pages[0].replacement?.phaseId).toBe('phase-2')
  })

  it('starts merged report export from the independent workspace', async () => {
    const { exportReport } = createHarness()

    buttonByText('合并为一个 PDF')?.click()
    await Promise.resolve()

    expect(exportReport).toHaveBeenCalledWith(
      'merged',
      expect.any(AbortSignal),
      expect.any(Function)
    )
  })

  it('lists the exact localized issue and disables export', async () => {
    const state = JSON.parse(JSON.stringify(workspace)) as PhaseWorkspaceState
    state.processes[0].sequences[0].phases[0].drawing = { kind: 'unassigned' }
    createHarness('en', state)
    await Promise.resolve()

    const details = document.querySelector('.report-issue-details')?.textContent
    expect(details).toContain('Issue details')
    expect(details).toContain('Page 1 · Sequence 01 · Phase 01')
    expect(details).toContain('The Phase has no drawing. Assign a drawing first.')
    expect(document.querySelector('.report-page-row i')?.textContent).toBe(
      'Issues'
    )
    expect(buttonByText('Merge into one PDF')?.disabled).toBe(true)
    expect(buttonByText('One PDF per sequence (ZIP)')?.disabled).toBe(true)
  })

  it('shows output estimates and requires confirmation for warnings', async () => {
    const state = JSON.parse(JSON.stringify(workspace)) as PhaseWorkspaceState
    state.processes[0].sequences.push({
      id: 'empty-sequence',
      number: 2,
      name: 'Empty',
      phases: [],
      createdAt: 'now',
      updatedAt: 'now'
    })
    const { exportReport } = createHarness('zh', state)

    expect(document.querySelector('.report-export-estimates')?.textContent).toContain(
      '预计页数2'
    )
    buttonByText('合并为一个 PDF')?.click()
    expect(exportReport).not.toHaveBeenCalled()
    expect(document.querySelector('.report-warning-confirmation')?.textContent).toContain(
      '预检发现 1 个警告'
    )

    buttonByText('忽略警告并继续')?.click()
    await Promise.resolve()
    expect(exportReport).toHaveBeenCalledTimes(1)
  })

  it('locks state-changing controls while export is running', async () => {
    let finishExport: (() => void) | undefined
    const exportReport = jest.fn(
      () =>
        new Promise<{ status: 'completed'; fileName: string; bytes: Uint8Array }>(
          resolve => {
            finishExport = () =>
              resolve({
                status: 'completed',
                fileName: 'report.pdf',
                bytes: new Uint8Array([1])
              })
          }
        )
    )
    const { modal } = createHarness('zh', workspace, exportReport)

    buttonByText('合并为一个 PDF')?.click()
    const overlay = document.querySelector('.report-export-overlay')
    expect(overlay?.parentElement).toBe(
      document.querySelector('.report-workspace-shell')
    )
    expect(overlay?.textContent).toContain(
      'PDF 正在生成中，请不要操作 Viewer'
    )
    expect(document.body.classList.contains('report-pdf-exporting')).toBe(true)
    expect(
      document.querySelector<HTMLButtonElement>('.report-icon-button')?.disabled
    ).toBe(true)
    expect(buttonByText('预览此页')?.disabled).toBe(true)
    expect(buttonByText('从报告排除')?.disabled).toBe(true)
    modal.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(modal.element.hidden).toBe(false)

    finishExport?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.querySelector('.report-export-overlay')).toBeNull()
    expect(document.body.classList.contains('report-pdf-exporting')).toBe(false)
  })

  it('localizes the overlay and aborts export when cancellation is requested', async () => {
    let exportSignal: AbortSignal | undefined
    const exportReport = jest.fn(
      (_mode, signal: AbortSignal, onProgress) =>
        new Promise<PhaseReportExportResult>(resolve => {
          exportSignal = signal
          onProgress({
            completed: 1,
            total: 2,
            pageNumber: 1,
            sequenceId: 'sequence',
            phaseId: 'phase-1'
          })
          signal.addEventListener(
            'abort',
            () => resolve({ status: 'canceled' }),
            { once: true }
          )
        })
    )
    createHarness('en', workspace, exportReport)

    buttonByText('Merge into one PDF')?.click()
    expect(document.querySelector('.report-export-overlay')?.textContent).toContain(
      'Generating PDF. Please do not operate the Viewer.'
    )
    expect(document.querySelector('.report-export-overlay')?.textContent).toContain(
      'Generating page 1 / 2'
    )

    buttonByText('Cancel generation')?.click()
    expect(exportSignal?.aborted).toBe(true)
    expect(document.querySelector('.report-export-overlay')).toBeNull()
    expect(document.body.textContent).toContain('Report generation canceled')

    await Promise.resolve()
    await Promise.resolve()
    expect(document.querySelector('.report-export-overlay')).toBeNull()
    expect(document.body.textContent).toContain('Report generation canceled')
  })

  it('lists runtime failures and retries failed pages', async () => {
    const retry = jest.fn(async () => ({
      status: 'completed' as const,
      fileName: 'report.pdf',
      bytes: new Uint8Array([1])
    }))
    const exportReport = jest.fn(async () => ({
      status: 'failed' as const,
      failures: [
        {
          completed: 1,
          total: 2,
          pageNumber: 2,
          sequenceId: 'sequence',
          phaseId: 'phase-2',
          slotId: 'id-3',
          error: new Error('drawing unavailable')
        }
      ],
      retry
    }))
    createHarness('en', workspace, exportReport)

    buttonByText('Merge into one PDF')?.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.querySelector('.report-export-failures')?.textContent).toContain(
      'Page 2: drawing unavailable'
    )

    buttonByText('Retry failed pages (1)')?.click()
    await Promise.resolve()
    expect(retry).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function)
    })
  })
})
