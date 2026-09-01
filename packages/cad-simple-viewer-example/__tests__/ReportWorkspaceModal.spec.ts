/** @jest-environment jsdom */

import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import type { PhaseWorkspaceState } from '../src/phase/types'
import type {
  PhaseReportExportResult,
  PhaseReportProgress
} from '../src/report/phaseReportExportTypes'
import { ReportManifestStore } from '../src/report/reportManifest'
import {
  type PhaseReportExportOptions,
  ReportWorkspaceModal
} from '../src/report/ReportWorkspaceModal'

type ExportReport = (
  options: PhaseReportExportOptions,
  signal: AbortSignal,
  onProgress: (progress: PhaseReportProgress) => void
) => Promise<PhaseReportExportResult>

const workspace: PhaseWorkspaceState = {
  version: 4,
  presentationProfile: createDefaultPresentationProfile(),
  drawingAssets: {
    drawing: { id: 'drawing', kind: 'blank', sourceName: 'Blank.dwg' }
  },
  processes: [
    {
      id: 'process',
      name: 'CIP',
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
  })),
  exportMatrix = jest.fn(async () => undefined)
) => {
  let id = 0
  const store = new ReportManifestStore(
    undefined,
    () => `id-${++id}`,
    () => 'now'
  )
  const modal = new ReportWorkspaceModal(
    () => JSON.parse(JSON.stringify(state)) as PhaseWorkspaceState,
    store,
    { export: exportReport, exportMatrix },
    () => locale
  )
  modal.open()
  return {
    modal,
    store,
    exportReport: exportReport as jest.MockedFunction<ExportReport>,
    exportMatrix
  }
}

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(button =>
    button.textContent?.includes(text)
  )

