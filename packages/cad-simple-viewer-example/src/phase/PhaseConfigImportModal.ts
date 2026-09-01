import { FileSpreadsheet, FileUp, X } from 'lucide'

import { createModalFocusController } from '../ui/modalFocus'
import { createPhaseIcon } from './phaseIcons'

export interface PhaseConfigImportLabels {
  title: string
  close: string
  dropTitle: string
  dropHint: string
  browse: string
  fileCount: string
  excelOnly: string
  cancel: string
  confirm: string
  uploading: string
  complete: string
}

export class PhaseConfigImportModal {
  readonly element = document.createElement('div')
  private readonly focusController = createModalFocusController(this.element)
  private files: File[] = []
  private labels?: PhaseConfigImportLabels
  private resolve?: (files?: File[]) => void
  private progressTimer?: number
  private completionTimer?: number

  constructor() {
    this.element.className = 'phase-config-import-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'phaseConfigImportTitle')
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

  open(labels: PhaseConfigImportLabels): Promise<File[] | undefined> {
    this.close()
    this.labels = labels
    this.files = []
    this.render()
    this.element.hidden = false
    document.body.classList.add('phase-config-import-modal-open')
    const dropZone = this.element.querySelector<HTMLButtonElement>(
      '.phase-config-import-dropzone'
    )
    this.focusController.activate(dropZone)
    return new Promise(resolve => {
      this.resolve = resolve
    })
  }

  private render() {
    const labels = this.labels
    if (!labels) return
    this.element.replaceChildren()

    const shell = document.createElement('section')
    shell.className = 'phase-config-import-shell'
    const header = document.createElement('header')
    const heading = document.createElement('div')
    const symbol = document.createElement('span')
    symbol.className = 'phase-config-import-symbol'
    symbol.append(createPhaseIcon(FileSpreadsheet))
    const title = document.createElement('h2')
    title.id = 'phaseConfigImportTitle'
    title.textContent = labels.title
    heading.append(symbol, title)
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'phase-config-import-close'
    closeButton.title = labels.close
    closeButton.setAttribute('aria-label', labels.close)
    closeButton.append(createPhaseIcon(X))
    closeButton.addEventListener('click', () => this.close())
    header.append(heading, closeButton)

    const body = document.createElement('div')
    body.className = 'phase-config-import-body'
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.xlsx,.xls'
    fileInput.multiple = true
    fileInput.hidden = true
    const dropZone = document.createElement('button')
    dropZone.type = 'button'
    dropZone.className = 'phase-config-import-dropzone'
    const uploadIcon = document.createElement('span')
    uploadIcon.append(createPhaseIcon(FileUp))
    const dropTitle = document.createElement('strong')
    dropTitle.textContent = labels.dropTitle
    const dropHint = document.createElement('span')
    dropHint.textContent = labels.dropHint
    const browse = document.createElement('span')
    browse.className = 'phase-config-import-browse'
    browse.textContent = labels.browse
    dropZone.append(uploadIcon, dropTitle, dropHint, browse)
    dropZone.addEventListener('click', () => {
      fileInput.value = ''
      fileInput.click()
    })
    fileInput.addEventListener('change', () => {
      this.selectFiles(fileInput.files)
    })
    let dragDepth = 0
    dropZone.addEventListener('dragenter', event => {
      event.preventDefault()
      dragDepth += 1
      dropZone.classList.add('is-dragging')
    })
    dropZone.addEventListener('dragover', event => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    })
    dropZone.addEventListener('dragleave', () => {
      dragDepth -= 1
      if (dragDepth <= 0) {
        dragDepth = 0
        dropZone.classList.remove('is-dragging')
      }
    })
    dropZone.addEventListener('drop', event => {
      event.preventDefault()
      dragDepth = 0
      dropZone.classList.remove('is-dragging')
      this.selectFiles(event.dataTransfer?.files)
    })

    const validation = document.createElement('p')
    validation.className = 'phase-config-import-validation'
    validation.hidden = true
    const selection = document.createElement('div')
    selection.className = 'phase-config-import-selection'
    selection.hidden = true
    const selectionTitle = document.createElement('strong')
    const fileList = document.createElement('ul')
    selection.append(selectionTitle, fileList)

    const progress = document.createElement('div')
    progress.className = 'phase-config-import-progress'
    progress.hidden = true
    const progressHeader = document.createElement('div')
    const progressStatus = document.createElement('span')
    const progressValue = document.createElement('strong')
    progressValue.textContent = '0%'
    progressHeader.append(progressStatus, progressValue)
    const progressTrack = document.createElement('div')
    progressTrack.className = 'phase-config-import-progress-track'
    progressTrack.setAttribute('role', 'progressbar')
    progressTrack.setAttribute('aria-valuemin', '0')
    progressTrack.setAttribute('aria-valuemax', '100')
    progressTrack.setAttribute('aria-valuenow', '0')
    const progressBar = document.createElement('i')
    progressTrack.append(progressBar)
    progress.append(progressHeader, progressTrack)
    body.append(fileInput, dropZone, validation, selection, progress)

    const footer = document.createElement('footer')
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'phase-config-import-cancel'
    cancel.textContent = labels.cancel
    cancel.addEventListener('click', () => this.close())
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = 'phase-config-import-confirm'
    confirm.textContent = labels.confirm
    confirm.disabled = true
    confirm.addEventListener('click', () => this.startUpload())
    footer.append(cancel, confirm)
    shell.append(header, body, footer)
    this.element.append(shell)
  }

