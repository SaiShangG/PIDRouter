import type { ProcessAssistantProjectApi } from '../src/api/processAssistantProjectApi'
import { ProcessAssistantProjectRepository } from '../src/project/ProcessAssistantProjectRepository'

const createHarness = () => {
  const api = {
    list: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    addV2: jest.fn()
  } as unknown as jest.Mocked<ProcessAssistantProjectApi>
  return { api, repository: new ProcessAssistantProjectRepository(api) }
}

describe('ProcessAssistantProjectRepository', () => {
  it('maps Project DTO jsonData and skips invalid IDs', async () => {
    const { api, repository } = createHarness()
    api.list.mockResolvedValue([
      {
        id: 4,
        name: 'CIP',
        jsonData: JSON.stringify({
          schemaVersion: 1,
          description: 'Cleaning',
          fileIds: [2, 2, -1, 3]
        })
      },
      { name: 'Missing ID' },
      { id: 5, name: 'Broken JSON', jsonData: '{' }
    ])

    await expect(repository.list()).resolves.toEqual([
      { id: 4, name: 'CIP', description: 'Cleaning', fileIds: [2, 3] },
      { id: 5, name: 'Broken JSON', description: '', fileIds: [] }
    ])
  })

  it('creates through add-v2 and reloads the backend DTO', async () => {
    const { api, repository } = createHarness()
    api.addV2.mockResolvedValue(7)
    api.get.mockResolvedValue({
      id: 7,
      name: 'New Project',
      jsonData: JSON.stringify({
        schemaVersion: 1,
        description: 'Description',
        fileIds: [8, 9]
      })
    })

    await expect(
      repository.create({
        name: ' New Project ',
        description: ' Description ',
        fileIds: [8, 8, 9, 0]
      })
    ).resolves.toEqual({
      id: 7,
      name: 'New Project',
      description: 'Description',
      fileIds: [8, 9]
    })
    expect(api.addV2).toHaveBeenCalledWith({
      name: 'New Project',
      description: 'Description',
      fileIds: [8, 9]
    })
    expect(api.get).toHaveBeenCalledWith(7)
  })

  it('updates with versioned jsonData and delegates delete', async () => {
    const { api, repository } = createHarness()
    api.update.mockResolvedValue(undefined)
    api.delete.mockResolvedValue(undefined)

    await expect(
      repository.update(3, {
        name: 'Updated',
        description: 'Details',
        fileIds: [5]
      })
    ).resolves.toEqual({
      id: 3,
      name: 'Updated',
      description: 'Details',
      fileIds: [5]
    })
    expect(api.update).toHaveBeenCalledWith(3, {
      id: 3,
      name: 'Updated',
      jsonData: JSON.stringify({
        schemaVersion: 1,
        description: 'Details',
        fileIds: [5]
      })
    })

    await repository.delete(3)
    expect(api.delete).toHaveBeenCalledWith(3)
  })
})