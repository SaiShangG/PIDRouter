import { ProcessAssistantClient } from '../src/api/processAssistantClient'
import { ProcessAssistantFileApi } from '../src/api/processAssistantFileApi'
import { ProcessAssistantOperationApi } from '../src/api/processAssistantOperationApi'
import { ProcessAssistantPhaseApi } from '../src/api/processAssistantPhaseApi'
import { ProcessAssistantProcedureApi } from '../src/api/processAssistantProcedureApi'

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
})

describe('ProcessAssistant endpoint services', () => {
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
})