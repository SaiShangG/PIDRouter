import { PhaseWorkspaceRepository } from '../src/phase/phaseWorkspaceRepository'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'

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
    const payload = procedures.create.mock.calls[0][0]
    expect(JSON.parse(payload.jsonData)).toEqual({
      schemaVersion: 1,
      presentationProfile: { deviceStyles: [], utilities: [] }
    })
  })

  it('updates a Process with only the persisted presentation fields', async () => {
    const procedures = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
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
    const presentationProfile = createDefaultPresentationProfile()
    presentationProfile.devices = [{
      id: 'a22a29fb-8de4-447e-884f-fcd79f74cf5d',
      name: 'Valve',
      order: 0,
      states: [{
        id: 'a4f4cb2a-edf8-4880-b45c-0ca42a45063d',
        key: 'open',
        displayName: 'Open',
        color: 16711680,
        lineWidthPx: 3,
        opacity: 1,
        enabled: true,
        autoHighlightFlow: true,
        flowBehavior: 'conducting',
        order: 0
      }]
    }]
    presentationProfile.utilities = [{
      id: '0a4e2606-bb00-479d-bb6d-22c2a8607189',
      name: 'Water',
      style: { color: 51443, lineWidthPx: 3, opacity: 1, visible: true },
      enabled: true,
      order: 0
    }]

    await repository.updateProcess({
      id: '12',
      name: 'CIP',
      presentationProfile,
      sequences: [],
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z'
    })

    const payload = procedures.update.mock.calls[0][1]
    expect(JSON.parse(payload.jsonData)).toEqual({
      schemaVersion: 1,
      presentationProfile: {
        deviceStyles: [{
          id: 'a4f4cb2a-edf8-4880-b45c-0ca42a45063d',
          deviceType: 'Valve',
          deviceState: 'open',
          displayName: 'Open',
          color: '#FF0000',
          lineWidthPx: 3,
          opacity: 1,
          autoHighlightFlow: true,
          flowBehavior: 'conducting'
        }],
        utilities: [{
          id: '0a4e2606-bb00-479d-bb6d-22c2a8607189',
          name: 'Water',
          color: '#00C8F3',
          lineWidthPx: 3,
          opacity: 1
        }]
      }
    })
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
    expect(phase.flowState.deviceStates).toEqual({
      '1A': { key: '1A', label: 'XV-101', mode: 'open' }
    })
    expect(workspace.drawingAssets['file:5'].url).toBe(
      'http://localhost/api/v1/File/download/stored%20drawing.dwg'
    )
    expect(workspace.processes[0].sequences[1].phases[0].flowState).toEqual({
      flowPaths: []
    })
  })
})
