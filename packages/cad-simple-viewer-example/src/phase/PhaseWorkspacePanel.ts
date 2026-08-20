import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  X
} from 'lucide'

import type { AppLocale } from '../locale'
import { localizeDom, translateUiText } from '../uiTranslations'
import { createPhaseIcon } from './phaseIcons'
import type { PhaseWorkspaceState } from './types'

export interface NewPhaseRequest {
  processId: string
  sequenceId: string
  number: number
  name: string
  sourceKind:
    | 'unassigned'
    | 'previous'
    | 'history'
    | 'project'
    | 'local'
    | 'url'
    | 'blank'
  sourcePhaseId?: string
  fileId?: number
  drawingDisplayName: string
  file?: File
  url?: string
}

export interface NewSequenceRequest {
  processId: string
  number: number
  name: string
}

export interface DrawingAssociationRequest {
  processId: string
  sequenceId: string
  phaseId: string
  sourceKind: 'project' | 'marked'
  fileId?: number
  sourceProcessId?: string
  sourceSequenceId?: string
  sourcePhaseId?: string
  drawingDisplayName: string
}

export interface CopySequenceRequest extends NewSequenceRequest {
  sequenceId: string
}

export interface CopyPhaseRequest {
  processId: string
  sourceSequenceId: string
  sourcePhaseId: string
  targetSequenceId: string
  number: number
  name: string
}

export interface PhaseWorkspacePanelActions {
  createProcess(name: string): void
  deleteProcess(processId: string): Promise<void>
  createSequence(request: NewSequenceRequest): void
  copySequence(request: CopySequenceRequest): void
  renameSequence(processId: string, sequenceId: string, name: string): void
  deleteSequence(processId: string, sequenceId: string): Promise<void>
  reorderSequence(processId: string, sequenceId: string, targetIndex: number): void
  activateSequence(processId: string, sequenceId: string): Promise<void>
  createPhase(request: NewPhaseRequest): Promise<void>
  copyPhase(request: CopyPhaseRequest): Promise<void>
  associateDrawing(request: DrawingAssociationRequest): Promise<void>
  activateProcess(processId: string): Promise<void>
  activatePhase(processId: string, sequenceId: string, phaseId: string): Promise<void>
  reorderPhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    targetIndex: number
  ): void
  renamePhase(processId: string, sequenceId: string, phaseId: string, name: string): void
  deletePhase(processId: string, sequenceId: string, phaseId: string): Promise<void>
  renameDrawing(processId: string, sequenceId: string, phaseId: string, name: string): void
}

export class PhaseWorkspacePanel {
  readonly element = document.createElement('section')
  private readonly expandedSequenceIds = new Set<string>()
  private readonly initializedSequenceIds = new Set<string>()
  private readonly drawingAssociationModals = new Set<HTMLElement>()
  private processCreatorExpanded = false

  constructor(
    private readonly getState: () => PhaseWorkspaceState,
    private readonly actions: PhaseWorkspacePanelActions,
    private readonly getLocale: () => AppLocale = () => 'zh',
    private readonly getProjectFileIds: () => readonly number[] = () => []
  ) {
    this.element.className = 'phase-workspace'
    this.render()
  }

  render() {
    this.drawingAssociationModals.forEach(modal => modal.remove())
    this.drawingAssociationModals.clear()
    this.element.replaceChildren()
    const state = this.getState()
    const activeProcess = state.processes.find(
      process => process.id === state.activeProcessId
    )
    if (!activeProcess) {
      this.renderEmptyProcess()
      this.localize()
      return
    }

    const activeSequence = activeProcess.sequences.find(
      sequence => sequence.id === activeProcess.activeSequenceId
    )
    activeProcess.sequences.forEach(sequence => {
      if (this.initializedSequenceIds.has(sequence.id)) return
      this.initializedSequenceIds.add(sequence.id)
      if (sequence.id === activeSequence?.id) this.expandedSequenceIds.add(sequence.id)
    })
    const activePhase = activeSequence?.phases.find(
      phase => phase.id === activeSequence.activePhaseId
    )
    const content = document.createElement('div')
    content.className = 'phase-workspace-content'
    content.append(
      this.createHeader(state, activeProcess.id)
    )
    content.append(this.createSequenceNavigation(activeProcess))
    if (activeSequence) {
      if (activePhase) {
        content.append(
          this.createOverview(activeProcess.id, activeSequence, activePhase)
        )
      }
      this.element.append(
        content,
        this.createPhaseControls(activeProcess.id, activeSequence)
      )
      this.localize()
      return
    }
    this.element.append(content)
    this.localize()
  }

  private localize() {
    localizeDom(this.element, this.getLocale())
  }

  private t(text: string) {
    return translateUiText(this.getLocale(), text)
  }

  private renderEmptyProcess() {
    const empty = this.createBlock('从第一个工艺开始')
    const description = document.createElement('p')
    description.textContent =
      '工作区当前为空。创建一个工艺，例如 CIP，然后添加第一个 Phase。'
    const input = document.createElement('input')
    input.placeholder = '工艺名称，例如 CIP'
    input.setAttribute('aria-label', '工艺名称')
    const button = this.createButton('创建工艺', true)
    const updateButtonState = () => {
      button.disabled = !input.value.trim()
    }
    input.addEventListener('input', updateButtonState)
    updateButtonState()
    button.addEventListener('click', () => {
      if (!input.value.trim()) return
      this.actions.createProcess(input.value)
      this.render()
    })
    empty.append(description, input, button)
    const content = document.createElement('div')
    content.className = 'phase-workspace-content'
    content.append(empty)
    this.element.append(content)
  }

