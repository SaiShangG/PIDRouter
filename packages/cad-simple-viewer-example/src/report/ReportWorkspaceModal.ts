import JSZip from 'jszip'
import { Download, Eye, FileArchive, FileText, RotateCcw, Trash2, X } from 'lucide'

import type {
  MatrixDeviceType,
  MatrixFormat
} from '../api/processAssistantExportApi'
import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import type {
  PhaseSnapshot,
  PhaseWorkspaceState,
  ProcessDefinition,
  SequenceDefinition
} from '../phase/types'
import { createModalFocusController } from '../ui/modalFocus'
import { localizeDom } from '../uiTranslations'
import { PdfPreviewModal } from './PdfPreviewModal'
import type {
  PhaseReportExportResult,
  PhaseReportOutputMode,
  PhaseReportProgress
} from './phaseReportExportTypes'
import {
  type ReportManifest,
  ReportManifestStore,
  type ReportPageSlot,
  type ReportPreflightIssue
} from './reportManifest'

export interface MatrixExportSelection {
  processId: string
  sequenceIds: string[]
  phaseIds: string[]
  fileName: string
  format: MatrixFormat
  deviceTypes: MatrixDeviceType[]
  includeInactiveDevices: boolean
  includeTransitions: boolean
}

interface ReportWorkspaceActions {
  export(
    options: PhaseReportExportOptions,
    signal: AbortSignal,
    onProgress: (progress: PhaseReportProgress) => void
  ): Promise<PhaseReportExportResult>
  exportMatrix?(
    selection: MatrixExportSelection,
    signal: AbortSignal
  ): Promise<void>
}

export interface PhaseReportExportOptions {
  mode: PhaseReportOutputMode
  fileName: string
  sequenceIds: string[]
}

interface PageContext {
  slot: ReportPageSlot
  pageNumber: number
  process?: ProcessDefinition
  sequence?: SequenceDefinition
  phase?: PhaseSnapshot
  sourceProcess?: ProcessDefinition
  sourceSequence?: SequenceDefinition
  sourcePhase?: PhaseSnapshot
}

interface GeneratedPdfFile {
  fileName: string
  bytes: Uint8Array
}

interface GeneratedReport {
  id: string
  fileName: string
  createdAt: Date
  mode: PhaseReportOutputMode
  pageCount: number
  bytes: Uint8Array
  pdfFiles: GeneratedPdfFile[]
}

const ROW_HEIGHT = 66
const OVERSCAN = 6

export class ReportWorkspaceModal {
  readonly element = document.createElement('div')
  private manifest: ReportManifest
  private selectedSlotId?: string
  private query = ''
  private sequenceFilterId = 'all'
  private filter: 'all' | 'excluded' | 'replaced' | 'issues' = 'all'
  private listViewport?: HTMLElement
  private listScrollTop = 0
  private exportController?: AbortController
  private exportProgress?: PhaseReportProgress
  private exportMessage = ''
  private failedExport?: Extract<PhaseReportExportResult, { status: 'failed' }>
  private pendingWarningOptions?: PhaseReportExportOptions
  private exportScope: 'all' | 'current' | 'selected' = 'all'
  private exportFileName = ''
  private exportSequenceIds = new Set<string>()
  private matrixProcessId = ''
  private matrixSequenceIds = new Set<string>()
  private matrixPhaseIds = new Set<string>()
  private matrixFormat: MatrixFormat = 'XLSX'
  private matrixDeviceTypes = new Set<MatrixDeviceType>([
    'VALVE',
    'PUMP_MOTOR',
    'SENSOR'
  ])
  private matrixIncludeInactiveDevices = true
  private matrixIncludeTransitions = true
  private matrixFileName = ''
  private matrixQuery = ''
  private matrixMessage = ''
  private activeTab: 'pdf' | 'matrix' = 'pdf'
  private activePdfPanel: 'page' | 'export' | 'generated' = 'page'
  private activeExportKind: 'pdf' | 'matrix' = 'pdf'
  private generatedReports: GeneratedReport[] = []
  private generatedReportSequence = 0
  private readonly pdfPreview: PdfPreviewModal
  private readonly focusController = createModalFocusController(this.element)

