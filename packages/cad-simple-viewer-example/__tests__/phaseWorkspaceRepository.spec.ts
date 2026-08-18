import { PhaseWorkspaceRepository } from '../src/phase/phaseWorkspaceRepository'

describe('PhaseWorkspaceRepository', () => {
  it('creates a Process through the Procedure API', async () => {
    const procedures = {
      list: jest.fn(),
      create: jest.fn().mockResolvedValue(12),
      update: jest.fn(),
      delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 1,
      files: { list: jest.fn(), upload: jest.fn() },
      procedures,
      operations: {
        list: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      phases: {
        list: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    })

    await expect(repository.createProcess('CIP')).resolves.toBe(12)
    expect(procedures.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CIP',
        projectId: 1,
        jsonData: expect.any(String)
      }),
      undefined
    )
  })

  it('loads and maps the backend hierarchy and persisted phase state', async () => {
    const files = {
      list: jest.fn().mockResolvedValue([
        {
          id: 5,
          originalFileName: 'PID-1001.dwg',
          storedFileName: 'stored drawing.dwg'
        }
      ]),
      upload: jest.fn()
    }
    const procedures = {
      list: jest.fn().mockResolvedValue([{ id: 2, name: 'CIP' }]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
    const operations = {
      list: jest.fn().mockResolvedValue([
        { id: 11, name: 'Rinse', index: 2, orderIndex: 2, procedureId: 2 },
        { id: 10, name: 'Supply', index: 1, orderIndex: 1, procedureId: 2 }
      ]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
    const phases = {
      list: jest.fn().mockImplementation((operationId: number) =>
        Promise.resolve(
          operationId === 10
            ? [
                {
                  id: 20,
                  name: 'Transfer',
                  index: 1,
                  operationId: 10,
                  jsonData: JSON.stringify({
                    schemaVersion: 1,
                    drawing: { fileId: 5, displayName: 'Supply PID' },
                    flowState: {
                      flowPaths: [
                        { id: 'flow-1', name: 'Main', handleKeys: ['1A'] }
                      ]
                    },
                    deviceStates: {
                      '1A': { label: 'XV-101', mode: 'open' }
                    }
                  })
                }
              ]
            : [
                {
                  id: 21,
                  name: 'Broken state',
                  index: 1,
                  operationId: 11,
                  jsonData: '{invalid'
                }
              ]
        )
      ),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 7,
      files,
      procedures,
      operations,
      phases,
      now: () => '2026-08-18T00:00:00.000Z'
    })

    const workspace = await repository.load()

    expect(procedures.list).toHaveBeenCalledWith(7, undefined)
    expect(operations.list).toHaveBeenCalledWith(2, undefined)
    expect(phases.list).toHaveBeenCalledTimes(2)
    expect(workspace.processes[0].sequences.map(sequence => sequence.id)).toEqual([
      '10',
      '11'
    ])
    const phase = workspace.processes[0].sequences[0].phases[0]
    expect(phase.drawing).toEqual({
      kind: 'assigned',
      assetId: 'file:5',
      displayName: 'Supply PID'
    })
    expect(phase.flowState.flowPaths[0].handleKeys).toEqual(['1A'])
    expect(phase.deviceStates['1A']).toEqual({
      key: '1A',
      label: 'XV-101',
      mode: 'open'
    })
    expect(workspace.drawingAssets['file:5'].url).toBe(
      '/api/v1/File/download/stored%20drawing.dwg'
    )
    expect(workspace.processes[0].sequences[1].phases[0].flowState).toEqual({
      flowPaths: []
    })
  })
})