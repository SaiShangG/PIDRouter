import { ChevronLeft, ChevronRight, Download, Search, X } from 'lucide'
import type { WorkBook, WorkSheet } from 'xlsx'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { createModalFocusController } from '../ui/modalFocus'

const ROWS_PER_PAGE = 250
const messages = {
  zh: {
    close: '关闭 Excel 预览', download: '下载 Excel', empty: '该工作表没有内容',
    error: 'Excel 预览加载失败', loading: '正在加载 Excel 预览...', next: '下一页',
    noMatches: '没有匹配的单元格', previous: '上一页', search: '搜索当前工作表', sheet: '工作表',
    summary: (shown: number, total: number) => `显示 ${shown} / ${total} 行`
  },
  en: {
    close: 'Close Excel preview', download: 'Download Excel', empty: 'This worksheet is empty',
    error: 'Failed to load Excel preview', loading: 'Loading Excel preview...', next: 'Next page',
    noMatches: 'No matching cells', previous: 'Previous page', search: 'Search current worksheet', sheet: 'Worksheet',
    summary: (shown: number, total: number) => `Showing ${shown} of ${total} rows`
  }
} as const

type SheetRow = { index: number; values: string[] }
type SheetToRows = <T>(sheet: WorkSheet, options: object) => T[]

export class ExcelPreviewModal {
  readonly element = document.createElement('div')
  private readonly focusController = createModalFocusController(this.element)
  private workbook?: WorkBook
  private fileName = ''
  private bytes?: Uint8Array
  private rows: SheetRow[] = []
  private activeSheet = ''
  private query = ''
  private page = 1

