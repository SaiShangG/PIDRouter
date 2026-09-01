import { ProcessAssistantClient } from '../src/api/processAssistantClient'
import {
  ProcessAssistantFlowPathApi,
  ProcessAssistantMatrixApi
} from '../src/api/processAssistantExportApi'
import { ProcessAssistantFileApi } from '../src/api/processAssistantFileApi'
import { ProcessAssistantOperationApi } from '../src/api/processAssistantOperationApi'
import { ProcessAssistantPhaseApi } from '../src/api/processAssistantPhaseApi'
import { ProcessAssistantProcedureApi } from '../src/api/processAssistantProcedureApi'
import { ProcessAssistantProjectApi } from '../src/api/processAssistantProjectApi'

const createClient = (fetchMock: jest.MockedFunction<typeof fetch>) =>
  new ProcessAssistantClient({
    baseUrl: 'http://api.example.test/',
    fetch: fetchMock
  })

describe('ProcessAssistantClient', () => {
  it('sends requests directly to the configured target server', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response('[]', { headers: { 'Content-Type': 'application/json' } })
    ) as jest.MockedFunction<typeof fetch>
    const client = new ProcessAssistantClient({
      baseUrl: 'http://192.168.1.100:5153',
      fetch: fetchMock
    })

    await client.request('GET', '/api/v1/File')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.1.100:5153/api/v1/File',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('serializes JSON and parses a JSON response', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 3 }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ) as jest.MockedFunction<typeof fetch>
    const client = createClient(fetchMock)

    await expect(
      client.request<{ id: number }>('POST', '/api/items', {
        body: { name: 'CIP' }
      })
    ).resolves.toEqual({ id: 3 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.example.test/api/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'CIP' })
      })
    )
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('handles empty success responses', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, { status: 204 })
    ) as jest.MockedFunction<typeof fetch>

    await expect(
      createClient(fetchMock).request<void>('DELETE', '/api/items/1')
    ).resolves.toBeUndefined()
  })

  it('converts non-success responses into a typed error', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'missing' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' }
      })
    ) as jest.MockedFunction<typeof fetch>

    const promise = createClient(fetchMock).request('GET', '/api/items/9')
    await expect(promise).rejects.toMatchObject({
      name: 'ProcessAssistantApiError',
      status: 404,
      responseBody: { message: 'missing' }
    })
  })

  it('returns file responses as Blob data', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response('drawing-content')
    ) as jest.MockedFunction<typeof fetch>

    const blob = await createClient(fetchMock).requestBlob(
      'GET',
      '/api/files/drawing.dwg'
    )
    await expect(blob.text()).resolves.toBe('drawing-content')
  })

  it('preserves a UTF-8 filename from file responses', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response('matrix-content', {
        headers: {
          'Content-Disposition':
            'attachment; filename*=UTF-8\'\'CIP%20Valve%20Matrix.xlsx'
        }
      })
    ) as jest.MockedFunction<typeof fetch>

    const file = await createClient(fetchMock).requestFile(
      'GET',
      '/api/v1/valve-matrices/7/download'
    )

    expect(file.fileName).toBe('CIP Valve Matrix.xlsx')
    await expect(file.blob.text()).resolves.toBe('matrix-content')
  })
})