const openExportSettings = (locale: 'en' | 'zh' = 'zh') =>
  buttonByText(locale === 'zh' ? '导出设置' : 'Export settings')?.click()

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
    expect(document.querySelector('.report-page-preview')).toBeNull()
    expect(buttonByText('Preview page')).toBeUndefined()
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

    openExportSettings()
    buttonByText('合并为一个 PDF')?.click()
    await Promise.resolve()

    expect(exportReport).toHaveBeenCalledWith(
      {
        fileName: 'CIP-report.pdf',
        mode: 'merged',
        sequenceIds: ['sequence']
      },
      expect.any(AbortSignal),
      expect.any(Function)
    )
  })

  it('filters pages by Sequence and batch excludes or restores only that Sequence', async () => {
    const state = JSON.parse(JSON.stringify(workspace)) as PhaseWorkspaceState
    state.processes[0].sequences.push({
      ...state.processes[0].sequences[0],
      id: 'sequence-2',
      number: 2,
      name: 'Second tank',
      phases: state.processes[0].sequences[0].phases.map(phase => ({
        ...phase,
        id: `${phase.id}-second`
      }))
    })
    const { store } = createHarness('zh', state)
    const sequenceFilter = document.querySelector<HTMLSelectElement>(
      '[aria-label="按序列筛选"]'
    )!
    sequenceFilter.value = 'sequence-2'
    sequenceFilter.dispatchEvent(new Event('change'))
    await Promise.resolve()

    buttonByText('批量排除')?.click()
    expect(store.snapshot().pages.filter(page => page.sequenceId === 'sequence')).toEqual(
      expect.arrayContaining([expect.objectContaining({ excluded: false })])
    )
    expect(store.snapshot().pages
      .filter(page => page.sequenceId === 'sequence-2')
      .every(page => page.excluded)).toBe(true)

    buttonByText('批量恢复')?.click()
    expect(store.snapshot().pages.every(page => !page.excluded)).toBe(true)
  })

  it('exports the current Sequence with a custom filename', async () => {
    const state = JSON.parse(JSON.stringify(workspace)) as PhaseWorkspaceState
    state.activeProcessId = 'process'
    state.processes[0].activeSequenceId = 'sequence'
    const { exportReport } = createHarness('zh', state)
    openExportSettings()
    const fileName = document.querySelector<HTMLInputElement>(
      '[aria-label="自定义 PDF 文件名"]'
    )!
    fileName.value = 'CIP Batch 42.pdf'
    fileName.dispatchEvent(new Event('input'))
    const current = document.querySelector<HTMLInputElement>(
      'input[name="pdfExportScope"][value="current"]'
    )!
    current.checked = true
    current.dispatchEvent(new Event('change'))
    buttonByText('合并为一个 PDF')?.click()
    await Promise.resolve()

    expect(exportReport).toHaveBeenCalledWith(
      {
        fileName: 'CIP Batch 42.pdf',
        mode: 'merged',
        sequenceIds: ['sequence']
      },
      expect.any(AbortSignal),
      expect.any(Function)
    )
  })

  it('exports only checked Sequences in selected scope', async () => {
    const state = JSON.parse(JSON.stringify(workspace)) as PhaseWorkspaceState
    state.processes[0].sequences.push({
      ...state.processes[0].sequences[0],
      id: 'sequence-2',
      number: 2,
      name: 'Second tank',
      phases: state.processes[0].sequences[0].phases.map(phase => ({
        ...phase,
        id: `${phase.id}-second`
      }))
    })
    const { exportReport } = createHarness('zh', state)
    openExportSettings()
    const selected = document.querySelector<HTMLInputElement>(
      'input[name="pdfExportScope"][value="selected"]'
    )!
    selected.checked = true
    selected.dispatchEvent(new Event('change'))
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      '.report-export-sequences input[type="checkbox"]'
    )
    checkboxes[0].checked = false
    checkboxes[0].dispatchEvent(new Event('change'))
    buttonByText('合并为一个 PDF')?.click()
    await Promise.resolve()

    expect(exportReport).toHaveBeenCalledWith(
      {
        fileName: 'CIP-report.pdf',
        mode: 'merged',
        sequenceIds: ['sequence-2']
      },
      expect.any(AbortSignal),
      expect.any(Function)
    )
  })

  it('keeps a completed PDF in generated files until the user downloads or deletes it', async () => {
    createHarness()

    openExportSettings()
    buttonByText('合并为一个 PDF')?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(document.querySelector('.report-generated-files')?.textContent).toContain(
      'report.pdf'
    )
    expect(document.querySelector('[aria-label="预览 PDF"]')).not.toBeNull()
    expect(document.querySelector('[aria-label="下载 PDF"]')).not.toBeNull()
    buttonByText('生成记录')?.click()
    document.querySelector<HTMLButtonElement>('[aria-label="删除生成记录"]')?.click()
    expect(document.querySelector('.report-generated-empty')).not.toBeNull()
  })

  it('switches between separate PDF and Matrix export tabs', () => {
    createHarness()
    const pdfTab = document.querySelector<HTMLButtonElement>('#pdfExportTab')!
    const matrixTab = document.querySelector<HTMLButtonElement>('#matrixExportTab')!

    expect(pdfTab.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('#pdfExportPanel')).not.toBeNull()
    expect(document.querySelector('.report-matrix-controls')).toBeNull()

    matrixTab.click()
    expect(document.querySelector('#matrixExportTab')?.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('#matrixExportPanel')).not.toBeNull()
    expect(buttonByText('合并为一个 PDF')).toBeUndefined()

    document.querySelector<HTMLButtonElement>('#pdfExportTab')?.click()
    expect(document.querySelector('#pdfExportTab')?.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('#pdfExportPanel')).not.toBeNull()
    expect(document.querySelector('.report-matrix-controls')).toBeNull()
  })

  it('exports a matrix for selected Sequences, Phases, and device types', async () => {
    const { exportMatrix } = createHarness()

    document.querySelector<HTMLButtonElement>('#matrixExportTab')?.click()
    document.querySelector<HTMLButtonElement>(
      '#matrixExportPanel .report-primary-button'
    )?.click()
    await Promise.resolve()

    expect(exportMatrix).toHaveBeenCalledWith({
      processId: 'process',
      sequenceIds: ['sequence'],
      phaseIds: ['phase-1', 'phase-2'],
      fileName: 'CIP-matrix.xlsx',
      format: 'XLSX',
      deviceTypes: ['VALVE', 'PUMP_MOTOR', 'SENSOR'],
      includeInactiveDevices: true,
      includeTransitions: true
    }, expect.any(AbortSignal))
  })

  it('supports Matrix Sequence shortcuts and partial selection', () => {
    const state = JSON.parse(JSON.stringify(workspace)) as PhaseWorkspaceState
    state.processes[0].activeSequenceId = 'sequence-2'
    state.processes[0].sequences.push({
      ...state.processes[0].sequences[0],
      id: 'sequence-2',
      number: 2,
      name: 'Second tank',
      phases: state.processes[0].sequences[0].phases.map(phase => ({
        ...phase,
        id: `${phase.id}-second`
      }))
    })
    createHarness('zh', state)
    document.querySelector<HTMLButtonElement>('#matrixExportTab')?.click()

    buttonByText('全部清除')?.click()
    expect(document.querySelector('.report-matrix-summary')?.textContent).toContain(
      '已选择 0 个 Sequence，0 个 Phase'
    )
    buttonByText('当前 Sequence')?.click()
    expect(document.querySelector('.report-matrix-summary')?.textContent).toContain(
      '已选择 1 个 Sequence，2 个 Phase'
    )

    const selectedSequence = document.querySelectorAll<HTMLElement>(
      '.report-matrix-sequence'
    )[1]
    const selectedPhase = selectedSequence.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    )[1]
    selectedPhase.checked = false
    selectedPhase.dispatchEvent(new Event('change'))
    expect(document.querySelectorAll<HTMLElement>('.report-matrix-sequence')[1]
      .querySelector<HTMLInputElement>('input[type="checkbox"]')?.indeterminate
    ).toBe(true)
  })

  it('normalizes a custom Matrix filename and shows export failure details', async () => {
    const exportMatrix = jest.fn(async () => {
      throw new Error('service unavailable')
    })
    createHarness('en', workspace, undefined, exportMatrix)
    document.querySelector<HTMLButtonElement>('#matrixExportTab')?.click()
    const fileName = document.querySelector<HTMLInputElement>(
      '[aria-label="Custom Matrix filename"]'
    )!
    fileName.value = 'Batch:42.csv'
    fileName.dispatchEvent(new Event('input'))
    const format = document.querySelector<HTMLSelectElement>(
      '[aria-label="Matrix file format"]'
    )!
    format.value = 'CSV'
    format.dispatchEvent(new Event('change'))
    document.querySelector<HTMLButtonElement>(
      '#matrixExportPanel .report-primary-button'
    )?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(exportMatrix).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'Batch-42.csv', format: 'CSV' }),
      expect.any(AbortSignal)
    )
    expect(document.querySelector('.report-matrix-summary')?.textContent).toContain(
      'Matrix export failed：service unavailable'
    )
  })

  it('lists the exact localized issue and disables export', async () => {
    const state = JSON.parse(JSON.stringify(workspace)) as PhaseWorkspaceState
    state.processes[0].sequences[0].phases[0].drawing = { kind: 'unassigned' }
    createHarness('en', state)
    await Promise.resolve()
    openExportSettings('en')
    await Promise.resolve()

    const details = document.querySelector('.report-issue-details')?.textContent
    expect(details).toContain('Issue details')
    expect(details).toContain('Page 1 · Sequence 01 · Phase 01')
    expect(details).toContain('The Phase has no drawing. Assign a drawing first.')
    expect(document.querySelector('.report-page-row i')?.textContent).toBe(
      'Issues'
    )
    expect(buttonByText('Merge into one PDF')?.disabled).toBe(true)
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

    openExportSettings()
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

    openExportSettings()
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
    buttonByText('页面设置')?.click()
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
      (_options, signal: AbortSignal, onProgress) =>
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

    openExportSettings('en')
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

    openExportSettings('en')
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
