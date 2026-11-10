/** @jest-environment jsdom */

import {
  PhaseWorkspacePanel,
  type PhaseWorkspacePanelActions,
  type TankWorkspaceBindings
} from '../src/phase/PhaseWorkspacePanel'
import { PhaseWorkspaceStore } from '../src/phase/phaseWorkspaceStore'
import { injectPhaseWorkspaceStyles } from '../src/phase/phaseWorkspaceStyles'

const createHarness = (
  locale: 'en' | 'zh' = 'zh',
  projectFileIds: readonly number[] = [5],
  withTanks = false,
  isPhaseMoveEnabled: () => boolean = () => false
) => {
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
  const tanks: TankWorkspaceBindings = {
    getTanks: () => [
      { id: 'file:5:E65', name: 'Vessel_1', handleKey: 'E65' },
      { id: 'file:5:1B3C', name: 'Vessel_2', handleKey: '1B3C' }
    ],
    locateTank: jest.fn(() => true),
    stopLocatingTank: jest.fn(),
    assignPhaseTank: jest.fn(async (processId, sequenceId, phaseId, tankId) => {
      store.assignPhaseTank(processId, sequenceId, phaseId, tankId)
    })
  }
  const panel = new PhaseWorkspacePanel(
    () => store.snapshot(),
    actions,
    () => locale,
    () => projectFileIds,
    withTanks ? tanks : undefined,
    isPhaseMoveEnabled
  )
  document.body.append(panel.element)
  return { store, panel, actions, tanks }
}

const createCopyHarness = (locale: 'zh' | 'en' = 'zh') => {
  const harness = createHarness(locale)
  const { store, panel } = harness
  const process = store.createProcess('CIP')
  const sequence = process.sequences[0]
  const phases = [1, 2].map(number => store.createPhase({
    processId: process.id, sequenceId: sequence.id, number,
    name: `Phase ${number}`, source: { kind: 'unassigned' }
  }))
  store.activate(process.id, sequence.id, phases[0].id)
  panel.render()
  const startCopy = () => panel.element.querySelector<HTMLButtonElement>(
    `[aria-label="${locale === 'zh' ? '复制 Phase' : 'Copy Phase'}"]`
  )!.click()
  const clickTarget = () => panel.element.querySelector<HTMLButtonElement>('.is-copy-target')!.click()
  return { ...harness, process, sequence, source: phases[0], target: phases[1], startCopy, clickTarget }
}

