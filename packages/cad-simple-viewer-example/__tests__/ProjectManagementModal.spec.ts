/** @jest-environment jsdom */

import { ProjectManagementModal } from '../src/project/ProjectManagementModal'
import type { AppLocale } from '../src/locale'
import type { DrawingRecord } from '../src/drawing-library/types'
import type { ProjectRecord, ProjectRepository } from '../src/project/types'

const drawings: DrawingRecord[] = [
  {
    id: '1',
    drawingNumber: 'PID-1001',
    name: 'CIP Supply',
    originalFileName: 'cip-supply.dwg',
    fileSize: 1024,
    uploadedBy: 'Backend',
    uploadedAt: '2026-08-17T08:30:00Z',
    status: 'READY',
    progress: 100
  },
  {
    id: '2',
    drawingNumber: 'PID-1002',
    name: 'CIP Return',
    originalFileName: 'cip-return.dwg',
    fileSize: 2048,
    uploadedBy: 'Backend',
    uploadedAt: '2026-08-17T08:31:00Z',
    status: 'READY',
    progress: 100
  }
]

const existingProject: ProjectRecord = {
  id: 1,
  name: 'Existing Project',
  description: 'Existing description',
  fileIds: [1]
}

const createHarness = (
  projects: ProjectRecord[] = [],
  getLoadedProject?: () => ProjectRecord | undefined,
  locale: AppLocale = 'zh'
) => {
  const onSelect = jest.fn()
  const onDelete = jest.fn()
  const repository: jest.Mocked<ProjectRepository> = {
    list: jest.fn(async () => projects.map(project => ({ ...project }))),
    get: jest.fn(async id => {
      const project = projects.find(item => item.id === id)
      if (!project) throw new Error('Project not found')
      return { ...project }
    }),
    create: jest.fn(async input => {
      const project = {
        ...existingProject,
        id: 2,
        name: input.name,
        description: input.description,
        fileIds: input.fileIds
      }
      projects = [...projects, project]
      return project
    }),
    update: jest.fn(async (id, input) => {
      const project = {
        ...existingProject,
        id,
        name: input.name,
        description: input.description,
        fileIds: input.fileIds
      }
      projects = projects.map(item => (item.id === id ? project : item))
      return project
    }),
    delete: jest.fn(async (_id: number) => undefined)
  }
  const drawingRepository = {
    list: jest.fn(async () => drawings.map(drawing => ({ ...drawing })))
  }
  const modal = new ProjectManagementModal(
    repository,
    drawingRepository,
    {
      onSelect,
      onDelete,
      getLoadedProject
    },
    () => locale
  )
  return { modal, repository, drawingRepository, onSelect, onDelete }
}

const flushPromises = async () => {
  for (let index = 0; index < 10; index++) await Promise.resolve()
}

