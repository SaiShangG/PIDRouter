import { PhaseWorkspaceRepository } from '../src/phase/phaseWorkspaceRepository'
import { createDefaultPresentationProfile, PhaseWorkspaceStore } from '../src/phase/phaseWorkspaceStore'

describe('PhaseWorkspaceRepository', () => {
  const orderingRepository = (failAt?: number) => {
    const records = [
      { id: 20, operationId: 10, index: 2000, name: 'First', orderIndex: 1, jsonData: '{"OrderId":1,"custom":true}' },
      { id: 21, operationId: 10, index: 2001, name: 'Second', orderIndex: 2, jsonData: '{"OrderId":2}' },
      { id: 22, operationId: 10, index: 2002, name: 'Third', orderIndex: 3, jsonData: '{"OrderId":3}' }
    ]
    const phases = {
      list: jest.fn().mockImplementation(async () => records.map(record => ({ ...record }))),
      get: jest.fn().mockImplementation(async (id: number) => ({ ...records.find(record => record.id === id) })),
      create: jest.fn().mockImplementation(async record => {
        const id = Math.max(0, ...records.map(other => other.id)) + 1
        records.push({ ...record, id })
        return id
      }),
      update: jest.fn().mockImplementation(async (id: number, record) => {
        if (phases.update.mock.calls.length === failAt) throw new Error('Network failed')
        if (records.some(other => other.id !== id && other.orderIndex === record.orderIndex)) {
          throw new Error('Duplicate OrderIndex')
        }
        records[records.findIndex(other => other.id === id)] = record
      }),
      delete: jest.fn()
    }
    const crud = { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '', projectId: 1,
      files: { list: jest.fn().mockResolvedValue([]), upload: jest.fn() },
      procedures: { ...crud, list: jest.fn().mockResolvedValue([{ id: 1, name: 'Process' }]) },
      operations: { ...crud, list: jest.fn().mockResolvedValue([{ id: 10, name: 'Sequence' }]) },
      phases
    })
    return { repository, phases, records }
  }

  it('reorders the whole Sequence without temporary duplicates or changing Phase content', async () => {
    const { repository, records, phases } = orderingRepository()
    const before = records.map(record => ({ ...record }))
    await repository.reorderPhases('10', ['22', '20', '21'])
    expect(phases.update).toHaveBeenCalledTimes(6)
    expect(records.map(record => record.orderIndex)).toEqual([2, 3, 1])
    records.forEach((record, index) => {
      expect(record).toMatchObject({ ...before[index], orderIndex: record.orderIndex, jsonData: record.jsonData })
      expect(JSON.parse(record.jsonData)).toEqual({ ...JSON.parse(before[index].jsonData), OrderId: record.orderIndex })
    })
  })

  it.each([2, 5])('restores original orders when reorder write %s fails', async failAt => {
    const { repository, records } = orderingRepository(failAt)
    const before = records.map(record => ({ ...record }))
    await expect(repository.reorderPhases('10', ['22', '20', '21'])).rejects.toThrow('Network failed')
    expect(records).toEqual(before)
  })

  it('reports rollback failure instead of reporting success', async () => {
    const { repository, phases } = orderingRepository()
    phases.update.mockRejectedValue(new Error('Offline'))
    await expect(repository.reorderPhases('10', ['22', '20', '21']))
      .rejects.toThrow('rollback failed')
  })

  it('loads by OrderIndex even when Phase numbers and JSON OrderId disagree', async () => {
    const { repository, records } = orderingRepository()
    records[0].orderIndex = 3
    records[1].orderIndex = 1
    records[2].orderIndex = 2
    records.forEach(record => {
      record.jsonData = JSON.stringify({
        Index: record.index, OrderId: record.index, Name: record.name,
        Comment: null, autoFlowPaths: [], flowPaths: [], deviceStates: null, textNotes: []
      })
    })
    const workspace = await repository.load()
    expect(workspace.processes[0].sequences[0].phases.map(phase => phase.id))
      .toEqual(['21', '22', '20'])
  })

  it('serializes content saves after reorder and preserves the newly saved order', async () => {
    const { repository, records } = orderingRepository()
    const phase = {
      id: '21', number: 2001, name: 'Edited', drawing: { kind: 'unassigned' as const },
      flowState: { flowPaths: [] }, createdAt: '', updatedAt: ''
    }
    await Promise.all([
      repository.reorderPhases('10', ['22', '20', '21']),
      repository.updatePhaseContent('10', phase)
    ])
    expect(records[1]).toMatchObject({ id: 21, index: 2001, name: 'Edited', orderIndex: 3 })
    expect(JSON.parse(records[1].jsonData).OrderId).toBe(3)
  })

  it('appends simultaneous new Phases with distinct orders unrelated to their numbers', async () => {
    const { repository, records } = orderingRepository()
    await Promise.all([
      repository.createPhase({ sequenceId: '10', number: 6000, name: 'New' }),
      repository.createPhase({ sequenceId: '10', number: 1000, name: 'Another' })
    ])
    expect(records.slice(3).map(record => [record.index, record.orderIndex])).toEqual([[6000, 4], [1000, 5]])
  })

  it('starts a new Sequence at OrderIndex 1', async () => {
    const { repository, records } = orderingRepository()
    records.splice(0)
    const id = await repository.createPhase({ sequenceId: '10', number: 6000, name: 'New' })
    expect(records[0]).toMatchObject({ id, index: 6000, orderIndex: 1 })
    expect(JSON.parse(records[0].jsonData).OrderId).toBe(1)
  })

  it('rejects duplicate new or explicit order writes before submitting', async () => {
    const { repository, phases } = orderingRepository()
    await expect(repository.createPhase({ sequenceId: '10', number: 6000, name: 'New', orderIndex: 2 }))
      .rejects.toThrow('already exists')
    await expect(repository.updatePhase('10', {
      id: '21', number: 2001, name: 'Edited', drawing: { kind: 'unassigned' },
      flowState: { flowPaths: [] }, createdAt: '', updatedAt: ''
    }, 1)).rejects.toThrow('already exists')
    expect(phases.create).not.toHaveBeenCalled()
    expect(phases.update).not.toHaveBeenCalled()
  })

  it.each([undefined, -1, 1.5, Number.NaN])('rejects invalid stored OrderIndex %s before writing', async orderIndex => {
    const { repository, phases, records } = orderingRepository()
    phases.list.mockResolvedValue([{ ...records[0], orderIndex }])
    await expect(repository.createPhase({ sequenceId: '10', number: 6000, name: 'New' }))
      .rejects.toThrow('missing or invalid')
    expect(phases.create).not.toHaveBeenCalled()
    expect(phases.update).not.toHaveBeenCalled()
  })

  it('rejects duplicate stored orders before reordering or creating', async () => {
    const { repository, phases, records } = orderingRepository()
    records[1].orderIndex = 1
    await expect(repository.reorderPhases('10', ['22', '20', '21'])).rejects.toThrow('already exists')
    await expect(repository.createPhase({ sequenceId: '10', number: 6000, name: 'New' }))
      .rejects.toThrow('already exists')
    expect(phases.create).not.toHaveBeenCalled()
    expect(phases.update).not.toHaveBeenCalled()
  })

  it.each([['20', '20', '22'], ['20', '21'], ['20', '21', '99']])(
    'rejects invalid reorder membership before writing (%s)', async (...ids) => {
      const { repository, phases } = orderingRepository()
      await expect(repository.reorderPhases('10', ids)).rejects.toThrow('exactly once')
      expect(phases.update).not.toHaveBeenCalled()
    }
  )

  it.each([30, 0])('preserves backend Order %s when replacing Phase content', async orderIndex => {
    const records = [
      { id: 20, index: 7000, orderIndex: 10, name: 'Source' },
      { id: 21, index: 7005, orderIndex: 20, name: 'Other' },
      { id: 22, index: 7011, orderIndex, name: 'Target' }
    ].map(phase => ({
      ...phase,
      jsonData: JSON.stringify({
        Index: phase.index, OrderId: phase.orderIndex ?? phase.index, Name: phase.name,
        Comment: null, autoFlowPaths: [], flowPaths: [], deviceStates: null, textNotes: [],
        tankId: phase.id === 20 ? 'source-vessel' : 'target-vessel',
        manualCorrections: {
          additions: [{ handleKey: phase.id === 20 ? '171' : '205', highlightStyleRefId: 'water' }],
          exclusions: []
        }
      })
    }))
    const phases = {
      list: jest.fn().mockImplementation(async () => records),
      get: jest.fn().mockImplementation(async (id: number) => records.find(phase => phase.id === id)),
      create: jest.fn(),
      update: jest.fn().mockImplementation(async (id: number, phase) => {
        records[records.findIndex(record => record.id === id)] = phase
      }),
      delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '', projectId: 1,
      now: () => '2026-11-06T00:00:00.000Z',
      files: { list: jest.fn().mockResolvedValue([]), upload: jest.fn() },
      procedures: { list: jest.fn().mockResolvedValue([{ id: 1, name: 'Process' }]), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      operations: { list: jest.fn().mockResolvedValue([{ id: 10, name: 'Sequence' }]), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      phases
    })
    const before = await repository.load()
    const sequence = before.processes[0].sequences[0]
    const target = sequence.phases.find(phase => phase.id === '22')!
    const draft = new PhaseWorkspaceStore(before)
    const replacement = draft.copyPhaseOver('1', '10', '20', '10', target.id)
    await repository.updatePhaseContent('10', replacement)

    expect(phases.get).toHaveBeenCalledWith(22, undefined)
    expect(phases.update).toHaveBeenCalledTimes(1)
    const payload = phases.update.mock.calls[0][1]
    expect(payload).toMatchObject({ id: 22, index: 7011, orderIndex: orderIndex ?? 7011, name: 'Target' })
    expect(JSON.parse(payload.jsonData).OrderId).toBe(orderIndex ?? 7011)
    const after = await repository.load()
    expect(after.processes[0].sequences[0].phases.map(phase => phase.id))
      .toEqual(sequence.phases.map(phase => phase.id))
    const restoredTarget = after.processes[0].sequences[0].phases.find(phase => phase.id === target.id)!
    expect(restoredTarget).toMatchObject({
      id: target.id, number: target.number, name: target.name,
      tankId: 'source-vessel', manualCorrections: replacement.manualCorrections
    })
    expect(after.processes[0].sequences[0].phases.find(phase => phase.id === '20'))
      .toEqual(sequence.phases.find(phase => phase.id === '20'))
  })

  it('round-trips Tank ownership through backend Phase JSON', async () => {
    const phases = {
      list: jest.fn().mockResolvedValue([]), get: jest.fn(), create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined), delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '', projectId: 1,
      files: { list: jest.fn(), upload: jest.fn() },
      procedures: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      operations: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      phases
    })
    const phase = {
      id: '20', number: 1, name: 'Rinse', tankId: 'file:5:E65',
      highlightMode: 'manual' as const,
      drawing: { kind: 'unassigned' as const }, flowState: { flowPaths: [] },
      createdAt: '', updatedAt: ''
    }
    await repository.updatePhase('10', phase, 1)
    const payload = phases.update.mock.calls[0][1]
    expect(JSON.parse(payload.jsonData).tankId).toBe(phase.tankId)
    expect(JSON.parse(payload.jsonData)).not.toHaveProperty('highlightMode')
    phases.get.mockResolvedValue({ ...payload, id: 20 })
    expect((await repository.loadPhase('20', {}, 0)).tankId).toBe(phase.tankId)
    expect(await repository.loadPhase('20', {}, 0)).not.toHaveProperty('highlightMode')
    phases.get.mockResolvedValue({
      ...payload, id: 20,
      jsonData: JSON.stringify({ ...JSON.parse(payload.jsonData), highlightMode: 'invalid' })
    })
    expect(await repository.loadPhase('20', {}, 0)).not.toHaveProperty('highlightMode')
    await repository.updatePhase('10', { ...phase, tankId: undefined }, 1)
    expect(JSON.parse(phases.update.mock.calls[1][1].jsonData)).not.toHaveProperty('tankId')
  })

  it('persists the drawing with PUT after creating a Phase', async () => {
    const phases = {
      list: jest.fn().mockResolvedValue([{ id: 19, index: 6000, orderIndex: 7 }]),
      get: jest.fn(),
      create: jest.fn().mockResolvedValue(20),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 1,
      projectConfigure: {
        deviceStyles: [{
          id: 'state-open',
          deviceType: 'VALVE',
          deviceState: 'OPEN',
          displayName: 'Open',
          color: '#00C853',
          lineWidthPx: 3,
          opacity: 1,
          autoHighlightFlow: true,
          flowBehavior: 'conducting'
        }]
      },
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
      number: 6010,
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
      Index: 6010,
      OrderId: 8,
      Name: 'Transfer',
      Comment: null,
      drawing: { fileId: 5, displayName: 'Supply PID' },
      autoFlowPaths: [],
      flowPaths: [],
      deviceStates: null,
      mergedDeviceStates: [],
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
        get: jest.fn(),
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
        get: jest.fn(),
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
                  autoFlowPaths: [{
                    id: 'flow-1', name: 'Main', ownerHandleKey: '26',
                    handleKeys: ['26'],
                    highlightStyleRefId: 'utility-water'
                  }],
                  flowPaths: [],
                  deviceStates: [{
                    handleKey: '26',
                    stateKey: 'Open',
                    highlightStyleRefId: 'state-open',
                    deviceType: 'device-valve'
                  }, {
                    handleKey: '27',
                    stateKey: 'Open',
                    highlightStyleRefId: 'state-open'
                  }],
                  textNotes: []
                })
              }
            ]
            : [
              {
                id: 21,
                name: 'Empty state',
                index: 1,
                operationId: 11,
                jsonData: JSON.stringify({
                  Index: 1, OrderId: 1, Name: 'Empty state', Comment: null,
                  autoFlowPaths: [], flowPaths: [], deviceStates: [], textNotes: []
                })
              }
            ]
        )
      ),
      get: jest.fn(),
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
        stateKey: 'Open',
        deviceType: 'device-valve',
        highlightStyleRefId: 'state-open'
      },
      '1B': {
        key: '1B',
        stateKey: 'Open',
        deviceType: 'UNKNOWN',
        highlightStyleRefId: 'state-open'
      }
    })
    expect(workspace.drawingAssets['file:5'].url).toBe(
      '/api/v1/File/download/stored%20drawing.dwg'
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
            autoFlowPaths: [],
            deviceStates: null,
            textNotes: []
          })
        }]),
        get: jest.fn(),
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
      list: jest.fn().mockResolvedValue([]),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn()
    }
    const repository = new PhaseWorkspaceRepository({
      baseUrl: '',
      projectId: 1,
      projectConfigure: {
        deviceStyles: [{
          id: 'state-open',
          deviceType: 'VALVE',
          deviceState: 'OPEN',
          displayName: 'Open',
          color: '#00C853',
          lineWidthPx: 3,
          opacity: 1,
          autoHighlightFlow: true,
          flowBehavior: 'conducting'
        }]
      },
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
          highlightStyleRefId: 'utility-water'
        }],
        deviceStates: {
          '1A': {
            key: '1a',
            stateKey: 'OPEN',
            deviceType: 'VALVE',
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
      autoFlowPaths: [{
        id: 'flow-1', name: 'Main', handleKeys: ['26', '43'],
        highlightStyleRefId: 'utility-water'
      }],
      flowPaths: [{
        handleKey: '43',
        highlightStyleRefId: 'utility-water'
      }],
      deviceStates: [{
        handleKey: '26',
        stateKey: 'OPEN',
        highlightStyleRefId: 'state-open',
        deviceType: 'VALVE'
      }],
      mergedDeviceStates: [{
        handleKey: '26',
        stateKey: 'OPEN',
        highlightStyleRefId: 'state-open',
        deviceType: 'VALVE',
        source: 'auto'
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
        get: jest.fn(),
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
