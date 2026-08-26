import { FolderPlus, Pencil, Save, Search, Trash2, X } from 'lucide'

import type { DrawingRecord, DrawingRepository } from '../drawing-library/types'
import { createPhaseIcon } from '../phase/phaseIcons'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { createModalFocusController } from '../ui/modalFocus'
import type { ProjectRecord, ProjectRepository } from './types'

export interface ProjectManagementModalOptions {
  onSelect?: (project: ProjectRecord) => void | Promise<void>
  onDelete?: (projectId: number) => void | Promise<void>
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
  private message = ''
  private readonly confirmationModal = new ConfirmationModal()
  private readonly focusController = createModalFocusController(this.element)

  constructor(
    private readonly repository: ProjectRepository,
    private readonly drawingRepository: Pick<DrawingRepository, 'list'>,
    private readonly options: ProjectManagementModalOptions = {}
  ) {
    this.element.className = 'project-management-modal'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'projectManagementTitle')
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
      this.element.querySelector<HTMLInputElement>('input[type="search"], input')
    )
  }

  close() {
    if (this.busy) return
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
    const title = document.createElement('h3')
    title.textContent = '已创建的 Project'
    const create = createIconButton('新建 Project', FolderPlus, () =>
      this.startNewProject()
    )
    create.disabled = this.busy
    toolbar.append(title, create)
    panel.append(toolbar)
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
      button.classList.toggle('is-selected', project.id === this.selectedProjectId)
      const name = document.createElement('strong')
      name.textContent = project.name
      const details = document.createElement('span')
      details.className = 'project-list-item-details'
      const count = document.createElement('span')
      count.textContent = `${project.fileIds.length} 张 PID`
      const id = document.createElement('span')
      id.textContent = `ID ${project.id}`
      details.append(count, id)
      button.append(name, details)
      button.addEventListener('click', () => void this.selectProject(project.id))
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
      edit.append(createPhaseIcon(Pencil), document.createTextNode('编辑'))
      edit.addEventListener('click', () => {
        this.isEditing = true
        this.message = ''
        this.render()
      })
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'project-danger-button'
      remove.disabled = this.busy
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
      if (!this.isEditing && !this.selectedDrawingIds.has(drawing.id)) return false
      return [drawing.name, drawing.drawingNumber, drawing.originalFileName].some(
        value => value?.toLocaleLowerCase().includes(normalizedQuery)
      )
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
      ['包含 PID', `${project.fileIds.length} 张`],
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
    this.busy = true
    this.message = ''
    this.render()
    try {
      const project = await this.repository.get(projectId)
      this.projects = this.projects.map(item =>
        item.id === project.id ? project : item
      )
      this.selectedProjectId = project.id
      this.name = project.name
      this.description = project.description
      this.selectedDrawingIds = new Set(project.fileIds.map(String))
      this.drawingQuery = ''
      this.isEditing = false
      await this.options.onSelect?.(project)
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error)
    } finally {
      this.busy = false
      this.render()
    }
  }

  private startNewProject() {
    this.selectedProjectId = undefined
    this.name = ''
    this.description = ''
    this.selectedDrawingIds.clear()
    this.drawingQuery = ''
    this.isEditing = true
    this.message = ''
    this.render()
  }

  private cancelEditing() {
    const project = this.projects.find(item => item.id === this.selectedProjectId)
    if (!project) return
    this.name = project.name
    this.description = project.description
    this.selectedDrawingIds = new Set(project.fileIds.map(String))
    this.drawingQuery = ''
    this.isEditing = false
    this.message = ''
    this.render()
  }

  private async saveProject() {
    this.busy = true
    this.message = ''
    this.render()
    try {
      const input = {
        name: this.name,
        description: this.description,
        fileIds: [...this.selectedDrawingIds]
          .map(Number)
          .filter(id => Number.isInteger(id) && id > 0)
      }
      const saved = this.selectedProjectId
        ? await this.repository.update(this.selectedProjectId, input)
        : await this.repository.create(input)
      this.selectedProjectId = saved.id
      this.name = saved.name
      this.description = saved.description
      this.selectedDrawingIds = new Set(saved.fileIds.map(String))
      this.drawingQuery = ''
      this.isEditing = false
      await this.refresh()
      await this.options.onSelect?.(saved)
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error)
    } finally {
      this.busy = false
      this.render()
    }
  }

  private async removeProject() {
    const project = this.projects.find(item => item.id === this.selectedProjectId)
    if (!project) return
    const confirmed = await this.confirmationModal.confirm({
      title: '删除 Project',
      message: `确定删除“${project.name}”吗？关联的 PID 图纸不会被删除。`,
      confirmLabel: '删除',
      tone: 'danger'
    })
    if (!confirmed) return
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