describe('ProjectManagementModal', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.classList.remove('project-management-open')
    document.body.classList.remove('confirmation-modal-open')
  })

  it('shows projects already created by the user', async () => {
    const { modal } = createHarness([existingProject])

    await modal.open()

    expect(document.body.textContent).toContain('Existing Project')
    expect(document.body.textContent).toContain('1 张 PID')
    expect(document.body.textContent).toContain('ID 1')
  })

  it('shows detailed metadata for the selected project', async () => {
    const { modal, repository, onSelect } = createHarness([existingProject])
    await modal.open()

    document.querySelector<HTMLButtonElement>('.project-list-item')?.click()
    await flushPromises()

    const details = document.querySelector('.project-details')
    expect(details?.textContent).toContain('描述')
    expect(details?.textContent).toContain('Existing description')
    expect(details?.textContent).toContain('包含 PID')
    expect(details?.textContent).toContain('1')
    expect(document.body.textContent).toContain('Project 详情')
    expect(document.querySelector('.project-drawing-option input')).toBeNull()
    expect(document.body.textContent).toContain('编辑')
    expect(repository.get).toHaveBeenCalledWith(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes immediately on load and prevents repeated loads after reopening', async () => {
    const secondProject = {
      ...existingProject,
      id: 2,
      name: 'Second Project',
      fileIds: [2]
    }
    const { modal, onSelect } = createHarness([existingProject, secondProject])
    let finishActivation: () => void = () => undefined
    onSelect.mockImplementation(() => {
      expect(modal.element.hidden).toBe(true)
      expect(
        document.body.classList.contains('project-management-open')
      ).toBe(false)
      return new Promise<void>(resolve => (finishActivation = resolve))
    })
    await modal.open()

    document.querySelector<HTMLButtonElement>('.project-list-item')?.click()
    await flushPromises()

    const load = document.querySelector<HTMLButtonElement>(
      '.project-load-button'
    )!
    load.click()
    load.click()
    expect(onSelect).toHaveBeenCalledWith(existingProject)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(modal.element.hidden).toBe(true)
    await modal.open()
    expect(modal.element.hidden).toBe(false)
    expect(document.body.textContent).toContain('Project 详情')
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        button => button.textContent === '编辑'
      )?.disabled
    ).toBe(true)
    expect(
      document.querySelector<HTMLButtonElement>(
        '[aria-label="关闭 Project 管理"]'
      )?.disabled
    ).toBe(false)

    document
      .querySelectorAll<HTMLButtonElement>('.project-list-item')[1]
      .click()
    await flushPromises()
    expect(document.querySelector('.project-details')?.textContent).toContain(
      '1'
    )
    expect(
      document.querySelector<HTMLInputElement>('input[readonly]')?.value
    ).toBe('Second Project')
    expect(document.body.textContent).toContain('CIP Return')
    expect(document.body.textContent).not.toContain('CIP Supply')
    expect(
      document.querySelector<HTMLButtonElement>('.project-load-button')
        ?.disabled
    ).toBe(true)
    modal.close()
    await modal.open()
    document.querySelector<HTMLButtonElement>('.project-load-button')?.click()
    expect(onSelect).toHaveBeenCalledTimes(1)

    finishActivation()
    await flushPromises()
    expect(document.querySelector('.project-list-item')?.textContent).toContain(
      '已加载'
    )
    expect(
      document.querySelector<HTMLButtonElement>('.project-load-button')
        ?.disabled
    ).toBe(false)
    document.querySelector<HTMLButtonElement>('.project-load-button')?.click()
    expect(onSelect).toHaveBeenLastCalledWith(secondProject)
    finishActivation()
    await flushPromises()
    expect(modal.element.hidden).toBe(true)
    await modal.open()
    expect(
      document.querySelector<HTMLButtonElement>('.project-load-button')
        ?.disabled
    ).toBe(true)
    expect(document.querySelector('.project-load-button')?.textContent).toBe(
      '已加载'
    )
  })

  it('stays closed on load failure and allows retry after reopening', async () => {
    const { modal, onSelect } = createHarness([existingProject])
    onSelect.mockRejectedValue(new Error('PID activation failed'))
    await modal.open()

    document.querySelector<HTMLButtonElement>('.project-list-item')?.click()
    await flushPromises()
    document.querySelector<HTMLButtonElement>('.project-load-button')?.click()
    await flushPromises()

    expect(modal.element.hidden).toBe(true)
    await modal.open()
    expect(document.body.textContent).toContain('PID activation failed')
    expect(modal.element.hidden).toBe(false)
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        button => button.textContent === '编辑'
      )?.disabled
    ).toBe(false)
    onSelect.mockResolvedValue(undefined)
    document.querySelector<HTMLButtonElement>('.project-load-button')?.click()
    await flushPromises()
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(modal.element.hidden).toBe(true)
    await modal.open()
    expect(document.querySelector('.project-load-button')?.textContent).toBe(
      '已加载'
    )
  })

  it('ignores stale project details during rapid selection', async () => {
    const secondProject = {
      ...existingProject,
      id: 2,
      name: 'Second Project',
      fileIds: [2]
    }
    const { modal, repository, onSelect } = createHarness([
      existingProject,
      secondProject
    ])
    let finishFirst!: (project: ProjectRecord) => void
    repository.get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishFirst = resolve
        })
    )
    await modal.open()
    document
      .querySelectorAll<HTMLButtonElement>('.project-list-item')[0]
      .click()
    document
      .querySelectorAll<HTMLButtonElement>('.project-list-item')[1]
      .click()
    await flushPromises()
    finishFirst(existingProject)
    await flushPromises()

    expect(
      document.querySelector<HTMLInputElement>('input[readonly]')?.value
    ).toBe('Second Project')
    expect(
      document.querySelector('.project-list-item.is-selected')?.textContent
    ).toContain('Second Project')
    expect(document.body.textContent).toContain('CIP Return')
    expect(document.body.textContent).not.toContain('CIP Supply')
    expect(onSelect).not.toHaveBeenCalled()
    document.querySelector<HTMLButtonElement>('.project-load-button')?.click()
    await flushPromises()
    expect(onSelect).toHaveBeenCalledWith(secondProject)
  })

  it('does not apply pending details after starting a new project', async () => {
    const { modal, repository, onSelect } = createHarness([existingProject])
    let finishDetails!: (project: ProjectRecord) => void
    repository.get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishDetails = resolve
        })
    )
    await modal.open()
    document.querySelector<HTMLButtonElement>('.project-list-item')?.click()
    document
      .querySelector<HTMLButtonElement>('[aria-label="新建 Project"]')
      ?.click()
    finishDetails(existingProject)
    await flushPromises()
    expect(document.body.textContent).toContain('创建 Project')
    expect(document.querySelector('.project-load-button')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it.each(['zh', 'en'] as const)(
    'distinguishes the selected and loaded projects in %s',
    async locale => {
      const secondProject = {
        ...existingProject,
        id: 2,
        name: 'Second Project'
      }
      const { modal, onSelect } = createHarness(
        [existingProject, secondProject],
        () => existingProject,
        locale
      )
      await modal.open()
      document.querySelector<HTMLButtonElement>('.project-list-item')?.click()
      await flushPromises()
      expect(document.querySelector('.project-load-button')?.textContent).toBe(
        locale === 'zh' ? '已加载' : 'Loaded'
      )
      expect(
        document.querySelector<HTMLButtonElement>('.project-load-button')
          ?.disabled
      ).toBe(true)
      document
        .querySelectorAll<HTMLButtonElement>('.project-list-item')[1]
        .click()
      await flushPromises()
      expect(
        document.querySelector('.project-list-item')?.textContent
      ).toContain(locale === 'zh' ? '已加载' : 'Loaded')
      expect(document.querySelector('.project-load-button')?.textContent).toBe(
        locale === 'zh' ? '加载 Project' : 'Load Project'
      )
      expect(
        document.querySelector<HTMLButtonElement>('.project-load-button')
          ?.disabled
      ).toBe(false)
      expect(onSelect).not.toHaveBeenCalled()
    }
  )

  it('filters PID drawings by name, number, or file name', async () => {
    const { modal } = createHarness()
    await modal.open()
    const search = document.querySelector<HTMLInputElement>(
      '.project-drawing-search input'
    )!

    search.value = 'PID-1002'
    search.dispatchEvent(new Event('input'))

    expect(document.body.textContent).not.toContain('CIP Supply')
    expect(document.body.textContent).toContain('CIP Return')
  })

  it('creates a project with multiple selected PID drawings', async () => {
    const { modal, repository, onSelect } = createHarness()
    await modal.open()
    const name = document.querySelector<HTMLInputElement>(
      'input[placeholder="例如：2026-03CA-PC"]'
    )!
    name.value = '2026-03CA-PC'
    name.dispatchEvent(new Event('input'))
    const description = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="输入 Project 描述"]'
    )!
    description.value = 'CIP Project'
    description.dispatchEvent(new Event('input'))

    document
      .querySelector<HTMLInputElement>('.project-drawing-option input')!
      .click()
    document
      .querySelectorAll<HTMLInputElement>('.project-drawing-option input')[1]
      .click()
    ;[...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === '创建 Project')
      ?.click()
    await flushPromises()

    expect(repository.create).toHaveBeenCalledWith({
      name: '2026-03CA-PC',
      description: 'CIP Project',
      fileIds: [1, 2]
    })
    expect(onSelect).not.toHaveBeenCalled()
    expect(document.querySelector('.project-load-button')?.textContent).toBe(
      '加载 Project'
    )
  })

  it('updates PID associations for an existing project', async () => {
    const { modal, repository, onSelect } = createHarness(
      [existingProject],
      () => existingProject
    )
    await modal.open()
    document.querySelector<HTMLButtonElement>('.project-list-item')?.click()
    await flushPromises()
    ;[...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === '编辑')
      ?.click()
    document
      .querySelectorAll<HTMLInputElement>('.project-drawing-option input')[1]
      .click()
    ;[...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === '保存更改')
      ?.click()
    await flushPromises()

    expect(repository.update).toHaveBeenCalledWith(1, {
      name: 'Existing Project',
      description: 'Existing description',
      fileIds: [1, 2]
    })
    expect(onSelect).not.toHaveBeenCalled()
    expect(
      document.querySelector<HTMLButtonElement>('.project-load-button')
        ?.disabled
    ).toBe(false)
  })

  it('deletes only the selected project after confirmation', async () => {
    const { modal, repository, drawingRepository, onDelete } = createHarness([
      existingProject
    ])
    await modal.open()
    document.querySelector<HTMLButtonElement>('.project-list-item')?.click()
    await flushPromises()
    ;[...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === '删除')
      ?.click()
    await flushPromises()
    ;[...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(
        button =>
          button.textContent === '删除' &&
          button.classList.contains('confirmation-modal-confirm')
      )
      ?.click()
    await flushPromises()

    expect(repository.delete).toHaveBeenCalledWith(1)
    expect(onDelete).toHaveBeenCalledWith(1)
    expect(drawingRepository.list).toHaveBeenCalled()
    expect(document.body.textContent).toContain('创建 Project')
    expect(document.body.textContent).toContain('CIP Supply')
    expect(document.body.textContent).toContain('CIP Return')
    expect(
      document.querySelectorAll('.project-drawing-option input')
    ).toHaveLength(2)
  })
})
