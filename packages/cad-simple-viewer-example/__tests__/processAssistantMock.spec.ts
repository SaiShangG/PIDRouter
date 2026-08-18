import { setupServer } from 'msw/node'

import { ProcessAssistantClient } from '../src/api/processAssistantClient'
import { ProcessAssistantFileApi } from '../src/api/processAssistantFileApi'
import { ProcessAssistantOperationApi } from '../src/api/processAssistantOperationApi'
import { ProcessAssistantPhaseApi } from '../src/api/processAssistantPhaseApi'
import { ProcessAssistantProcedureApi } from '../src/api/processAssistantProcedureApi'
import { processAssistantHandlers } from '../src/mocks/process-assistant/handlers'
import { processAssistantMockStore } from '../src/mocks/process-assistant/store'

const server = setupServer(...processAssistantHandlers)
let files: ProcessAssistantFileApi
let procedures: ProcessAssistantProcedureApi
let operations: ProcessAssistantOperationApi
let phases: ProcessAssistantPhaseApi

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  const client = new ProcessAssistantClient({
    baseUrl: 'http://api.example.test'
  })
  files = new ProcessAssistantFileApi(client)
  procedures = new ProcessAssistantProcedureApi(client)
  operations = new ProcessAssistantOperationApi(client)
  phases = new ProcessAssistantPhaseApi(client)
})
beforeEach(() => processAssistantMockStore.reset())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Process Assistant mock hierarchy', () => {
  it('loads fixtures and supports a complete hierarchy CRUD flow', async () => {
    await expect(procedures.list(1)).resolves.toEqual([
      expect.objectContaining({ id: 1, name: 'Mock CIP Procedure' })
    ])
    await expect(operations.list(1)).resolves.toEqual([
      expect.objectContaining({ id: 1, procedureId: 1 })
    ])
    await expect(phases.list(1)).resolves.toEqual([
      expect.objectContaining({ id: 1, operationId: 1 })
    ])

    const procedureId = await procedures.create({
      name: 'Created Procedure',
      projectId: 1,
      jsonData: JSON.stringify({ schemaVersion: 1 })
    })
    await procedures.update(procedureId, {
      name: 'Updated Procedure',
      projectId: 1,
      jsonData: JSON.stringify({ schemaVersion: 1 })
    })
    await expect(procedures.get(procedureId)).resolves.toEqual(
      expect.objectContaining({ id: procedureId, name: 'Updated Procedure' })
    )

    const operationId = await operations.create({
      name: 'Created Operation',
      procedureId,
      orderIndex: 0,
      jsonData: JSON.stringify({ schemaVersion: 1 })
    })
    await expect(operations.list(procedureId)).resolves.toEqual([
      expect.objectContaining({ id: operationId, procedureId })
    ])

    const phaseJsonData = JSON.stringify({
      schemaVersion: 1,
      drawing: null,
      flowState: { flowPaths: [{ id: 'mock-flow' }] },
      deviceStates: { V101: { state: 'open' } }
    })
    const phaseId = await phases.create({
      name: 'Created Phase',
      operationId,
      orderIndex: 0,
      jsonData: phaseJsonData
    })
    await phases.update(phaseId, {
      name: 'Updated Phase',
      operationId,
      orderIndex: 0,
      jsonData: phaseJsonData
    })
    await expect(phases.get(phaseId)).resolves.toEqual(
      expect.objectContaining({
        id: phaseId,
        name: 'Updated Phase',
        jsonData: phaseJsonData
      })
    )

    await phases.delete(phaseId)
    await operations.delete(operationId)
    await procedures.delete(procedureId)
    await expect(procedures.get(procedureId)).rejects.toMatchObject({
      name: 'ProcessAssistantApiError',
      status: 404
    })
  })

  it('returns typed 400 and 404 API errors', async () => {
    await expect(
      operations.create({ name: 'Orphan', procedureId: 999 })
    ).rejects.toMatchObject({
      name: 'ProcessAssistantApiError',
      status: 400
    })
    await expect(phases.get(999)).rejects.toMatchObject({
      name: 'ProcessAssistantApiError',
      status: 404
    })
  })
})

describe('Process Assistant mock files', () => {
  it('uploads, downloads, updates, and deletes files', async () => {
    await expect(files.list()).resolves.toEqual([
      expect.objectContaining({ storedFileName: '1-mock-pid.dxf' })
    ])

    const content = 'mock drawing content'
    const uploaded = await files.upload({
      file: new File([content], 'drawing one.dwg', {
        type: 'application/octet-stream'
      }),
      comment: JSON.stringify({ name: 'Drawing One', drawingNumber: 'D-001' })
    })
    expect(uploaded).toEqual(
      expect.objectContaining({
        id: 2,
        originalFileName: 'drawing one.dwg',
        comment: JSON.stringify({
          name: 'Drawing One',
          drawingNumber: 'D-001'
        })
      })
    )

    const blob = await files.download(uploaded.storedFileName!)
    await expect(blob.text()).resolves.toBe(content)

    await files.updateComment(uploaded.id!, 'updated comment')
    await expect(files.get(uploaded.id!)).resolves.toEqual(
      expect.objectContaining({ comment: 'updated comment' })
    )

    const multiple = await files.uploadMultiple([
      new File(['a'], 'a.dxf'),
      new File(['b'], 'b.dxf')
    ])
    expect(multiple).toHaveLength(2)

    await files.delete(uploaded.storedFileName!)
    await expect(files.get(uploaded.id!)).rejects.toMatchObject({
      name: 'ProcessAssistantApiError',
      status: 404
    })
  })
})