  constructor(
    private readonly getWorkspace: () => PhaseWorkspaceState,
    private readonly store: ReportManifestStore,
    private readonly actions: ReportWorkspaceActions,
    private readonly getLocale: () => AppLocale = () => 'zh'
  ) {
    this.manifest = store.snapshot()
    this.pdfPreview = new PdfPreviewModal(getLocale)
    this.element.className = 'report-workspace-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'reportWorkspaceTitle')
    this.element.addEventListener('pointerdown', event => {
      if (event.target === this.element) this.close()
    })
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    })
    document.body.append(this.element)
  }

  open() {
    const workspace = this.getWorkspace()
    this.manifest = this.store.reconcile(workspace)
    this.store.persist()
    this.initializePdfExportSelection(workspace)
    this.initializeMatrixSelection(workspace)
    this.selectedSlotId =
      this.manifest.pages.find(page => page.id === this.selectedSlotId)?.id ??
      this.manifest.pages[0]?.id
    this.element.hidden = false
    document.body.classList.add('report-workspace-open')
    this.render()
    this.focusController.activate(
      this.element.querySelector<HTMLButtonElement>('.report-icon-button')
    )
  }

  close() {
    if (this.exportController) return
    this.element.hidden = true
    document.body.classList.remove('report-workspace-open')
    this.focusController.deactivate()
  }

  refreshLocale() {
    if (!this.element.hidden) this.render()
  }

  private render() {
    const workspace = this.getWorkspace()
    const contexts = this.getPageContexts(workspace)
    const issues = this.store.preflight(workspace)
    const excludedCount = this.manifest.pages.filter(page => page.excluded).length
    const replacedCount = this.manifest.pages.filter(page => page.replacement).length
    const includedCount = this.manifest.pages.length - excludedCount

    this.element.replaceChildren()
    const shell = document.createElement('section')
    shell.className = 'report-workspace-shell'

    const header = document.createElement('header')
    const heading = document.createElement('div')
    const eyebrow = document.createElement('span')
    eyebrow.textContent = '独立报告工作区'
    const title = document.createElement('h2')
    title.id = 'reportWorkspaceTitle'
    title.textContent = this.activeTab === 'pdf' ? 'PDF 报告页面' : 'Matrix 导出页面'
    const summary = document.createElement('span')
    summary.className = 'report-workspace-summary'
    summary.textContent = this.activeTab === 'pdf'
      ? `${includedCount} / ${this.manifest.pages.length} 页`
      : `已选择 ${this.matrixSequenceIds.size} 个 Sequence，${this.matrixPhaseIds.size} 个 Phase`
    heading.append(eyebrow, title)
    const tabs = this.createExportTabs()
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'report-icon-button'
    close.title = '关闭报告工作区'
    close.setAttribute('aria-label', '关闭报告工作区')
    close.disabled = Boolean(this.exportController)
    close.append(createPhaseIcon(X))
    close.addEventListener('click', () => this.close())
    header.append(heading, tabs, summary, close)

    const body = document.createElement('div')
    body.id = `${this.activeTab}ExportPanel`
    body.setAttribute('role', 'tabpanel')
    body.setAttribute('aria-labelledby', `${this.activeTab}ExportTab`)
    if (this.activeTab === 'pdf') {
      body.className = 'report-workspace-body'
      body.append(
        this.createPageBrowser(contexts, issues.length, excludedCount, replacedCount),
        this.createPdfPanel(contexts, issues)
      )
    } else {
      body.className = 'report-matrix-workspace'
      body.append(this.createMatrixExportControls())
    }
    shell.append(header, body)
    if (this.exportController && !this.exportController.signal.aborted) {
      shell.append(this.createExportOverlay())
    }
    this.element.append(shell)
    localizeDom(this.element, this.getLocale())
  }

  private createExportTabs() {
    const tabs = document.createElement('div')
    tabs.className = 'report-export-tabs'
    tabs.setAttribute('role', 'tablist')
    tabs.setAttribute('aria-label', '报告导出类型')
      ; ([
        ['pdf', '导出 PDF'],
        ['matrix', '导出 Matrix']
      ] as const).forEach(([value, label]) => {
        if (value === 'matrix' && !this.actions.exportMatrix) return
        const button = document.createElement('button')
        button.type = 'button'
        button.id = `${value}ExportTab`
        button.className = 'report-export-tab'
        button.setAttribute('role', 'tab')
        button.setAttribute('aria-controls', `${value}ExportPanel`)
        button.setAttribute('aria-selected', String(this.activeTab === value))
        button.tabIndex = this.activeTab === value ? 0 : -1
        button.disabled = Boolean(this.exportController)
        button.textContent = label
        button.addEventListener('click', () => {
          this.activeTab = value
          this.render()
        })
        tabs.append(button)
      })
    return tabs
  }

  private createExportOverlay() {
    const overlay = document.createElement('div')
    overlay.className = 'report-export-overlay'
    overlay.setAttribute('role', 'status')
    overlay.setAttribute('aria-live', 'polite')
    const spinner = document.createElement('div')
    spinner.className = 'report-export-spinner'
    spinner.setAttribute('aria-hidden', 'true')
    const message = document.createElement('strong')
    message.textContent = this.activeExportKind === 'matrix'
      ? 'Matrix 正在后台生成，请稍候'
      : 'PDF 正在生成中，请不要操作 Viewer'
    overlay.append(spinner, message)
    if (this.exportProgress) {
      const progress = document.createElement('span')
      progress.textContent = this.getProgressText(this.exportProgress)
      overlay.append(progress)
    }
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = '取消生成'
    cancel.addEventListener('click', () => this.cancelExport())
    overlay.append(cancel)
    return overlay
  }

  private cancelExport() {
    if (!this.exportController || this.exportController.signal.aborted) return
    this.exportController.abort()
    this.exportProgress = undefined
    if (this.activeExportKind === 'matrix') {
      this.matrixMessage = 'Matrix 导出已取消'
    } else {
      this.exportMessage = '报告生成已取消'
    }
    this.render()
  }

  private createPageBrowser(
    contexts: PageContext[],
    issueCount: number,
    excludedCount: number,
    replacedCount: number
  ) {
    const panel = document.createElement('section')
    panel.className = 'report-page-browser'
    const search = document.createElement('input')
    search.type = 'search'
    search.value = this.query
    search.placeholder = '搜索页码、序列或 Phase'
    search.setAttribute('aria-label', '搜索报告页面')
    search.addEventListener('input', () => {
      this.query = search.value
      this.listScrollTop = 0
      this.renderList()
    })
    const jump = document.createElement('input')
    jump.type = 'number'
    jump.min = '1'
    jump.max = String(this.manifest.pages.length)
    jump.placeholder = '页码'
    jump.setAttribute('aria-label', '跳转到页码')
    jump.addEventListener('change', () => {
      const page = Number.parseInt(jump.value, 10)
      const context = contexts[page - 1]
      if (!context) return
      this.selectedSlotId = context.slot.id
      this.filter = 'all'
      this.query = ''
      this.listScrollTop = (page - 1) * ROW_HEIGHT
      this.render()
    })
    const searchRow = document.createElement('div')
    searchRow.className = 'report-search-row'
    searchRow.append(search, jump)

    const sequenceRow = document.createElement('div')
    sequenceRow.className = 'report-sequence-row'
    const sequence = document.createElement('select')
    sequence.setAttribute('aria-label', '按序列筛选')
    sequence.add(new Option('全部序列', 'all'))
    const seenSequenceIds = new Set<string>()
    contexts.forEach(context => {
      if (!context.sequence || seenSequenceIds.has(context.sequence.id)) return
      seenSequenceIds.add(context.sequence.id)
      sequence.add(new Option(
        `序列 ${String(context.sequence.number).padStart(2, '0')} · ${context.sequence.name}`,
        context.sequence.id
      ))
    })
    sequence.value = seenSequenceIds.has(this.sequenceFilterId)
      ? this.sequenceFilterId
      : 'all'
    sequence.addEventListener('change', () => {
      this.sequenceFilterId = sequence.value
      this.listScrollTop = 0
      this.render()
    })
    const excludeVisible = document.createElement('button')
    excludeVisible.type = 'button'
    excludeVisible.textContent = '批量排除'
    excludeVisible.disabled = Boolean(this.exportController)
    excludeVisible.addEventListener('click', () => this.setFilteredPagesExcluded(true))
    const restoreVisible = document.createElement('button')
    restoreVisible.type = 'button'
    restoreVisible.textContent = '批量恢复'
    restoreVisible.disabled = Boolean(this.exportController)
    restoreVisible.addEventListener('click', () => this.setFilteredPagesExcluded(false))
    sequenceRow.append(sequence, excludeVisible, restoreVisible)

    const filters = document.createElement('div')
    filters.className = 'report-filter-row'
    const definitions: Array<[typeof this.filter, string]> = [
      ['all', `全部 ${contexts.length}`],
      ['excluded', `已排除 ${excludedCount}`],
      ['replaced', `已替换 ${replacedCount}`],
      ['issues', `问题 ${issueCount}`]
    ]
    definitions.forEach(([value, label]) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.classList.toggle('is-active', this.filter === value)
      button.addEventListener('click', () => {
        this.filter = value
        this.listScrollTop = 0
        this.render()
      })
      filters.append(button)
    })

    const viewport = document.createElement('div')
    viewport.className = 'report-page-viewport'
    viewport.setAttribute('role', 'listbox')
    viewport.setAttribute('aria-label', '报告页面列表')
    viewport.addEventListener('scroll', () => {
      this.listScrollTop = viewport.scrollTop
      this.renderList()
    })
    this.listViewport = viewport
    panel.append(searchRow, sequenceRow, filters, viewport)
    queueMicrotask(() => {
      viewport.scrollTop = this.listScrollTop
      this.renderList()
    })
    return panel
  }

  private renderList() {
    const viewport = this.listViewport
    if (!viewport) return
    const workspace = this.getWorkspace()
    const issues = this.store.preflight(workspace)
    const issueSlotIds = new Set(issues.map(issue => issue.slotId).filter(Boolean))
    const issuePhaseIds = new Set(issues.map(issue => issue.phaseId).filter(Boolean))
    const contexts = this.getFilteredContexts(this.getPageContexts(workspace))
    const height = viewport.clientHeight || 500
    const start = Math.max(0, Math.floor(viewport.scrollTop / ROW_HEIGHT) - OVERSCAN)
    const end = Math.min(
      contexts.length,
      Math.ceil((viewport.scrollTop + height) / ROW_HEIGHT) + OVERSCAN
    )
    const canvas = document.createElement('div')
    canvas.className = 'report-page-window'
    canvas.style.height = `${contexts.length * ROW_HEIGHT}px`
    contexts.slice(start, end).forEach((context, offset) => {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'report-page-row'
      row.style.transform = `translateY(${(start + offset) * ROW_HEIGHT}px)`
      row.classList.toggle('is-selected', context.slot.id === this.selectedSlotId)
      row.classList.toggle('is-excluded', context.slot.excluded)
      row.setAttribute('role', 'option')
      row.setAttribute(
        'aria-selected',
        String(context.slot.id === this.selectedSlotId)
      )
      const number = document.createElement('strong')
      number.textContent = String(context.pageNumber).padStart(3, '0')
      const identity = document.createElement('span')
      identity.className = 'report-page-identity'
      const sequence = document.createElement('b')
      sequence.textContent = `序列 ${String(context.sequence?.number ?? 0).padStart(2, '0')} · ${context.sequence?.name ?? '来源缺失'}`
      const phase = document.createElement('span')
      phase.textContent = `Phase ${String(context.phase?.number ?? 0).padStart(2, '0')} · ${context.phase?.name ?? '来源缺失'}`
      identity.append(sequence, phase)
      const status = document.createElement('i')
      const hasIssue =
        issueSlotIds.has(context.slot.id) || issuePhaseIds.has(context.slot.phaseId)
      status.textContent = context.slot.excluded
        ? '已排除'
        : hasIssue
          ? '问题'
          : context.slot.replacement
            ? '已替换'
            : '正常'
      row.append(number, identity, status)
      row.addEventListener('click', () => {
        this.selectedSlotId = context.slot.id
        this.render()
      })
      canvas.append(row)
    })
    viewport.replaceChildren(canvas)
    localizeDom(viewport, this.getLocale())
  }

  private createPdfPanel(
    contexts: PageContext[],
    issues: ReturnType<ReportManifestStore['preflight']>
  ) {
    const section = document.createElement('section')
    section.className = 'report-pdf-panel'
    const tabs = document.createElement('div')
    tabs.className = 'report-pdf-tabs'
    tabs.setAttribute('role', 'tablist')
    tabs.setAttribute('aria-label', 'PDF 报告设置')
      ; ([
        ['page', '页面设置'],
        ['export', '导出设置'],
        ['generated', `生成记录 ${this.generatedReports.length}`]
      ] as const).forEach(([value, label]) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.setAttribute('role', 'tab')
        button.setAttribute('aria-selected', String(this.activePdfPanel === value))
        button.textContent = label
        button.addEventListener('click', () => {
          this.activePdfPanel = value
          this.render()
        })
        tabs.append(button)
      })
    const content = document.createElement('div')
    content.className = 'report-pdf-panel-content'
    content.setAttribute('role', 'tabpanel')
    if (this.activePdfPanel === 'page') {
      content.append(this.createInspector(contexts, issues))
    } else if (this.activePdfPanel === 'export') {
      const sequenceIds = new Set(this.getExportSequenceIds())
      const scopedIssues = issues.filter(issue => sequenceIds.has(issue.sequenceId))
      if (scopedIssues.length > 0) {
        content.append(this.createIssueList(scopedIssues, contexts))
      }
      content.append(this.createExportControls(issues))
    } else {
      content.append(this.createGeneratedReports())
    }
    section.append(tabs, content)
    return section
  }

  private createInspector(contexts: PageContext[], issues: ReturnType<ReportManifestStore['preflight']>) {
    const context = contexts.find(item => item.slot.id === this.selectedSlotId)
    const panel = document.createElement('aside')
    panel.className = 'report-page-inspector'
    const title = document.createElement('h3')
    title.textContent = '页面属性'
    panel.append(title)
    if (!context) {
      if (issues.length > 0) panel.append(this.createIssueList(issues, contexts))
      return panel
    }

    const status = document.createElement('dl')
    status.innerHTML = `
      <dt>原始来源</dt><dd>${context.process?.name ?? '—'} / ${context.sequence?.name ?? '—'} / ${context.phase?.name ?? '—'}</dd>
      <dt>页面状态</dt><dd>${context.slot.excluded ? '已排除' : context.slot.replacement ? '已替换' : '正常'}</dd>
      <dt>预检问题</dt><dd>${issues.filter(issue => issue.slotId === context.slot.id || issue.phaseId === context.slot.phaseId).length}</dd>
    `
    const exclude = document.createElement('button')
    exclude.type = 'button'
    exclude.textContent = context.slot.excluded ? '恢复到报告' : '从报告排除'
    exclude.disabled = Boolean(this.exportController)
    exclude.addEventListener('click', () => {
      this.store.setExcluded(context.slot.id, !context.slot.excluded)
      this.commitAndRender()
    })

    const label = document.createElement('label')
    label.textContent = '替换来源'
    const replacement = document.createElement('select')
    replacement.setAttribute('aria-label', '替换页面来源')
    replacement.disabled = Boolean(this.exportController)
    replacement.add(new Option('选择另一个 Phase', ''))
    contexts.forEach(candidate => {
      if (candidate.slot.id === context.slot.id || !candidate.phase) return
      replacement.add(
        new Option(
          `${candidate.process?.name} / 序列 ${String(candidate.sequence?.number).padStart(2, '0')} / Phase ${String(candidate.phase.number).padStart(2, '0')} · ${candidate.phase.name}`,
          candidate.slot.id
        )
      )
    })
    const replace = document.createElement('button')
    replace.type = 'button'
    replace.className = 'report-primary-button'
    replace.textContent = '确认替换'
    replace.disabled = true
    replacement.addEventListener('change', () => {
      replace.disabled = !replacement.value
    })
    replace.addEventListener('click', () => {
      const source = contexts.find(item => item.slot.id === replacement.value)
      if (!source?.process || !source.sequence || !source.phase) return
      this.store.replace(context.slot.id, {
        kind: 'phase',
        processId: source.process.id,
        sequenceId: source.sequence.id,
        phaseId: source.phase.id
      })
      this.commitAndRender()
    })
    label.append(replacement)
    panel.append(status)
    if (issues.length > 0) panel.append(this.createIssueList(issues, contexts))
    panel.append(exclude, label, replace)
    if (context.slot.replacement) {
      const restore = document.createElement('button')
      restore.type = 'button'
      restore.disabled = Boolean(this.exportController)
      restore.append(createPhaseIcon(RotateCcw), document.createTextNode('恢复原始页面'))
      restore.addEventListener('click', () => {
        this.store.restoreOriginal(context.slot.id)
        this.commitAndRender()
      })
      panel.append(restore)
    }
    return panel
  }

  private createGeneratedReports() {
    const section = document.createElement('section')
    section.className = 'report-generated-files'
    const title = document.createElement('h3')
    title.textContent = '已生成 PDF'
    section.append(title)
    if (this.generatedReports.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'report-generated-empty'
      empty.textContent = '尚无生成记录。生成报告后可在此预览和下载。'
      section.append(empty)
      return section
    }
    this.generatedReports.forEach(report => {
      const article = document.createElement('article')
      article.className = 'report-generated-item'
      const icon = createPhaseIcon(report.mode === 'merged' ? FileText : FileArchive)
      const identity = document.createElement('div')
      identity.className = 'report-generated-identity'
      const name = document.createElement('strong')
      name.textContent = report.fileName
      const metadata = document.createElement('span')
      metadata.textContent = `${this.formatDate(report.createdAt)} · ${report.mode === 'merged' ? '合并 PDF' : '分序列 ZIP'} · ${report.pageCount} 页 · ${this.formatBytes(report.bytes.byteLength)} · 已完成`
      identity.append(name, metadata)
      const actions = document.createElement('div')
      actions.className = 'report-generated-actions'
      if (report.mode === 'merged') {
        actions.append(this.createFileAction(Eye, '预览 PDF', () => {
          void this.pdfPreview.open(report.fileName, report.bytes)
        }))
      }
      actions.append(
        this.createFileAction(Download, report.mode === 'merged' ? '下载 PDF' : '下载 ZIP', () => {
          this.downloadFile(report.fileName, report.bytes, report.mode === 'merged' ? 'application/pdf' : 'application/zip')
        }),
        this.createFileAction(Trash2, '删除生成记录', () => {
          this.generatedReports = this.generatedReports.filter(item => item.id !== report.id)
          this.render()
        })
      )
      const header = document.createElement('div')
      header.className = 'report-generated-header'
      header.append(icon, identity, actions)
      article.append(header)
      if (report.pdfFiles.length > 0) {
        const files = document.createElement('ul')
        files.className = 'report-generated-children'
        report.pdfFiles.forEach(file => {
          const item = document.createElement('li')
          const fileName = document.createElement('span')
          fileName.textContent = file.fileName
          const fileActions = document.createElement('div')
          fileActions.append(
            this.createFileAction(Eye, '预览 PDF', () => {
              void this.pdfPreview.open(file.fileName, file.bytes)
            }),
            this.createFileAction(Download, '下载 PDF', () => {
              this.downloadFile(file.fileName, file.bytes, 'application/pdf')
            })
          )
          item.append(fileName, fileActions)
          files.append(item)
        })
        article.append(files)
      }
      section.append(article)
    })
    return section
  }

  private createFileAction(icon: typeof Eye, label: string, action: () => void) {
    const button = document.createElement('button')
    button.type = 'button'
    button.title = label
    button.setAttribute('aria-label', label)
    button.append(createPhaseIcon(icon))
    button.addEventListener('click', action)
    return button
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat(this.getLocale() === 'zh' ? 'zh-CN' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(value)
  }

  private formatBytes(value: number) {
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  private downloadFile(fileName: string, bytes: Uint8Array, type: string) {
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    queueMicrotask(() => URL.revokeObjectURL(url))
  }

  private createIssueList(issues: ReportPreflightIssue[], contexts: PageContext[]) {
    const section = document.createElement('section')
    section.className = 'report-issue-details'
    const title = document.createElement('h3')
    title.textContent = '问题详情'
    const list = document.createElement('ul')
    issues.forEach(issue => {
      const context = contexts.find(
        item =>
          item.slot.id === issue.slotId ||
          (!issue.slotId && item.slot.phaseId === issue.phaseId)
      )
      const sequence = context?.sequence ?? context?.sourceSequence
      const phase = context?.phase ?? context?.sourcePhase
      const item = document.createElement('li')
      item.classList.add(`is-${issue.severity}`)
      const heading = document.createElement('div')
      const location = document.createElement('b')
      location.textContent = context
        ? `第 ${context.pageNumber} 页 · 序列 ${String(sequence?.number ?? 0).padStart(2, '0')} · Phase ${String(phase?.number ?? 0).padStart(2, '0')}`
        : `序列 ${String(this.findSequenceNumber(issue.sequenceId) ?? 0).padStart(2, '0')}`
      const severity = document.createElement('span')
      severity.textContent = issue.severity === 'error' ? '错误' : '警告'
      const message = document.createElement('p')
      message.textContent = this.getIssueMessage(issue.code)
      heading.append(location, severity)
      item.append(heading, message)
      list.append(item)
    })
    section.append(title, list)
    return section
  }

  private findSequenceNumber(sequenceId: string) {
    for (const process of this.getWorkspace().processes) {
      const sequence = process.sequences.find(item => item.id === sequenceId)
      if (sequence) return sequence.number
    }
    return undefined
  }

  private getIssueMessage(code: ReportPreflightIssue['code']) {
    const messages: Record<ReportPreflightIssue['code'], string> = {
      'empty-sequence': '序列中没有 Phase，请先添加 Phase。',
      'missing-drawing': 'Phase 未关联图纸，请先关联图纸。',
      'duplicate-phase-number': 'Phase 编号重复，请修改编号。',
      'invalid-replacement': '替换来源不存在或已移动，请重新选择。',
      'missing-drawing-asset': '关联的图纸资源不存在，请重新关联图纸。',
      'drawing-load-failed': '图纸加载失败，请检查文件或 URL 后重试。'
    }
    return messages[code]
  }

  private createExportControls(
    issues: ReturnType<ReportManifestStore['preflight']>
  ) {
    const section = document.createElement('section')
    section.className = 'report-export-controls'
    const title = document.createElement('h3')
    title.textContent = '生成 PDF 报告'
    const sequenceIds = this.getExportSequenceIds()
    const sequenceIdSet = new Set(sequenceIds)
    const scopedIssues = issues.filter(issue => sequenceIdSet.has(issue.sequenceId))
    const errorCount = scopedIssues.filter(issue => issue.severity === 'error').length
    const warningCount = scopedIssues.filter(issue => issue.severity === 'warning').length
    const scopedPages = this.manifest.pages.filter(page =>
      sequenceIdSet.has(page.sequenceId)
    )
    const includedPages = scopedPages.filter(page => !page.excluded)
    const sequenceCount = new Set(includedPages.map(page => page.sequenceId)).size
    const excludedCount = scopedPages.length - includedPages.length
    const replacedCount = scopedPages.filter(page => page.replacement).length

    const fileNameLabel = document.createElement('label')
    fileNameLabel.className = 'report-export-field'
    fileNameLabel.textContent = '文件名'
    const fileName = document.createElement('input')
    fileName.type = 'text'
    fileName.value = this.exportFileName
    fileName.placeholder = '输入 PDF 文件名'
    fileName.setAttribute('aria-label', '自定义 PDF 文件名')
    fileName.disabled = Boolean(this.exportController)
    fileName.addEventListener('input', () => {
      this.exportFileName = fileName.value
    })
    fileNameLabel.append(fileName)

    const scope = document.createElement('fieldset')
    scope.className = 'report-export-scope'
    const scopeTitle = document.createElement('legend')
    scopeTitle.textContent = '导出范围'
    scope.append(scopeTitle)
      ; ([
        ['all', '全部序列'],
        ['current', '当前序列'],
        ['selected', '选中序列']
      ] as const).forEach(([value, label]) => {
        const option = document.createElement('label')
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = 'pdfExportScope'
        radio.value = value
        radio.checked = this.exportScope === value
        radio.disabled = Boolean(this.exportController)
        radio.addEventListener('change', () => {
          this.exportScope = value
          this.pendingWarningOptions = undefined
          this.render()
        })
        option.append(radio, document.createTextNode(label))
        scope.append(option)
      })
    if (this.exportScope === 'selected') {
      const selected = document.createElement('div')
      selected.className = 'report-export-sequences'
      this.getActiveProcess()?.sequences.forEach(sequence => {
        const option = document.createElement('label')
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = this.exportSequenceIds.has(sequence.id)
        checkbox.disabled = Boolean(this.exportController)
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) this.exportSequenceIds.add(sequence.id)
          else this.exportSequenceIds.delete(sequence.id)
          this.pendingWarningOptions = undefined
          this.render()
        })
        option.append(
          checkbox,
          document.createTextNode(
            `序列 ${String(sequence.number).padStart(2, '0')} · ${sequence.name}`
          )
        )
        selected.append(option)
      })
      scope.append(selected)
    }

    const estimates = document.createElement('dl')
    estimates.className = 'report-export-estimates'
    estimates.innerHTML = `
      <dt>预计页数</dt><dd>${includedPages.length}</dd>
      <dt>排除页面</dt><dd>${excludedCount}</dd>
      <dt>替换页面</dt><dd>${replacedCount}</dd>
      <dt>合并输出</dt><dd>${includedPages.length > 0 ? 1 : 0} 个 PDF</dd>
      <dt>分序列输出</dt><dd>${sequenceCount} 个 PDF（ZIP）</dd>
    `
    const status = document.createElement('p')
    status.textContent = this.exportProgress
      ? this.getProgressText(this.exportProgress)
      : this.exportMessage ||
      (errorCount > 0
        ? `预检发现 ${errorCount} 个严重问题`
        : warningCount > 0
          ? `预检发现 ${warningCount} 个警告`
          : '报告已通过预检')
    const merged = document.createElement('button')
    merged.type = 'button'
    merged.className = 'report-primary-button'
    merged.textContent = '合并为一个 PDF'
    merged.disabled =
      Boolean(this.exportController) || errorCount > 0 || includedPages.length === 0
    merged.addEventListener('click', () => this.requestExport('merged', warningCount))
    const split = document.createElement('button')
    split.type = 'button'
    split.textContent = '每个序列一个 PDF（ZIP）'
    split.disabled =
      Boolean(this.exportController) || errorCount > 0 || includedPages.length === 0
    split.addEventListener('click', () =>
      this.requestExport('per-sequence', warningCount)
    )
    section.append(title, fileNameLabel, scope, estimates, status, merged, split)
    if (this.pendingWarningOptions && !this.exportController) {
      const confirmation = document.createElement('div')
      confirmation.className = 'report-warning-confirmation'
      const message = document.createElement('p')
      message.textContent = `预检发现 ${warningCount} 个警告，是否继续生成？`
      const proceed = document.createElement('button')
      proceed.type = 'button'
      proceed.className = 'report-primary-button'
      proceed.textContent = '忽略警告并继续'
      proceed.addEventListener('click', () => {
        const options = this.pendingWarningOptions
        this.pendingWarningOptions = undefined
        if (options) void this.startExport(options)
      })
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = '返回检查'
      cancel.addEventListener('click', () => {
        this.pendingWarningOptions = undefined
        this.render()
      })
      confirmation.append(message, proceed, cancel)
      section.append(confirmation)
    }
    if (this.failedExport && !this.exportController) {
      const failures = document.createElement('ul')
      failures.className = 'report-export-failures'
      this.failedExport.failures.forEach(failure => {
        const item = document.createElement('li')
        item.textContent = `第 ${failure.pageNumber} 页：${this.errorMessage(failure.error)}`
        failures.append(item)
      })
      const retry = document.createElement('button')
      retry.type = 'button'
      retry.className = 'report-primary-button'
      retry.textContent = `重试失败页面（${this.failedExport.failures.length}）`
      retry.addEventListener('click', () => void this.retryFailedPages())
      section.append(failures, retry)
    }
    if (this.exportController && !this.exportController.signal.aborted) {
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = '取消生成'
      cancel.addEventListener('click', () => this.cancelExport())
      section.append(cancel)
    }
    return section
  }

  private createMatrixExportControls() {
    const workspace = this.getWorkspace()
    const process = workspace.processes.find(item => item.id === this.matrixProcessId)
    const section = document.createElement('section')
    section.className = 'report-matrix-controls'

    const scopePanel = document.createElement('section')
    scopePanel.className = 'report-matrix-scope-panel'
    const scopeTitle = document.createElement('h3')
    scopeTitle.textContent = 'Sequence / Phase 范围'

    const search = document.createElement('input')
    search.type = 'search'
    search.value = this.matrixQuery
    search.placeholder = '搜索 Sequence 或 Phase'
    search.setAttribute('aria-label', '搜索 Matrix 范围')
    search.disabled = Boolean(this.exportController)
    search.addEventListener('input', () => {
      this.matrixQuery = search.value
      this.render()
    })

    const scopeActions = document.createElement('div')
    scopeActions.className = 'report-matrix-scope-actions'
      ; ([
        ['全部选择', () => this.selectAllMatrixScope()],
        ['全部清除', () => this.clearMatrixScope()],
        ['当前 Sequence', () => this.selectCurrentMatrixSequence()]
      ] as const).forEach(([label, action]) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = label
        button.disabled = Boolean(this.exportController) || !process
        button.addEventListener('click', () => {
          action()
          this.matrixMessage = ''
          this.render()
        })
        scopeActions.append(button)
      })

    const scope = document.createElement('div')
    scope.className = 'report-matrix-tree'
    scope.setAttribute('role', 'group')
    scope.setAttribute('aria-label', 'Sequence / Phase 范围')
    const query = this.matrixQuery.trim().toLocaleLowerCase()
    process?.sequences.forEach(sequence => {
      const visiblePhases = query
        ? sequence.phases.filter(phase =>
          phase.name.toLocaleLowerCase().includes(query) ||
          String(phase.number).includes(query)
        )
        : sequence.phases
      const sequenceMatches = !query ||
        sequence.name.toLocaleLowerCase().includes(query) ||
        String(sequence.number).includes(query)
      if (!sequenceMatches && visiblePhases.length === 0) return

      const group = document.createElement('div')
      group.className = 'report-matrix-sequence'
      const selectedPhaseCount = sequence.phases.filter(phase =>
        this.matrixPhaseIds.has(phase.id)
      ).length
      group.append(this.createMatrixCheckbox(
        `Sequence ${String(sequence.number).padStart(2, '0')} · ${sequence.name}`,
        sequence.phases.length > 0 && selectedPhaseCount === sequence.phases.length,
        checked => {
          if (checked) {
            this.matrixSequenceIds.add(sequence.id)
            sequence.phases.forEach(phase => this.matrixPhaseIds.add(phase.id))
          } else {
            this.matrixSequenceIds.delete(sequence.id)
            sequence.phases.forEach(phase => this.matrixPhaseIds.delete(phase.id))
          }
          this.render()
        },
        selectedPhaseCount > 0 && selectedPhaseCount < sequence.phases.length
      ))
      const phases = sequenceMatches ? sequence.phases : visiblePhases
      phases.forEach(phase => {
        const option = this.createMatrixCheckbox(
          `Phase ${String(phase.number).padStart(2, '0')} · ${phase.name}`,
          this.matrixPhaseIds.has(phase.id),
          checked => {
            if (checked) {
              this.matrixPhaseIds.add(phase.id)
              this.matrixSequenceIds.add(sequence.id)
            } else {
              this.matrixPhaseIds.delete(phase.id)
              if (!sequence.phases.some(item => this.matrixPhaseIds.has(item.id))) {
                this.matrixSequenceIds.delete(sequence.id)
              }
            }
            this.render()
          }
        )
        option.classList.add('is-phase')
        group.append(option)
      })
      scope.append(group)
    })
    if (!scope.childElementCount) {
      const empty = document.createElement('p')
      empty.className = 'report-matrix-empty'
      empty.textContent = '未找到匹配的 Sequence 或 Phase'
      scope.append(empty)
    }
    scopePanel.append(scopeTitle, search, scopeActions, scope)

    const settingsPanel = document.createElement('section')
    settingsPanel.className = 'report-matrix-settings-panel'
    const title = document.createElement('h3')
    title.textContent = 'Matrix 导出设置'

    const processLabel = document.createElement('label')
    processLabel.textContent = 'Process'
    const processSelect = document.createElement('select')
    processSelect.setAttribute('aria-label', 'Matrix Process')
    workspace.processes.forEach(item => processSelect.add(new Option(item.name, item.id)))
    processSelect.value = this.matrixProcessId
    processSelect.disabled = Boolean(this.exportController)
    processSelect.addEventListener('change', () => {
      this.matrixProcessId = processSelect.value
      this.selectAllMatrixScope()
      this.initializeMatrixFileName()
      this.matrixMessage = ''
      this.render()
    })
    processLabel.append(processSelect)

    const fileNameLabel = document.createElement('label')
    fileNameLabel.textContent = '文件名'
    const fileName = document.createElement('input')
    fileName.type = 'text'
    fileName.value = this.matrixFileName
    fileName.placeholder = '输入 Matrix 文件名'
    fileName.setAttribute('aria-label', '自定义 Matrix 文件名')
    fileName.disabled = Boolean(this.exportController)
    fileName.addEventListener('input', () => {
      this.matrixFileName = fileName.value
    })
    fileNameLabel.append(fileName)

    const formatLabel = document.createElement('label')
    formatLabel.textContent = '文件格式'
    const format = document.createElement('select')
    format.setAttribute('aria-label', 'Matrix 文件格式')
      ; (['XLSX', 'CSV'] as MatrixFormat[]).forEach(value =>
        format.add(new Option(value, value))
      )
    format.value = this.matrixFormat
    format.disabled = Boolean(this.exportController)
    format.addEventListener('change', () => {
      this.matrixFormat = format.value as MatrixFormat
    })
    formatLabel.append(format)

    const devices = document.createElement('fieldset')
    const devicesLegend = document.createElement('legend')
    devicesLegend.textContent = '设备与内容'
    devices.append(
      devicesLegend,
      this.createDeviceCheckbox('Valve', 'VALVE'),
      this.createDeviceCheckbox('Pump / Motor', 'PUMP_MOTOR'),
      this.createDeviceCheckbox('Sensor', 'SENSOR'),
      this.createMatrixCheckbox('包含未激活设备', this.matrixIncludeInactiveDevices, checked => {
        this.matrixIncludeInactiveDevices = checked
      }),
      this.createMatrixCheckbox('包含转换条件', this.matrixIncludeTransitions, checked => {
        this.matrixIncludeTransitions = checked
      })
    )

    const summary = document.createElement('p')
    summary.className = 'report-matrix-summary'
    summary.textContent = this.matrixMessage ||
      `已选择 ${this.matrixSequenceIds.size} 个 Sequence，${this.matrixPhaseIds.size} 个 Phase，${this.matrixDeviceTypes.size} 类设备`
    const exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'report-primary-button'
    exportButton.textContent = '导出 Matrix'
    exportButton.disabled = Boolean(this.exportController) ||
      !this.matrixProcessId || this.matrixPhaseIds.size === 0 ||
      this.matrixDeviceTypes.size === 0
    exportButton.addEventListener('click', () => void this.startMatrixExport())

    settingsPanel.append(
      title,
      processLabel,
      fileNameLabel,
      formatLabel,
      devices,
      summary,
      exportButton
    )
    section.append(scopePanel, settingsPanel)
    return section
  }

  private createDeviceCheckbox(label: string, type: MatrixDeviceType) {
    return this.createMatrixCheckbox(label, this.matrixDeviceTypes.has(type), checked => {
      if (checked) this.matrixDeviceTypes.add(type)
      else this.matrixDeviceTypes.delete(type)
      this.render()
    })
  }

  private createMatrixCheckbox(
    text: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    indeterminate = false
  ) {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = checked
    input.indeterminate = indeterminate
    input.disabled = Boolean(this.exportController)
    input.addEventListener('change', () => onChange(input.checked))
    label.append(input, document.createTextNode(text))
    return label
  }

  private initializeMatrixSelection(workspace: PhaseWorkspaceState) {
    if (!workspace.processes.some(item => item.id === this.matrixProcessId)) {
      this.matrixProcessId = workspace.activeProcessId ?? workspace.processes[0]?.id ?? ''
      this.selectAllMatrixScope()
    }
    this.initializeMatrixFileName()
  }

  private initializeMatrixFileName() {
    if (this.matrixFileName) return
    const process = this.getWorkspace().processes.find(
      item => item.id === this.matrixProcessId
    )
    this.matrixFileName = `${process?.name ?? 'process'}-matrix`
  }

  private selectAllMatrixScope() {
    const process = this.getWorkspace().processes.find(
      item => item.id === this.matrixProcessId
    )
    this.matrixSequenceIds = new Set(process?.sequences.map(item => item.id))
    this.matrixPhaseIds = new Set(
      process?.sequences.flatMap(sequence => sequence.phases.map(phase => phase.id))
    )
  }

  private clearMatrixScope() {
    this.matrixSequenceIds.clear()
    this.matrixPhaseIds.clear()
  }

  private selectCurrentMatrixSequence() {
    const process = this.getWorkspace().processes.find(
      item => item.id === this.matrixProcessId
    )
    const sequence = process?.sequences.find(
      item => item.id === process.activeSequenceId
    ) ?? process?.sequences[0]
    this.clearMatrixScope()
    if (!sequence) return
    this.matrixSequenceIds.add(sequence.id)
    sequence.phases.forEach(phase => this.matrixPhaseIds.add(phase.id))
  }

  private async startMatrixExport() {
    if (this.exportController || !this.actions.exportMatrix) return
    const controller = new AbortController()
    this.exportController = controller
    this.activeExportKind = 'matrix'
    this.matrixMessage = ''
    this.render()
    try {
      const extension = this.matrixFormat.toLowerCase()
      const baseName = this.matrixFileName
        .trim()
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\.(xlsx|csv)$/i, '') || 'device-matrix'
      await this.actions.exportMatrix({
        processId: this.matrixProcessId,
        sequenceIds: [...this.matrixSequenceIds],
        phaseIds: [...this.matrixPhaseIds],
        fileName: `${baseName}.${extension}`,
        format: this.matrixFormat,
        deviceTypes: [...this.matrixDeviceTypes],
        includeInactiveDevices: this.matrixIncludeInactiveDevices,
        includeTransitions: this.matrixIncludeTransitions
      }, controller.signal)
      this.matrixMessage = controller.signal.aborted
        ? 'Matrix 导出已取消'
        : 'Matrix 导出完成'
    } catch (error) {
      this.matrixMessage = controller.signal.aborted
        ? 'Matrix 导出已取消'
        : `${this.getLocale() === 'zh' ? 'Matrix 导出失败' : 'Matrix export failed'}：${this.errorMessage(error)}`
    } finally {
      this.exportController = undefined
      this.render()
    }
  }

  private requestExport(mode: PhaseReportOutputMode, warningCount: number) {
    const options = this.getExportOptions(mode)
    if (warningCount > 0) {
      this.pendingWarningOptions = options
      this.render()
      return
    }
    void this.startExport(options)
  }

  private async startExport(options: PhaseReportExportOptions) {
    if (this.exportController) return
    const controller = new AbortController()
    this.exportController = controller
    this.activeExportKind = 'pdf'
    this.exportProgress = undefined
    this.exportMessage = ''
    this.failedExport = undefined
    document.body.classList.add('report-pdf-exporting')
    this.render()
    try {
      const result = await this.actions.export(options, controller.signal, progress => {
        if (controller.signal.aborted) return
        this.exportProgress = progress
        this.render()
      })
      if (!controller.signal.aborted && result.status === 'completed') {
        await this.addGeneratedReport(
          result,
          options.mode,
          this.manifest.pages.filter(
            page => options.sequenceIds.includes(page.sequenceId) && !page.excluded
          ).length
        )
        this.activePdfPanel = 'generated'
      }
      this.exportMessage = controller.signal.aborted
        ? '报告生成已取消'
        : result.status === 'completed'
          ? '报告生成完成'
          : result.status === 'canceled'
            ? '报告生成已取消'
            : `报告生成失败：${result.failures.length} 页`
      this.failedExport = result.status === 'failed' ? result : undefined
    } catch {
      this.exportMessage = '报告生成失败'
    } finally {
      document.body.classList.remove('report-pdf-exporting')
      this.exportController = undefined
      this.exportProgress = undefined
      this.render()
    }
  }

  private async addGeneratedReport(
    result: Extract<PhaseReportExportResult, { status: 'completed' }>,
    mode: PhaseReportOutputMode,
    pageCount: number
  ) {
    const pdfFiles: GeneratedPdfFile[] = []
    if (mode === 'per-sequence') {
      const archive = await JSZip.loadAsync(result.bytes)
      for (const entry of Object.values(archive.files)) {
        if (entry.dir || !entry.name.toLocaleLowerCase().endsWith('.pdf')) continue
        pdfFiles.push({
          fileName: entry.name.split('/').pop() ?? entry.name,
          bytes: await entry.async('uint8array')
        })
      }
    }
    this.generatedReports.unshift({
      id: `generated-report-${++this.generatedReportSequence}`,
      fileName: result.fileName,
      createdAt: new Date(),
      mode,
      pageCount,
      bytes: result.bytes,
      pdfFiles
    })
  }

  private async retryFailedPages() {
    if (this.exportController || !this.failedExport) return
    const failedExport = this.failedExport
    const controller = new AbortController()
    this.exportController = controller
    this.exportProgress = undefined
    this.exportMessage = ''
    document.body.classList.add('report-pdf-exporting')
    this.render()
    try {
      const result = await failedExport.retry({
        signal: controller.signal,
        onProgress: progress => {
          if (controller.signal.aborted) return
          this.exportProgress = progress
          this.render()
        }
      })
      this.exportMessage = controller.signal.aborted
        ? '报告生成已取消'
        : result.status === 'completed'
          ? '报告生成完成'
          : result.status === 'canceled'
            ? '报告生成已取消'
            : `报告生成失败：${result.failures.length} 页`
      this.failedExport = result.status === 'failed' ? result : undefined
    } catch {
      this.exportMessage = '报告生成失败'
    } finally {
      document.body.classList.remove('report-pdf-exporting')
      this.exportController = undefined
      this.exportProgress = undefined
      this.render()
    }
  }

  private getProgressText(progress: PhaseReportProgress) {
    const context = this.getPageContexts(this.getWorkspace()).find(
      item =>
        item.slot.sequenceId === progress.sequenceId &&
        item.sourcePhase?.id === progress.phaseId
    )
    return `正在生成第 ${progress.completed} / ${progress.total} 页 · 序列 ${String(context?.sequence?.number ?? 0).padStart(2, '0')} ${context?.sequence?.name ?? ''} · Phase ${String(context?.sourcePhase?.number ?? 0).padStart(2, '0')} ${context?.sourcePhase?.name ?? ''}`
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  private commitAndRender() {
    if (this.exportController) return
    this.pendingWarningOptions = undefined
    this.failedExport = undefined
    this.store.persist()
    this.manifest = this.store.snapshot()
    this.render()
  }

  private getFilteredContexts(contexts: PageContext[]) {
    const issuePhaseIds = new Set(
      this.store.preflight(this.getWorkspace()).map(issue => issue.phaseId)
    )
    const query = this.query.trim().toLocaleLowerCase()
    return contexts.filter(context => {
      if (
        this.sequenceFilterId !== 'all' &&
        context.slot.sequenceId !== this.sequenceFilterId
      ) return false
      if (this.filter === 'excluded' && !context.slot.excluded) return false
      if (this.filter === 'replaced' && !context.slot.replacement) return false
      if (this.filter === 'issues' && !issuePhaseIds.has(context.slot.phaseId)) return false
      if (!query) return true
      return [
        String(context.pageNumber),
        context.process?.name,
        context.sequence?.name,
        context.phase?.name
      ].some(value => value?.toLocaleLowerCase().includes(query))
    })
  }

  private setFilteredPagesExcluded(excluded: boolean) {
    if (this.exportController) return
    const contexts = this.getFilteredContexts(
      this.getPageContexts(this.getWorkspace())
    )
    contexts.forEach(context => this.store.setExcluded(context.slot.id, excluded))
    this.commitAndRender()
  }

  private getActiveProcess() {
    const workspace = this.getWorkspace()
    return workspace.processes.find(item => item.id === workspace.activeProcessId)
      ?? workspace.processes[0]
  }

  private initializePdfExportSelection(workspace: PhaseWorkspaceState) {
    const process = workspace.processes.find(item => item.id === workspace.activeProcessId)
      ?? workspace.processes[0]
    const validIds = new Set(process?.sequences.map(item => item.id))
    this.exportSequenceIds = new Set(
      [...this.exportSequenceIds].filter(id => validIds.has(id))
    )
    if (this.exportSequenceIds.size === 0) {
      this.exportSequenceIds = new Set(validIds)
    }
    if (!this.exportFileName) {
      this.exportFileName = `${process?.name ?? 'process'}-report`
    }
  }

  private getExportSequenceIds() {
    const process = this.getActiveProcess()
    if (!process) return []
    if (this.exportScope === 'current') {
      const current = process.sequences.find(
        item => item.id === process.activeSequenceId
      ) ?? process.sequences[0]
      return current ? [current.id] : []
    }
    if (this.exportScope === 'selected') {
      return process.sequences
        .filter(item => this.exportSequenceIds.has(item.id))
        .map(item => item.id)
    }
    return process.sequences.map(item => item.id)
  }

  private getExportOptions(mode: PhaseReportOutputMode): PhaseReportExportOptions {
    const baseName = this.exportFileName
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\.(pdf|zip)$/i, '') || 'process-report'
    return {
      mode,
      fileName: `${baseName}.${mode === 'merged' ? 'pdf' : 'zip'}`,
      sequenceIds: this.getExportSequenceIds()
    }
  }

  private getPageContexts(workspace: PhaseWorkspaceState): PageContext[] {
    return this.manifest.pages.map((slot, index) => {
      const process = workspace.processes.find(item => item.id === slot.processId)
      const sequence = process?.sequences.find(item => item.id === slot.sequenceId)
      const phase = sequence?.phases.find(item => item.id === slot.phaseId)
      const source = slot.replacement ?? {
        kind: 'phase' as const,
        processId: slot.processId,
        sequenceId: slot.sequenceId,
        phaseId: slot.phaseId
      }
      const sourceProcess = workspace.processes.find(item => item.id === source.processId)
      const sourceSequence = sourceProcess?.sequences.find(item => item.id === source.sequenceId)
      const sourcePhase = sourceSequence?.phases.find(item => item.id === source.phaseId)
      return {
        slot,
        pageNumber: index + 1,
        process,
        sequence,
        phase,
        sourceProcess,
        sourceSequence,
        sourcePhase
      }
    })
  }
}
