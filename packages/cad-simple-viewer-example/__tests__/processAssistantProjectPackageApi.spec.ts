import JSZip from 'jszip'

import { ProcessAssistantClient } from '../src/api/processAssistantClient'
import {
  getProjectPackageErrorMessage,
  ProcessAssistantProjectPackageApi,
  type ProjectPackageImportResult
} from '../src/api/processAssistantProjectPackageApi'
import { ProcessAssistantApiError } from '../src/api/processAssistantTypes'

const projectKey = 'f36fd893-b44f-4e16-bc37-928aef3d400a'
const result: ProjectPackageImportResult = {
  projectId: 12, projectKey, name: 'Process project', action: 'created'
}

const createHarness = () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
  const api = new ProcessAssistantProjectPackageApi(
    new ProcessAssistantClient({ baseUrl: 'http://api.example.test', fetch: fetchMock })
  )
  return { api, fetchMock }
}

const zipContent = async () => {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify({ schemaVersion: 1, projectKey }))
  zip.file('project.json', JSON.stringify({ name: result.name }))
  return zip.generateAsync({ type: 'arraybuffer' })
}

const jsonResponse = (value: unknown, status = 201) =>
  new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json' }
  })

describe('project package API', () => {
  it.each(['application/zip', 'application/octet-stream', 'application/x-zip-compressed'])(
    'downloads ZIP bytes and the UTF-8 filename with %s',
    async type => {
      const { api, fetchMock } = createHarness()
      const content = await zipContent()
      fetchMock.mockResolvedValue(new Response(content, {
        headers: {
          'Content-Type': type,
          'Content-Disposition': 'attachment; filename*=UTF-8\'\'%E9%A1%B9%E7%9B%AE.pidproject'
        }
      }))
      const controller = new AbortController()
      const downloaded = await api.exportPackage(12, controller.signal)
      expect(downloaded.fileName).toBe('项目.pidproject')
      expect(await downloaded.blob.arrayBuffer()).toEqual(content)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.example.test/api/v1/Project/12/export-package',
        expect.objectContaining({ method: 'GET', cache: 'no-store', signal: controller.signal })
      )
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Accept')).toBe('application/zip')
    }
  )

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid project ID %s before requesting',
    async id => {
      const { api, fetchMock } = createHarness()
      await expect(api.exportPackage(id)).rejects.toThrow('后台项目 ID 无效')
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it.each(['application/json', 'text/html', ''])(
    'does not download a success-shaped error with content type %s',
    async type => {
      const { api, fetchMock } = createHarness()
      fetchMock.mockResolvedValue(new Response('{"message":"not ready"}', {
        headers: { 'Content-Type': type }
      }))
      await expect(api.exportPackage(12)).rejects.toThrow('未返回有效的项目包文件')
    }
  )

  it.each(['', '{"message":"error"}'])(
    'rejects invalid ZIP bytes even with the expected content type',
    async content => {
      const { api, fetchMock } = createHarness()
      fetchMock.mockResolvedValue(new Response(content, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="project.pidproject"'
        }
      }))
      await expect(api.exportPackage(12)).rejects.toThrow('未返回有效的项目包文件')
    }
  )

  it.each([undefined, 'project.zip', '..\\project.pidproject', '../project.pidproject'])(
    'rejects missing or invalid package filenames: %s',
    async fileName => {
      const { api, fetchMock } = createHarness()
      const headers = new Headers({ 'Content-Type': 'application/zip' })
      if (fileName !== undefined) {
        headers.set('Content-Disposition', `attachment; filename="${fileName}"`)
      }
      fetchMock.mockResolvedValue(new Response(await zipContent(), { headers }))
      await expect(api.exportPackage(12)).rejects.toThrow('项目包文件名')
    }
  )

  it.each(['created', 'replaced'] as const)(
    'uploads one opaque package and accepts the backend %s decision',
    async action => {
      const { api, fetchMock } = createHarness()
      fetchMock.mockResolvedValue(jsonResponse({ ...result, action }))
      const file = new File([await zipContent()], '项目.pidproject')
      const controller = new AbortController()
      await expect(api.importPackage(file, 'operation-123', controller.signal))
        .resolves.toEqual({ ...result, action })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('http://api.example.test/api/v1/Project/import-package')
      expect(options).toMatchObject({ method: 'POST', signal: controller.signal })
      const headers = new Headers(options?.headers)
      expect(headers.get('Idempotency-Key')).toBe('operation-123')
      expect(headers.has('Content-Type')).toBe(false)
      expect(options?.body).toBeInstanceOf(FormData)
      if (!(options?.body instanceof FormData)) throw new Error('Expected multipart body')
      expect([...options.body.keys()]).toEqual(['file'])
      const uploaded = options.body.get('file')
      expect(uploaded).toBeInstanceOf(File)
      if (!(uploaded instanceof File)) throw new Error('Expected uploaded file')
      expect(uploaded.name).toBe(file.name)
      expect(await uploaded.arrayBuffer()).toEqual(await file.arrayBuffer())
    }
  )

  it.each([
    new File(['bytes'], 'drawing.pdi'),
    new File([], 'empty.pidproject')
  ])('rejects invalid local packages without sending a request', async file => {
    const { api, fetchMock } = createHarness()
    await expect(api.importPackage(file, 'request')).rejects.toThrow('请选择非空')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires an idempotency key before uploading', async () => {
    const { api, fetchMock } = createHarness()
    await expect(api.importPackage(new File(['bytes'], 'test.pidproject'), ' '))
      .rejects.toThrow('请求标识不能为空')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { ...result, projectId: 0 },
    { ...result, projectId: '12' },
    { ...result, projectId: Number.MAX_SAFE_INTEGER + 1 },
    { ...result, projectKey: undefined },
    { ...result, projectKey: ' ' },
    { ...result, name: '' },
    { ...result, action: undefined },
    { ...result, action: 'updated' },
    { success: true, data: result }
  ])('rejects invalid import results instead of showing success: %j', async value => {
    const { api, fetchMock } = createHarness()
    fetchMock.mockResolvedValue(jsonResponse(value))
    await expect(api.importPackage(new File(['bytes'], 'test.pidproject'), 'request'))
      .rejects.toThrow('无效的项目导入结果')
  })

  it('preserves the original HTTP failure and displays the backend message', async () => {
    const { api, fetchMock } = createHarness()
    fetchMock.mockResolvedValue(jsonResponse({
      code: 'PACKAGE_FILE_MISSING', message: '缺少图纸文件'
    }, 422))
    const failure = api.importPackage(new File(['bytes'], 'test.pidproject'), 'request')
    await expect(failure).rejects.toMatchObject({
      status: 422, responseBody: { code: 'PACKAGE_FILE_MISSING' }
    })
    await failure.catch(error => {
      expect(getProjectPackageErrorMessage(error)).toBe('缺少图纸文件')
    })
  })

  it.each([404, 501])('reports unavailable endpoints without a mock fallback (%s)', async status => {
    const { api, fetchMock } = createHarness()
    fetchMock.mockResolvedValue(new Response(null, { status }))
    const failure = api.exportPackage(12)
    await expect(failure).rejects.toBeInstanceOf(ProcessAssistantApiError)
    await failure.catch(error => {
      expect(getProjectPackageErrorMessage(error)).toContain('确认后台已部署')
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    [413, '项目包超过后台允许的大小'],
    [undefined, '无法连接后台']
  ])('provides an explicit message for status %s', (status, message) => {
    expect(getProjectPackageErrorMessage(new ProcessAssistantApiError('failure', {
      method: 'POST', url: '/import', status
    }))).toContain(message)
  })
})
