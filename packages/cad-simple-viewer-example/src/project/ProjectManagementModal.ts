import { Download, FolderOpen, FolderPlus, Pencil, Save, Search, Trash2, Upload, X } from 'lucide'

import {
  getProjectPackageErrorMessage,
  type ProjectPackageImportResult
} from '../api/processAssistantProjectPackageApi'
import type { DrawingRecord, DrawingRepository } from '../drawing-library/types'
import type { AppLocale } from '../locale'
import { createPhaseIcon } from '../phase/phaseIcons'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { createModalFocusController } from '../ui/modalFocus'
import { localizeDom } from '../uiTranslations'
import { isProjectPidFile } from './projectPidFiles'
import type { ProjectRecord, ProjectRepository } from './types'

export interface ProjectManagementModalOptions {
  onSelect?: (project: ProjectRecord) => void | Promise<void>
  onDelete?: (projectId: number) => void | Promise<void>
  getLoadedProject?: () => ProjectRecord | undefined
  onExport?: (projectId: number) => Promise<void>
  onImport?: (file: File, requestId: string) => Promise<ProjectPackageImportResult>
  onImported?: (result: ProjectPackageImportResult) => void | Promise<void>
}

const createIconButton = (
  title: string,
  icon: Parameters<typeof createPhaseIcon>[0],
  action: () => void
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'project-icon-button'
  button.title = title
  button.setAttribute('aria-label', title)
  button.append(createPhaseIcon(icon))
  button.addEventListener('click', action)
  return button
}

export class ProjectManagementModal {
  readonly element = document.createElement('div')
  private projects: ProjectRecord[] = []
  private drawings: DrawingRecord[] = []
  private selectedProjectId?: number
  private name = ''
  private description = ''
  private selectedDrawingIds = new Set<string>()
  private drawingQuery = ''
  private isEditing = true
  private busy = false
  private selectionToken = 0
  private detailsLoading = false
  private loadingProjectId?: number
  private loadedProject?: ProjectRecord
  private failedProjectId?: number
  private message = ''
  private packageMessage = ''
  private packageError = false
  private packageOperation?: 'import' | 'export'
  private pendingImport?: { file: File; requestId: string }
  private importedProject?: ProjectPackageImportResult
  private replacedProjectId?: number
  private readonly packageInput = document.createElement('input')
  private readonly confirmationModal: ConfirmationModal
  private readonly focusController = createModalFocusController(this.element)

  constructor(
    private readonly repository: ProjectRepository,
    private readonly drawingRepository: Pick<DrawingRepository, 'list'>,
    private readonly options: ProjectManagementModalOptions = {},
    private readonly getLocale: () => AppLocale = () => 'zh'
  ) {
    this.confirmationModal = new ConfirmationModal(getLocale)
    this.element.className = 'project-management-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'projectManagementTitle')
    this.packageInput.type = 'file'
    this.packageInput.accept = '.zip'
    this.packageInput.hidden = true
    this.packageInput.setAttribute('aria-label', '选择 Project 包')
    this.packageInput.addEventListener('change', () => {
      const file = this.packageInput.files?.[0]
      this.packageInput.value = ''
      if (file) void this.importProjectPackage(file, crypto.randomUUID())
    })
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
    document.body.classList.add('project-management-open')
    await this.refresh()
    if (this.element.hidden) return
    this.focusController.activate(
      this.element.querySelector<HTMLInputElement>(
        'input[type="search"], input:not([type="file"])'
      )
    )
  }

  close() {
    if (this.busy) return
    this.selectionToken++
    this.detailsLoading = false
    this.element.hidden = true
    document.body.classList.remove('project-management-open')
    this.focusController.deactivate()
  }

  private async refresh() {
    try {
      ;[this.projects, this.drawings] = await Promise.all([
        this.repository.list(),
        this.drawingRepository.list()
      ])
      this.drawings = this.drawings.filter(drawing =>
        isProjectPidFile(drawing.originalFileName)
      )
      this.selectedDrawingIds = this.getPidDrawingIds(
        [...this.selectedDrawingIds].map(Number)
      )
      if (
        this.selectedProjectId &&
        !this.projects.some(project => project.id === this.selectedProjectId)
      ) {
        this.startNewProject()
        return
      }
    } catch (error) {
      this.message = String(error)
    }
    this.render()
  }

  private getPidDrawingIds(fileIds: readonly number[]): Set<string> {
    const availableIds = new Set(this.drawings.map(drawing => drawing.id))
    return new Set(fileIds.map(String).filter(id => availableIds.has(id)))
  }