  constructor(private readonly getLocale: () => AppLocale = () => 'zh') {
    this.element.className = 'excel-preview-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'excelPreviewTitle')
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.close()
    })
    document.body.append(this.element)
  }

  async open(fileName: string, bytes: Uint8Array) {
    this.fileName = fileName
    this.bytes = bytes
    this.query = ''
    this.page = 1
    this.element.hidden = false
    document.body.classList.add('excel-preview-open')
    this.renderStatus(this.text.loading)
    try {
      const xlsx = await import('xlsx')
      this.workbook = xlsx.read(bytes, { cellDates: true, dense: true })
      this.activeSheet = this.workbook.SheetNames[0] ?? ''
      this.loadSheet(xlsx.utils.sheet_to_json)
      this.render()
      this.focusController.activate(
        this.element.querySelector<HTMLButtonElement>('.excel-preview-close')
      )
    } catch (error) {
      this.renderError(error)
    }
  }

  close() {
    this.element.hidden = true
    document.body.classList.remove('excel-preview-open')
    this.focusController.deactivate()
    this.workbook = undefined
    this.bytes = undefined
  }

  refreshLocale() {
    if (!this.element.hidden && this.workbook) this.render()
  }

  private get text() { return messages[this.getLocale()] }

  private loadSheet(toRows: SheetToRows) {
    const sheet = this.workbook?.Sheets[this.activeSheet]
    const rows = sheet ? toRows<unknown[]>(sheet, { header: 1, raw: false, defval: '' }) : []
    this.rows = rows.map((row, index) => ({
      index: index + 1,
      values: row.map(value => String(value ?? ''))
    }))
  }

  private get filteredRows() {
    const query = this.query.trim().toLocaleLowerCase()
    return query
      ? this.rows.filter(row => row.values.some(value => value.toLocaleLowerCase().includes(query)))
      : this.rows
  }

  private render() {
    if (!this.workbook || !this.bytes) return
    const shell = document.createElement('section')
    shell.className = 'excel-preview-shell'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'excelPreviewTitle'
    title.textContent = this.fileName
    const close = this.iconButton(X, this.text.close, 'excel-preview-close')
    close.addEventListener('click', () => this.close())
    header.append(title, close)

    const tabs = document.createElement('div')
    tabs.className = 'excel-preview-tabs'
    tabs.setAttribute('role', 'tablist')
    tabs.setAttribute('aria-label', this.text.sheet)
    this.workbook.SheetNames.forEach(name => {
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(name === this.activeSheet))
      tab.textContent = name
      tab.addEventListener('click', () => void this.changeSheet(name))
      tabs.append(tab)
    })

    const toolbar = document.createElement('div')
    toolbar.className = 'excel-preview-toolbar'
    const searchLabel = document.createElement('label')
    searchLabel.append(createPhaseIcon(Search))
    const search = document.createElement('input')
    search.type = 'search'
    search.value = this.query
    search.placeholder = this.text.search
    search.setAttribute('aria-label', this.text.search)
    search.addEventListener('change', () => { this.query = search.value; this.page = 1; this.render() })
    searchLabel.append(search)
    const filteredRows = this.filteredRows
    const pageCount = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE))
    this.page = Math.min(this.page, pageCount)
    const summary = document.createElement('span')
    summary.className = 'excel-preview-summary'
    summary.textContent = this.text.summary(filteredRows.length, this.rows.length)
    const previous = this.iconButton(ChevronLeft, this.text.previous)
    previous.disabled = this.page === 1
    previous.addEventListener('click', () => { this.page--; this.render() })
    const page = document.createElement('span')
    page.className = 'excel-preview-page'
    page.textContent = `${this.page} / ${pageCount}`
    const next = this.iconButton(ChevronRight, this.text.next)
    next.disabled = this.page === pageCount
    next.addEventListener('click', () => { this.page++; this.render() })
    const download = this.iconButton(Download, this.text.download)
    download.addEventListener('click', () => this.download())
    toolbar.append(searchLabel, summary, previous, page, next, download)

    const stage = document.createElement('div')
    stage.className = 'excel-preview-stage'
    stage.setAttribute('role', 'tabpanel')
    this.renderGrid(stage, filteredRows)
    shell.append(header, tabs, toolbar, stage)
    this.element.replaceChildren(shell)
  }

  private renderGrid(stage: HTMLElement, rows: SheetRow[]) {
    if (this.rows.length === 0 || rows.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'excel-preview-empty'
      empty.textContent = this.rows.length === 0 ? this.text.empty : this.text.noMatches
      stage.append(empty)
      return
    }
    const start = (this.page - 1) * ROWS_PER_PAGE
    const pageRows = rows.slice(start, start + ROWS_PER_PAGE)
    const columnCount = Math.max(...pageRows.map(row => row.values.length), 1)
    const table = document.createElement('table')
    const headRow = document.createElement('tr')
    headRow.append(document.createElement('th'))
    for (let column = 0; column < columnCount; column++) {
      const heading = document.createElement('th')
      heading.textContent = this.columnLabel(column)
      headRow.append(heading)
    }
    const head = document.createElement('thead')
    head.append(headRow)
    const body = document.createElement('tbody')
    const query = this.query.trim().toLocaleLowerCase()
    pageRows.forEach(row => {
      const tableRow = document.createElement('tr')
      const rowHeading = document.createElement('th')
      rowHeading.textContent = String(row.index)
      tableRow.append(rowHeading)
      for (let column = 0; column < columnCount; column++) {
        const cell = document.createElement('td')
        cell.textContent = row.values[column] ?? ''
        cell.title = cell.textContent
        if (query && cell.textContent.toLocaleLowerCase().includes(query)) cell.className = 'is-match'
        tableRow.append(cell)
      }
      body.append(tableRow)
    })
    table.append(head, body)
    stage.append(table)
  }

  private async changeSheet(name: string) {
    const xlsx = await import('xlsx')
    this.activeSheet = name
    this.query = ''
    this.page = 1
    this.loadSheet(xlsx.utils.sheet_to_json)
    this.render()
  }

  private renderStatus(message: string) {
    const status = document.createElement('p')
    status.className = 'excel-preview-status'
    status.textContent = message
    this.element.replaceChildren(status)
  }

  private renderError(error: unknown) {
    const status = document.createElement('div')
    status.className = 'excel-preview-status'
    const message = document.createElement('strong')
    message.textContent = this.text.error
    const detail = document.createElement('span')
    detail.textContent = error instanceof Error ? error.message : String(error)
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = this.text.close
    close.addEventListener('click', () => this.close())
    status.append(message, detail, close)
    this.element.replaceChildren(status)
  }

  private iconButton(icon: typeof X, label: string, className = '') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.title = label
    button.setAttribute('aria-label', label)
    button.append(createPhaseIcon(icon))
    return button
  }

  private columnLabel(index: number) {
    let label = ''
    for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
      label = String.fromCharCode(65 + ((value - 1) % 26)) + label
    }
    return label
  }

  private download() {
    if (!this.bytes) return
    const url = URL.createObjectURL(new Blob([this.bytes.slice().buffer as ArrayBuffer], {
      type: this.fileName.toLocaleLowerCase().endsWith('.csv')
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = this.fileName
    anchor.click()
    queueMicrotask(() => URL.revokeObjectURL(url))
  }
}