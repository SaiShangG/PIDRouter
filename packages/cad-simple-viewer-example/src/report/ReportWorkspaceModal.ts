import { Eye, RotateCcw, X } from 'lucide'

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
import type {
  PhaseReportExportResult,
  PhaseReportOutputMode,
  PhaseReportProgress
} from './PhaseReportExporter'
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
  format: MatrixFormat
  deviceTypes: MatrixDeviceType[]
  includeInactiveDevices: boolean
  includeTransitions: boolean
}

interface ReportWorkspaceActions {
  preview(processId: string, sequenceId: string, phaseId: string): Promise<void>
  export(
    mode: PhaseReportOutputMode,
    signal: AbortSignal,
    onProgress: (progress: PhaseReportProgress) => void
  ): Promise<PhaseReportExportResult>
  exportMatrix?(
    selection: MatrixExportSelection,
    signal: AbortSignal
  ): Promise<void>
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

const ROW_HEIGHT = 66
const OVERSCAN = 6

export class ReportWorkspaceModal {
  readonly element = document.createElement('div')
  private manifest: ReportManifest
  private selectedSlotId?: string
  private query = ''
  private filter: 'all' | 'excluded' | 'replaced' | 'issues' = 'all'
  private listViewport?: HTMLElement
  private listScrollTop = 0
  private exportController?: AbortController
  private exportProgress?: PhaseReportProgress
  private exportMessage = ''
  private failedExport?: Extract<PhaseReportExportResult, { status: 'failed' }>
  private pendingWarningMode?: PhaseReportOutputMode
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
  private matrixMessage = ''
  private activeTab: 'pdf' | 'matrix' = 'pdf'
  private activeExportKind: 'pdf' | 'matrix' = 'pdf'
  private readonly focusController = createModalFocusController(this.element)