  private createHeader(state: PhaseWorkspaceState, activeProcessId: string) {
    const block = this.createBlock('工艺')
    const row = document.createElement('div')
    row.className = 'phase-process-selector'
    const select = document.createElement('select')
    select.setAttribute('aria-label', '当前工艺')
    state.processes.forEach(process => {
      select.add(new Option(process.name, process.id))
    })
    select.value = activeProcessId
    select.addEventListener('change', async () => {
      await this.actions.activateProcess(select.value)
      this.render()
    })
    const toggleAdd = this.createButton('', false)
    toggleAdd.className = 'phase-icon-button'
    toggleAdd.title = '新增工艺'
    toggleAdd.setAttribute('aria-label', '新增工艺')
    toggleAdd.append(createPhaseIcon(Plus))
    toggleAdd.setAttribute('aria-expanded', String(this.processCreatorExpanded))
    toggleAdd.addEventListener('click', () => {
      this.processCreatorExpanded = !this.processCreatorExpanded
      this.render()
      if (this.processCreatorExpanded) {
        this.element
          .querySelector<HTMLInputElement>(
            `[aria-label="${this.t('新工艺名称')}"]`
          )
          ?.focus()
      }
    })
    const deleteProcess = this.createButton('', false)
    deleteProcess.className = 'phase-process-delete phase-icon-button'
    deleteProcess.title = '删除当前工艺'
    deleteProcess.setAttribute('aria-label', '删除当前工艺')
    deleteProcess.append(createPhaseIcon(Trash2))
    deleteProcess.addEventListener('click', () => {
      const process = state.processes.find(item => item.id === activeProcessId)
      if (!process) return
      const phaseCount = process.sequences.reduce(
        (count, sequence) => count + sequence.phases.length,
        0
      )
      this.openDeleteConfirmation({
        title: '删除工艺？',
        description: `将同时删除 ${process.sequences.length} 个序列和 ${phaseCount} 个 Phase，此操作无法撤销。`,
        target: process.name,
        trigger: deleteProcess,
        onConfirm: async () => {
          await this.actions.deleteProcess(process.id)
          this.processCreatorExpanded = false
        }
      })
    })
    row.append(select, toggleAdd, deleteProcess)
    block.append(row)
    if (this.processCreatorExpanded) {
      const creator = document.createElement('div')
      creator.className = 'phase-process-creator'
      const input = document.createElement('input')
      input.placeholder = '输入新工艺名称'
      input.setAttribute('aria-label', '新工艺名称')
      const add = this.createButton('创建', true)
      const cancel = this.createButton('', false)
      cancel.className = 'phase-process-cancel phase-icon-button'
      cancel.title = '取消新增工艺'
      cancel.setAttribute('aria-label', '取消新增工艺')
      cancel.append(createPhaseIcon(X))
      const cancelProcess = () => {
        this.processCreatorExpanded = false
        this.render()
        this.element
          .querySelector<HTMLButtonElement>(
            `[aria-label="${this.t('新增工艺')}"]`
          )
          ?.focus()
      }
      const createProcess = () => {
        if (!input.value.trim()) return
        this.actions.createProcess(input.value)
        this.processCreatorExpanded = false
        this.render()
      }
      add.addEventListener('click', createProcess)
      cancel.addEventListener('click', cancelProcess)
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') createProcess()
        if (event.key === 'Escape') cancelProcess()
      })
      creator.append(input, add, cancel)
      block.append(creator)
    }
    return block
  }

  private createSequenceNavigation(
    process: PhaseWorkspaceState['processes'][number]
  ) {
    const block = document.createElement('section')
    block.className = 'phase-workspace-block phase-tree-section'
    const heading = document.createElement('div')
    heading.className = 'phase-tree-section-heading'
    const title = document.createElement('h3')
    title.textContent = '工艺结构'
    const addSequence = this.createButton('', false)
    addSequence.className = 'phase-icon-button'
    addSequence.title = '新增序列'
    addSequence.setAttribute('aria-label', '新增序列')
    addSequence.setAttribute('aria-haspopup', 'dialog')
    addSequence.append(createPhaseIcon(Plus))
    addSequence.addEventListener('click', () => {
      this.openSequenceEditorModal(process, 'create', addSequence)
    })
    heading.append(title, addSequence)
    block.append(heading)
    const tree = document.createElement('div')
    tree.className = 'phase-sequence-tree'
    tree.setAttribute('aria-label', `${process.name} 的序列与阶段`)
    process.sequences.forEach((sequence, sequenceIndex) => {
      tree.append(this.createSequenceTreeItem(process, sequence, sequenceIndex))
    })
    if (process.sequences.length === 0) {
      const empty = document.createElement('p')
      empty.textContent = '此工艺尚无序列。请先创建序列。'
      tree.append(empty)
    }
    block.append(tree)
    return block
  }

  private createSequenceTreeItem(
    process: PhaseWorkspaceState['processes'][number],
    sequence: PhaseWorkspaceState['processes'][number]['sequences'][number],
    sequenceIndex: number
  ) {
    const expanded = this.expandedSequenceIds.has(sequence.id)
    const active = sequence.id === process.activeSequenceId
    const group = document.createElement('section')
    group.className = 'phase-sequence-group'
    group.classList.toggle('is-active', active)
    const row = document.createElement('div')
    row.className = 'phase-sequence-row'
    const toggle = this.createButton('', false)
    toggle.className = 'phase-sequence-toggle phase-tree-header'
    toggle.setAttribute('aria-expanded', String(expanded))
    toggle.setAttribute('aria-label', `${expanded ? '折叠' : '展开'}序列 ${sequence.number}`)
    toggle.title = sequence.name
    toggle.append(
      createPhaseIcon(ChevronDown, 'phase-tree-chevron')
    )
    const identity = document.createElement('span')
    identity.className = 'phase-sequence-identity'
    const number = document.createElement('span')
    number.className = 'phase-sequence-number'
    number.textContent = String(sequence.number).padStart(2, '0')
    const name = document.createElement('strong')
    name.textContent = sequence.name
    name.title = sequence.name
    const count = document.createElement('span')
    count.className = 'phase-count-badge'
    count.textContent = String(sequence.phases.length)
    const status = document.createElement('span')
    status.className = 'phase-sequence-status'
    const complete =
      sequence.phases.length > 0 &&
      sequence.phases.every(
        phase =>
          phase.drawing.kind === 'assigned' &&
          this.getState().drawingAssets[phase.drawing.assetId]
      )
    status.textContent = active ? '活动' : complete ? '完整' : '待完善'
    identity.append(number, name, count, status)
    toggle.append(identity)
    toggle.addEventListener('click', async () => {
      if (expanded) this.expandedSequenceIds.delete(sequence.id)
      else this.expandedSequenceIds.add(sequence.id)
      if (!active) await this.actions.activateSequence(process.id, sequence.id)
      this.render()
    })
    const controls = document.createElement('div')
    controls.className = 'phase-sequence-controls'
    controls.append(
      this.createIconButton('复制序列', Copy, trigger => this.openSequenceEditorModal(process, 'copy', trigger, sequence)),
      this.createIconButton('重命名序列', Pencil, trigger => this.openSequenceEditorModal(process, 'rename', trigger, sequence)),
      this.createIconButton('上移序列', ArrowUp, () => {
        this.actions.reorderSequence(process.id, sequence.id, sequenceIndex - 1)
        this.render()
      }, sequenceIndex === 0),
      this.createIconButton('下移序列', ArrowDown, () => {
        this.actions.reorderSequence(process.id, sequence.id, sequenceIndex + 1)
        this.render()
      }, sequenceIndex === process.sequences.length - 1),
      this.createIconButton('删除序列', Trash2, trigger => this.openSequenceDelete(process.id, sequence, trigger))
    )
    row.append(toggle, controls)
    const list = document.createElement('div')
    list.className = 'phase-tree-list'
    list.hidden = !expanded
    list.setAttribute('role', 'tree')
    list.setAttribute('aria-label', `${sequence.name} 的阶段`)
    if (sequence.phases.length === 0) {
      const empty = document.createElement('p')
      empty.textContent = active
        ? '此工艺尚无阶段。请从一张新图纸创建首个 Phase。'
        : '此序列尚无阶段。'
      list.append(empty)
    }
    sequence.phases.forEach((phase, index) => {
      const item = document.createElement('div')
      item.className = 'phase-tree-item'
      item.draggable = true
      item.setAttribute('role', 'treeitem')
      item.setAttribute(
        'aria-selected',
        String(active && phase.id === sequence.activePhaseId)
      )
      const button = this.createButton('', false)
      button.className = 'phase-tree-node'
      button.classList.toggle(
        'is-active',
        active && phase.id === sequence.activePhaseId
      )
      button.title =
        phase.drawing.kind === 'assigned'
          ? phase.drawing.displayName
          : '未关联图纸'
      const grip = createPhaseIcon(GripVertical, 'phase-tree-grip')
      grip.setAttribute('title', '拖动调整顺序')
      const label = document.createElement('span')
      label.className = 'phase-tree-node-label'
      const phaseNumber = document.createElement('span')
      phaseNumber.className = 'phase-tree-node-number'
      phaseNumber.textContent = String(phase.number).padStart(2, '0')
      const phaseName = document.createElement('span')
      phaseName.textContent = phase.name
      const drawingStatus = document.createElement('span')
      drawingStatus.className = 'phase-tree-drawing-status'
      drawingStatus.textContent =
        phase.drawing.kind === 'unassigned'
          ? '未关联图纸'
          : this.getState().drawingAssets[phase.drawing.assetId]
            ? '图纸已关联'
            : '图纸缺失'
      label.append(phaseNumber, phaseName, drawingStatus)
      button.append(grip, label)
      button.addEventListener('click', async () => {
        await this.actions.activatePhase(process.id, sequence.id, phase.id)
        this.render()
      })
      const controls = document.createElement('div')
      controls.className = 'phase-tree-order-controls'
      const copy = this.createIconButton('复制 Phase', Copy, trigger => {
        this.openPhaseCopyModal(process, sequence, phase, trigger)
      })
      const moveUp = this.createButton('', false)
      moveUp.className = 'phase-tree-order-button phase-icon-button'
      moveUp.title = '上移'
      moveUp.setAttribute(
        'aria-label',
        `上移 Phase ${String(phase.number).padStart(2, '0')}`
      )
      moveUp.append(createPhaseIcon(ArrowUp))
      moveUp.disabled = index === 0
      moveUp.addEventListener('click', () => {
        this.actions.reorderPhase(process.id, sequence.id, phase.id, index - 1)
        this.render()
      })
      const moveDown = this.createButton('', false)
      moveDown.className = 'phase-tree-order-button phase-icon-button'
      moveDown.title = '下移'
      moveDown.setAttribute(
        'aria-label',
        `下移 Phase ${String(phase.number).padStart(2, '0')}`
      )
      moveDown.append(createPhaseIcon(ArrowDown))
      moveDown.disabled = index === sequence.phases.length - 1
      moveDown.addEventListener('click', () => {
        this.actions.reorderPhase(process.id, sequence.id, phase.id, index + 1)
        this.render()
      })
      controls.append(copy, moveUp, moveDown)
      item.addEventListener('dragstart', event => {
        event.dataTransfer?.setData('text/plain', phase.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
        item.classList.add('is-dragging')
      })
      item.addEventListener('dragend', () => {
        this.element
          .querySelectorAll('.phase-tree-item')
          .forEach(element => element.classList.remove('is-dragging', 'is-drag-over'))
      })
      item.addEventListener('dragover', event => {
        event.preventDefault()
        item.classList.add('is-drag-over')
      })
      item.addEventListener('dragleave', () => {
        item.classList.remove('is-drag-over')
      })
      item.addEventListener('drop', event => {
        event.preventDefault()
        const sourcePhaseId = event.dataTransfer?.getData('text/plain')
        if (sourcePhaseId && sourcePhaseId !== phase.id) {
          this.actions.reorderPhase(process.id, sequence.id, sourcePhaseId, index)
          this.render()
        }
      })
      item.append(button, controls)
      list.append(item)
    })
    group.append(row, list)
    return group
  }

  private openPhaseCopyModal(
    process: PhaseWorkspaceState['processes'][number],
    sourceSequence: PhaseWorkspaceState['processes'][number]['sequences'][number],
    sourcePhase: PhaseWorkspaceState['processes'][number]['sequences'][number]['phases'][number],
    trigger: HTMLButtonElement
  ) {
    this.element.querySelector('.phase-operation-modal')?.remove()
    const modal = document.createElement('div')
    modal.className = 'phase-workspace-modal phase-operation-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'phaseOperationModalTitle')
    const dialog = document.createElement('section')
    dialog.className = 'phase-workspace-modal-dialog phase-operation-dialog'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'phaseOperationModalTitle'
    title.textContent = '复制 Phase'
    const close = this.createButton('', false)
    close.className = 'phase-workspace-modal-close phase-icon-button'
    close.setAttribute('aria-label', '关闭对话框')
    close.title = '关闭'
    close.append(createPhaseIcon(X))
    header.append(title, close)

    const form = document.createElement('form')
    form.className = 'phase-workspace-modal-form phase-copy-modal-form'
    const source = document.createElement('input')
    source.readOnly = true
    source.value = `Phase ${String(sourcePhase.number).padStart(2, '0')} · ${sourcePhase.name}`
    source.setAttribute('aria-label', '来源 Phase')
    const target = document.createElement('select')
    target.required = true
    target.setAttribute('aria-label', '目标序列')
    process.sequences.forEach(sequence => {
      target.add(
        new Option(
          `${String(sequence.number).padStart(2, '0')} · ${sequence.name}`,
          sequence.id
        )
      )
    })
    target.value = sourceSequence.id
    const number = document.createElement('input')
    number.type = 'number'
    number.min = '1'
    number.required = true
    number.setAttribute('aria-label', '新 Phase 编号')
    const name = document.createElement('input')
    name.required = true
    name.setAttribute('aria-label', '新 Phase 名称')
    const copySuffix = this.getLocale() === 'zh' ? '副本' : 'Copy'
    name.value = `${sourcePhase.name} ${copySuffix}`
    const setNextNumber = () => {
      const targetSequence = process.sequences.find(
        sequence => sequence.id === target.value
      )
      number.value = String(
        Math.max(0, ...(targetSequence?.phases.map(phase => phase.number) ?? [])) + 1
      )
    }
    setNextNumber()
    target.addEventListener('change', setNextNumber)

    const actions = document.createElement('footer')
    actions.className = 'phase-workspace-modal-actions'
    const cancel = this.createButton('取消', false)
    const submit = this.createButton('复制', true)
    submit.type = 'submit'
    actions.append(cancel, submit)
    form.append(
      this.createModalField('来源 Phase', source),
      this.createFormField('目标序列', target),
      this.createModalField('新 Phase 编号', number),
      this.createModalField('新 Phase 名称', name),
      actions
    )
    dialog.append(header, form)
    modal.append(dialog)
    const closeModal = () => {
      modal.remove()
      trigger.focus()
    }
    close.addEventListener('click', closeModal)
    cancel.addEventListener('click', closeModal)
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal()
    })
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal()
    })
    form.addEventListener('submit', async event => {
      event.preventDefault()
      const phaseNumber = Number(number.value)
      const phaseName = name.value.trim()
      const targetSequence = process.sequences.find(
        sequence => sequence.id === target.value
      )
      if (
        !targetSequence ||
        !phaseName ||
        !Number.isInteger(phaseNumber) ||
        phaseNumber < 1 ||
        targetSequence.phases.some(phase => phase.number === phaseNumber)
      ) return
      submit.disabled = true
      try {
        await this.actions.copyPhase({
          processId: process.id,
          sourceSequenceId: sourceSequence.id,
          sourcePhaseId: sourcePhase.id,
          targetSequenceId: targetSequence.id,
          number: phaseNumber,
          name: phaseName
        })
        modal.remove()
        this.render()
      } finally {
        submit.disabled = false
      }
    })
    this.element.append(modal)
    localizeDom(modal, this.getLocale())
    target.focus()
  }

  private openSequenceEditorModal(
    process: PhaseWorkspaceState['processes'][number],
    mode: 'create' | 'copy' | 'rename',
    trigger: HTMLButtonElement,
    sequence?: PhaseWorkspaceState['processes'][number]['sequences'][number]
  ) {
    this.element.querySelector('.phase-operation-modal')?.remove()
    const modal = document.createElement('div')
    modal.className = 'phase-workspace-modal phase-operation-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'phaseOperationModalTitle')
    const dialog = document.createElement('section')
    dialog.className = 'phase-workspace-modal-dialog phase-operation-dialog'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'phaseOperationModalTitle'
    title.textContent = mode === 'create'
      ? '创建序列'
      : mode === 'copy'
        ? '复制序列'
        : '重命名序列'
    const close = this.createButton('', false)
    close.className = 'phase-workspace-modal-close phase-icon-button'
    close.setAttribute('aria-label', '关闭对话框')
    close.title = '关闭'
    close.append(createPhaseIcon(X))
    header.append(title, close)
    const form = document.createElement('form')
    form.className = 'phase-workspace-modal-form phase-sequence-modal-form'
    const number = document.createElement('input')
    number.type = 'number'
    number.min = '1'
    number.required = true
    number.value = String(
      mode === 'rename'
        ? sequence!.number
        : Math.max(0, ...process.sequences.map(item => item.number)) + 1
    )
    number.setAttribute('aria-label', '序列编号')
    const numberField = this.createModalField('序列编号', number)
    const name = document.createElement('input')
    name.required = true
    name.setAttribute('aria-label', '序列名称')
    const copySuffix = this.getLocale() === 'zh' ? '副本' : 'Copy'
    name.value = mode === 'copy'
      ? `${sequence!.name} ${copySuffix}`
      : mode === 'rename'
        ? sequence!.name
        : ''
    const nameField = this.createModalField('序列名称', name)
    const actions = document.createElement('footer')
    actions.className = 'phase-workspace-modal-actions'
    const cancel = this.createButton('取消', false)
    const submit = this.createButton(
      mode === 'create' ? '创建' : mode === 'copy' ? '复制' : '保存',
      true
    )
    submit.type = 'submit'
    actions.append(cancel, submit)
    form.append(numberField, nameField, actions)
    if (mode === 'rename') numberField.hidden = true
    dialog.append(header, form)
    modal.append(dialog)
    const closeModal = () => {
      modal.remove()
      trigger.focus()
    }
    close.addEventListener('click', closeModal)
    cancel.addEventListener('click', closeModal)
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal()
    })
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal()
    })
    form.addEventListener('submit', event => {
      event.preventDefault()
      const sequenceNumber = Number(number.value)
      const sequenceName = name.value.trim()
      if (!sequenceName || !Number.isInteger(sequenceNumber) || sequenceNumber < 1) return
      if (mode === 'create') {
        this.actions.createSequence({
          processId: process.id,
          number: sequenceNumber,
          name: sequenceName
        })
      } else if (mode === 'copy') {
        this.actions.copySequence({
          processId: process.id,
          sequenceId: sequence!.id,
          number: sequenceNumber,
          name: sequenceName
        })
      } else {
        this.actions.renameSequence(process.id, sequence!.id, sequenceName)
      }
      modal.remove()
      this.render()
    })
    this.element.append(modal)
    localizeDom(modal, this.getLocale())
    ;(mode === 'rename' ? name : number).focus()
    if (mode === 'rename') name.select()
  }

  private openSequenceDelete(
    processId: string,
    sequence: PhaseWorkspaceState['processes'][number]['sequences'][number],
    trigger: HTMLButtonElement
  ) {
    this.openDeleteConfirmation({
      title: '删除序列？',
      description: `此操作将永久删除该序列及其 ${sequence.phases.length} 个 Phase，无法撤销。`,
      target: `${String(sequence.number).padStart(2, '0')} · ${sequence.name}`,
      trigger,
      onConfirm: () => this.actions.deleteSequence(processId, sequence.id)
    })
  }

  private createModalField(labelText: string, input: HTMLInputElement) {
    const label = document.createElement('label')
    label.className = 'phase-modal-field'
    const text = document.createElement('span')
    text.textContent = labelText
    label.append(text, input)
    return label
  }

  private openDeleteConfirmation(options: {
    title: string
    description: string
    target: string
    trigger: HTMLButtonElement
    onConfirm: () => Promise<void>
  }) {
    this.element.querySelector('.phase-operation-modal')?.remove()
    const modal = document.createElement('div')
    modal.className = 'phase-workspace-modal phase-operation-modal'
    modal.setAttribute('role', 'alertdialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'phaseOperationModalTitle')
    modal.setAttribute('aria-describedby', 'phaseOperationModalDescription')
    const dialog = document.createElement('section')
    dialog.className = 'phase-workspace-modal-dialog phase-delete-dialog'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'phaseOperationModalTitle'
    title.textContent = options.title
    const close = this.createButton('', false)
    close.className = 'phase-workspace-modal-close phase-icon-button'
    close.setAttribute('aria-label', '关闭删除确认对话框')
    close.title = '关闭'
    close.append(createPhaseIcon(X))
    header.append(title, close)
    const body = document.createElement('div')
    body.className = 'phase-delete-dialog-body'
    const warningIcon = createPhaseIcon(TriangleAlert, 'phase-delete-warning-icon')
    const message = document.createElement('div')
    const description = document.createElement('p')
    description.id = 'phaseOperationModalDescription'
    description.textContent = options.description
    const target = document.createElement('strong')
    target.className = 'phase-delete-target'
    target.textContent = options.target
    message.append(description, target)
    body.append(warningIcon, message)
    const actions = document.createElement('footer')
    actions.className = 'phase-workspace-modal-actions phase-delete-actions'
    const cancel = this.createButton('取消', false)
    const confirm = this.createButton('确认删除', false)
    confirm.className = 'phase-delete-confirm'
    actions.append(cancel, confirm)
    dialog.append(header, body, actions)
    modal.append(dialog)
    const closeModal = () => {
      modal.remove()
      options.trigger.focus()
    }
    close.addEventListener('click', closeModal)
    cancel.addEventListener('click', closeModal)
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal()
    })
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal()
    })
    confirm.addEventListener('click', async () => {
      confirm.disabled = true
      cancel.disabled = true
      close.disabled = true
      try {
        await options.onConfirm()
        modal.remove()
        this.render()
      } finally {
        confirm.disabled = false
        cancel.disabled = false
        close.disabled = false
      }
    })
    this.element.append(modal)
    localizeDom(modal, this.getLocale())
    confirm.focus()
  }

  private createIconButton(
    label: string,
    icon: Parameters<typeof createPhaseIcon>[0],
    action: (button: HTMLButtonElement) => void,
    disabled = false
  ) {
    const button = this.createButton('', false)
    button.className = 'phase-icon-button'
    button.title = label
    button.setAttribute('aria-label', label)
    button.disabled = disabled
    button.append(createPhaseIcon(icon))
    button.addEventListener('click', () => action(button))
    return button
  }

  private createOverview(
    processId: string,
    sequence: PhaseWorkspaceState['processes'][number]['sequences'][number],
    phase: PhaseWorkspaceState['processes'][number]['sequences'][number]['phases'][number]
  ) {
    const block = this.createBlock('当前阶段概览')
    block.classList.add('phase-overview-card')
    const source = sequence.phases.find(item => item.id === phase.sourcePhaseId)
    const identity = document.createElement('div')
    identity.className = 'phase-overview-identity'
    const identityHeader = document.createElement('div')
    identityHeader.className = 'phase-overview-identity-header'
    const deletePhase = this.createButton('', false)
    deletePhase.className = 'phase-overview-delete phase-icon-button'
    deletePhase.title = '删除 Phase'
    deletePhase.setAttribute('aria-label', '删除 Phase')
    deletePhase.setAttribute('aria-haspopup', 'dialog')
    const deleteIcon = createPhaseIcon(Trash2, 'phase-delete-icon')
    deletePhase.append(deleteIcon)
    const identityName = document.createElement('strong')
    identityName.textContent = phase.name
    const identityActions = document.createElement('div')
    identityActions.className = 'phase-overview-identity-actions'
    const editPhaseName = this.createButton('', false)
    editPhaseName.className = 'phase-overview-edit phase-icon-button'
    editPhaseName.title = '修改阶段名称'
    editPhaseName.setAttribute('aria-label', '修改阶段名称')
    editPhaseName.append(this.createEditIcon())
    identityActions.append(identityName, editPhaseName)
    identityHeader.append(identityActions, deletePhase)
    identity.append(identityHeader)
    const details = document.createElement('dl')
    details.className = 'phase-workspace-overview'
    const drawing = document.createElement('div')
    drawing.className = 'phase-overview-drawing'
    const drawingName = document.createElement('span')
    drawingName.className = 'phase-overview-drawing-name'
    drawingName.textContent =
      phase.drawing.kind === 'assigned'
        ? phase.drawing.displayName
        : '未关联图纸'
    drawingName.title = drawingName.textContent
    const edit = this.createButton('', false)
    edit.className = 'phase-overview-edit phase-icon-button'
    edit.title = '重命名图纸'
    edit.setAttribute('aria-label', '重命名图纸')
    edit.hidden = phase.drawing.kind !== 'assigned'
    edit.append(this.createEditIcon())
    const associate = this.createButton(
      phase.drawing.kind === 'assigned' ? '更换图纸' : '关联图纸',
      false
    )
    associate.setAttribute('aria-haspopup', 'dialog')
    drawing.append(drawingName, edit, associate)
    this.addDetail(details, '图纸', drawing)
    this.addDetail(
      details,
      '来源',
      source
        ? `Phase ${String(source.number).padStart(2, '0')} · ${source.name}`
        : '新图纸'
    )
    const status = document.createElement('div')
    status.className = 'phase-overview-statuses'
    const process = this.getState().processes.find(item => item.id === processId)!
    status.append(
      this.createStatusBadge(`${phase.flowState.flowPaths.length} 条流路`),
      this.createStatusBadge(`${process.presentationProfile.utilities.length} 个 Utility`),
      this.createStatusBadge(`${process.presentationProfile.defaultFlowStyle.lineWidthPx} px 默认线宽`),
      this.createStatusBadge(`${Object.keys(phase.deviceStates).length} 个设备`)
    )
    this.addDetail(details, '状态', status)
    edit.addEventListener('click', () => {
      const editor = document.createElement('div')
      editor.className = 'phase-overview-rename'
      const rename = document.createElement('input')
      if (phase.drawing.kind !== 'assigned') return
      rename.value = phase.drawing.displayName
      rename.setAttribute('aria-label', '图纸显示名')
      const save = this.createButton('保存', true)
      const cancel = this.createButton('取消', false)
      save.addEventListener('click', () => {
        if (!rename.value.trim()) return
        this.actions.renameDrawing(processId, sequence.id, phase.id, rename.value)
        this.render()
      })
      cancel.addEventListener('click', () => editor.replaceWith(drawing))
      editor.append(rename, cancel, save)
      drawing.replaceWith(editor)
      rename.focus()
      rename.select()
    })
    editPhaseName.addEventListener('click', () => {
      const editor = document.createElement('div')
      editor.className = 'phase-overview-rename'
      const rename = document.createElement('input')
      rename.value = phase.name
      rename.setAttribute('aria-label', '阶段名称')
      const save = this.createButton('保存', true)
      const cancel = this.createButton('取消', false)
      save.addEventListener('click', () => {
        if (!rename.value.trim()) return
        this.actions.renamePhase(processId, sequence.id, phase.id, rename.value)
        this.render()
      })
      cancel.addEventListener('click', () => editor.replaceWith(identityActions))
      editor.append(rename, cancel, save)
      identityActions.replaceWith(editor)
      rename.focus()
      rename.select()
    })
    const deleteModal = document.createElement('div')
    deleteModal.className = 'phase-workspace-modal phase-delete-modal'
    deleteModal.hidden = true
    deleteModal.setAttribute('role', 'alertdialog')
    deleteModal.setAttribute('aria-modal', 'true')
    deleteModal.setAttribute('aria-labelledby', 'phaseDeleteModalTitle')
    deleteModal.setAttribute('aria-describedby', 'phaseDeleteModalDescription')
    const deleteDialog = document.createElement('section')
    deleteDialog.className = 'phase-workspace-modal-dialog phase-delete-dialog'
    const deleteDialogHeader = document.createElement('header')
    const deleteTitle = document.createElement('h2')
    deleteTitle.id = 'phaseDeleteModalTitle'
    deleteTitle.textContent = '删除 Phase？'
    const closeDelete = this.createButton('', false)
    closeDelete.className = 'phase-workspace-modal-close phase-icon-button'
    closeDelete.setAttribute('aria-label', '关闭删除确认对话框')
    closeDelete.title = '关闭'
    closeDelete.append(createPhaseIcon(X))
    deleteDialogHeader.append(deleteTitle, closeDelete)
    const deleteBody = document.createElement('div')
    deleteBody.className = 'phase-delete-dialog-body'
    const warningIcon = createPhaseIcon(
      TriangleAlert,
      'phase-delete-warning-icon'
    )
    const deleteMessage = document.createElement('div')
    const deleteDescription = document.createElement('p')
    deleteDescription.id = 'phaseDeleteModalDescription'
    deleteDescription.textContent = '此操作将永久删除该 Phase 及其已保存状态，无法撤销。'
    const deleteTarget = document.createElement('strong')
    deleteTarget.className = 'phase-delete-target'
    deleteTarget.textContent = `Phase ${String(phase.number).padStart(2, '0')} · ${phase.name}`
    deleteMessage.append(deleteDescription, deleteTarget)
    deleteBody.append(warningIcon, deleteMessage)
    const deleteActions = document.createElement('footer')
    deleteActions.className = 'phase-workspace-modal-actions phase-delete-actions'
    const cancelDelete = this.createButton('取消', false)
    const confirmDelete = this.createButton('确认删除', false)
    confirmDelete.className = 'phase-delete-confirm'
    deleteActions.append(cancelDelete, confirmDelete)
    deleteDialog.append(deleteDialogHeader, deleteBody, deleteActions)
    deleteModal.append(deleteDialog)
    const closeDeleteModal = () => {
      deleteModal.hidden = true
      deletePhase.focus()
    }
    deletePhase.addEventListener('click', () => {
      deleteModal.hidden = false
      confirmDelete.focus()
    })
    closeDelete.addEventListener('click', closeDeleteModal)
    cancelDelete.addEventListener('click', closeDeleteModal)
    deleteModal.addEventListener('click', event => {
      if (event.target === deleteModal) closeDeleteModal()
    })
    deleteModal.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeDeleteModal()
    })
    confirmDelete.addEventListener('click', async () => {
      confirmDelete.disabled = true
      cancelDelete.disabled = true
      try {
        await this.actions.deletePhase(processId, sequence.id, phase.id)
        this.render()
      } finally {
        confirmDelete.disabled = false
        cancelDelete.disabled = false
      }
    })
    this.createDrawingAssociationModal(
      processId,
      sequence.id,
      phase.id,
      phase.drawing.kind === 'assigned' ? phase.drawing.displayName : '',
      associate
    )
    block.append(identity, details, deleteModal)
    return block
  }

  private createDrawingAssociationModal(
    processId: string,
    sequenceId: string,
    phaseId: string,
    currentDisplayName: string,
    trigger: HTMLButtonElement
  ) {
    const modal = document.createElement('div')
    modal.className = 'phase-workspace-modal phase-drawing-association-modal'
    modal.hidden = true
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', `phaseDrawingModalTitle-${phaseId}`)
    const dialog = document.createElement('section')
    dialog.className =
      'phase-workspace-modal-dialog phase-drawing-association-dialog'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = `phaseDrawingModalTitle-${phaseId}`
    title.textContent = currentDisplayName ? '更换关联图纸' : '关联图纸'
    const close = this.createButton('', false)
    close.className = 'phase-workspace-modal-close phase-icon-button'
    close.setAttribute('aria-label', '关闭关联图纸对话框')
    close.title = '关闭'
    close.append(createPhaseIcon(X))
    header.append(title, close)

    const form = document.createElement('form')
    form.className = 'phase-workspace-modal-form phase-drawing-association-form'
    const source = document.createElement('select')
    source.setAttribute('aria-label', '图纸关联方式')
    const state = this.getState()
    const projectFileIds = new Set(this.getProjectFileIds())
    const projectDrawings = Object.values(state.drawingAssets).flatMap(drawing => {
      const match = /^file:(\d+)$/.exec(drawing.id)
      const fileId = match ? Number(match[1]) : undefined
      return fileId && projectFileIds.has(fileId) ? [{ fileId, drawing }] : []
    })
    const markedSources = this.getState().processes.flatMap(process =>
      process.sequences.flatMap(sequence =>
        sequence.phases.flatMap(phase =>
          phase.id !== phaseId &&
          phase.drawing.kind === 'assigned' &&
          projectFileIds.has(
            Number(/^file:(\d+)$/.exec(phase.drawing.assetId)?.[1])
          )
            ? [{ process, sequence, phase }]
            : []
        )
      )
    )
    source.add(new Option('使用 Project PID', 'project'))
    if (markedSources.length > 0) {
      source.add(new Option('使用任意已标记 Phase 的图纸', 'marked'))
    }
    const projectDrawing = document.createElement('select')
    projectDrawing.setAttribute('aria-label', 'Project PID')
    projectDrawing.add(new Option('请选择 Project PID', ''))
    projectDrawings.forEach(({ fileId, drawing }) => {
      projectDrawing.add(new Option(drawing.sourceName, String(fileId)))
    })
    const displayName = document.createElement('input')
    displayName.value = currentDisplayName
    displayName.placeholder = '图纸显示名'
    displayName.setAttribute('aria-label', '关联图纸显示名')
    const markedPhase = document.createElement('select')
    markedPhase.setAttribute('aria-label', '已标记 Phase')
    markedSources.forEach(({ process, sequence, phase }, index) => {
      markedPhase.add(
        new Option(
          `${process.name} / 序列 ${String(sequence.number).padStart(2, '0')} ${
            sequence.name
          } / Phase ${String(phase.number).padStart(2, '0')} ${phase.name} / ${
            phase.drawing.kind === 'assigned' ? phase.drawing.displayName : ''
          }`,
          String(index)
        )
      )
    })
    const sourceField = this.createFormField('关联方式', source)
    const projectDrawingField = this.createFormField('Project PID', projectDrawing)
    const markedPhaseField = this.createFormField('已标记 Phase', markedPhase)
    const displayNameField = this.createFormField('图纸显示名', displayName)
    sourceField.classList.add('phase-drawing-source-field')
    displayNameField.classList.add('phase-drawing-name-field')
    const footer = document.createElement('footer')
    footer.className = 'phase-workspace-modal-actions'
    const cancel = this.createButton('取消', false)
    const submit = this.createButton(
      currentDisplayName ? '确认更换' : '确认关联',
      true
    )
    submit.type = 'submit'
    footer.append(cancel, submit)
    form.append(
      sourceField,
      projectDrawingField,
      markedPhaseField,
      displayNameField,
      footer
    )
    dialog.append(header, form)
    modal.append(dialog)

    const closeModal = () => {
      modal.hidden = true
      trigger.focus()
    }
    trigger.addEventListener('click', () => {
      modal.hidden = false
      source.focus()
    })
    close.addEventListener('click', closeModal)
    cancel.addEventListener('click', closeModal)
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal()
    })
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal()
    })
    const syncFields = () => {
      projectDrawingField.hidden = source.value !== 'project'
      markedPhaseField.hidden = source.value !== 'marked'
      if (source.value === 'marked') {
        const markedSource = markedSources[Number(markedPhase.value)]
        if (markedSource?.phase.drawing.kind === 'assigned') {
          displayName.value = markedSource.phase.drawing.displayName
        }
      }
      submit.disabled =
        source.value === 'project'
          ? !projectDrawing.value
          : markedSources.length === 0
    }
    source.addEventListener('change', syncFields)
    projectDrawing.addEventListener('change', () => {
      const selected = projectDrawings.find(
        item => item.fileId === Number(projectDrawing.value)
      )
      if (selected) displayName.value = selected.drawing.sourceName
      syncFields()
    })
    markedPhase.addEventListener('change', syncFields)
    form.addEventListener('submit', async event => {
      event.preventDefault()
      if (source.value === 'project' && !projectDrawing.value) return
      if (source.value === 'marked' && markedSources.length === 0) return
      submit.disabled = true
      try {
        const markedSource =
          source.value === 'marked'
            ? markedSources[Number(markedPhase.value)]
            : undefined
        await this.actions.associateDrawing({
          processId,
          sequenceId,
          phaseId,
          sourceKind: source.value as DrawingAssociationRequest['sourceKind'],
          fileId:
            source.value === 'project' ? Number(projectDrawing.value) : undefined,
          sourceProcessId: markedSource?.process.id,
          sourceSequenceId: markedSource?.sequence.id,
          sourcePhaseId: markedSource?.phase.id,
          drawingDisplayName:
            markedSource?.phase.drawing.kind === 'assigned'
              ? markedSource.phase.drawing.displayName
              : displayName.value
        })
        this.render()
      } finally {
        submit.disabled = false
      }
    })
    syncFields()
    this.drawingAssociationModals.add(modal)
    document.body.append(modal)
    localizeDom(modal, this.getLocale())
  }

  private createPhaseControls(
    processId: string,
    sequence: PhaseWorkspaceState['processes'][number]['sequences'][number]
  ) {
    const fragment = document.createDocumentFragment()
    const block = this.createBlock('创建阶段')
    block.classList.add('phase-create-section')
    const description = document.createElement('p')
    description.textContent = '可先创建 Phase，之后再关联图纸，也可复制历史状态或直接使用图纸。'
    const open = this.createButton('创建 Phase', true)
    open.setAttribute('aria-haspopup', 'dialog')

    const modal = document.createElement('div')
    modal.className = 'phase-workspace-modal'
    modal.hidden = true
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'phaseWorkspaceModalTitle')
    const dialog = document.createElement('section')
    dialog.className = 'phase-workspace-modal-dialog'
    const header = document.createElement('header')
    const title = document.createElement('h2')
    title.id = 'phaseWorkspaceModalTitle'
    title.textContent = '创建 Phase'
    const close = this.createButton('', false)
    close.className = 'phase-workspace-modal-close phase-icon-button'
    close.setAttribute('aria-label', '关闭创建 Phase 对话框')
    close.title = '关闭'
    close.append(createPhaseIcon(X))
    header.append(title, close)

    const form = document.createElement('form')
    form.className = 'phase-workspace-modal-form phase-create-form'
    const number = document.createElement('input')
    number.type = 'number'
    number.min = '1'
    number.value = String(
      Math.max(0, ...sequence.phases.map(phase => phase.number)) + 1
    )
    number.setAttribute('aria-label', '阶段编号')
    const name = document.createElement('input')
    name.placeholder = '阶段名称'
    name.setAttribute('aria-label', '阶段名称')
    const source = document.createElement('select')
    source.setAttribute('aria-label', '阶段创建方式')
    const state = this.getState()
    const projectFileIds = new Set(this.getProjectFileIds())
    const projectDrawings = Object.values(state.drawingAssets).flatMap(drawing => {
      const match = /^file:(\d+)$/.exec(drawing.id)
      const fileId = match ? Number(match[1]) : undefined
      return fileId && projectFileIds.has(fileId) ? [{ fileId, drawing }] : []
    })
    if (sequence.phases.length > 0) {
      source.add(new Option('使用上一阶段的已标记图纸', 'previous'))
      source.add(new Option('使用任意历史阶段的已标记图纸', 'history'))
    }
    source.add(new Option('稍后关联图纸', 'unassigned'))
    source.add(new Option('使用 Project PID', 'project'))
    const projectDrawing = document.createElement('select')
    projectDrawing.setAttribute('aria-label', 'Project PID')
    projectDrawing.add(new Option('请选择 Project PID', ''))
    projectDrawings.forEach(({ fileId, drawing }) => {
      projectDrawing.add(new Option(drawing.sourceName, String(fileId)))
    })
    const history = document.createElement('select')
    history.setAttribute('aria-label', '历史阶段')
    sequence.phases.forEach(phase => {
      history.add(
        new Option(
          `Phase ${phase.number} · ${phase.name} · ${
            phase.drawing.kind === 'assigned'
              ? phase.drawing.displayName
              : '未关联图纸'
          }`,
          phase.id
        )
      )
    })
    const file = document.createElement('input')
    file.type = 'file'
    file.accept = '.dwg,.dxf'
    file.setAttribute('aria-label', '本地图纸')
    const url = document.createElement('input')
    url.type = 'url'
    url.placeholder = 'https://example.com/drawing.dxf'
    url.setAttribute('aria-label', '图纸 URL')
    const displayName = document.createElement('input')
    displayName.placeholder = '图纸显示名'
    displayName.setAttribute('aria-label', '新图纸显示名')
    const identityFields = document.createElement('div')
    identityFields.className = 'phase-modal-field-grid'
    identityFields.append(
      this.createFormField('阶段编号', number),
      this.createFormField('阶段名称', name)
    )
    const sourceField = this.createFormField('创建方式', source)
    const projectDrawingField = this.createFormField('Project PID', projectDrawing)
    const historyField = this.createFormField('历史阶段', history)
    const fileField = this.createFormField('本地图纸', file)
    const urlField = this.createFormField('图纸 URL', url)
    const displayNameField = this.createFormField('图纸显示名', displayName)
    const actions = document.createElement('footer')
    actions.className = 'phase-workspace-modal-actions'
    const cancel = this.createButton('取消', false)
    const submit = this.createButton('创建 Phase', true)
    submit.type = 'submit'
    const closeModal = () => {
      modal.hidden = true
      open.focus()
    }
    const openModal = () => {
      modal.hidden = false
      name.focus()
    }
    open.addEventListener('click', openModal)
    close.addEventListener('click', closeModal)
    cancel.addEventListener('click', closeModal)
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal()
    })
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal()
    })
    const syncSourceFields = () => {
      projectDrawingField.hidden = source.value !== 'project'
      historyField.hidden = source.value !== 'history'
      fileField.hidden = source.value !== 'local'
      urlField.hidden = source.value !== 'url'
      displayNameField.hidden = source.value === 'unassigned'
      if (source.value === 'previous') {
        const previous = sequence.phases[sequence.phases.length - 1]
        displayName.value =
          previous?.drawing.kind === 'assigned'
            ? previous.drawing.displayName
            : ''
      } else if (source.value === 'history') {
        const historical = sequence.phases.find(phase => phase.id === history.value)
        displayName.value =
          historical?.drawing.kind === 'assigned'
            ? historical.drawing.displayName
            : ''
      } else if (source.value === 'blank' && !displayName.value) {
        displayName.value = `Drawing-Phase-${number.value}.dwg`
      }
      submit.disabled = source.value === 'project' && !projectDrawing.value
    }
    source.addEventListener('change', syncSourceFields)
    projectDrawing.addEventListener('change', () => {
      const selected = projectDrawings.find(
        item => item.fileId === Number(projectDrawing.value)
      )
      if (selected) displayName.value = selected.drawing.sourceName
      syncSourceFields()
    })
    history.addEventListener('change', syncSourceFields)
    file.addEventListener('change', () => {
      if (file.files?.[0]) displayName.value = file.files[0].name
    })
    form.addEventListener('submit', async event => {
      event.preventDefault()
      if (source.value === 'project' && !projectDrawing.value) return
      submit.disabled = true
      try {
        await this.actions.createPhase({
          processId,
          sequenceId: sequence.id,
          number: Number(number.value),
          name: name.value,
          sourceKind: source.value as NewPhaseRequest['sourceKind'],
          sourcePhaseId:
            source.value === 'history' ? history.value || undefined : undefined,
          fileId:
            source.value === 'project' ? Number(projectDrawing.value) : undefined,
          drawingDisplayName: displayName.value,
          file: file.files?.[0],
          url: url.value
        })
        this.render()
      } finally {
        submit.disabled = false
      }
    })
    actions.append(cancel, submit)
    form.append(
      identityFields,
      sourceField,
      projectDrawingField,
      historyField,
      fileField,
      urlField,
      displayNameField,
      actions
    )
    dialog.append(header, form)
    modal.append(dialog)
    block.append(description, open)
    fragment.append(block, modal)
    syncSourceFields()
    return fragment
  }

  private createBlock(titleText: string) {
    const block = document.createElement('section')
    block.className = 'phase-workspace-block'
    const title = document.createElement('h3')
    title.textContent = titleText
    block.append(title)
    return block
  }

  private createButton(label: string, primary: boolean) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.className = primary ? 'phase-workspace-primary' : ''
    return button
  }

  private createStatusBadge(label: string) {
    const badge = document.createElement('span')
    badge.className = 'phase-status-badge'
    badge.textContent = label
    return badge
  }

  private createEditIcon() {
    return createPhaseIcon(Pencil, 'phase-edit-icon')
  }

  private createFormField(labelText: string, control: HTMLElement) {
    const field = document.createElement('label')
    field.className = 'phase-modal-field'
    const label = document.createElement('span')
    label.textContent = labelText
    field.append(label, control)
    return field
  }

  private addDetail(list: HTMLDListElement, term: string, value: string | HTMLElement) {
    const row = document.createElement('div')
    row.className = 'phase-overview-row'
    const dt = document.createElement('dt')
    dt.textContent = term
    const dd = document.createElement('dd')
    if (typeof value === 'string') dd.textContent = value
    else dd.append(value)
    row.append(dt, dd)
    list.append(row)
  }
}