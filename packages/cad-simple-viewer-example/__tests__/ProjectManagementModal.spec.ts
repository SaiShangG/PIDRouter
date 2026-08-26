/** @jest-environment jsdom */

import { ProjectManagementModal } from '../src/project/ProjectManagementModal'
import type { DrawingRecord } from '../src/drawing-library/types'
import type {
  ProjectRecord,
  ProjectRepository
} from '../src/project/types'

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

const createHarness = (projects: ProjectRecord[] = []) => {
  const onSelect = jest.fn()
  const onDelete = jest.fn()
  const repository: jest.Mocked<ProjectRepository> = {
    list: jest.fn(async () => projects.map(project => ({ ...project }))),
    get: jest.fn(async id => {
      const project = projects.find(item => item.id === id)
      if (!project) throw new Error('Project not found')
      return { ...project }
    }),
    create: jest.fn(async input => ({
      ...existingProject,
      id: 2,
      name: input.name,
      description: input.description,
      fileIds: input.fileIds
    })),
    update: jest.fn(async (id, input) => ({
      ...existingProject,
      id,
      name: input.name,
      description: input.description,
      fileIds: input.fileIds
    })),
    delete: jest.fn(async (_id: number) => undefined)
  }
  const drawingRepository = {
    list: jest.fn(async () => drawings.map(drawing => ({ ...drawing })))
  }
  const modal = new ProjectManagementModal(repository, drawingRepository, {
    onSelect,
    onDelete
  })
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
    expect(onSelect).toHaveBeenCalledWith(existingProject)
  })

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
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: '2026-03CA-PC' })
    )
  })

  it('updates PID associations for an existing project', async () => {
    const { modal, repository } = createHarness([existingProject])
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