describe('PhaseWorkspacePanel', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.getElementById('phase-workspace-styles')?.remove()
  })

  it.each(['escape', 'copy'] as const)('cancels quick copy using %s', async method => {
    const { panel, actions, startCopy } = createCopyHarness()
    startCopy()
    if (method === 'escape') {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    } else startCopy()
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
    expect(panel.element.querySelector('.is-copy-source')).toBeNull()
    panel.element.querySelector<HTMLButtonElement>('.phase-tree-node')!.click()
    await Promise.resolve()
    expect(actions.activatePhase).toHaveBeenCalledTimes(1)
    expect(actions.copyPhase).not.toHaveBeenCalled()
  })

  it('blocks duplicate submissions and conflicting panel operations across busy redraws', async () => {
    const { panel, actions, startCopy, clickTarget } = createCopyHarness()
    let resolveCopy!: () => void
    jest.mocked(actions.copyPhase).mockImplementation(() => new Promise<void>(resolve => { resolveCopy = resolve }))
    startCopy()
    const staleTarget = panel.element.querySelector<HTMLButtonElement>('.is-copy-target')!
    clickTarget()
    staleTarget.click()
    panel.render()
    clickTarget()
    panel.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.element.getAttribute('aria-busy')).toBe('true')
    expect(panel.element.querySelector('[role="status"]')?.textContent).toBe('正在替换 Phase…')
    expect(Array.from(panel.element.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button, select'))
      .every(control => control.disabled)).toBe(true)
    expect(panel.element.querySelector('[draggable="true"]')).toBeNull()
    expect(actions.copyPhase).toHaveBeenCalledTimes(1)
    expect(actions.activatePhase).not.toHaveBeenCalled()
    resolveCopy()
    await Promise.resolve()
    expect(panel.element.getAttribute('aria-busy')).toBe('false')
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
  })

  it('reports replacement errors and keeps the source available for retry', async () => {
    const { panel, actions, startCopy, clickTarget } = createCopyHarness()
    jest.mocked(actions.copyPhase).mockRejectedValueOnce(new Error('Network unavailable'))
    startCopy()
    clickTarget()
    await Promise.resolve()
    expect(panel.element.querySelector('[role="alert"]')?.textContent).toContain('Network unavailable')
    expect(panel.element.querySelector('.phase-copy-status button')).toBeNull()
    expect(panel.element.querySelector('.is-copy-source')).not.toBeNull()
    expect(panel.element.getAttribute('aria-busy')).toBe('false')
    clickTarget()
    await Promise.resolve()
    expect(actions.copyPhase).toHaveBeenCalledTimes(2)
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
  })

  it('cancels copying when another Sequence is activated, without replacing across sequences', async () => {
    const { store, panel, actions, process, sequence, source, startCopy } = createCopyHarness()
    const otherSequence = store.createSequence(process.id, 2, 'Other')
    const otherPhase = store.createPhase({
      processId: process.id, sequenceId: otherSequence.id, number: 1,
      name: 'Other phase', source: { kind: 'unassigned' }
    })
    store.activate(process.id, sequence.id, source.id)
    panel.render()
    startCopy()
    const otherNode = Array.from(panel.element.querySelectorAll<HTMLButtonElement>('.phase-tree-node'))
      .find(button => button.dataset.phaseId === otherPhase.id)!
    expect(otherNode.classList.contains('is-copy-target')).toBe(false)
    otherNode.click()
    await Promise.resolve()
    expect(actions.copyPhase).not.toHaveBeenCalled()
    expect(actions.activatePhase).toHaveBeenCalledWith(process.id, otherSequence.id, otherPhase.id)
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()

    startCopy()
    panel.element.querySelectorAll<HTMLButtonElement>('.phase-sequence-toggle')[1].click()
    await Promise.resolve()
    expect(actions.activateSequence).toHaveBeenCalledWith(process.id, otherSequence.id)
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
  })

  it('cancels copying on process selection and when the source disappears', async () => {
    const { store, panel, actions, process, sequence, source, startCopy } = createCopyHarness()
    startCopy()
    const select = panel.element.querySelector<HTMLSelectElement>('[aria-label="当前工艺"]')!
    select.dispatchEvent(new Event('change'))
    await Promise.resolve()
    expect(actions.activateProcess).toHaveBeenCalled()
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
    startCopy()
    store.deletePhase(process.id, sequence.id, source.id)
    panel.render()
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
    expect(actions.copyPhase).not.toHaveBeenCalled()
  })

  it.each(['zh', 'en'] as const)('hides create-copy controls while keeping quick replacement available in %s', locale => {
    injectPhaseWorkspaceStyles()
    const { panel, startCopy } = createCopyHarness(locale)
    for (const copying of [false, true]) {
      if (copying) startCopy()
      const duplicates = panel.element.querySelectorAll<HTMLButtonElement>(
        `[aria-label="${locale === 'zh' ? '创建副本…' : 'Create copy…'}"]`
      )
      expect(duplicates).toHaveLength(2)
      duplicates.forEach(button => {
        expect(button.hidden).toBe(true)
        expect(getComputedStyle(button).display).toBe('none')
      })
      const copy = panel.element.querySelector<HTMLButtonElement>(
        `[aria-label="${locale === 'zh' ? '复制 Phase' : 'Copy Phase'}"]`
      )!
      expect(copy.hidden).toBe(false)
      expect(copy.disabled).toBe(false)
      expect(getComputedStyle(copy).display).not.toBe('none')
    }
  })

  it('localizes quick copy and cancels it when opening the separate create-copy form programmatically', () => {
    const { panel, startCopy } = createCopyHarness('en')
    startCopy()
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
    expect(panel.element.textContent).not.toContain('Click a target Phase in the same sequence')
    expect(panel.element.textContent).not.toContain('Cancel copy')
    expect(panel.element.querySelector('.is-copy-source')?.textContent).toContain('Copy source')
    panel.element.querySelector<HTMLButtonElement>('[aria-label="Create copy…"]')!.click()
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
    expect(panel.element.querySelector('.is-copy-source')).toBeNull()
    expect(panel.element.querySelector('[aria-label="Copy mode"]')).toBeNull()
    expect(panel.element.querySelector('[aria-label="New Phase name"]')).not.toBeNull()
    panel.element.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click()
    expect(panel.element.contains(document.activeElement)).toBe(true)
  })

  it.each(['zh', 'en'] as const)('filters Phases by Vessel and cancels blinking without clearing the filter in %s', locale => {
    const { store, panel, tanks } = createHarness(locale, [5], true)
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phases = [1, 2, 3].map(number => store.createPhase({
      processId: process.id, sequenceId: sequence.id, number,
      name: `Rinse ${number}`, source: { kind: 'unassigned' }
    }))
    store.assignPhaseTank(process.id, sequence.id, phases[0].id, 'file:5:E65')
    store.assignPhaseTank(process.id, sequence.id, phases[1].id, 'file:5:1B3C')
    panel.render()
    const selectTank = (value: string) => {
      const select = panel.element.querySelector<HTMLSelectElement>('.phase-tank-selector select')!
      select.value = value
      select.dispatchEvent(new Event('change'))
    }
    const visiblePhases = () => [...panel.element.querySelectorAll('.phase-tree-node')].map(node => node.textContent)
    expect(panel.element.querySelector('.phase-workspace-content')!.firstElementChild)
      .toBe(panel.element.querySelector('.phase-tank-section'))
    expect(panel.element.querySelector('.phase-tank-selector select')?.getAttribute('aria-label'))
      .toBe(locale === 'zh' ? '当前 Vessel' : 'Current Vessel')
    expect(panel.element.querySelectorAll('.phase-tank-selector option')).toHaveLength(4)
    selectTank('file:5:E65')
    expect(tanks.locateTank).toHaveBeenLastCalledWith('file:5:E65')
    expect(visiblePhases()).toHaveLength(1)
    expect(visiblePhases()[0]).toContain('Rinse 1')
    expect(panel.element.querySelector('.phase-overview-card')).toBeNull()
    panel.element.querySelector<HTMLButtonElement>('.phase-tank-selector button')!.click()
    expect(tanks.stopLocatingTank).toHaveBeenCalled()
    expect(panel.element.querySelector<HTMLSelectElement>('.phase-tank-selector select')!.value).toBe('file:5:E65')
    expect(panel.element.querySelector('.phase-tank-selector button')?.getAttribute('aria-pressed')).toBe('false')
    selectTank('file:5:1B3C')
    expect(visiblePhases()[0]).toContain('Rinse 2')
    selectTank('unassigned')
    expect(visiblePhases()[0]).toContain('Rinse 3')
    expect(panel.element.querySelector('.phase-overview-card')).not.toBeNull()
    selectTank('')
    expect(visiblePhases()).toHaveLength(3)
    panel.resetTankSelection()
    panel.render()
    expect(panel.element.querySelector<HTMLSelectElement>('.phase-tank-selector select')!.value).toBe('')
  })

  it('assigns and clears Vessel ownership from the bottom of Phase details', async () => {
    const { store, panel, tanks } = createHarness('en', [5], true)
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phase = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 1,
      name: 'Rinse', source: { kind: 'unassigned' }
    })
    panel.render()
    let select = panel.element.querySelector<HTMLSelectElement>('[aria-label="Phase Vessel"]')!
    expect(select.closest('.phase-overview-row')).toBe(panel.element.querySelector('.phase-workspace-overview')!.lastElementChild)
    select.value = 'file:5:E65'
    select.dispatchEvent(new Event('change'))
    await Promise.resolve()
    expect(tanks.assignPhaseTank).toHaveBeenCalledWith(process.id, sequence.id, phase.id, 'file:5:E65')
    select = panel.element.querySelector<HTMLSelectElement>('[aria-label="Phase Vessel"]')!
    expect(select.value).toBe('file:5:E65')
    select.value = ''
    select.dispatchEvent(new Event('change'))
    await Promise.resolve()
    expect(store.snapshot().processes[0].sequences[0].phases[0].tankId).toBeUndefined()
  })

  it('reveals matching Phases in inactive sequences and handles empty Vessels without a drawable entity', () => {
    const { store, panel, tanks } = createHarness('en', [5], true)
    const process = store.createProcess('CIP')
    const first = process.sequences[0]
    const second = store.createSequence(process.id, 2, 'Wash')
    const phase = store.createPhase({
      processId: process.id, sequenceId: second.id, number: 1,
      name: 'Wash Vessel', source: { kind: 'unassigned' }
    })
    store.assignPhaseTank(process.id, second.id, phase.id, 'file:5:E65')
    store.activate(process.id, first.id)
    panel.render()
    const selectTank = (id: string) => {
      const select = panel.element.querySelector<HTMLSelectElement>('.phase-tank-selector select')!
      select.value = id
      select.dispatchEvent(new Event('change'))
    }
    selectTank('file:5:E65')
    const tree = panel.element.querySelector<HTMLElement>('[aria-label="Wash Phases"]')!
    expect(tree.hidden).toBe(false)
    expect(tree.textContent).toContain('Wash Vessel')
    jest.mocked(tanks.locateTank).mockReturnValue(false)
    selectTank('file:5:1B3C')
    expect(panel.element.querySelectorAll('[role="treeitem"]')).toHaveLength(0)
    expect(panel.element.textContent).toContain('No Phases for this Vessel.')
    expect(panel.element.querySelector('.phase-tank-selector button')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('starts empty and allows creating the first process', () => {
    injectPhaseWorkspaceStyles()
    const { store, panel } = createHarness()
    const name = panel.element.querySelector<HTMLInputElement>(
      '[aria-label="工艺名称"]'
    )
    const button = [...panel.element.querySelectorAll('button')].find(
      item => item.textContent === '创建工艺'
    ) as HTMLButtonElement
    expect(panel.element.textContent).toContain('工作区当前为空')
    expect(button.disabled).toBe(false)
    expect(getComputedStyle(button).cursor).toBe('pointer')
    button.click()
    expect(store.snapshot().processes).toHaveLength(0)
    expect(name!.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(name)

    name!.value = '   '
    name!.dispatchEvent(new Event('input'))
    expect(button.disabled).toBe(false)
    expect(name!.getAttribute('aria-invalid')).toBe('true')

    name!.value = 'CIP'
    name!.dispatchEvent(new Event('input'))
    expect(button.disabled).toBe(false)
    expect(name!.hasAttribute('aria-invalid')).toBe(false)
    expect(getComputedStyle(button).cursor).toBe('pointer')
    button.click()

    expect(store.snapshot().processes[0].name).toBe('CIP')
    expect(panel.element.textContent).toContain('此工艺尚无阶段')
  })

  it.each(['zh', 'en'] as const)('marks all missing sequence fields and focuses the first in %s', locale => {
    const { store, panel, actions } = createHarness(locale)
    store.createProcess('CIP')
    panel.render()
    panel.element.querySelector<HTMLButtonElement>(
      `[aria-label="${locale === 'zh' ? '新增序列' : 'Add sequence'}"]`
    )!.click()
    const form = panel.element.querySelector<HTMLFormElement>('.phase-sequence-modal-form')!
    const number = form.querySelector<HTMLInputElement>('input[type="number"]')!
    const name = form.querySelector<HTMLInputElement>('input:not([type="number"])')!
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    number.value = ''
    submit.click()
    expect(submit.disabled).toBe(false)
    expect(number.getAttribute('aria-invalid')).toBe('true')
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(number)
    expect(actions.createSequence).not.toHaveBeenCalled()
    number.value = '2'
    number.dispatchEvent(new Event('input'))
    name.value = 'Rinse'
    name.dispatchEvent(new Event('input'))
    expect(form.querySelector('[aria-invalid="true"]')).toBeNull()
    submit.click()
    expect(actions.createSequence).toHaveBeenCalledWith(expect.objectContaining({ number: 2, name: 'Rinse' }))
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

  it.each(['zh', 'en'] as const)('keeps process controls outside the scrolling content in %s', locale => {
    injectPhaseWorkspaceStyles()
    const { store, panel } = createHarness(locale)
    store.createProcess('CIP')
    panel.render()

    const assertFixedHeader = () => {
      const header = panel.element.querySelector<HTMLElement>('.phase-workspace-header')!
      const content = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
      expect(header.parentElement).toBe(panel.element)
      expect(header.nextElementSibling).toBe(content)
      expect(header.querySelector('.phase-process-selector')).not.toBeNull()
      expect(header.querySelector('.phase-process-delete')).not.toBeNull()
      expect(content.querySelector('.phase-process-selector')).toBeNull()
      expect(getComputedStyle(header).flexShrink).toBe('0')
      expect(getComputedStyle(content).overflow).toBe('auto')
      return header
    }

    assertFixedHeader().querySelector<HTMLButtonElement>('[aria-expanded]')!.click()
    expect(assertFixedHeader().querySelector('.phase-process-creator')).not.toBeNull()
    panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop = 240
    panel.render()
    assertFixedHeader()
    expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(240)
  })

  it.each(['zh', 'en'] as const)('returns only the list to the top using the localized fixed button in %s', locale => {
    injectPhaseWorkspaceStyles()
    const { store, panel, actions } = createHarness(locale)
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 1,
      name: 'Phase 1', source: { kind: 'unassigned' }
    })
    panel.render()
    const state = store.snapshot()
    const label = locale === 'zh' ? '回到顶部' : 'Back to top'
    const getButton = () => panel.element.querySelector<HTMLButtonElement>('.phase-back-to-top')!
    let content = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
    expect(getButton().hidden).toBe(true)
    expect(getComputedStyle(getButton()).display).toBe('none')
    expect(getButton().closest('.phase-workspace-header')).not.toBeNull()
    expect(getButton().textContent).toBe(label)
    expect(getButton().getAttribute('aria-label')).toBe(label)
    expect(getButton().title).toBe(label)

    content.scrollTop = 1
    content.dispatchEvent(new Event('scroll'))
    expect(getButton().hidden).toBe(false)
    expect(getComputedStyle(getButton()).display).toBe('inline-flex')
    content.scrollTop = 0
    content.dispatchEvent(new Event('scroll'))
    expect(getButton().hidden).toBe(true)

    content.scrollTop = 720
    content.scrollLeft = 16
    panel.render()
    content = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
    expect(content.scrollTop).toBe(720)
    expect(getButton().hidden).toBe(false)
    getButton().focus()
    getButton().click()
    expect(content.scrollTop).toBe(0)
    expect(content.scrollLeft).toBe(16)
    expect(getButton().hidden).toBe(true)
    expect(document.activeElement).toBe(content)
    expect(store.snapshot()).toEqual(state)
    expect(actions.activatePhase).not.toHaveBeenCalled()
    expect(actions.activateProcess).not.toHaveBeenCalled()
    panel.render()
    expect(getButton().hidden).toBe(true)
    expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(0)
  })

  it.each(['zh', 'en'] as const)('resets scrolling on process changes through any entry point in %s', async locale => {
    const { store, panel, actions } = createHarness(locale)
    const processes = ['CIP', 'SIP'].map(name => {
      const process = store.createProcess(name)
      const sequence = process.sequences[0]
      const phases = Array.from({ length: 20 }, (_, index) => store.createPhase({
        processId: process.id, sequenceId: sequence.id, number: index + 1,
        name: `${name} ${index + 1}`, source: { kind: 'unassigned' }
      }))
      store.activate(process.id, sequence.id, phases[19].id)
      return { process, sequence, phase: phases[19] }
    })
    jest.mocked(actions.activateProcess).mockImplementation(async processId => {
      const target = processes.find(item => item.process.id === processId)!
      store.activate(processId, target.sequence.id, target.phase.id)
      panel.render()
      await Promise.resolve()
      panel.render()
    })
    panel.render()
    for (const entry of ['selector', 'state'] as const) {
      for (const target of processes) {
        const content = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
        content.scrollTop = 720
        content.dispatchEvent(new Event('scroll'))
        expect(panel.element.querySelector<HTMLButtonElement>('.phase-back-to-top')!.hidden).toBe(false)
        if (entry === 'selector') {
          const select = panel.element.querySelector<HTMLSelectElement>('.phase-process-selector select')!
          select.value = target.process.id
          select.dispatchEvent(new Event('change'))
          await Promise.resolve()
          await Promise.resolve()
        } else {
          store.activate(target.process.id, target.sequence.id, target.phase.id)
          panel.render({ revealActivePhase: true })
        }
        expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(0)
        expect(panel.element.querySelector<HTMLButtonElement>('.phase-back-to-top')!.hidden).toBe(true)
        expect(panel.element.querySelector<HTMLElement>('.phase-tree-node.is-active')!.dataset.phaseId)
          .toBe(target.phase.id)
        panel.render()
        expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(0)

        panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop = 120
        panel.render()
        expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(120)
      }
    }
    expect(actions.activatePhase).not.toHaveBeenCalled()
  })

  it('resets scrolling when switching to an empty process or one without an active sequence', () => {
    const { store, panel } = createHarness()
    const first = store.createProcess('CIP')
    const empty = store.createProcess('Empty')
    store.activate(first.id, first.sequences[0].id)
    panel.render()
    panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop = 720
    store.activate(empty.id, empty.sequences[0].id)
    panel.render()
    expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(0)
    panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop = 240
    store.activate(first.id)
    panel.render()
    expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(0)
    expect(panel.element.querySelector<HTMLButtonElement>('.phase-back-to-top')!.hidden).toBe(true)
  })

  it.each(['zh', 'en'] as const)('preserves scrolling when selecting bottom Phases and rendering again in %s', async locale => {
    const { store, panel, actions } = createHarness(locale)
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phases = Array.from({ length: 20 }, (_, index) => store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: index + 1,
      name: `Rinse ${index + 1}`, source: { kind: 'unassigned' }
    }))
    store.activate(process.id, sequence.id, phases[0].id)
    panel.render()
    jest.mocked(actions.activatePhase).mockImplementation(async (processId, sequenceId, phaseId) => {
      store.activate(processId, sequenceId, phaseId)
      panel.render()
    })

    for (const [index, scrollTop] of [[19, 720], [18, 460]]) {
      const viewport = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
      viewport.scrollTop = scrollTop
      viewport.scrollLeft = 16
      panel.element.querySelectorAll<HTMLButtonElement>('.phase-tree-node')[index].click()
      await Promise.resolve()

      const updatedViewport = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
      expect(updatedViewport.scrollTop).toBe(scrollTop)
      expect(updatedViewport.scrollLeft).toBe(16)
      expect(panel.element.querySelector('.phase-tree-node.is-active')?.textContent)
        .toContain(phases[index].name)
      expect(actions.activatePhase).toHaveBeenLastCalledWith(process.id, sequence.id, phases[index].id)
      panel.render()
      expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(scrollTop)
    }
  })

  describe('revealing the Phase selected from the context bar', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it.each([
      ['above', 40, 440],
      ['below', 410, 550],
      ['partially above', 90, 490],
      ['partially below', 380, 520],
      ['visible', 220, 500],
      ['at top edge', 100, 500],
      ['at bottom edge', 360, 500]
    ] as const)('minimally scrolls a row %s the viewport and retains the result on redraw', (_name, rowTop, expectedTop) => {
      const { store, panel } = createHarness('en')
      const process = store.createProcess('CIP')
      const sequence = process.sequences[0]
      const phase = store.createPhase({
        processId: process.id, sequenceId: sequence.id, number: 1,
        name: 'Selected Phase', source: { kind: 'unassigned' }
      })
      panel.render()
      const content = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
      content.scrollTop = 500
      content.scrollLeft = 16
      const focused = document.createElement('select')
      document.body.append(focused)
      focused.focus()
      jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
      jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const top = this.classList.contains('phase-tree-item') ? rowTop : 100
        const height = this.classList.contains('phase-tree-item') ? 40 : 300
        return { top, bottom: top + height, left: 0, right: 400, x: 0, y: top, width: 400, height, toJSON: () => ({}) }
      })

      store.activate(process.id, sequence.id, phase.id)
      panel.render({ revealActivePhase: true })

      const updated = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
      expect(updated.scrollTop).toBe(expectedTop)
      expect(updated.scrollLeft).toBe(16)
      expect(document.activeElement).toBe(focused)
      expect(panel.element.querySelector('.phase-tree-node.is-active')?.getAttribute('data-phase-id')).toBe(phase.id)
      panel.render()
      expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(expectedTop)
    })

    it('opens an already initialized, collapsed Sequence to reveal its newly selected Phase', async () => {
      const { store, panel } = createHarness()
      const process = store.createProcess('CIP')
      const first = process.sequences[0]
      const second = store.createSequence(process.id, 2, 'Second')
      const phase = store.createPhase({
        processId: process.id, sequenceId: second.id, number: 1,
        name: 'Selected Phase', source: { kind: 'unassigned' }
      })
      store.activate(process.id, first.id)
      panel.render()
      expect(panel.element.querySelectorAll<HTMLElement>('.phase-tree-list')[1].hidden).toBe(true)

      store.activate(process.id, second.id, phase.id)
      panel.render({ revealActivePhase: true })
      expect(panel.element.querySelectorAll<HTMLElement>('.phase-tree-list')[1].hidden).toBe(false)
      expect(panel.element.querySelector('.phase-tree-node.is-active')?.getAttribute('data-phase-id')).toBe(phase.id)
      panel.element.querySelectorAll<HTMLButtonElement>('.phase-sequence-toggle')[1].click()
      await Promise.resolve()
      expect(panel.element.querySelectorAll<HTMLElement>('.phase-tree-list')[1].hidden).toBe(true)
      panel.render({ revealActivePhase: true })
      expect(panel.element.querySelectorAll<HTMLElement>('.phase-tree-list')[1].hidden).toBe(false)
    })

    it.each([true, false])('clears only a Vessel filter hiding the selected Phase (hidden: %s)', hidden => {
      const { store, panel, tanks } = createHarness('en', [5], true)
      const process = store.createProcess('CIP')
      const sequence = process.sequences[0]
      const phase = store.createPhase({
        processId: process.id, sequenceId: sequence.id, number: 1,
        name: 'Selected Phase', source: { kind: 'unassigned' }
      })
      store.assignPhaseTank(process.id, sequence.id, phase.id, 'file:5:E65')
      panel.render()
      const select = panel.element.querySelector<HTMLSelectElement>('.phase-tank-selector select')!
      select.value = hidden ? 'file:5:1B3C' : 'file:5:E65'
      select.dispatchEvent(new Event('change'))
      jest.mocked(tanks.stopLocatingTank).mockClear()
      expect(panel.element.querySelector('.phase-tree-node') === null).toBe(hidden)

      store.activate(process.id, sequence.id, phase.id)
      panel.render({ revealActivePhase: true })

      expect(panel.element.querySelector('.phase-tree-node.is-active')?.getAttribute('data-phase-id')).toBe(phase.id)
      expect(panel.element.querySelector<HTMLSelectElement>('.phase-tank-selector select')!.value)
        .toBe(hidden ? '' : 'file:5:E65')
      expect(tanks.stopLocatingTank).toHaveBeenCalledTimes(hidden ? 1 : 0)
      expect(panel.element.querySelector('.phase-tank-selector button')?.getAttribute('aria-pressed'))
        .toBe(String(!hidden))
    })

    it('does not move an empty workspace or a hidden viewport', () => {
      const { store, panel } = createHarness()
      expect(() => panel.render({ revealActivePhase: true })).not.toThrow()
      const process = store.createProcess('CIP')
      const sequence = process.sequences[0]
      store.createPhase({
        processId: process.id, sequenceId: sequence.id, number: 1,
        name: 'Selected Phase', source: { kind: 'unassigned' }
      })
      panel.render()
      panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop = 500
      panel.render({ revealActivePhase: true })
      expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(500)
    })
  })

  it('preserves the latest manual scroll position while Phase activation is pending', async () => {
    const { store, panel, actions } = createHarness('en')
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phase = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 1,
      name: 'Rinse', source: { kind: 'unassigned' }
    })
    panel.render()
    let completeActivation: (() => void) | undefined
    jest.mocked(actions.activatePhase).mockImplementation((processId, sequenceId, phaseId) => new Promise(resolve => {
      completeActivation = () => {
        store.activate(processId, sequenceId, phaseId)
        panel.render()
        resolve()
      }
    }))
    const viewport = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
    viewport.scrollTop = 720
    panel.element.querySelector<HTMLButtonElement>('.phase-tree-node')!.click()
    viewport.scrollTop = 450
    completeActivation!()
    await Promise.resolve()

    expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(450)
    expect(actions.activatePhase).toHaveBeenCalledWith(process.id, sequence.id, phase.id)
  })

  it('preserves scrolling when no sequence is active', () => {
    const { store, panel } = createHarness('en')
    const process = store.createProcess('CIP')
    store.activate(process.id)
    panel.render()
    panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop = 240

    panel.render()

    expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(240)
    expect(panel.element.children).toHaveLength(2)
    expect(panel.element.firstElementChild?.className).toBe('phase-workspace-header')
  })

  it.each(['zh', 'en'] as const)('allows Phase renaming but keeps the drawing name read-only in %s', locale => {
    const { store, panel, actions } = createHarness(locale)
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const phase = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 11,
      name: 'Phase11', source: {
        kind: 'new',
        drawing: { id: 'drawing-11', kind: 'blank', sourceName: 'Phase11.dwg' },
        displayName: 'Phase11.dwg'
      }
    })
    panel.render()
    const drawing = panel.element.querySelector('.phase-overview-drawing')!
    expect(drawing.querySelector('.phase-overview-drawing-name')?.textContent).toBe('Phase11.dwg')
    expect(drawing.querySelector('.phase-overview-edit')).toBeNull()
    expect(drawing.querySelector('input')).toBeNull()
    expect(drawing.querySelectorAll('button')).toHaveLength(1)
    expect(drawing.querySelector('button')?.textContent).toBe(locale === 'zh' ? '更换图纸' : 'Replace drawing')
    const openEditor = () => panel.element.querySelector<HTMLButtonElement>(
      '.phase-overview-identity-actions button'
    )!.click()
    openEditor()
    let editor = panel.element.querySelector('.phase-overview-rename')!
    expect([...editor.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(locale === 'en' ? ['Cancel', 'Save'] : ['取消', '保存'])
    expect(editor.querySelector('input')?.getAttribute('aria-label'))
      .toBe(locale === 'en' ? 'Phase name' : '阶段名称')
    expect(editor.querySelector('input')?.value).toBe('Phase11')
    editor.querySelector('button')!.click()
    expect(actions.renamePhase).not.toHaveBeenCalled()
    expect(actions.renameDrawing).not.toHaveBeenCalled()
    openEditor()
    editor = panel.element.querySelector('.phase-overview-rename')!
    const rename = editor.querySelector('input')!
    rename.value = '   '
    editor.querySelectorAll('button')[1].click()
    expect(rename.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(rename)
    expect(actions.renamePhase).not.toHaveBeenCalled()
    expect(actions.renameDrawing).not.toHaveBeenCalled()
    editor.querySelector('input')!.value = '清洗 Phase11'
    rename.dispatchEvent(new Event('input'))
    expect(rename.hasAttribute('aria-invalid')).toBe(false)
    editor.querySelectorAll('button')[1].click()
    expect(actions.renamePhase)
      .toHaveBeenCalledWith(process.id, sequence.id, phase.id, '清洗 Phase11')
    expect(actions.renameDrawing).not.toHaveBeenCalled()
  })

  it.each(['zh', 'en'] as const)('preserves business names that match UI translations in %s', locale => {
    const { store, panel } = createHarness(locale)
    const process = store.createProcess('Save')
    const sequence = process.sequences[0]
    store.renameSequence(process.id, sequence.id, '取消')
    store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 1,
      name: '保存', source: {
        kind: 'new', drawing: { id: 'drawing', kind: 'blank', sourceName: 'Open' },
        displayName: 'Open'
      }
    })
    panel.render()
    expect(panel.element.querySelector('.phase-process-selector option')?.textContent).toBe('Save')
    expect(panel.element.querySelector('.phase-sequence-identity strong')?.textContent).toBe('取消')
    expect(panel.element.querySelector('.phase-overview-identity-actions strong')?.textContent).toBe('保存')
    expect(panel.element.querySelector('.phase-overview-drawing-name')?.textContent).toBe('Open')
    expect(panel.element.querySelector('.phase-overview-drawing-name')?.getAttribute('title')).toBe('Open')
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
      'project'
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
      'project'
    ])
  })

  it('creates a Phase from a Project PID drawing', () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: 'PID source',
      source: {
        kind: 'new',
        drawing: {
          id: 'file:5',
          kind: 'url',
          sourceName: 'Project-PID.dwg',
          url: '/project-pid.dwg'
        },
        displayName: 'Project-PID.dwg'
      }
    })
    panel.render()
      ;[...panel.element.querySelectorAll('button')]
        .find(item => item.textContent === '创建 Phase')!
        .click()

    const form = panel.element.querySelector<HTMLFormElement>('.phase-create-form')!
    const source = form.querySelector<HTMLSelectElement>(
      '[aria-label="阶段创建方式"]'
    )!
    const projectDrawing = form.querySelector<HTMLSelectElement>(
      '[aria-label="Project PID"]'
    )!
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    source.value = 'project'
    source.dispatchEvent(new Event('change'))
    expect(projectDrawing.parentElement?.hidden).toBe(false)
    expect(submit.disabled).toBe(false)
    submit.click()
    expect(actions.createPhase).not.toHaveBeenCalled()
    expect(projectDrawing.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(projectDrawing)

    projectDrawing.value = '5'
    projectDrawing.dispatchEvent(new Event('change'))
    expect(submit.disabled).toBe(false)
    expect(projectDrawing.hasAttribute('aria-invalid')).toBe(false)
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )

    expect(actions.createPhase).toHaveBeenCalledWith({
      processId: process.id,
      sequenceId: sequence.id,
      number: 2,
      name: '',
      sourceKind: 'project',
      sourcePhaseId: undefined,
      fileId: 5,
      drawingDisplayName: 'Project-PID.dwg',
      file: undefined,
      url: ''
    })
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

  it.each(['zh', 'en'] as const)('shows drawing association on Phase numbers without a status text column in %s', locale => {
    injectPhaseWorkspaceStyles()
    const { store, panel } = createHarness(locale)
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const assigned = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 8010,
      name: '保存', source: {
        kind: 'new',
        drawing: { id: 'drawing-assigned', kind: 'blank', sourceName: 'Assigned.dwg' },
        displayName: 'Assigned.dwg'
      }
    })
    const unassigned = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 8011,
      name: 'No drawing', source: { kind: 'unassigned' }
    })
    const missing = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 8012,
      name: 'Missing drawing', source: {
        kind: 'new',
        drawing: { id: 'drawing-missing', kind: 'blank', sourceName: 'Missing.dwg' },
        displayName: 'Missing.dwg'
      }
    })
    const state = store.snapshot()
    delete state.drawingAssets['drawing-missing']
    jest.spyOn(store, 'snapshot').mockReturnValue(state)
    const expected = [
      { phase: assigned, assigned: true, missing: false, status: locale === 'zh' ? '图纸已关联' : 'Drawing assigned' },
      { phase: unassigned, assigned: false, missing: false, status: locale === 'zh' ? '未关联图纸' : 'No drawing assigned' },
      { phase: missing, assigned: false, missing: true, status: locale === 'zh' ? '图纸缺失' : 'Drawing missing' }
    ]

    for (const active of expected) {
      state.processes[0].sequences[0].activePhaseId = active.phase.id
      panel.render()
      const nodes = [...panel.element.querySelectorAll<HTMLButtonElement>('.phase-tree-node')]
      expected.forEach(({ phase, assigned, missing, status }, index) => {
        const node = nodes[index]
        const label = node.querySelector<HTMLElement>('.phase-tree-node-label')!
        const number = label.querySelector<HTMLElement>('.phase-tree-node-number')!
        expect(label.children).toHaveLength(2)
        expect(getComputedStyle(label).gridTemplateColumns).toBe('24px minmax(0, 1fr)')
        expect(node.textContent).toBe(`${phase.number}${phase.name}`)
        expect(number.classList.contains('is-drawing-assigned')).toBe(assigned)
        expect(number.classList.contains('is-drawing-missing')).toBe(missing)
        expect(number.title).toBe(status)
        expect(node.title).toBe(phase.drawing.kind === 'assigned'
          ? `${status} · ${phase.drawing.displayName}`
          : status)
        expect(node.getAttribute('aria-label')).toBe(`Phase ${phase.number} · ${phase.name} · ${status}`)
        expect(node.classList.contains('is-active')).toBe(phase.id === active.phase.id)
      })
      expect(panel.element.querySelector('.phase-tree-drawing-status')).toBeNull()
    }
  })

  it.each(['zh', 'en'] as const)('omits the overview status row in %s', locale => {
    const { store, panel } = createHarness(locale)
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

    const overview = panel.element.querySelector('.phase-workspace-overview')!
    expect(overview.querySelectorAll('.phase-overview-row')).toHaveLength(2)
    expect(overview.querySelector('.phase-overview-drawing')).not.toBeNull()
    expect(overview.querySelector('.phase-overview-statuses')).toBeNull()
    expect(overview.querySelector('.phase-status-badge')).toBeNull()
    expect([...overview.querySelectorAll('dt')].map(term => term.textContent))
      .not.toEqual(expect.arrayContaining([locale === 'zh' ? '状态' : 'Status']))
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

  it.each(['zh', 'en'] as const)('keeps Sequence actions beside its name and outside the Phase list in %s', locale => {
    injectPhaseWorkspaceStyles()
    const { store, panel } = createHarness(locale)
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 1,
      name: 'Rinse', source: { kind: 'unassigned' }
    })
    panel.render()
    const row = panel.element.querySelector<HTMLElement>('.phase-sequence-row')!
    const toggle = row.querySelector<HTMLElement>('.phase-sequence-toggle')!
    const controls = row.querySelector<HTMLElement>('.phase-sequence-controls')!
    expect(toggle.parentElement).toBe(controls.parentElement)
    expect(getComputedStyle(row).gridTemplateColumns).toBe('minmax(0, 1fr) auto')
    expect(getComputedStyle(toggle).gridTemplateColumns).toBe('12px minmax(0, 1fr)')
    expect(getComputedStyle(controls).flexWrap).toBe('nowrap')
    expect(controls.querySelectorAll('button')).toHaveLength(5)
    expect(row.nextElementSibling?.classList.contains('phase-tree-list')).toBe(true)
    expect(controls.closest('.phase-tree-list')).toBeNull()
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
    panel.element.querySelector<HTMLSelectElement>('[aria-label="阶段创建方式"]')!.value = 'unassigned'
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

  it('copies a Phase into its sequence with editable defaults', async () => {
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
    store.createPhase({
      processId: process.id,
      sequenceId: sourceSequence.id,
      number: 7,
      name: '循环',
      source: { kind: 'unassigned' }
    })
    store.activate(process.id, sourceSequence.id, sourcePhase.id)
    panel.render()

    panel.element.querySelector<HTMLButtonElement>('[aria-label="创建副本…"]')!.click()
    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="来源 Phase"]')!.value)
      .toContain('Phase 04 · 预冲洗')
    expect(panel.element.querySelector('[aria-label="目标序列"]')).toBeNull()
    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 编号"]')!.value)
      .toBe('8')
    expect(panel.element.querySelector<HTMLInputElement>('[aria-label="新 Phase 名称"]')!.value)
      .toBe('预冲洗 副本')

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
      mode: 'create',
      processId: process.id,
      sourceSequenceId: sourceSequence.id,
      sourcePhaseId: sourcePhase.id,
      targetSequenceId: sourceSequence.id,
      number: 8,
      name: '预冲洗复制'
    })
  })

  it('replaces the clicked Phase directly and exits copy mode after success', async () => {
    const { store, panel, actions } = createHarness()
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    const source = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 1,
      name: 'Source', source: { kind: 'unassigned' }
    })
    const target = store.createPhase({
      processId: process.id, sequenceId: sequence.id, number: 2,
      name: 'Target', source: { kind: 'unassigned' }
    })
    store.activate(process.id, sequence.id, source.id)
    panel.render()

    panel.element.querySelector<HTMLButtonElement>('[aria-label="复制 Phase"]')!.click()
    expect(panel.element.querySelector('[role="dialog"]:not([hidden])')).toBeNull()
    expect(panel.element.querySelector('.is-copy-source')?.textContent).toContain('Source')
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
    expect(panel.element.textContent).not.toContain('点击同一序列的目标 Phase 直接替换')
    expect(panel.element.textContent).not.toContain('取消复制')
    panel.render()
    panel.element.querySelector<HTMLButtonElement>('.is-copy-source')!.click()
    expect(actions.copyPhase).not.toHaveBeenCalled()
    panel.element.querySelector<HTMLButtonElement>('.is-copy-target')!.click()
    expect(actions.activatePhase).not.toHaveBeenCalled()
    expect(document.querySelector('.confirmation-modal:not([hidden])')).toBeNull()
    await Promise.resolve()
    expect(actions.copyPhase).toHaveBeenCalledTimes(1)
    expect(actions.copyPhase).toHaveBeenCalledWith({
      mode: 'replace',
      processId: process.id,
      sourceSequenceId: sequence.id,
      sourcePhaseId: source.id,
      targetSequenceId: sequence.id,
      targetPhaseId: target.id
    })
    expect(panel.element.querySelector('.phase-copy-status')).toBeNull()
    panel.element.querySelector<HTMLButtonElement>('.phase-tree-node')!.click()
    expect(actions.activatePhase).toHaveBeenCalledWith(process.id, sequence.id, source.id)
  })

  it('creates a Phase without a drawing and later assigns a Project PID', () => {
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
    store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 2,
      name: 'PID source',
      source: {
        kind: 'new',
        drawing: {
          id: 'file:5',
          kind: 'url',
          sourceName: 'PID-later.dwg',
          url: '/pid-later.dwg'
        },
        displayName: 'PID-later.dwg'
      }
    })
    store.activate(process.id, sequence.id, phase.id)
    panel.render()

    expect(panel.element.textContent).toContain('未关联图纸')
    const associate = [...panel.element.querySelectorAll('button')].find(
      button => button.textContent === '关联图纸'
    )!
    const modal = document.body.querySelector<HTMLElement>(
      '.phase-drawing-association-modal'
    )!
    expect(panel.element.contains(modal)).toBe(false)
    expect(modal.hidden).toBe(true)
    associate.click()
    expect(modal.hidden).toBe(false)
    const source = modal.querySelector<HTMLSelectElement>(
      '[aria-label="图纸关联方式"]'
    )!
    expect([...source.options].map(option => option.value)).toEqual([
      'project',
      'marked'
    ])
    const projectDrawing = modal.querySelector<HTMLSelectElement>(
      '[aria-label="Project PID"]'
    )!
    const markedPhase = modal.querySelector<HTMLSelectElement>(
      '[aria-label="已标记 Phase"]'
    )!
    const submit = modal.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(projectDrawing.parentElement!.hidden).toBe(false)
    expect(modal.textContent).toContain('选择原始图纸会清除当前 Phase 的设备状态、自动流路和人工修正，即使重新选择同一图纸。')
    expect(getComputedStyle(markedPhase.parentElement!).display).toBe('none')
    source.value = 'marked'
    source.dispatchEvent(new Event('change'))
    expect(modal.textContent).toContain('将复制来源 Phase 的设备状态、自动流路和人工修正，并替换当前 Phase 的对应数据。')
    expect(getComputedStyle(projectDrawing.parentElement!).display).toBe('none')
    expect(markedPhase.parentElement!.hidden).toBe(false)
    source.value = 'project'
    source.dispatchEvent(new Event('change'))
    expect(submit.disabled).toBe(false)
    submit.click()
    expect(actions.associateDrawing).not.toHaveBeenCalled()
    expect(projectDrawing.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(projectDrawing)
    projectDrawing.value = '5'
    projectDrawing.dispatchEvent(new Event('change'))
    expect(submit.disabled).toBe(false)
    expect(projectDrawing.hasAttribute('aria-invalid')).toBe(false)
    modal.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )

    expect(actions.associateDrawing).toHaveBeenCalledWith({
      processId: process.id,
      sequenceId: sequence.id,
      phaseId: phase.id,
      sourceKind: 'project',
      fileId: 5,
      drawingDisplayName: 'PID-later.dwg'
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
        drawing: {
          id: 'file:5',
          kind: 'url',
          sourceName: 'PID.dwg',
          url: '/pid.dwg'
        },
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
    const modal = document.body.querySelector<HTMLElement>(
      '.phase-drawing-association-modal'
    )!
    const source = modal.querySelector<HTMLSelectElement>(
      '[aria-label="图纸关联方式"]'
    )!
    expect([...source.options].map(option => option.value)).toContain('marked')
    source.value = 'marked'
    source.dispatchEvent(new Event('change'))
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

  it('excludes marked Phase drawings outside the active Project', () => {
    const { store, panel } = createHarness('zh', [5])
    const process = store.createProcess('CIP')
    const sequence = process.sequences[0]
    store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 1,
      name: '其他 Project 图纸',
      source: {
        kind: 'new',
        drawing: {
          id: 'file:9',
          kind: 'url',
          sourceName: 'Other.dwg',
          url: '/other.dwg'
        },
        displayName: 'Other.dwg'
      }
    })
    const target = store.createPhase({
      processId: process.id,
      sequenceId: sequence.id,
      number: 2,
      name: '待关联阶段',
      source: { kind: 'unassigned' }
    })
    store.activate(process.id, sequence.id, target.id)
    panel.render()

      ;[...panel.element.querySelectorAll('button')]
        .find(button => button.textContent === '关联图纸')!
        .click()
    const source = document.body.querySelector<HTMLSelectElement>(
      '.phase-drawing-association-modal [aria-label="图纸关联方式"]'
    )!

    expect([...source.options].map(option => option.value)).toEqual(['project'])
  })

  describe('Phase drag auto-scroll', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      document.dispatchEvent(new Event('dragend'))
      jest.useRealTimers()
      jest.restoreAllMocks()
    })

    const createDragHarness = () => {
      const harness = createHarness()
      const { store, panel, actions } = harness
      const process = store.createProcess('CIP')
      const sequence = process.sequences[0]
      const phases = Array.from({ length: 30 }, (_, index) => store.createPhase({
        processId: process.id, sequenceId: sequence.id, number: index + 1,
        name: `Phase ${index + 1}`, source: { kind: 'unassigned' }
      }))
      jest.mocked(actions.reorderPhase).mockImplementation((processId, sequenceId, phaseId, index) => {
        store.reorderPhase(processId, sequenceId, phaseId, index)
      })
      panel.render()
      const content = panel.element.querySelector<HTMLElement>('.phase-workspace-content')!
      const items = panel.element.querySelectorAll<HTMLElement>('.phase-tree-item')
      jest.spyOn(content, 'getBoundingClientRect').mockReturnValue({
        x: 100, y: 100, left: 100, top: 100, right: 400, bottom: 400,
        width: 300, height: 300, toJSON: () => ({})
      })
      Object.defineProperties(content, {
        clientHeight: { value: 300 },
        scrollHeight: { value: 1800, configurable: true }
      })
      const data = new Map<string, string>()
      const transfer = {
        effectAllowed: 'none',
        setData: (type: string, value: string) => data.set(type, value),
        getData: (type: string) => data.get(type) ?? ''
      }
      const drag = (target: EventTarget, type: string, clientY = 400, clientX = 200, relatedTarget: EventTarget | null = null) => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, relatedTarget })
        Object.defineProperty(event, 'dataTransfer', { value: transfer })
        target.dispatchEvent(event)
        return event
      }
      return { ...harness, process, sequence, phases, content, items, drag, transfer }
    }

    it('keeps scrolling with a stationary pointer and drops onto a previously offscreen Phase', () => {
      const { panel, store, actions, process, sequence, phases, content, items, drag, transfer } = createDragHarness()
      drag(items[0], 'dragstart')
      expect(transfer.effectAllowed).toBe('move')
      expect(drag(content, 'dragover').defaultPrevented).toBe(true)
      jest.advanceTimersByTime(500)
      const halfway = content.scrollTop
      expect(halfway).toBeGreaterThan(250)
      jest.advanceTimersByTime(1500)
      expect(content.scrollTop).toBeGreaterThan(1000)
      const finalTop = content.scrollTop
      drag(items[24], 'drop')
      expect(actions.reorderPhase).toHaveBeenCalledWith(process.id, sequence.id, phases[0].id, 24)
      expect(store.snapshot().processes[0].sequences[0].phases[24].id).toBe(phases[0].id)
      expect(panel.element.querySelector<HTMLElement>('.phase-workspace-content')!.scrollTop).toBe(finalTop)
      expect(panel.element.querySelector('.is-dragging, .is-drag-over')).toBeNull()
      expect(jest.getTimerCount()).toBe(0)
    })

    it('scrolls upward, scales speed near the edge, and clamps at both limits', () => {
      const { content, items, drag } = createDragHarness()
      drag(items[0], 'dragstart')
      content.scrollTop = 500
      drag(content, 'dragover', 376)
      jest.advanceTimersByTime(160)
      const slowDistance = content.scrollTop - 500
      expect(slowDistance).toBeGreaterThan(40)
      expect(slowDistance).toBeLessThan(55)
      drag(content, 'dragover', 400)
      const start = content.scrollTop
      jest.advanceTimersByTime(160)
      expect(content.scrollTop - start).toBeGreaterThan(slowDistance * 1.8)
      jest.advanceTimersByTime(3000)
      expect(content.scrollTop).toBe(1500)
      expect(jest.getTimerCount()).toBe(0)
      drag(content, 'dragover', 100)
      jest.advanceTimersByTime(160)
      expect(content.scrollTop).toBeLessThan(1500)
      jest.advanceTimersByTime(3000)
      expect(content.scrollTop).toBe(0)
      expect(jest.getTimerCount()).toBe(0)
    })

    it.each([
      ['center', 250, 200],
      ['header', 90, 200],
      ['footer', 410, 200],
      ['outside horizontally', 400, 410]
    ] as const)('stops when the pointer moves to %s', (_name, y, x) => {
      const { content, items, drag } = createDragHarness()
      drag(items[0], 'dragstart')
      drag(content, 'dragover')
      jest.advanceTimersByTime(160)
      const top = content.scrollTop
      drag(document.body, 'dragover', y, x)
      jest.advanceTimersByTime(500)
      expect(content.scrollTop).toBe(top)
      expect(jest.getTimerCount()).toBe(0)
    })

    it.each(['drop', 'dragend', 'blur', 'render', 'remove', 'leave'] as const)(
      'stops and releases animation work on %s',
      method => {
        const { panel, content, items, drag } = createDragHarness()
        drag(items[0], 'dragstart')
        drag(content, 'dragover')
        jest.advanceTimersByTime(160)
        const top = content.scrollTop
        if (method === 'render') panel.render()
        else if (method === 'remove') panel.element.remove()
        else if (method === 'blur') window.dispatchEvent(new Event('blur'))
        else if (method === 'leave') drag(content, 'dragleave')
        else drag(document.body, method)
        jest.advanceTimersByTime(500)
        expect(content.scrollTop).toBe(top)
        expect(jest.getTimerCount()).toBe(0)
        if (method !== 'leave') {
          drag(content, 'dragover')
          expect(jest.getTimerCount()).toBe(0)
          expect(panel.element.querySelector('.is-dragging, .is-drag-over')).toBeNull()
        }
      }
    )

    it('continues across child elements and ignores unrelated or disabled drags', () => {
      const { panel, content, items, drag } = createDragHarness()
      drag(content, 'dragover')
      expect(jest.getTimerCount()).toBe(0)
      drag(items[0], 'dragstart')
      drag(items[1], 'dragover')
      drag(items[1], 'dragleave', 400, 200, items[2])
      jest.advanceTimersByTime(160)
      expect(content.scrollTop).toBeGreaterThan(0)
      drag(items[0], 'dragend')
      panel.element.querySelector<HTMLButtonElement>('[aria-label="复制 Phase"]')!.click()
      const disabledItem = panel.element.querySelector<HTMLElement>('.phase-tree-item')!
      expect(drag(disabledItem, 'dragstart').defaultPrevented).toBe(true)
      drag(disabledItem, 'dragover')
      expect(jest.getTimerCount()).toBe(0)
    })

    it('does not animate when content fits in the viewport', () => {
      const { content, items, drag } = createDragHarness()
      Object.defineProperty(content, 'scrollHeight', { value: 300 })
      drag(items[0], 'dragstart')
      drag(content, 'dragover')
      jest.advanceTimersByTime(160)
      expect(content.scrollTop).toBe(0)
      expect(jest.getTimerCount()).toBe(0)
    })
  })

  it('hides Phase move controls by default without changing other Phase actions or sequence ordering', () => {
    const { panel, actions } = createCopyHarness()
    expect(panel.element.querySelector('.phase-tree-order-button')).toBeNull()
    expect(panel.element.querySelectorAll('.phase-tree-item[draggable="true"]')).toHaveLength(2)
    expect(panel.element.querySelectorAll('[aria-label="复制 Phase"]')).toHaveLength(2)
    expect(panel.element.querySelectorAll('[aria-label="删除 Phase"]')).toHaveLength(2)
    expect(panel.element.querySelector('[aria-label="上移序列"]')).not.toBeNull()
    expect(panel.element.querySelector('[aria-label="下移序列"]')).not.toBeNull()
    expect(actions.reorderPhase).not.toHaveBeenCalled()
  })

  it('exposes accessible controls only when enabled and applies preference changes on render', () => {
    let phaseMoveEnabled = true
    const { store, panel, actions } = createHarness('zh', [5], false, () => phaseMoveEnabled)
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

    expect(panel.element.querySelector<HTMLButtonElement>('[aria-label="上移 Phase 01"]')!.disabled).toBe(true)
    expect(panel.element.querySelector<HTMLButtonElement>('[aria-label="下移 Phase 02"]')!.disabled).toBe(true)
    panel.element
      .querySelector<HTMLButtonElement>('[aria-label="下移 Phase 01"]')!
      .click()

    expect(actions.reorderPhase).toHaveBeenCalledWith(
      process.id,
      sequence.id,
      'id-3',
      1
    )
    panel.element.querySelector<HTMLButtonElement>('[aria-label="上移 Phase 02"]')!.click()
    expect(actions.reorderPhase).toHaveBeenLastCalledWith(process.id, sequence.id, 'id-4', 0)
    panel.element.querySelectorAll('.phase-icon-button').forEach(button => {
      expect(button.querySelector('svg.phase-ui-icon')).not.toBeNull()
      expect(button.getAttribute('aria-label')).toBeTruthy()
    })
    phaseMoveEnabled = false
    panel.render()
    expect(panel.element.querySelector('.phase-tree-order-button')).toBeNull()
    phaseMoveEnabled = true
    panel.render()
    expect(panel.element.querySelectorAll('.phase-tree-order-button')).toHaveLength(4)
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

  it.each(['zh', 'en'] as const)('deletes the Phase from its row only after confirmation in %s', async locale => {
    injectPhaseWorkspaceStyles()
    const { store, panel, actions } = createHarness(locale)
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
      '.phase-tree-delete'
    )!
    expect(deleteButton.textContent).toBe('')
    expect(deleteButton.getAttribute('aria-label')).toBe(locale === 'zh' ? '删除 Phase' : 'Delete Phase')
    expect(deleteButton.querySelector('svg')).not.toBeNull()
    const controls = deleteButton.closest('.phase-tree-order-controls')!
    expect(controls.children).toHaveLength(3)
    expect(getComputedStyle(controls).gridAutoFlow).toBe('column')
    expect(getComputedStyle(controls).gridAutoColumns).toBe('28px')
    expect(controls.lastElementChild).toBe(deleteButton)
    const processDelete = panel.element.querySelector<HTMLElement>('.phase-process-delete')!
    const sequenceDelete = panel.element.querySelector<HTMLElement>('.phase-sequence-controls .phase-delete-button')!
    for (const remove of [sequenceDelete, deleteButton]) {
      expect(remove.classList.contains('phase-delete-button')).toBe(true)
      expect(getComputedStyle(remove).color).toBe(getComputedStyle(processDelete).color)
      expect(getComputedStyle(remove).borderColor).toBe(getComputedStyle(processDelete).borderColor)
      expect(getComputedStyle(remove).backgroundColor).toBe(getComputedStyle(processDelete).backgroundColor)
    }
    expect(panel.element.querySelector('.phase-overview-identity-header .phase-tree-delete')).toBeNull()
    const modal = document.body.querySelector<HTMLElement>('.confirmation-modal')!
    expect(modal.parentElement).toBe(document.body)
    expect(modal.hidden).toBe(true)

    deleteButton.click()
    expect(modal.hidden).toBe(false)
    expect(modal.textContent).toContain('Phase 01 · 清洗准备')
    modal.querySelector<HTMLButtonElement>('.confirmation-modal-cancel')!.click()
    await Promise.resolve()
    expect(actions.deletePhase).not.toHaveBeenCalled()
    expect(modal.hidden).toBe(true)

    deleteButton.click()
    modal.querySelector<HTMLButtonElement>('.confirmation-modal-confirm')!.click()
    await Promise.resolve()

    expect(actions.deletePhase).toHaveBeenCalledWith(
      process.id,
      sequence.id,
      phase.id
    )
    expect(actions.activatePhase).not.toHaveBeenCalled()
    expect(actions.deleteSequence).not.toHaveBeenCalled()
  })
})
