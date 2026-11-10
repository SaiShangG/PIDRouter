/** @jest-environment jsdom */

import type { ProjectPackageImportResult } from '../src/api/processAssistantProjectPackageApi'
import type { DrawingRecord } from '../src/drawing-library/types'
import type { AppLocale } from '../src/locale'
import { ProjectManagementModal, type ProjectManagementModalOptions } from '../src/project/ProjectManagementModal'
import type { ProjectRecord, ProjectRepository } from '../src/project/types'

const drawings: DrawingRecord[] = [
  {
    id: '1',
    drawingNumber: 'PID-1001',
    name: 'CIP Supply',
    originalFileName: 'cip-supply.pdi',
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
    originalFileName: 'cip-return.PDI',
    fileSize: 2048,
    uploadedBy: 'Backend',
    uploadedAt: '2026-08-17T08:31:00Z',
    status: 'READY',
    progress: 100
  }
]

const nonPidDrawings: DrawingRecord[] = [
  'project.xlsx',
  'project.xls',
  'drawing.dwg',
  'drawing.dxf',
  'notes.pdf',
  'drawing.pdi.xlsx'
].map((originalFileName, index) => ({
  ...drawings[0],
  id: String(index + 3),
  name: originalFileName,
  originalFileName
}))

const existingProject: ProjectRecord = {
  id: 1,
  name: 'Existing Project',
  description: 'Existing description',
  fileIds: [1]
}

const createHarness = (
  projects: ProjectRecord[] = [],
  getLoadedProject?: () => ProjectRecord | undefined,
  locale: AppLocale = 'zh',
  options: ProjectManagementModalOptions = {}
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
      getLoadedProject,
      ...options
    },
    () => locale
  )
  return {
    modal, repository, drawingRepository, onSelect, onDelete,
    setProjects: (next: ProjectRecord[]) => { projects = next }
  }
}