  private selectFiles(files?: FileList | null) {
    if (!files?.length || !this.labels) return
    const excelFiles = Array.from(files).filter(file => /\.xlsx?$/i.test(file.name))
    const validation = this.element.querySelector<HTMLParagraphElement>(
      '.phase-config-import-validation'
    )
    if (validation) {
      validation.textContent = this.labels.excelOnly
      validation.hidden = excelFiles.length === files.length
    }
    if (excelFiles.length === 0) return
    this.files = excelFiles
    this.renderSelection()
  }

  private renderSelection() {
    if (!this.labels) return
    const selection = this.element.querySelector<HTMLElement>(
      '.phase-config-import-selection'
    )
    const title = selection?.querySelector('strong')
    const list = selection?.querySelector('ul')
    const confirm = this.element.querySelector<HTMLButtonElement>(
      '.phase-config-import-confirm'
    )
    if (!selection || !title || !list || !confirm) return
    selection.hidden = false
    title.textContent = this.labels.fileCount.replace(
      '{count}',
      String(this.files.length)
    )
    list.replaceChildren(
      ...this.files.map(file => {
        const item = document.createElement('li')
        const name = document.createElement('span')
        name.textContent = file.name
        const size = document.createElement('span')
        size.textContent = this.formatFileSize(file.size)
        item.append(name, size)
        return item
      })
    )
    confirm.disabled = false
  }

  private startUpload() {
    if (this.files.length === 0 || !this.labels) return
    const dropZone = this.element.querySelector<HTMLButtonElement>(
      '.phase-config-import-dropzone'
    )
    const confirm = this.element.querySelector<HTMLButtonElement>(
      '.phase-config-import-confirm'
    )
    const progress = this.element.querySelector<HTMLElement>(
      '.phase-config-import-progress'
    )
    const progressStatus = progress?.querySelector('span')
    const progressValue = progress?.querySelector('strong')
    const progressTrack = progress?.querySelector<HTMLElement>('[role="progressbar"]')
    const progressBar = progressTrack?.querySelector<HTMLElement>('i')
    if (!dropZone || !confirm || !progress || !progressStatus || !progressValue || !progressTrack || !progressBar) return
    dropZone.disabled = true
    confirm.disabled = true
    progress.hidden = false
    progressStatus.textContent = this.labels.uploading
    let value = 0
    this.progressTimer = window.setInterval(() => {
      value = Math.min(100, value + 4)
      progressValue.textContent = `${value}%`
      progressTrack.setAttribute('aria-valuenow', String(value))
      progressBar.style.width = `${value}%`
      if (value < 100) return
      this.clearProgressTimers()
      progressStatus.textContent = this.labels?.complete ?? ''
      this.completionTimer = window.setTimeout(() => this.finish(this.files), 300)
    }, 80)
  }

  private formatFileSize(size: number) {
    if (size < 1024) return `${size} B`
    return `${(size / 1024).toFixed(1)} KB`
  }

  private clearProgressTimers() {
    if (this.progressTimer !== undefined) window.clearInterval(this.progressTimer)
    if (this.completionTimer !== undefined) window.clearTimeout(this.completionTimer)
    this.progressTimer = undefined
    this.completionTimer = undefined
  }

  private close() {
    this.finish(undefined)
  }

  private finish(files?: File[]) {
    if (this.element.hidden) return
    this.clearProgressTimers()
    this.element.hidden = true
    document.body.classList.remove('phase-config-import-modal-open')
    this.focusController.deactivate()
    const resolve = this.resolve
    this.resolve = undefined
    resolve?.(files)
  }
}