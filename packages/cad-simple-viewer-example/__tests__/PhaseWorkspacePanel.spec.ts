/** @jest-environment jsdom */

import {
  PhaseWorkspacePanel,
  type PhaseWorkspacePanelActions
} from '../src/phase/PhaseWorkspacePanel'
import { PhaseWorkspaceStore } from '../src/phase/phaseWorkspaceStore'

const createHarness = (locale: 'en' | 'zh' = 'zh') => {
  let id = 0
  const store = new PhaseWorkspaceStore(
    undefined,
    () => `id-${++id}`,
    () => '2026-08-11T00:00:00.000Z'
  )
  const actions: PhaseWorkspacePanelActions = {
    createProcess: name => {
      store.createProcess(name)
    },
    deleteProcess: jest.fn(async processId => {
      store.deleteProcess(processId)
    }),
    createSequence: jest.fn(request => {
      store.createSequence(request.processId, request.number, request.name)
    }),
    copySequence: jest.fn(request => {
      store.copySequence(
        request.processId,
        request.sequenceId,
        request.number,
        request.name
      )
    }),
    renameSequence: jest.fn((processId, sequenceId, name) => {
      store.renameSequence(processId, sequenceId, name)
    }),
    deleteSequence: jest.fn(async (processId, sequenceId) => {
      store.deleteSequence(processId, sequenceId)
    }),
    reorderSequence: jest.fn((processId, sequenceId, targetIndex) => {
      store.reorderSequence(processId, sequenceId, targetIndex)
    }),
    activateSequence: jest.fn(async (processId, sequenceId) => {
      store.activate(processId, sequenceId)
    }),
    createPhase: jest.fn(async () => undefined),
    copyPhase: jest.fn(async () => undefined),
    associateDrawing: jest.fn(async () => undefined),
    activateProcess: jest.fn(async () => undefined),
    activatePhase: jest.fn(async () => undefined),
    reorderPhase: jest.fn(),
    renamePhase: jest.fn((processId, sequenceId, phaseId, name) => {
      store.renamePhase(processId, sequenceId, phaseId, name)
    }),
    deletePhase: jest.fn(async () => undefined),
    renameDrawing: jest.fn()
  }
  const panel = new PhaseWorkspacePanel(
    () => store.snapshot(),
    actions,
    () => locale
  )
  document.body.append(panel.element)
  return { store, panel, actions }
}