  private render() {
    this.element.replaceChildren()
    const shell = document.createElement('section')
    shell.className = 'project-management-shell'
    shell.append(this.createHeader())
    const body = document.createElement('div')
    body.className = 'project-management-body'
    body.append(this.createProjectList(), this.createEditor())
    shell.append(body)
    this.element.append(shell)
    localizeDom(this.element, this.getLocale())
  }

  private createHeader() {
    const header = document.createElement('header')
    const identity = document.createElement('div')
    const eyebrow = document.createElement('span')
    eyebrow.textContent = 'PID Workspace'
    const title = document.createElement('h2')
    title.id = 'projectManagementTitle'
    title.textContent = 'Project 管理'
    identity.append(eyebrow, title)
    const summary = document.createElement('span')
    summary.className = 'project-summary'
    summary.textContent = `${this.projects.length} 个 Project`
    const close = createIconButton('关闭 Project 管理', X, () => this.close())
    close.disabled = this.busy
    header.append(identity, summary, close)
    return header
  }

  private createProjectList() {
    const panel = document.createElement('section')
    panel.className = 'project-list-panel'
    const toolbar = document.createElement('div')
    toolbar.className = 'project-list-toolbar'
    const title = document.createElement('h3')
    title.textContent = '已创建的 Project'
    const create = createIconButton('新建 Project', FolderPlus, () =>
      this.startNewProject()
    )
    create.disabled = this.busy || this.loadingProjectId !== undefined
    toolbar.append(title, create)
    const controls = document.createElement('div')
    controls.className = 'project-list-controls'
    const packageActions = document.createElement('div')
    packageActions.className = 'project-package-actions'
    const importButton = document.createElement('button')
    importButton.type = 'button'
    importButton.className = 'project-secondary-button project-import-button'
    importButton.disabled = this.busy || this.detailsLoading ||
      this.loadingProjectId !== undefined || !this.options.onImport
    importButton.append(
      createPhaseIcon(Upload),
      document.createTextNode(this.packageOperation === 'import' ? '正在导入项目包…' : '导入项目')
    )
    importButton.addEventListener('click', () => this.packageInput.click())
    const exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'project-secondary-button project-export-button'
    exportButton.disabled = this.busy || this.detailsLoading ||
      this.loadingProjectId !== undefined || !this.selectedProjectId || !this.options.onExport
    exportButton.append(
      createPhaseIcon(Download),
      document.createTextNode(this.packageOperation === 'export' ? '正在导出项目包…' : '导出项目')
    )
    exportButton.addEventListener('click', () => void this.exportProjectPackage())
    packageActions.append(importButton, exportButton)
    const hint = document.createElement('p')
    hint.className = 'project-package-hint'
    hint.textContent = '相同 projectKey 直接覆盖替换，不同 projectKey 新增项目；同名不作为覆盖依据。'
    controls.append(toolbar, packageActions, this.packageInput, hint)
    if (this.packageMessage) {
      const status = document.createElement('p')
      status.className = this.packageError ? 'project-message' : 'project-package-status'
      status.setAttribute('role', this.packageError ? 'alert' : 'status')
      status.textContent = this.packageMessage
      controls.append(status)
    }
    if (this.pendingImport && !this.busy) {
      const retry = document.createElement('button')
      retry.type = 'button'
      retry.className = 'project-secondary-button project-import-retry'
      retry.textContent = '重试导入'
      retry.disabled = this.detailsLoading || this.loadingProjectId !== undefined
      retry.addEventListener('click', () => {
        const pending = this.pendingImport
        if (pending) void this.importProjectPackage(pending.file, pending.requestId)
      })
      const retryHint = document.createElement('p')
      retryHint.className = 'project-package-hint'
      retryHint.textContent = '失败或网络中断不代表后台已取消；重试将复用同一文件和请求标识。'
      controls.append(retry, retryHint)
    }
    if (this.importedProject && this.packageError && !this.pendingImport) {
      const refresh = document.createElement('button')
      refresh.type = 'button'
      refresh.className = 'project-secondary-button project-package-refresh'
      refresh.textContent = '刷新项目列表'
      refresh.disabled = this.busy
      refresh.addEventListener('click', () => void this.refreshImportedProject())
      controls.append(refresh)
    }
    panel.append(controls)
    if (this.projects.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'project-empty'
      empty.textContent = '尚未创建 Project'
      panel.append(empty)
      return panel
    }
    const list = document.createElement('div')
    list.className = 'project-list'
    this.projects.forEach(project => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'project-list-item'
      button.classList.toggle(
        'is-selected',
        project.id === this.selectedProjectId
      )
      button.setAttribute(
        'aria-pressed',
        String(project.id === this.selectedProjectId)
      )
      button.disabled = this.busy
      const name = document.createElement('strong')
      name.textContent = project.name
      const details = document.createElement('span')
      details.className = 'project-list-item-details'
      const count = document.createElement('span')
      count.textContent = `${this.getPidDrawingIds(project.fileIds).size} 张 PID`
      const id = document.createElement('span')
      id.textContent = `ID ${project.id}`
      details.append(count, id)
      if (
        this.loadingProjectId === project.id ||
        this.isProjectLoaded(project)
      ) {
        const status = document.createElement('span')
        status.textContent =
          this.loadingProjectId === project.id ? '加载中' : '已加载'
        details.append(status)
      }
      button.append(name, details)
      button.addEventListener(
        'click',
        () => void this.selectProject(project.id)
      )
      list.append(button)
    })
    panel.append(list)
    return panel
  }

  private createEditor() {
    const panel = document.createElement('section')
    panel.className = 'project-editor-panel'
    const heading = document.createElement('div')
    heading.className = 'project-editor-heading'
    const title = document.createElement('h3')
    title.textContent = this.selectedProjectId
      ? this.isEditing
        ? '编辑 Project'
        : 'Project 详情'
      : '创建 Project'
    const help = document.createElement('p')
    help.textContent = this.isEditing
      ? '修改 Project 名称或关联的 PID 图纸。'
      : '查看 Project 信息和已关联的 PID 图纸。'
    const headingText = document.createElement('div')
    headingText.append(title, help)
    heading.append(headingText)
    if (this.selectedProjectId && !this.isEditing) {
      const headingActions = document.createElement('div')
      headingActions.className = 'project-editor-heading-actions'
      const edit = document.createElement('button')
      edit.type = 'button'
      edit.className = 'project-secondary-button'
      edit.disabled =
        this.busy || this.detailsLoading || this.loadingProjectId !== undefined
      edit.append(createPhaseIcon(Pencil), document.createTextNode('编辑'))
      edit.addEventListener('click', () => {
        this.isEditing = true
        this.message = ''
        this.render()
      })
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'project-danger-button'
      remove.disabled =
        this.busy || this.detailsLoading || this.loadingProjectId !== undefined
      remove.append(createPhaseIcon(Trash2), document.createTextNode('删除'))
      remove.addEventListener('click', () => void this.removeProject())
      headingActions.append(edit, remove)
      heading.append(headingActions)
    }

    const selectedProject = this.projects.find(
      project => project.id === this.selectedProjectId
    )
    const projectDetails = selectedProject
      ? this.createProjectDetails(selectedProject)
      : undefined

    const nameLabel = document.createElement('label')
    const nameTitle = document.createElement('span')
    nameTitle.textContent = 'Project 名称'
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.placeholder = '例如：2026-03CA-PC'
    nameInput.value = this.name
    nameInput.readOnly = !this.isEditing
    nameInput.disabled = this.busy
    nameInput.addEventListener('input', () => {
      this.name = nameInput.value
      this.message = ''
    })
    nameLabel.append(nameTitle, nameInput)

    const descriptionLabel = document.createElement('label')
    const descriptionTitle = document.createElement('span')
    descriptionTitle.textContent = 'Project 描述'
    const descriptionInput = document.createElement('textarea')
    descriptionInput.placeholder = '输入 Project 描述'
    descriptionInput.value = this.description
    descriptionInput.readOnly = !this.isEditing
    descriptionInput.disabled = this.busy
    descriptionInput.addEventListener('input', () => {
      this.description = descriptionInput.value
      this.message = ''
    })
    descriptionLabel.append(descriptionTitle, descriptionInput)

    const drawingHeader = document.createElement('div')
    drawingHeader.className = 'project-drawing-header'
    const drawingTitle = document.createElement('strong')
    drawingTitle.textContent = this.isEditing ? '选择 PID' : '包含的 PID'
    const count = document.createElement('span')
    count.textContent = `${this.selectedDrawingIds.size} 张`
    drawingHeader.append(drawingTitle, count)

    const searchLabel = document.createElement('label')
    searchLabel.className = 'project-drawing-search'
    searchLabel.append(createPhaseIcon(Search))
    const searchInput = document.createElement('input')
    searchInput.type = 'search'
    searchInput.placeholder = '搜索 PID 名称、图号或文件名'
    searchInput.value = this.drawingQuery
    searchInput.addEventListener('input', () => {
      this.drawingQuery = searchInput.value
      this.render()
      this.element
        .querySelector<HTMLInputElement>('.project-drawing-search input')
        ?.focus()
    })
    searchLabel.append(searchInput)

    const drawingList = document.createElement('div')
    drawingList.className = 'project-drawing-list'
    const normalizedQuery = this.drawingQuery.trim().toLocaleLowerCase()
    const visibleDrawings = this.drawings.filter(drawing => {
      if (!this.isEditing && !this.selectedDrawingIds.has(drawing.id))
        return false
      return [
        drawing.name,
        drawing.drawingNumber,
        drawing.originalFileName
      ].some(value => value?.toLocaleLowerCase().includes(normalizedQuery))
    })
    if (this.drawings.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'project-empty'
      empty.textContent = '图纸库中暂无 PID，请先上传图纸'
      drawingList.append(empty)
    } else if (visibleDrawings.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'project-empty'
      empty.textContent = normalizedQuery ? '没有匹配的 PID' : '尚未关联 PID'
      drawingList.append(empty)
    } else {
      visibleDrawings.forEach(drawing =>
        drawingList.append(this.createDrawingOption(drawing))
      )
    }

    const actions = document.createElement('footer')
    if (selectedProject && !this.isEditing) {
      const load = document.createElement('button')
      load.type = 'button'
      load.className = 'project-primary-button project-load-button'
      const loaded = this.isProjectLoaded(selectedProject)
      load.disabled =
        this.busy ||
        this.detailsLoading ||
        this.loadingProjectId !== undefined ||
        loaded
      load.append(
        createPhaseIcon(FolderOpen),
        document.createTextNode(
          this.loadingProjectId === selectedProject.id
            ? '加载中'
            : loaded
              ? '已加载'
              : '加载 Project'
        )
      )
      load.addEventListener('click', () => void this.loadSelectedProject())
      actions.append(load)
    }
    if (this.isEditing) {
      if (this.selectedProjectId) {
        const cancel = document.createElement('button')
        cancel.type = 'button'
        cancel.className = 'project-secondary-button'
        cancel.textContent = '取消'
        cancel.addEventListener('click', () => this.cancelEditing())
        actions.append(cancel)
      }
      const save = document.createElement('button')
      save.type = 'button'
      save.className = 'project-primary-button'
      save.disabled = this.busy || this.drawings.length === 0
      save.append(
        createPhaseIcon(Save),
        document.createTextNode(
          this.selectedProjectId ? '保存更改' : '创建 Project'
        )
      )
      save.addEventListener('click', () => void this.saveProject())
      actions.append(save)
    }
    panel.append(heading)
    if (projectDetails) panel.append(projectDetails)
    panel.append(
      nameLabel,
      descriptionLabel,
      drawingHeader,
      searchLabel,
      drawingList
    )
    if (this.message) {
      const message = document.createElement('p')
      message.className = 'project-message'
      message.textContent = this.message
      panel.append(message)
    }
    panel.append(actions)
    return panel
  }

  private createProjectDetails(project: ProjectRecord) {
    const details = document.createElement('dl')
    details.className = 'project-details'
    const fields = [
      ['描述', project.description || '无'],
      ['包含 PID', `${this.getPidDrawingIds(project.fileIds).size} 张`],
      ['Project ID', String(project.id)]
    ]
    fields.forEach(([label, value]) => {
      const field = document.createElement('div')
      if (label === 'Project ID') field.className = 'project-id-field'
      const term = document.createElement('dt')
      term.textContent = label
      const description = document.createElement('dd')
      description.textContent = value
      description.title = value
      field.append(term, description)
      details.append(field)
    })
    return details
  }

  private createDrawingOption(drawing: DrawingRecord) {
    const label = document.createElement('label')
    label.className = 'project-drawing-option'
    label.classList.toggle('is-readonly', !this.isEditing)
    const identity = document.createElement('span')
    const name = document.createElement('strong')
    name.textContent = drawing.name
    const detail = document.createElement('small')
    detail.textContent = drawing.drawingNumber
      ? `${drawing.drawingNumber} · ${drawing.originalFileName}`
      : drawing.originalFileName
    identity.append(name, detail)
    if (this.isEditing) {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = this.selectedDrawingIds.has(drawing.id)
      checkbox.disabled = this.busy
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.selectedDrawingIds.add(drawing.id)
        else this.selectedDrawingIds.delete(drawing.id)
        this.message = ''
        this.render()
      })
      label.append(checkbox, identity)
    } else {
      label.append(identity)
    }
    return label
  }

  private async selectProject(projectId: number) {
    if (this.busy) return
    const token = ++this.selectionToken
    this.detailsLoading = true
    this.message = ''
    this.render()
    try {
      const project = await this.repository.get(projectId)
      if (token !== this.selectionToken) return
      this.projects = this.projects.map(item =>
        item.id === project.id ? project : item
      )
      this.selectedProjectId = project.id
      this.name = project.name
      this.description = project.description
      this.selectedDrawingIds = this.getPidDrawingIds(project.fileIds)
      this.drawingQuery = ''
      this.isEditing = false
    } catch (error) {
      if (token === this.selectionToken) {
        this.message = error instanceof Error ? error.message : String(error)
      }
    } finally {
      if (token === this.selectionToken) {
        this.detailsLoading = false
        if (!this.element.hidden) this.render()
      }
    }
  }

  private isProjectLoaded(project: ProjectRecord): boolean {
    const loaded = this.options.getLoadedProject
      ? this.options.getLoadedProject()
      : this.loadedProject
    return (
      this.failedProjectId !== project.id &&
      this.replacedProjectId !== project.id &&
      loaded?.id === project.id &&
      loaded.name === project.name &&
      loaded.description === project.description &&
      loaded.fileIds.length === project.fileIds.length &&
      project.fileIds.every(id => loaded.fileIds.includes(id))
    )
  }

  private async loadSelectedProject() {
    const project = this.projects.find(
      item => item.id === this.selectedProjectId
    )
    if (
      !project ||
      this.busy ||
      this.detailsLoading ||
      this.loadingProjectId !== undefined ||
      this.isProjectLoaded(project) ||
      !this.options.onSelect
    )
      return
    this.loadingProjectId = project.id
    this.message = ''
    this.render()
    this.close()
    try {
      await this.options.onSelect(project)
      this.loadedProject = project
      this.failedProjectId = undefined
      if (this.replacedProjectId === project.id) this.replacedProjectId = undefined
    } catch (error) {
      this.failedProjectId = project.id
      if (this.selectedProjectId === project.id) {
        this.message = error instanceof Error ? error.message : String(error)
      }
    } finally {
      this.loadingProjectId = undefined
      if (!this.element.hidden) this.render()
    }
  }

  private startNewProject() {
    if (this.busy || this.loadingProjectId !== undefined) return
    this.selectionToken++
    this.detailsLoading = false
    this.selectedProjectId = undefined
    this.name = ''
    this.description = ''
    this.selectedDrawingIds.clear()
    this.drawingQuery = ''
    this.isEditing = true
    this.message = ''
    this.render()
  }

  private async exportProjectPackage() {
    const projectId = this.selectedProjectId
    if (!projectId || !this.options.onExport || this.busy ||
      this.detailsLoading || this.loadingProjectId !== undefined) return
    this.busy = true
    this.packageOperation = 'export'
    this.packageError = false
    this.importedProject = undefined
    this.packageMessage = '正在导出项目包…'
    this.render()
    try {
      await this.options.onExport(projectId)
      this.packageMessage = '项目包已下载。'
    } catch (error) {
      this.packageError = true
      this.packageMessage = `项目导出失败：${getProjectPackageErrorMessage(error)}`
    } finally {
      this.busy = false
      this.packageOperation = undefined
      this.render()
    }
  }

  private async importProjectPackage(file: File, requestId: string) {
    if (!this.options.onImport || this.busy || this.detailsLoading ||
      this.loadingProjectId !== undefined) return
    this.busy = true
    this.packageOperation = 'import'
    this.packageError = false
    this.packageMessage = '正在导入项目包…'
    this.pendingImport = { file, requestId }
    this.importedProject = undefined
    this.selectionToken++
    this.render()
    try {
      const result = await this.options.onImport(file, requestId)
      this.importedProject = result
      this.pendingImport = undefined
      if (result.action === 'replaced') this.replacedProjectId = result.projectId
      if (this.loadedProject?.id === result.projectId) this.loadedProject = undefined
      await this.options.onImported?.(result)
      await this.readImportedProject(result)
      this.packageMessage = this.importSuccessMessage(result)
    } catch (error) {
      this.packageError = true
      this.packageMessage = this.importedProject
        ? `项目已导入，但刷新失败：${getProjectPackageErrorMessage(error)}`
        : `项目导入失败：${getProjectPackageErrorMessage(error)}`
    } finally {
      this.busy = false
      this.packageOperation = undefined
      this.render()
    }
  }

  private importSuccessMessage(result: ProjectPackageImportResult) {
    return result.action === 'replaced'
      ? '项目导入完成，已覆盖替换 Project。'
      : '项目导入完成，已新增 Project。'
  }

  private async readImportedProject(result: ProjectPackageImportResult) {
    const [projects, drawings, project] = await Promise.all([
      this.repository.list(),
      this.drawingRepository.list(),
      this.repository.get(result.projectId)
    ])
    if (project.id !== result.projectId) {
      throw new Error('后台返回的项目与导入结果不一致，请刷新重试。')
    }
    if (!projects.some(item => item.id === project.id)) {
      throw new Error('导入的项目尚未出现在后台项目列表中，请刷新重试。')
    }
    this.projects = projects.map(item => item.id === project.id ? project : item)
    this.drawings = drawings.filter(drawing =>
      isProjectPidFile(drawing.originalFileName)
    )
    this.selectedProjectId = project.id
    this.name = project.name
    this.description = project.description
    this.selectedDrawingIds = this.getPidDrawingIds(project.fileIds)
    this.drawingQuery = ''
    this.isEditing = false
    this.message = ''
  }

  private async refreshImportedProject() {
    const imported = this.importedProject
    if (!imported || this.busy) return
    this.busy = true
    this.packageError = false
    this.render()
    try {
      await this.options.onImported?.(imported)
      await this.readImportedProject(imported)
      this.packageMessage = this.importSuccessMessage(imported)
    } catch (error) {
      this.packageError = true
      this.packageMessage = `项目已导入，但刷新失败：${getProjectPackageErrorMessage(error)}`
    } finally {
      this.busy = false
      this.render()
    }
  }

  private cancelEditing() {
    const project = this.projects.find(
      item => item.id === this.selectedProjectId
    )
    if (!project) return
    this.name = project.name
    this.description = project.description
    this.selectedDrawingIds = this.getPidDrawingIds(project.fileIds)
    this.drawingQuery = ''
    this.isEditing = false
    this.message = ''
    this.render()
  }

  private async saveProject() {
    if (this.busy || this.detailsLoading || this.loadingProjectId !== undefined)
      return
    this.busy = true
    this.message = ''
    this.render()
    try {
      const project = this.projects.find(item => item.id === this.selectedProjectId)
      const pidIds = new Set(this.drawings.map(drawing => Number(drawing.id)))
      // Project fileIds can also contain configuration attachments.
      const preservedFileIds = project?.fileIds.filter(id => !pidIds.has(id)) ?? []
      const input = {
        name: this.name,
        description: this.description,
        fileIds: [
          ...preservedFileIds,
          ...this.getPidDrawingIds([...this.selectedDrawingIds].map(Number))
        ]
          .map(Number)
          .filter(id => Number.isInteger(id) && id > 0)
      }
      const saved = this.selectedProjectId
        ? await this.repository.update(this.selectedProjectId, input)
        : await this.repository.create(input)
      this.selectedProjectId = saved.id
      this.name = saved.name
      this.description = saved.description
      this.selectedDrawingIds = this.getPidDrawingIds(saved.fileIds)
      this.drawingQuery = ''
      this.isEditing = false
      await this.refresh()
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error)
    } finally {
      this.busy = false
      this.render()
    }
  }

  private async removeProject() {
    if (this.busy || this.detailsLoading || this.loadingProjectId !== undefined)
      return
    const project = this.projects.find(
      item => item.id === this.selectedProjectId
    )
    if (!project) return
    const confirmed = await this.confirmationModal.confirm({
      title: '删除 Project',
      message: `确定删除“${project.name}”吗？关联的 PID 图纸不会被删除。`,
      confirmLabel: '删除',
      tone: 'danger'
    })
    if (!confirmed || this.busy || this.loadingProjectId !== undefined) return
    this.selectionToken++
    this.detailsLoading = false
    this.busy = true
    this.render()
    try {
      await this.repository.delete(project.id)
      await this.options.onDelete?.(project.id)
      this.selectedProjectId = undefined
      this.name = ''
      this.description = ''
      this.selectedDrawingIds.clear()
      this.isEditing = true
      await this.refresh()
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error)
    } finally {
      this.busy = false
      this.render()
    }
  }
}