  constructor(
    private readonly getWorkspace: () => PhaseWorkspaceState,
    private readonly store: ReportManifestStore,
    private readonly actions: ReportWorkspaceActions,
    private readonly getLocale: () => AppLocale = () => 'zh'
  ) {
    this.manifest = store.snapshot()
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
      : `已选择 ${this.matrixSequenceIds.size} 个 Operation，${this.matrixPhaseIds.size} 个 Phase`
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
        this.createPreview(contexts),
        this.createInspector(contexts, issues)
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
    ;([
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
    panel.append(searchRow, filters, viewport)
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

  private createPreview(contexts: PageContext[]) {
    const context = contexts.find(item => item.slot.id === this.selectedSlotId)
    const panel = document.createElement('section')
    panel.className = 'report-page-preview'
    if (!context) {
      const empty = document.createElement('p')
      empty.textContent = '尚无报告页面'
      panel.append(empty)
      return panel
    }
    const page = document.createElement('span')
    page.className = 'report-preview-page-number'
    page.textContent = `报告页 ${context.pageNumber}`
    const title = document.createElement('h3')
    title.textContent = context.sourcePhase?.name ?? '来源缺失'
    const path = document.createElement('p')
    path.textContent = `${context.sourceProcess?.name ?? '—'} / 序列 ${String(context.sourceSequence?.number ?? 0).padStart(2, '0')} ${context.sourceSequence?.name ?? ''} / Phase ${String(context.sourcePhase?.number ?? 0).padStart(2, '0')}`
    const previewSurface = document.createElement('div')
    previewSurface.className = 'report-preview-surface'
    const drawing = document.createElement('strong')
    drawing.textContent =
      context.sourcePhase?.drawing.kind === 'assigned'
        ? context.sourcePhase.drawing.displayName
        : '未关联图纸'
    const hint = document.createElement('span')
    hint.textContent = '在 CAD Viewer 中打开此页面以查看完整 P&ID、高亮和设备状态。'
    const preview = document.createElement('button')
    preview.type = 'button'
    preview.className = 'report-primary-button'
    preview.append(createPhaseIcon(Eye), document.createTextNode('预览此页'))
    preview.disabled = !context.sourcePhase
      || Boolean(this.exportController)
    preview.addEventListener('click', async () => {
      if (!context.sourceProcess || !context.sourceSequence || !context.sourcePhase) return
      const assetId =
        context.sourcePhase.drawing.kind === 'assigned'
          ? context.sourcePhase.drawing.assetId
          : undefined
      try {
        await this.actions.preview(
          context.sourceProcess.id,
          context.sourceSequence.id,
          context.sourcePhase.id
        )
        if (assetId) this.store.setDrawingLoadFailed(assetId, false)
        this.close()
      } catch {
        if (assetId) this.store.setDrawingLoadFailed(assetId, true)
        this.render()
      }
    })
    previewSurface.append(drawing, hint, preview)
    panel.append(page, title, path, previewSurface)
    return panel
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
      panel.append(this.createExportControls(issues))
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
    panel.append(this.createExportControls(issues))
    return panel
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
    const errorCount = issues.filter(issue => issue.severity === 'error').length
    const warningCount = issues.filter(issue => issue.severity === 'warning').length
    const includedPages = this.manifest.pages.filter(page => !page.excluded)
    const sequenceCount = new Set(includedPages.map(page => page.sequenceId)).size
    const excludedCount = this.manifest.pages.length - includedPages.length
    const replacedCount = this.manifest.pages.filter(page => page.replacement).length
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
    merged.disabled = Boolean(this.exportController) || errorCount > 0
    merged.addEventListener('click', () => this.requestExport('merged', warningCount))
    const split = document.createElement('button')
    split.type = 'button'
    split.textContent = '每个序列一个 PDF（ZIP）'
    split.disabled = Boolean(this.exportController) || errorCount > 0
    split.addEventListener('click', () =>
      this.requestExport('per-sequence', warningCount)
    )
    section.append(title, estimates, status, merged, split)
    if (this.pendingWarningMode && !this.exportController) {
      const confirmation = document.createElement('div')
      confirmation.className = 'report-warning-confirmation'
      const message = document.createElement('p')
      message.textContent = `预检发现 ${warningCount} 个警告，是否继续生成？`
      const proceed = document.createElement('button')
      proceed.type = 'button'
      proceed.className = 'report-primary-button'
      proceed.textContent = '忽略警告并继续'
      proceed.addEventListener('click', () => {
        const mode = this.pendingWarningMode
        this.pendingWarningMode = undefined
        if (mode) void this.startExport(mode)
      })
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = '返回检查'
      cancel.addEventListener('click', () => {
        this.pendingWarningMode = undefined
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
    const title = document.createElement('h3')
    title.textContent = '配置并导出设备 Matrix'

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
      this.matrixMessage = ''
      this.render()
    })
    processLabel.append(processSelect)

    const formatLabel = document.createElement('label')
    formatLabel.textContent = '文件格式'
    const format = document.createElement('select')
    format.setAttribute('aria-label', 'Matrix 文件格式')
    ;(['XLSX', 'CSV'] as MatrixFormat[]).forEach(value =>
      format.add(new Option(value, value))
    )
    format.value = this.matrixFormat
    format.disabled = Boolean(this.exportController)
    format.addEventListener('change', () => {
      this.matrixFormat = format.value as MatrixFormat
    })
    formatLabel.append(format)

    const scope = document.createElement('fieldset')
    const scopeLegend = document.createElement('legend')
    scopeLegend.textContent = 'Operation / Phase 范围'
    scope.append(scopeLegend)
    process?.sequences.forEach(sequence => {
      const group = document.createElement('div')
      group.className = 'report-matrix-sequence'
      group.append(this.createMatrixCheckbox(
        `序列 ${String(sequence.number).padStart(2, '0')} · ${sequence.name}`,
        this.matrixSequenceIds.has(sequence.id),
        checked => {
          if (checked) {
            this.matrixSequenceIds.add(sequence.id)
            sequence.phases.forEach(phase => this.matrixPhaseIds.add(phase.id))
          } else {
            this.matrixSequenceIds.delete(sequence.id)
            sequence.phases.forEach(phase => this.matrixPhaseIds.delete(phase.id))
          }
          this.render()
        }
      ))
      sequence.phases.forEach(phase => {
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
    summary.textContent = this.matrixMessage ||
      `已选择 ${this.matrixSequenceIds.size} 个 Operation，${this.matrixPhaseIds.size} 个 Phase`
    const exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'report-primary-button'
    exportButton.textContent = '导出 Matrix'
    exportButton.disabled = Boolean(this.exportController) ||
      !this.matrixProcessId || this.matrixPhaseIds.size === 0 ||
      this.matrixDeviceTypes.size === 0
    exportButton.addEventListener('click', () => void this.startMatrixExport())

    section.append(title, processLabel, formatLabel, scope, devices, summary, exportButton)
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
    onChange: (checked: boolean) => void
  ) {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = checked
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

  private async startMatrixExport() {
    if (this.exportController || !this.actions.exportMatrix) return
    const controller = new AbortController()
    this.exportController = controller
    this.activeExportKind = 'matrix'
    this.matrixMessage = ''
    this.render()
    try {
      await this.actions.exportMatrix({
        processId: this.matrixProcessId,
        sequenceIds: [...this.matrixSequenceIds],
        phaseIds: [...this.matrixPhaseIds],
        format: this.matrixFormat,
        deviceTypes: [...this.matrixDeviceTypes],
        includeInactiveDevices: this.matrixIncludeInactiveDevices,
        includeTransitions: this.matrixIncludeTransitions
      }, controller.signal)
      this.matrixMessage = controller.signal.aborted
        ? 'Matrix 导出已取消'
        : 'Matrix 导出完成'
    } catch {
      this.matrixMessage = controller.signal.aborted
        ? 'Matrix 导出已取消'
        : 'Matrix 导出失败'
    } finally {
      this.exportController = undefined
      this.render()
    }
  }

  private requestExport(mode: PhaseReportOutputMode, warningCount: number) {
    if (warningCount > 0) {
      this.pendingWarningMode = mode
      this.render()
      return
    }
    void this.startExport(mode)
  }

  private async startExport(mode: PhaseReportOutputMode) {
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
      const result = await this.actions.export(mode, controller.signal, progress => {
        if (controller.signal.aborted) return
        this.exportProgress = progress
        this.render()
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
    this.pendingWarningMode = undefined
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