const choosePackage = (file = new File(['package'], 'project.pidproject')) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change'))
  return file
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

  it('only offers PDI files when creating a Project', async () => {
    const { modal, drawingRepository } = createHarness()
    drawingRepository.list.mockResolvedValue([...drawings, ...nonPidDrawings])

    await modal.open()

    expect(
      [...document.querySelectorAll('.project-drawing-option small')].map(
        option => option.textContent
      )
    ).toEqual([
      'PID-1001 · cip-supply.pdi',
      'PID-1002 · cip-return.PDI'
    ])
  })

  it.each([{ pdiIds: [] }, { pdiIds: [1] }, { pdiIds: [1, 2] }])(
    'counts only available PDI files $pdiIds in every Project PID count', async ({ pdiIds }) => {
    const project = {
      ...existingProject,
      fileIds: [...pdiIds, ...nonPidDrawings.map(drawing => Number(drawing.id)), 999]
    }
    const { modal, drawingRepository } = createHarness([project])
    drawingRepository.list.mockResolvedValue([...drawings, ...nonPidDrawings])
    await modal.open()

    expect(document.querySelector('.project-list-item-details')?.textContent)
      .toContain(`${pdiIds.length} 张 PID`)
    document.querySelector<HTMLButtonElement>('.project-list-item')!.click()
    await flushPromises()

    expect(document.querySelectorAll('.project-details dd')[1].textContent)
      .toBe(`${pdiIds.length} 张`)
    expect(document.querySelector('.project-drawing-header span')?.textContent)
      .toBe(`${pdiIds.length} 张`)
    expect(document.querySelectorAll('.project-drawing-option')).toHaveLength(pdiIds.length)
    expect(document.querySelector('.project-drawing-list')?.textContent)
      .not.toContain('xlsx')

    const search = document.querySelector<HTMLInputElement>(
      '.project-drawing-search input'
    )!
    search.value = 'cip-return'
    search.dispatchEvent(new Event('input'))
    expect(document.querySelector('.project-drawing-header span')?.textContent)
      .toBe(`${pdiIds.length} 张`)
    }
  )

  it('saves PDI selections without removing existing non-PID attachments', async () => {
    const project = { ...existingProject, fileIds: [1, 3, 5] }
    const { modal, repository, drawingRepository } = createHarness([project])
    drawingRepository.list.mockResolvedValue([...drawings, ...nonPidDrawings])
    await modal.open()
    document.querySelector<HTMLButtonElement>('.project-list-item')!.click()
    await flushPromises()
    const clickButton = (text: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent === text)!.click()

    clickButton('编辑')
    clickButton('取消')
    expect(document.querySelector('.project-drawing-header span')?.textContent)
      .toBe('1 张')
    clickButton('编辑')
    document.querySelectorAll<HTMLInputElement>('.project-drawing-option input')[1]
      .click()
    clickButton('保存更改')
    await flushPromises()

    expect(repository.update).toHaveBeenCalledWith(1, {
      name: project.name,
      description: project.description,
      fileIds: [3, 5, 1, 2]
    })
    expect(document.querySelector('.project-drawing-header span')?.textContent)
      .toBe('2 张')
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

  it('exports the selected project rather than the loaded project and blocks duplicates', async () => {
    const second = { ...existingProject, id: 2, name: 'Second project' }
    let finish!: () => void
    const onExport = jest.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const { modal } = createHarness([existingProject, second], () => existingProject, 'zh', { onExport })
    await modal.open()
    expect(document.querySelector<HTMLButtonElement>('.project-export-button')?.disabled).toBe(true)
    document.querySelectorAll<HTMLButtonElement>('.project-list-item')[1].click()
    await flushPromises()
    document.querySelector<HTMLButtonElement>('.project-export-button')!.click()
    document.querySelector<HTMLButtonElement>('.project-export-button')!.click()
    modal.close()
    expect(modal.element.hidden).toBe(false)
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport).toHaveBeenCalledWith(2)
    expect(document.body.textContent).toContain('正在导出项目包')
    finish()
    await flushPromises()
    expect(document.querySelector('[role="status"]')?.textContent).toContain('项目包已下载')
    expect(document.querySelector<HTMLButtonElement>('.project-export-button')?.disabled).toBe(false)
  })

  it('reports an export failure without displaying download success', async () => {
    const onExport = jest.fn().mockRejectedValue(new Error('export unavailable'))
    const { modal } = createHarness([existingProject], undefined, 'zh', { onExport })
    await modal.open()
    document.querySelector<HTMLButtonElement>('.project-list-item')!.click()
    await flushPromises()
    document.querySelector<HTMLButtonElement>('.project-export-button')!.click()
    await flushPromises()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('export unavailable')
    expect(document.body.textContent).not.toContain('项目包已下载')
  })

  it.each(['zh', 'en'] as const)('imports a new project with the same name without frontend name matching (%s)', async locale => {
    const created = { ...existingProject, id: 2, fileIds: [2, 3] }
    const imported: ProjectPackageImportResult = {
      projectId: 2, projectKey: 'new-project-key', name: created.name, action: 'created'
    }
    const onImport = jest.fn()
    const onImported = jest.fn()
    const harness = createHarness([existingProject], undefined, locale, { onImport, onImported })
    harness.drawingRepository.list.mockResolvedValue([...drawings, ...nonPidDrawings])
    onImport.mockImplementation(async () => {
      harness.setProjects([existingProject, created])
      return imported
    })
    await harness.modal.open()
    const file = choosePackage()
    await flushPromises()
    expect(onImport).toHaveBeenCalledWith(file, expect.any(String))
    expect(onImported).toHaveBeenCalledWith(imported)
    expect(document.querySelectorAll('.project-list-item')).toHaveLength(2)
    expect(document.querySelector('.project-list-item.is-selected')?.textContent).toContain('ID 2')
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      locale === 'zh' ? '已新增 Project' : 'new Project'
    )
    expect(harness.repository.create).not.toHaveBeenCalled()
    expect(harness.repository.update).not.toHaveBeenCalled()
    expect(harness.repository.delete).not.toHaveBeenCalled()
    expect(harness.onSelect).not.toHaveBeenCalled()
    expect(document.querySelectorAll('.project-drawing-option')).toHaveLength(1)
    expect(document.querySelector('.project-drawing-option')?.textContent)
      .toContain('cip-return.PDI')
    expect(document.querySelectorAll('.project-details dd')[1].textContent)
      .toContain('1')
    expect(document.querySelector('.project-drawing-list')?.textContent)
      .not.toContain('xlsx')
  })

  it('allows import without existing projects or drawings', async () => {
    const onImport = jest.fn().mockResolvedValue({
      projectId: 1, projectKey: 'key', name: existingProject.name, action: 'created'
    })
    const harness = createHarness([], undefined, 'zh', { onImport })
    harness.drawingRepository.list.mockResolvedValue([])
    onImport.mockImplementation(async () => {
      harness.setProjects([existingProject])
      return { projectId: 1, projectKey: 'key', name: existingProject.name, action: 'created' }
    })
    await harness.modal.open()
    expect(document.querySelector<HTMLButtonElement>('.project-import-button')?.disabled).toBe(false)
    choosePackage()
    await flushPromises()
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.project-list-item.is-selected')?.textContent).toContain('ID 1')
  })

  it('replaces immediately without confirmation and invalidates loaded status even with identical metadata', async () => {
    const imported: ProjectPackageImportResult = {
      projectId: 1, projectKey: 'existing-project-key',
      name: existingProject.name, action: 'replaced'
    }
    const onImport = jest.fn().mockResolvedValue(imported)
    const onImported = jest.fn()
    const harness = createHarness([existingProject], () => existingProject, 'zh', { onImport, onImported })
    await harness.modal.open()
    document.querySelector<HTMLButtonElement>('.project-list-item')!.click()
    await flushPromises()
    expect(document.querySelector<HTMLButtonElement>('.project-load-button')?.disabled).toBe(true)
    choosePackage()
    await flushPromises()
    expect(onImported).toHaveBeenCalledWith(imported)
    expect(document.querySelector('.confirmation-modal:not([hidden])')).toBeNull()
    expect(document.querySelectorAll('.project-list-item')).toHaveLength(1)
    expect(document.querySelector('[role="status"]')?.textContent).toContain('已覆盖替换')
    expect(document.querySelector<HTMLButtonElement>('.project-load-button')?.disabled).toBe(false)
    document.querySelector<HTMLButtonElement>('.project-load-button')!.click()
    await flushPromises()
    expect(harness.onSelect).toHaveBeenCalledWith(existingProject)
    expect(harness.onSelect).toHaveBeenCalledTimes(1)
  })

  it('blocks duplicate imports and closing while a request is pending', async () => {
    let finish!: (result: ProjectPackageImportResult) => void
    const onImport = jest.fn(() => new Promise<ProjectPackageImportResult>(resolve => { finish = resolve }))
    const { modal } = createHarness([existingProject], undefined, 'zh', { onImport })
    await modal.open()
    choosePackage()
    choosePackage()
    modal.close()
    expect(modal.element.hidden).toBe(false)
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(document.querySelector<HTMLButtonElement>('.project-import-button')?.disabled).toBe(true)
    finish({ projectId: 1, projectKey: 'key', name: existingProject.name, action: 'replaced' })
    await flushPromises()
    expect(document.querySelector<HTMLButtonElement>('.project-import-button')?.disabled).toBe(false)
  })

  it('retries a failed import with exactly the same file and idempotency key', async () => {
    const onImport = jest.fn().mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({
        projectId: 1, projectKey: 'key', name: existingProject.name, action: 'replaced'
      })
    const onImported = jest.fn()
    const { modal } = createHarness([existingProject], undefined, 'en', { onImport, onImported })
    await modal.open()
    const file = choosePackage()
    await flushPromises()
    expect(onImported).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Project import failed')
    expect(document.body.textContent).toContain('connection lost')
    document.querySelector<HTMLButtonElement>('.project-import-retry')!.click()
    await flushPromises()
    expect(onImport).toHaveBeenCalledTimes(2)
    expect(onImport.mock.calls[1]).toEqual(onImport.mock.calls[0])
    expect(onImport.mock.calls[1][0]).toBe(file)
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.project-import-retry')).toBeNull()
    expect(document.querySelector('[role="status"]')?.textContent).toContain('replaced')
  })

  it('refreshes after a committed import failure without submitting the import again', async () => {
    const onImport = jest.fn().mockResolvedValue({
      projectId: 1, projectKey: 'key', name: existingProject.name, action: 'replaced'
    })
    const harness = createHarness([existingProject], undefined, 'zh', { onImport })
    await harness.modal.open()
    harness.repository.list.mockRejectedValueOnce(new Error('list unavailable'))
    choosePackage()
    await flushPromises()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('项目已导入，但刷新失败')
    expect(document.querySelector('.project-import-retry')).toBeNull()
    document.querySelector<HTMLButtonElement>('.project-package-refresh')!.click()
    await flushPromises()
    expect(onImport).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="status"]')?.textContent).toContain('已覆盖替换')
    expect(document.querySelector('.project-package-refresh')).toBeNull()
  })

  it('rejects stale project lists after import and offers refresh rather than another upload', async () => {
    const onImport = jest.fn().mockResolvedValue({
      projectId: 2, projectKey: 'new-key', name: 'New project', action: 'created'
    })
    const harness = createHarness([existingProject], undefined, 'zh', { onImport })
    await harness.modal.open()
    harness.repository.get.mockResolvedValue({ ...existingProject, id: 2, name: 'New project' })
    choosePackage()
    await flushPromises()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('尚未出现在后台项目列表')
    expect(document.querySelector('.project-package-refresh')).not.toBeNull()
    expect(document.querySelector('.project-import-retry')).toBeNull()
  })

  it('does not select a different project when the detail response has the wrong ID', async () => {
    const onImport = jest.fn().mockResolvedValue({
      projectId: 2, projectKey: 'new-key', name: 'New project', action: 'created'
    })
    const harness = createHarness([existingProject], undefined, 'zh', { onImport })
    await harness.modal.open()
    harness.repository.get.mockResolvedValue(existingProject)
    choosePackage()
    await flushPromises()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('与导入结果不一致')
    expect(document.querySelector('.project-list-item.is-selected')).toBeNull()
    expect(document.querySelector('.project-package-refresh')).not.toBeNull()
    expect(harness.onSelect).not.toHaveBeenCalled()
  })
})
