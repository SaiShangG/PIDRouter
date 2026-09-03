import { Eye, FileJson, RotateCcw, Search, Trash2, Upload, X } from 'lucide'

import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { createModalFocusController } from '../ui/modalFocus'
import { localizeDom } from '../uiTranslations'
import { ParsingDetailsModal } from './ParsingDetailsModal'
import type { DrawingRecord, DrawingRepository } from './types'

interface DrawingLibraryActions {
  open(record: DrawingRecord): Promise<void>
}

const STATUS_LABELS: Record<DrawingRecord['status'], string> = {
  UPLOADING: '上传中',
  UPLOADED: '已上传',
  PARSING: '处理中',
  READY: '可查看',
  FAILED: '处理失败'
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const createIconButton = (
  title: string,
  icon: Parameters<typeof createPhaseIcon>[0],
  action: () => void
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'drawing-library-icon-button'
  button.title = title
  button.setAttribute('aria-label', title)
  button.append(createPhaseIcon(icon))
  button.addEventListener('click', action)
  return button
}

export class DrawingLibraryModal {
  readonly element = document.createElement('div')
  private records: DrawingRecord[] = []
  private query = ''
  private selectedFile?: File
  private drawingName = ''
  private drawingNumber = ''
  private busy = false
  private message = ''
  private readonly confirmationModal: ConfirmationModal
  private readonly parsingDetailsModal: ParsingDetailsModal
  private readonly focusController = createModalFocusController(this.element)

  constructor(
    private readonly repository: DrawingRepository,
    private readonly actions: DrawingLibraryActions,
    private readonly getLocale: () => AppLocale = () => 'zh'
  ) {
    this.confirmationModal = new ConfirmationModal(getLocale)
    this.parsingDetailsModal = new ParsingDetailsModal(getLocale)
    this.element.className = 'drawing-library-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'drawingLibraryTitle')
    this.element.addEventListener('pointerdown', event => {
      if (event.target === this.element && !this.busy) this.close()
    })
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !this.busy) {
        event.stopPropagation()
        this.close()
      }
    })
    document.body.append(this.element)
  }

  async open() {
    this.element.hidden = false
    document.body.classList.add('drawing-library-open')
    await this.refresh()
    this.focusController.activate(
      this.element.querySelector<HTMLInputElement>('input[type="search"], input')
    )
  }

  close() {
    if (this.busy) return
    this.element.hidden = true
    document.body.classList.remove('drawing-library-open')
    this.focusController.deactivate()
  }

  private async refresh() {
    try {
      this.records = await this.repository.list()
    } catch (error) {
      this.message = String(error)
    }
    this.render()
  }

  private render() {
    this.element.replaceChildren()
    const shell = document.createElement('section')
    shell.className = 'drawing-library-shell'
    shell.append(this.createHeader())

    const body = document.createElement('div')
    body.className = 'drawing-library-body'
    body.append(this.createUploadPanel(), this.createLibraryPanel())
    shell.append(body)
    this.element.append(shell)
    localizeDom(this.element, this.getLocale())
  }

  private createHeader() {
    const header = document.createElement('header')
    const identity = document.createElement('div')
    const eyebrow = document.createElement('span')
    eyebrow.textContent = 'ProcessAssistant API'
    const title = document.createElement('h2')
    title.id = 'drawingLibraryTitle'
    title.textContent = 'PID 图纸库'
    identity.append(eyebrow, title)

    const summary = document.createElement('span')
    summary.className = 'drawing-library-summary'
    summary.textContent = `${this.records.length} 张图纸`
    const close = createIconButton('关闭图纸库', X, () => this.close())
    close.disabled = this.busy
    header.append(identity, summary, close)
    return header
  }

  private createUploadPanel() {
    const panel = document.createElement('section')
    panel.className = 'drawing-upload-panel'
    const heading = document.createElement('div')
    const title = document.createElement('h3')
    title.textContent = '上传 PID'
    const help = document.createElement('p')
    help.textContent = '文件将直接上传到目标服务器并由后台保存。'
    heading.append(title, help)

    const form = document.createElement('form')
    const name = this.createTextField('图纸名称', '例如：CIP Supply', this.drawingName)
    name.input.required = true
    name.input.addEventListener('input', () => {
      this.drawingName = name.input.value
    })
    const number = this.createTextField('图号（可选）', '例如：PID-1001', this.drawingNumber)
    number.input.addEventListener('input', () => {
      this.drawingNumber = number.input.value
    })

    const fileLabel = document.createElement('label')
    fileLabel.className = 'drawing-upload-file'
    const fileTitle = document.createElement('span')
    fileTitle.textContent = '文件'
    const file = document.createElement('input')
    file.type = 'file'
    file.required = true
    file.disabled = this.busy
    file.addEventListener('change', () => {
      this.selectedFile = file.files?.[0]
      this.message = ''
    })
    const selected = document.createElement('small')
    selected.textContent = this.selectedFile
      ? `${this.selectedFile.name} · ${formatFileSize(this.selectedFile.size)}`
      : '请选择文件'
    fileLabel.append(fileTitle, file, selected)

    const submit = document.createElement('button')
    submit.type = 'submit'
    submit.className = 'drawing-library-primary-button'
    submit.disabled = this.busy
    submit.append(createPhaseIcon(Upload), document.createTextNode(this.busy ? '正在上传' : '上传'))
    form.addEventListener('submit', event => {
      event.preventDefault()
      void this.upload()
    })
    form.append(name.label, number.label, fileLabel, submit)
    panel.append(heading, form)
    if (this.message) {
      const message = document.createElement('p')
      message.className = 'drawing-library-message'
      message.textContent = this.message
      panel.append(message)
    }
    return panel
  }

  private createTextField(labelText: string, placeholder: string, value: string) {
    const label = document.createElement('label')
    const title = document.createElement('span')
    title.textContent = labelText
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = placeholder
    input.value = value
    input.disabled = this.busy
    label.append(title, input)
    return { label, input }
  }

  private createLibraryPanel() {
    const panel = document.createElement('section')
    panel.className = 'drawing-list-panel'
    const toolbar = document.createElement('div')
    toolbar.className = 'drawing-list-toolbar'
    const heading = document.createElement('h3')
    heading.textContent = '已上传图纸'
    const searchLabel = document.createElement('label')
    searchLabel.append(createPhaseIcon(Search))
    const search = document.createElement('input')
    search.type = 'search'
    search.placeholder = '搜索名称、图号或文件名'
    search.value = this.query
    search.addEventListener('input', () => {
      this.query = search.value
      this.render()
      this.element.querySelector<HTMLInputElement>('.drawing-list-toolbar input')?.focus()
    })
    searchLabel.append(search)
    toolbar.append(heading, searchLabel)
    panel.append(toolbar)

    const normalizedQuery = this.query.trim().toLocaleLowerCase()
    const records = this.records.filter(record =>
      [record.name, record.drawingNumber, record.originalFileName].some(value =>
        value?.toLocaleLowerCase().includes(normalizedQuery)
      )
    )
    if (records.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'drawing-library-empty'
      empty.textContent = this.records.length === 0 ? '尚未上传 PID 图纸' : '没有匹配的图纸'
      panel.append(empty)
      return panel
    }

    const list = document.createElement('div')
    list.className = 'drawing-library-list'
    records.forEach(record => list.append(this.createDrawingRow(record)))
    panel.append(list)
    return panel
  }

  private createDrawingRow(record: DrawingRecord) {
    const row = document.createElement('article')
    row.className = 'drawing-library-row'
    const identity = document.createElement('div')
    identity.className = 'drawing-row-identity'
    const name = document.createElement('strong')
    name.textContent = record.name
    const file = document.createElement('span')
    file.textContent = `${record.drawingNumber ? `${record.drawingNumber} · ` : ''}${record.originalFileName} · ${formatFileSize(record.fileSize)}`
    identity.append(name, file)

    const owner = document.createElement('div')
    owner.className = 'drawing-row-meta'
    owner.innerHTML = `<span>上传者</span><strong>${record.uploadedBy}</strong>`
    const time = document.createElement('div')
    time.className = 'drawing-row-meta'
    time.innerHTML = `<span>上传时间</span><strong>${new Date(record.uploadedAt).toLocaleString()}</strong>`

    const status = document.createElement('div')
    status.className = `drawing-row-status is-${record.status.toLowerCase()}`
    const statusLabel = document.createElement('strong')
    statusLabel.textContent = STATUS_LABELS[record.status]
    status.append(statusLabel)
    if (record.status === 'UPLOADING' || record.status === 'PARSING') {
      const progress = document.createElement('progress')
      progress.max = 100
      progress.value = record.progress
      status.append(progress)
    } else if (record.parseError) {
      const error = document.createElement('span')
      error.textContent = record.parseError
      status.append(error)
    } else if (record.connectionArtifact) {
      const summary = document.createElement('span')
      summary.textContent = `${record.connectionArtifact.entityCount.toLocaleString()} 实体 · ${record.connectionArtifact.edgeCount.toLocaleString()} 连接`
      status.append(summary)
    }

    const actions = document.createElement('div')
    actions.className = 'drawing-row-actions'
    const open = createIconButton('查看图纸', Eye, () => void this.openDrawing(record))
    open.disabled = record.status !== 'READY' || this.busy
    actions.append(open)
    if (record.connectionArtifact) {
      actions.append(
        createIconButton('查看解析摘要', FileJson, () =>
          this.parsingDetailsModal.open(record)
        )
      )
    }
    if (record.status === 'FAILED') {
      actions.append(
        createIconButton('重试处理', RotateCcw, () => void this.retry(record.id))
      )
    }
    const remove = createIconButton('删除图纸', Trash2, () => void this.remove(record))
    remove.disabled = this.busy || record.status === 'UPLOADING'
    actions.append(remove)
    row.append(identity, owner, time, status, actions)
    return row
  }

  private async upload() {
    if (!this.selectedFile) {
      this.message = '请选择文件'
      this.render()
      return
    }
    this.busy = true
    this.message = ''
    this.render()
    let uploaded = false
    try {
      await this.repository.upload(
        this.selectedFile,
        { name: this.drawingName, drawingNumber: this.drawingNumber },
        record => {
          const index = this.records.findIndex(item => item.id === record.id)
          if (index >= 0) this.records[index] = record
          else this.records.unshift(record)
          this.render()
        }
      )
      this.selectedFile = undefined
      this.drawingName = ''
      this.drawingNumber = ''
      uploaded = true
    } catch (error) {
      this.message = String(error)
    } finally {
      this.busy = false
      if (uploaded) await this.refresh()
      else this.render()
    }
  }

  private async openDrawing(record: DrawingRecord) {
    this.busy = true
    this.render()
    try {
      await this.actions.open(record)
      this.busy = false
      this.close()
    } catch (error) {
      this.busy = false
      this.message = String(error)
      this.render()
    }
  }

  private async retry(id: string) {
    this.busy = true
    this.render()
    try {
      await this.repository.retryParse(id)
    } catch (error) {
      this.message = String(error)
    } finally {
      this.busy = false
      await this.refresh()
    }
  }

  private async remove(record: DrawingRecord) {
    const confirmed = await this.confirmationModal.confirm({
      title: '删除图纸',
      message: `确定删除“${record.name}”？此操作无法撤销。`,
      confirmLabel: '删除',
      tone: 'danger'
    })
    if (!confirmed) return
    this.busy = true
    this.render()
    try {
      await this.repository.delete(record.id)
    } catch (error) {
      this.message = String(error)
    } finally {
      this.busy = false
      await this.refresh()
    }
  }
}