describe('ProcessAssistant endpoint services', () => {
  it('uses the direct skill export endpoints', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response('matrix-content'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        message: null,
        result: 'generated-pdf-id'
      }), {
        headers: { 'Content-Type': 'application/json' }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        message: null,
        result: 'generated-zip-id'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })) as jest.MockedFunction<typeof fetch>
    const client = createClient(fetchMock)
    const matrices = new ProcessAssistantMatrixApi(client)
    const flowPaths = new ProcessAssistantFlowPathApi(client)

    await matrices.create({
      projectId: 10,
      selection: {
        1: {
          2: [1, 2, 3],
          3: [4, 5]
        }
      }
    })
    await expect(flowPaths.create({
      projectId: 10,
      selection: {
        1: {
          2: [11, 12],
          3: [13]
        }
      },
      name: 'CIP-flow-path.pdf',
      isPdfMerge: true
    })).resolves.toEqual({
      success: true,
      message: null,
      result: 'generated-pdf-id'
    })
    await expect(flowPaths.create({
      projectId: 10,
      selection: {
        1: {
          2: [11, 12],
          3: [13]
        }
      },
      name: 'CIP-flow-path.zip',
      isPdfMerge: false
    })).resolves.toEqual({
      success: true,
      message: null,
      result: 'generated-zip-id'
    })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.example.test/api/v1/Skill/valve-matrix',
      'http://api.example.test/api/v1/Skill/flow-path',
      'http://api.example.test/api/v1/Skill/flow-path'
    ])
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      JSON.stringify({
        projectId: 10,
        selection: {
          1: {
            2: [1, 2, 3],
            3: [4, 5]
          }
        }
      })
    )
    expect(fetchMock.mock.calls[1][1]?.body).toBe(
      JSON.stringify({
        projectId: 10,
        selection: {
          1: {
            2: [11, 12],
            3: [13]
          }
        },
        name: 'CIP-flow-path.pdf',
        isPdfMerge: true
      })
    )
    expect(fetchMock.mock.calls[2][1]?.body).toBe(
      JSON.stringify({
        projectId: 10,
        selection: {
          1: {
            2: [11, 12],
            3: [13]
          }
        },
        name: 'CIP-flow-path.zip',
        isPdfMerge: false
      })
    )
  })

  it('builds parent filters and encoded File paths from the live contract', async () => {
    const fetchMock = jest.fn().mockImplementation(() =>
      Promise.resolve(
        new Response('[]', {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    ) as jest.MockedFunction<typeof fetch>
    const client = createClient(fetchMock)

    await new ProcessAssistantProcedureApi(client).list(4)
    await new ProcessAssistantOperationApi(client).list(7)
    await new ProcessAssistantPhaseApi(client).list(9)
    await new ProcessAssistantFileApi(client).download('stored file.dwg')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.example.test/api/v1/Procedure?projectId=4',
      'http://api.example.test/api/v1/Operation?procedureId=7',
      'http://api.example.test/api/v1/Phase?operationId=9',
      'http://api.example.test/api/v1/File/download/stored%20file.dwg'
    ])
  })

  it('updates a Phase through the PUT endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, { status: 204 })
    ) as jest.MockedFunction<typeof fetch>
    const phase = { id: 20, name: 'Transfer', operationId: 9 }

    await new ProcessAssistantPhaseApi(createClient(fetchMock)).update(20, phase)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.example.test/api/v1/Phase/20',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(phase)
      })
    )
  })

  it('implements the complete Project endpoint contract', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('[]', {
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response('11', {
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 11, name: 'Project 11' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response('12', {
          headers: { 'Content-Type': 'application/json' }
        })
      ) as jest.MockedFunction<typeof fetch>
    const api = new ProcessAssistantProjectApi(createClient(fetchMock))

    await expect(api.list()).resolves.toEqual([])
    await expect(
      api.create({ name: 'Project 11', jsonData: '{"schemaVersion":1}' })
    ).resolves.toBe(11)
    await expect(api.get(11)).resolves.toEqual({ id: 11, name: 'Project 11' })
    await expect(api.update(11, { id: 11, name: 'Updated' })).resolves.toBeUndefined()
    await expect(
      api.saveStyle(11, JSON.stringify({ presentationProfile: { devices: [] } }))
    ).resolves.toBeUndefined()
    await expect(api.delete(11)).resolves.toBeUndefined()
    await expect(
      api.addV2({ name: 'Project 12', description: 'CIP', fileIds: [3, 4] })
    ).resolves.toBe(12)

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['http://api.example.test/api/v1/Project', 'GET'],
      ['http://api.example.test/api/v1/Project', 'POST'],
      ['http://api.example.test/api/v1/Project/11', 'GET'],
      ['http://api.example.test/api/v1/Project/11', 'PUT'],
      ['http://api.example.test/api/v1/Project/savestyle/11', 'POST'],
      ['http://api.example.test/api/v1/Project/11', 'DELETE'],
      ['http://api.example.test/api/v1/Project/add-v2', 'POST']
    ])
    expect(fetchMock.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ name: 'Project 11', jsonData: '{"schemaVersion":1}' })
    )
    expect(fetchMock.mock.calls[4][1]?.body).toBe(
      JSON.stringify({
        jsonData: JSON.stringify({ presentationProfile: { devices: [] } })
      })
    )
    expect(fetchMock.mock.calls[6][1]?.body).toBe(
      JSON.stringify({
        name: 'Project 12',
        description: 'CIP',
        fileIds: [3, 4]
      })
    )
  })
})