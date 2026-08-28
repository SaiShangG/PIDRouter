import { PhaseWorkspaceRepository } from '../src/phase/phaseWorkspaceRepository'
import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'

describe('PhaseWorkspaceRepository', () => {
  it('persists the drawing with PUT after creating a Phase', async () => {
    const phases = {
      list: jest.fn(),
      create: jest.fn().mockResolvedValue(20),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 1,
      files: { list: jest.fn(), upload: jest.fn() },
      procedures: {
        list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn()
      },
      operations: {
        list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn()
      },
      phases
    })

    await expect(repository.createPhase({
      sequenceId: '10',
      number: 1,
      name: 'Transfer',
      data: repository.createPhaseData(undefined, {
        fileId: 5,
        displayName: 'Supply PID'
      })
    })).resolves.toBe(20)

    const createdPhase = phases.create.mock.calls[0][0]
    expect(phases.update).toHaveBeenCalledWith(
      20,
      { ...createdPhase, id: 20 },
      undefined
    )
    expect(JSON.parse(createdPhase.jsonData)).toEqual({
      Index: 1,
      OrderId: 1,
      Name: 'Transfer',
      Comment: null,
      drawing: { fileId: 5, displayName: 'Supply PID' },
      flowPaths: null,
      deviceStates: null,
      textNotes: []
    })
  })

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
      schemaVersion: 1
    })
  })

  it('updates a Process without persisting its runtime presentation profile', async () => {
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
      sequences: [],
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z'
    })

    const payload = procedures.update.mock.calls[0][1]
    expect(JSON.parse(payload.jsonData)).toEqual({
      schemaVersion: 1
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
      list: jest.fn().mockResolvedValue([{
        id: 2,
        name: 'CIP',
        jsonData: JSON.stringify({
          presentationProfile: {
            deviceStyles: [{
              id: 'legacy-state',
              deviceType: 'Legacy device',
              deviceState: 'legacy'
            }]
          }
        })
      }]),
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
                  Index: 1,
                  OrderId: 1,
                  Name: 'Transfer',
                  Comment: null,
                  drawing: { fileId: 5, displayName: 'Supply PID' },
                  flowPaths: [
                    { handleKey: '26', highlightStyleRefId: 'utility-water' },
                    { handleKey: 'invalid', highlightStyleRefId: 'utility-water' }
                  ],
                  deviceStates: [{
                    handleKey: '26',
                    stateKey: 'Open',
                    highlightStyleRefId: 'state-open',
                    deviceType: 'device-valve'
                  }],
                  textNotes: []
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
    expect(phase.pidOverlayPersistence).toBeUndefined()
    expect(phase.flowState.deviceStates).toEqual({
      '1A': {
        key: '1A',
        label: '1A',
        mode: 'unknown',
        stateKey: 'Open',
        deviceDefinitionId: 'device-valve',
        highlightStyleRefId: 'state-open'
      }
    })
    expect(workspace.drawingAssets['file:5'].url).toBe(
      'http://localhost/api/v1/File/download/stored%20drawing.dwg'
    )
    expect(workspace.processes[0].sequences[1].phases[0].flowState).toEqual({
      flowPaths: []
    })
    expect(workspace.processes[0].sequences[1].phases[0].pidOverlayPersistence)
      .toBeUndefined()
    expect(workspace.presentationProfile.devices).toEqual([])
    expect(workspace.presentationProfile.utilities).toEqual([])
    expect(workspace.processes[0]).not.toHaveProperty('presentationProfile')
  })

  it('keeps a persisted drawing association when the file list is stale', async () => {
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 1,
      files: {
        list: jest.fn().mockResolvedValue([]),
        upload: jest.fn()
      },
      procedures: {
        list: jest.fn().mockResolvedValue([{ id: 2, name: 'CIP' }]),
        create: jest.fn(), update: jest.fn(), delete: jest.fn()
      },
      operations: {
        list: jest.fn().mockResolvedValue([{
          id: 10, name: 'Supply', index: 1, procedureId: 2
        }]),
        create: jest.fn(), update: jest.fn(), delete: jest.fn()
      },
      phases: {
        list: jest.fn().mockResolvedValue([{
          id: 20,
          name: 'Transfer',
          index: 1,
          operationId: 10,
          jsonData: JSON.stringify({
            Index: 1,
            OrderId: 1,
            Name: 'Transfer',
            Comment: null,
            drawing: { fileId: 5, displayName: 'Supply PID' },
            flowPaths: null,
            deviceStates: null,
            textNotes: []
          })
        }]),
        create: jest.fn(), update: jest.fn(), delete: jest.fn()
      }
    })

    const workspace = await repository.load()

    expect(workspace.processes[0].sequences[0].phases[0].drawing).toEqual({
      kind: 'assigned',
      assetId: 'file:5',
      displayName: 'Supply PID'
    })
  })

  it('writes v2 Phase data and protects unsafe persisted overlays', async () => {
    const phases = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 1,
      files: { list: jest.fn(), upload: jest.fn() },
      procedures: {
        list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn()
      },
      operations: {
        list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn()
      },
      phases
    })
    const phase = {
      id: '20',
      number: 1,
      name: 'Transfer',
      drawing: { kind: 'assigned' as const, assetId: 'file:5', displayName: 'PID' },
      flowState: {
        flowPaths: [{
          id: 'flow-1',
          name: 'Main',
          handleKeys: ['1a', '2b', '2B'],
          utilityId: 'utility-water'
        }],
        deviceStates: {
          '1A': {
            key: '1a',
            label: 'XV-101',
            mode: 'open' as const,
            stateKey: 'Open',
            deviceDefinitionId: 'device-valve',
            highlightStyleRefId: 'state-open'
          }
        }
      },
      textNotes: [],
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z'
    }

    await repository.updatePhase('10', phase, 1)
    const payload = phases.update.mock.calls[0][1]
    const persistedOverlay = JSON.parse(payload.jsonData)
    expect(payload.jsonData).not.toContain('"mode"')
    expect(persistedOverlay).toEqual({
      Index: 1,
      OrderId: 1,
      Name: 'Transfer',
      Comment: null,
      drawing: { fileId: 5, displayName: 'PID' },
      flowPaths: [{
        handleKey: '43',
        highlightStyleRefId: 'utility-water'
      }],
      deviceStates: [{
        handleKey: '26',
        stateKey: 'Open',
        highlightStyleRefId: 'state-open',
        deviceType: 'device-valve'
      }],
      textNotes: []
    })

    const rewrittenPhase = {
      ...phase,
      pidOverlayPersistence: {
        status: 'warnings' as const,
        warningCodes: ['invalid-flow-path']
      }
    }
    await expect(repository.updatePhase('10', rewrittenPhase, 1))
      .resolves.toBeUndefined()
    expect(phases.update).toHaveBeenCalledTimes(2)
  })

  it('uses Project Configure as the presentation profile', async () => {
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 1,
      projectConfigure: {
        utilities: [{
          id: 'utility-1',
          name: 'Utility 1',
          lineWidthPx: 3,
          color: '#00C853',
          opacity: 1
        }],
        deviceStyles: [{
          id: 'state-1',
          lineWidthPx: 4,
          color: '#00C853',
          opacity: 0.7,
          deviceType: '设备 1',
          deviceState: 'state-1',
          FillColorString: '#FF0000',
          FillOpacity: 0.2
        }]
      },
      files: { list: jest.fn().mockResolvedValue([]), upload: jest.fn() },
      procedures: {
        list: jest.fn().mockResolvedValue([{ id: 2, name: 'CIP' }]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      operations: {
        list: jest.fn().mockResolvedValue([]),
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

    const profile = (await repository.load()).presentationProfile

    expect(profile.utilities).toHaveLength(1)
    expect(profile.utilities[0].name).toBe('Utility 1')
    expect(profile.devices[0].name).toBe('设备 1')
    expect(profile.devices[0].states[0]).toEqual(expect.objectContaining({
      key: 'state-1',
      color: 0x00c853,
      opacity: 0.7,
      lineWidthPx: 4
    }))
  })
})
