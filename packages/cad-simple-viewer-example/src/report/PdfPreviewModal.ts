import { ChevronLeft, ChevronRight, Download, Maximize2, Minus, Plus, X } from 'lucide'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type {
  PDFDocumentProxy,
  RenderTask
} from 'pdfjs-dist/types/src/display/api'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { createModalFocusController } from '../ui/modalFocus'
import { localizeDom } from '../uiTranslations'

export class PdfPreviewModal {
  readonly element = document.createElement('div')
  private readonly focusController = createModalFocusController(this.element)
  private document?: PDFDocumentProxy
  private renderTask?: RenderTask
  private bytes?: Uint8Array
  private fileName = ''
  private pageNumber = 1
  private scale = 1
  private fitWidth = true

  constructor(private readonly getLocale: () => AppLocale = () => 'zh') {
    this.element.className = 'pdf-preview-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'pdfPreviewTitle')
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    })
    document.body.append(this.element)
  }

  async open(fileName: string, bytes: Uint8Array) {
    this.closeDocument()
    this.fileName = fileName
    this.bytes = bytes
    this.pageNumber = 1
    this.scale = 1
    this.fitWidth = true
    this.element.hidden = false
    document.body.classList.add('pdf-preview-open')
    this.renderLoading()
    try {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      this.document = await pdfjs.getDocument({ data: bytes.slice() }).promise
      this.renderShell()
      await this.renderPage()
      this.focusController.activate(
        this.element.querySelector<HTMLButtonElement>('.pdf-preview-close')
      )
    } catch (error) {
      this.renderError(error)
    }
  }

  close() {
    this.element.hidden = true
    document.body.classList.remove('pdf-preview-open')
    this.focusController.deactivate()
    this.closeDocument()
  }

  private closeDocument() {
    this.renderTask?.cancel()
    this.renderTask = undefined
    void this.document?.destroy()
    this.document = undefined
  }

  private renderLoading() {
    const status = document.createElement('p')
    status.className = 'pdf-preview-status'
    status.textContent = '正在加载 PDF 预览…'
    this.element.replaceChildren(status)
    localizeDom(this.element, this.getLocale())
  }

  private renderError(error: unknown) {
    const status = document.createElement('div')
    status.className = 'pdf-preview-status'
    const message = document.createElement('strong')
    message.textContent = 'PDF 预览加载失败'
    const detail = document.createElement('span')
    detail.textContent = error instanceof Error ? error.message : String(error)
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = '关闭'
    close.addEventListener('click', () => this.close())
    status.append(message, detail, close)
    this.element.replaceChildren(status)
    localizeDom(this.element, this.getLocale())
  }

  private renderShell() {
    if (!this.document) return
    const shell = document.createElement('section')
    shell.className = 'pdf-preview-shell'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'pdfPreviewTitle'
    title.textContent = this.fileName
    const close = this.iconButton(X, '关闭 PDF 预览', 'pdf-preview-close')
    close.addEventListener('click', () => this.close())
    header.append(title, close)

    const toolbar = document.createElement('div')
    toolbar.className = 'pdf-preview-toolbar'
    const previous = this.iconButton(ChevronLeft, '上一页')
    previous.disabled = this.pageNumber <= 1
    previous.addEventListener('click', () => void this.changePage(this.pageNumber - 1))
    const page = document.createElement('input')
    page.type = 'number'
    page.min = '1'
    page.max = String(this.document.numPages)
    page.value = String(this.pageNumber)
    page.setAttribute('aria-label', 'PDF 页码')
    page.addEventListener('change', () => void this.changePage(Number(page.value)))
    const total = document.createElement('span')
    total.textContent = `/ ${this.document.numPages}`
    const next = this.iconButton(ChevronRight, '下一页')
    next.disabled = this.pageNumber >= this.document.numPages
    next.addEventListener('click', () => void this.changePage(this.pageNumber + 1))
    const zoomOut = this.iconButton(Minus, '缩小')
    zoomOut.addEventListener('click', () => void this.changeScale(-0.25))
    const zoom = document.createElement('span')
    zoom.className = 'pdf-preview-zoom'
    zoom.textContent = this.fitWidth ? '适合宽度' : `${Math.round(this.scale * 100)}%`
    const zoomIn = this.iconButton(Plus, '放大')
    zoomIn.addEventListener('click', () => void this.changeScale(0.25))
    const fit = this.iconButton(Maximize2, '适合宽度')
    fit.addEventListener('click', () => {
      this.fitWidth = true
      void this.renderPage()
    })
    const download = this.iconButton(Download, '下载 PDF')
    download.addEventListener('click', () => this.download())
    toolbar.append(previous, page, total, next, zoomOut, zoom, zoomIn, fit, download)

    const stage = document.createElement('div')
    stage.className = 'pdf-preview-stage'
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-label', 'PDF 页面预览')
    stage.append(canvas)
    shell.append(header, toolbar, stage)
    this.element.replaceChildren(shell)
    localizeDom(this.element, this.getLocale())
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

  private async changePage(pageNumber: number) {
    if (!this.document || !Number.isInteger(pageNumber)) return
    this.pageNumber = Math.max(1, Math.min(this.document.numPages, pageNumber))
    this.renderShell()
    await this.renderPage()
  }

  private async changeScale(delta: number) {
    this.fitWidth = false
    this.scale = Math.max(0.25, Math.min(4, this.scale + delta))
    this.renderShell()
    await this.renderPage()
  }

  private async renderPage() {
    const document = this.document
    const canvas = this.element.querySelector<HTMLCanvasElement>('canvas')
    const stage = this.element.querySelector<HTMLElement>('.pdf-preview-stage')
    if (!document || !canvas || !stage) return
    this.renderTask?.cancel()
    const page = await document.getPage(this.pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    if (this.fitWidth) {
      this.scale = Math.max(0.25, (stage.clientWidth - 48) / baseViewport.width)
    }
    const pixelRatio = window.devicePixelRatio || 1
    const viewport = page.getViewport({ scale: this.scale })
    const renderViewport = page.getViewport({ scale: this.scale * pixelRatio })
    canvas.width = Math.floor(renderViewport.width)
    canvas.height = Math.floor(renderViewport.height)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')
    this.renderTask = page.render({ canvas, canvasContext: context, viewport: renderViewport })
    try {
      await this.renderTask.promise
    } catch (error) {
      if (!(error instanceof Error && error.name === 'RenderingCancelledException')) throw error
    }
    const zoom = this.element.querySelector('.pdf-preview-zoom')
    if (zoom) zoom.textContent = this.fitWidth ? '适合宽度' : `${Math.round(this.scale * 100)}%`
  }

  private download() {
    if (!this.bytes) return
    const url = URL.createObjectURL(new Blob(
      [this.bytes.slice().buffer as ArrayBuffer],
      { type: 'application/pdf' }
    ))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = this.fileName
    anchor.click()
    queueMicrotask(() => URL.revokeObjectURL(url))
  }
}