describe('PhaseWorkspacePanel', () => {
  afterEach(() => document.body.replaceChildren())

  it('starts empty and allows creating the first process', () => {
    const { store, panel } = createHarness()
    const name = panel.element.querySelector<HTMLInputElement>(
      '[aria-label="工艺名称"]'
    )
    const button = [...panel.element.querySelectorAll('button')].find(
      item => item.textContent === '创建工艺'
    )
    expect(panel.element.textContent).toContain('工作区当前为空')

    name!.value = 'CIP'
    button!.click()

    expect(store.snapshot().processes[0].name).toBe('CIP')
    expect(panel.element.textContent).toContain('此工艺尚无阶段')
  })

  it('renders workspace controls in English without translating business names', () => {
    const { store, panel } = createHarness('en')
    store.createProcess('CIP Main')
    panel.render()

    expect(panel.element.textContent).toContain('PROCESS STRUCTURE')
    expect(panel.element.textContent).toContain('Create Phase')
    expect(panel.element.textContent).toContain('CIP Main')
    expect(
      panel.element.querySelector('[aria-label="Add sequence"]')
    ).not.toBeNull()
  })

  it('deletes the selected process through a dedicated confirmation dialog', async () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('SIP')
    panel.render()
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true)

    const deleteButton = panel.element.querySelector<HTMLButtonElement>(
      '[aria-label="删除当前工艺"]'
    )!
    deleteButton.click()
    const modal = panel.element.querySelector<HTMLElement>(
      '.phase-operation-modal[role="alertdialog"]'
    )!

    expect(modal.textContent).toContain('删除工艺？')
    expect(modal.textContent).toContain('SIP')
    expect(modal.textContent).toContain('1 个序列和 0 个 Phase')
    expect(confirm).not.toHaveBeenCalled()
    ;[...modal.querySelectorAll('button')]
      .find(button => button.textContent === '取消')!
      .click()
    expect(actions.deleteProcess).not.toHaveBeenCalled()

    deleteButton.click()
    ;[...panel.element.querySelectorAll<HTMLButtonElement>('.phase-operation-modal button')]
      .find(button => button.textContent === '确认删除')!
      .click()
    await Promise.resolve()

    expect(actions.deleteProcess).toHaveBeenCalledWith(process.id)
    expect(store.snapshot().processes).toEqual([])
    confirm.mockRestore()
  })

  it('allows cancelling creation of an additional process', () => {
    const { store, panel } = createHarness()
    store.createProcess('SIP')
    panel.render()

    panel.element
      .querySelector<HTMLButtonElement>('[aria-label="新增工艺"]')!
      .click()
    const input = panel.element.querySelector<HTMLInputElement>(
      '[aria-label="新工艺名称"]'
    )!
    input.value = 'CIP'
    panel.element
      .querySelector<HTMLButtonElement>('[aria-label="取消新增工艺"]')!
      .click()

    expect(panel.element.querySelector('[aria-label="新工艺名称"]')).toBeNull()
    expect(store.snapshot().processes).toHaveLength(1)
    expect(document.activeElement).toBe(
      panel.element.querySelector('[aria-label="新增工艺"]')
    )
  })

  it('offers copy sources only after a historical phase exists', () => {
    const { store, panel } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    panel.render()
    const openModal = [...panel.element.querySelectorAll('button')].find(
      item => item.textContent === '创建 Phase'
    )!
    openModal.click()
    expect(
      panel.element.querySelector('[role="dialog"]')?.hasAttribute('hidden')
    ).toBe(false)
    const source = panel.element.querySelector<HTMLSelectElement>(
      '[aria-label="阶段创建方式"]'
    )!
    expect([...source.options].map(option => option.value)).toEqual([
      'unassigned',
      'local',
      'url',
      'blank'
    ])

    store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: '初始阶段',
      source: {
        kind: 'new',
        drawing: {
          id: 'drawing-1',
          kind: 'blank',
          sourceName: 'PID-0001.dwg'
        },
        displayName: 'PID-0001.dwg'
      }
    })
    panel.render()
    ;[...panel.element.querySelectorAll('button')]
      .find(item => item.textContent === '创建 Phase')!
      .click()
    const nextSource = panel.element.querySelector<HTMLSelectElement>(
      '[aria-label="阶段创建方式"]'
    )!
    expect([...nextSource.options].map(option => option.value)).toEqual([
      'previous',
      'history',
      'unassigned',
      'local',
      'url',
      'blank'
    ])
  })

  it('renders phases as a collapsible tree with structured overview', () => {
    const { store, panel } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: '清洗准备',
      source: {
        kind: 'new',
        drawing: {
          id: 'drawing-1',
          kind: 'blank',
          sourceName: 'PID-0001.dwg'
        },
        displayName: 'PID-0001.dwg'
      }
    })
    panel.render()

    const tree = panel.element.querySelector('[role="tree"]') as HTMLElement
    const toggle = panel.element.querySelector(
      '.phase-tree-header'
    ) as HTMLButtonElement
    expect(tree.querySelectorAll('[role="treeitem"]')).toHaveLength(1)
    expect(panel.element.querySelector('.phase-overview-row')?.textContent).toContain(
      '图纸'
    )

    toggle.click()

    expect(
      (panel.element.querySelector('[role="tree"]') as HTMLElement).hidden
    ).toBe(true)
  })

  it('shows the active Phase style summary without an inline style action', () => {
    const { store, panel } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'Rinse',
      source: { kind: 'unassigned' }
    })
    panel.render()

    expect(panel.element.textContent).toContain('0 条流路')
    expect(panel.element.textContent).toContain('3 px 默认线宽')
    expect(panel.element.querySelector('[aria-label="高亮样式"]')).toBeNull()
  })

  it('maintains expanded state independently for each sequence', async () => {
    const { store, panel } = createHarness()
    const process = store.createProcess('CIP')
    const first = process.sequences[0]
    const second = store.createSequence(process.id, 2, '乳化罐清洗')
    store.activate(process.id, first.id)
    panel.render()

    const firstToggle = panel.element.querySelector<HTMLButtonElement>(
      `[aria-label="折叠序列 ${first.number}"]`
    )!
    const secondToggle = panel.element.querySelector<HTMLButtonElement>(
      `[aria-label="展开序列 ${second.number}"]`
    )!
    firstToggle.click()
    secondToggle.click()
    await Promise.resolve()

    expect(
      panel.element.querySelector(`[aria-label="${first.name} 的阶段"]`)?.hasAttribute('hidden')
    ).toBe(true)
    expect(
      panel.element.querySelector(`[aria-label="${second.name} 的阶段"]`)?.hasAttribute('hidden')
    ).toBe(false)
  })

  it('emits sequence action payloads', async () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    panel.render()

    panel.element.querySelector<HTMLButtonElement>('[aria-label="新增序列"]')!.click()
    panel.element.querySelector<HTMLInputElement>('[aria-label="序列编号"]')!.value = '2'
    panel.element.querySelector<HTMLInputElement>('[aria-label="序列名称"]')!.value = '回流清洗'
    panel.element.querySelector<HTMLFormElement>('.phase-sequence-modal-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(actions.createSequence).toHaveBeenCalledWith({
      processId: process.id,
      number: 2,
      name: '回流清洗'
    })

    const prompt = jest.spyOn(window, 'prompt')
    const confirm = jest.spyOn(window, 'confirm')
    panel.element.querySelector<HTMLButtonElement>('[aria-label="复制序列"]')!.click()
    expect(panel.element.querySelector('.phase-operation-modal')?.textContent)
      .toContain('复制序列')
    panel.element.querySelector<HTMLInputElement>('[aria-label="序列编号"]')!.value = '3'
    panel.element.querySelector<HTMLInputElement>('[aria-label="序列名称"]')!.value = '默认序列副本'
    panel.element.querySelector<HTMLFormElement>('.phase-sequence-modal-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(actions.copySequence).toHaveBeenCalledWith({
      processId: process.id,
      sequenceId: sequence.id,
      number: 3,
      name: '默认序列副本'
    })
    panel.element.querySelector<HTMLButtonElement>('[aria-label="重命名序列"]')!.click()
    const rename = panel.element.querySelector<HTMLInputElement>(
      '[aria-label="序列名称"]'
    )!
    rename.value = '默认序列重命名'
    panel.element.querySelector<HTMLFormElement>('.phase-sequence-modal-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(actions.renameSequence).toHaveBeenCalledWith(
      process.id,
      sequence.id,
      '默认序列重命名'
    )

    panel.element.querySelector<HTMLButtonElement>('[aria-label="删除序列"]')!.click()
    const deleteModal = panel.element.querySelector<HTMLElement>(
      '.phase-operation-modal[role="alertdialog"]'
    )!
    expect(deleteModal.textContent).toContain('删除序列？')
    expect(deleteModal.textContent).toContain('01 · 默认序列重命名')
    ;[...deleteModal.querySelectorAll('button')]
      .find(button => button.textContent === '确认删除')!
      .click()
    await Promise.resolve()
    expect(actions.deleteSequence).toHaveBeenCalledWith(process.id, sequence.id)
    expect(prompt).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    prompt.mockRestore()
    confirm.mockRestore()
  })

  it('creates a phase in the active selected sequence with its next number', () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = store.createSequence(process.id, 2, '配液罐清洗')
    store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 4,
      name: '预冲洗',
      source: {
        kind: 'new',
        drawing: { id: 'drawing-1', kind: 'blank', sourceName: 'PID.dwg' },
        displayName: 'PID.dwg'
      }
    })
    panel.render()
    ;[...panel.element.querySelectorAll('button')]
      .find(button => button.textContent === '创建 Phase')!
      .click()

    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="阶段编号"]')!.value)
      .toBe('5')
    panel.element.querySelector<HTMLInputElement>('[aria-label="阶段名称"]')!.value = '碱洗'
    panel.element.querySelector<HTMLInputElement>('[aria-label="新图纸显示名"]')!.value = 'PID-2.dwg'
    panel.element.querySelector<HTMLSelectElement>('[aria-label="阶段创建方式"]')!.value = 'blank'
    panel.element.querySelector<HTMLFormElement>('.phase-create-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(actions.createPhase).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: process.id,
        sequenceId: sequence.id,
        number: 5,
        name: '碱洗'
      })
    )
  })

  it('copies a Phase to a selected sequence with editable defaults', async () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sourceSequence = process.sequences[0]
    const sourcePhase = store.createPhase({
      processId: process.id,
      sequenceId: sourceSequence.id,
      number: 4,
      name: '预冲洗',
      source: { kind: 'unassigned' }
    })
    const targetSequence = store.createSequence(process.id, 2, '碱洗')
    store.createPhase({
      processId: process.id,
      sequenceId: targetSequence.id,
      number: 7,
      name: '循环',
      source: { kind: 'unassigned' }
    })
    store.activate(process.id, sourceSequence.id, sourcePhase.id)
    panel.render()

    panel.element.querySelector<HTMLButtonElement>('[aria-label="复制 Phase"]')!.click()
    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="来源 Phase"]')!.value)
      .toContain('Phase 04 · 预冲洗')
    expect(panel.element.querySelector<HTMLSelectElement>('[aria-label="目标序列"]')!.value)
      .toBe(sourceSequence.id)
    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 编号"]')!.value)
      .toBe('5')
    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 名称"]')!.value)
      .toBe('预冲洗 副本')

    const target = panel.element.querySelector<HTMLSelectElement>(
      '[aria-label="目标序列"]'
    )!
    target.value = targetSequence.id
    target.dispatchEvent(new Event('change'))
    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 编号"]')!.value)
      .toBe('8')
    panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 编号"]')!.value = '7'
    panel.element.querySelector<HTMLFormElement>('.phase-copy-modal-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(actions.copyPhase).not.toHaveBeenCalled()
    panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 编号"]')!.value = '8'
    panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 名称"]')!.value =
      '预冲洗复制'
    panel.element.querySelector<HTMLFormElement>('.phase-copy-modal-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()

    expect(actions.copyPhase).toHaveBeenCalledWith({
      processId: process.id,
      sourceSequenceId: sourceSequence.id,
      sourcePhaseId: sourcePhase.id,
      targetSequenceId: targetSequence.id,
      number: 8,
      name: '预冲洗复制'
    })
  })

  it('creates a Phase without a drawing and later opens the association flow', () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    panel.render()
    ;[...panel.element.querySelectorAll('button')]
      .find(button => button.textContent === '创建 Phase')!
      .click()
    panel.element.querySelector<HTMLInputElement>('[aria-label="阶段名称"]')!.value =
      '待关联阶段'
    const createSource = panel.element.querySelector<HTMLSelectElement>(
      '[aria-label="阶段创建方式"]'
    )!
    createSource.value = 'unassigned'
    createSource.dispatchEvent(new Event('change'))
    panel.element.querySelector<HTMLFormElement>('.phase-create-form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )
    expect(actions.createPhase).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKind: 'unassigned' })
    )

    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: '待关联阶段',
      source: { kind: 'unassigned' }
    })
    panel.render()

    expect(panel.element.textContent).toContain('未关联图纸')
    const associate = [...panel.element.querySelectorAll('button')].find(
      button => button.textContent === '关联图纸'
    )!
    associate.click()
    const modal = panel.element.querySelector<HTMLElement>(
      '.phase-drawing-association-modal'
    )!
    expect(modal.hidden).toBe(false)
    const source = modal.querySelector<HTMLSelectElement>(
      '[aria-label="图纸关联方式"]'
    )!
    source.value = 'blank'
    source.dispatchEvent(new Event('change'))
    modal.querySelector<HTMLInputElement>(
      '[aria-label="关联图纸显示名"]'
    )!.value = 'PID-later.dwg'
    modal.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )

    expect(actions.associateDrawing).toHaveBeenCalledWith({
      processId: process.id,
      sequenceId: sequence.id,
      phaseId: phase.id,
      sourceKind: 'blank',
      drawingDisplayName: 'PID-later.dwg',
      file: undefined,
      url: ''
    })
  })

  it('associates a Phase with any marked Phase drawing in the workspace', () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sourceSequence = process.sequences[0]
    const sourcePhase = store.createPhase({
      processId: process.id,
      sequenceId: sourceSequence.id,
      number: 1,
      name: '已标记冲洗',
      source: {
        kind: 'new',
        drawing: { id: 'drawing-marked', kind: 'blank', sourceName: 'PID.dwg' },
        displayName: 'PID-marked.dwg'
      }
    })
    const targetSequence = store.createSequence(process.id, 2, '目标序列')
    const targetPhase = store.createPhase({
      processId: process.id,
      sequenceId: targetSequence.id,
      number: 1,
      name: '待关联阶段',
      source: { kind: 'unassigned' }
    })
    panel.render()

    ;[...panel.element.querySelectorAll('button')]
      .find(button => button.textContent === '关联图纸')!
      .click()
    const modal = panel.element.querySelector<HTMLElement>(
      '.phase-drawing-association-modal'
    )!
    const source = modal.querySelector<HTMLSelectElement>(
      '[aria-label="图纸关联方式"]'
    )!
    expect([...source.options].map(option => option.value)).toContain('marked')
    expect(
      modal.querySelector<HTMLSelectElement>('[aria-label="已标记 Phase"]')!
        .options[0].textContent
    ).toContain('CIP / 序列 01 默认序列 / Phase 01 已标记冲洗 / PID-marked.dwg')

    modal.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )

    expect(actions.associateDrawing).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: process.id,
        sequenceId: targetSequence.id,
        phaseId: targetPhase.id,
        sourceKind: 'marked',
        sourceProcessId: process.id,
        sourceSequenceId: sourceSequence.id,
        sourcePhaseId: sourcePhase.id,
        drawingDisplayName: 'PID-marked.dwg'
      })
    )
  })

  it('exposes accessible controls for changing Phase order', () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    for (const number of [1, 2]) {
      store.createPhase({
        processId: process.id,
        sequenceId: sequence.id,
        number,
        name: `Phase ${number}`,
        source: {
          kind: 'new',
          drawing: {
            id: `drawing-${number}`,
            kind: 'blank',
            sourceName: `PID-${number}.dwg`
          },
          displayName: `PID-${number}.dwg`
        }
      })
    }
    panel.render()

    panel.element
      .querySelector<HTMLButtonElement>('[aria-label="下移 Phase 01"]')!
      .click()

    expect(actions.reorderPhase).toHaveBeenCalledWith(
      process.id,
      sequence.id,
      'id-3',
      1
    )
    panel.element.querySelectorAll('.phase-icon-button').forEach(button => {
      expect(button.querySelector('svg.phase-ui-icon')).not.toBeNull()
      expect(button.getAttribute('aria-label')).toBeTruthy()
    })
  })

  it('updates every displayed reference after changing a Phase name', () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: '清洗准备',
      source: {
        kind: 'new',
        drawing: { id: 'drawing-1', kind: 'blank', sourceName: 'PID-0001.dwg' },
        displayName: 'PID-0001.dwg'
      }
    })
    panel.render()

    panel.element
      .querySelector<HTMLButtonElement>('[aria-label="修改阶段名称"]')!
      .click()
    const input = panel.element.querySelector<HTMLInputElement>(
      '[aria-label="阶段名称"]'
    )!
    input.value = '预冲洗'
    ;[...panel.element.querySelectorAll('button')]
      .find(button => button.textContent === '保存')!
      .click()

    expect(actions.renamePhase).toHaveBeenCalledWith(
      process.id,
      sequence.id,
      phase.id,
      '预冲洗'
    )
    expect(panel.element.textContent).not.toContain('清洗准备')
    expect(panel.element.textContent).toContain('预冲洗')

    ;[...panel.element.querySelectorAll('button')]
      .find(button => button.textContent === '创建 Phase')!
      .click()
    const historyOptions = panel.element.querySelector<HTMLSelectElement>(
      '[aria-label="历史阶段"]'
    )!
    expect([...historyOptions.options].map(option => option.textContent)).toEqual([
      'Phase 1 · 预冲洗 · PID-0001.dwg'
    ])
  })

  it('deletes a Phase only through the dedicated confirmation dialog', async () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phase = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: '清洗准备',
      source: {
        kind: 'new',
        drawing: { id: 'drawing-1', kind: 'blank', sourceName: 'PID-0001.dwg' },
        displayName: 'PID-0001.dwg'
      }
    })
    panel.render()
    const deleteButton = panel.element.querySelector<HTMLButtonElement>(
      '[aria-label="删除 Phase"]'
    )!
    expect(deleteButton.textContent).toBe('')
    expect(deleteButton.querySelector('.phase-delete-icon')).not.toBeNull()
    expect(deleteButton.closest('.phase-overview-identity-header')).not.toBeNull()
    const modal = panel.element.querySelector<HTMLElement>('[role="alertdialog"]')!
    expect(modal.hidden).toBe(true)

    deleteButton.click()
    expect(modal.hidden).toBe(false)
    expect(modal.textContent).toContain('Phase 01 · 清洗准备')
    ;[...modal.querySelectorAll('button')]
      .find(button => button.textContent === '取消')!
      .click()
    expect(actions.deletePhase).not.toHaveBeenCalled()
    expect(modal.hidden).toBe(true)

    deleteButton.click()
    ;[...modal.querySelectorAll('button')]
      .find(button => button.textContent === '确认删除')!
      .click()
    await Promise.resolve()

    expect(actions.deletePhase).toHaveBeenCalledWith(
      process.id,
      sequence.id,
      phase.id
    )
  })
})