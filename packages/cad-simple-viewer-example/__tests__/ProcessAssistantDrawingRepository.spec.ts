import { ProcessAssistantDrawingRepository } from '../src/drawing-library/ProcessAssistantDrawingRepository'

const createHarness = () => {
  const files = {
    list: jest.fn(),
    get: jest.fn(),
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn()
  }
  return {
    files,
    repository: new ProcessAssistantDrawingRepository(files)
  }
}

describe('ProcessAssistantDrawingRepository', () => {
  it('loads backend files and only marks CAD files as viewable', async () => {
    const { files, repository } = createHarness()
    files.list.mockResolvedValue([
      {
        id: 1,
        originalFileName: 'PID-1001.dwg',
        storedFileName: 'stored-1.dwg',
        fileSize: 1024,
        uploadedAt: '2026-08-18T10:00:00Z',
        comment: JSON.stringify({ name: 'CIP Supply', drawingNumber: 'P-1' })
      },
      {
        id: 2,
        originalFileName: 'notes.pdf',
        storedFileName: 'stored-2.pdf',
        fileSize: 2048,
        uploadedAt: '2026-08-18T11:00:00Z'
      }
    ])

    const records = await repository.list()

    expect(files.list).toHaveBeenCalledTimes(1)
    expect(records[0]).toMatchObject({
      id: '2',
      originalFileName: 'notes.pdf',
      status: 'UPLOADED'
    })
    expect(records[1]).toMatchObject({
      id: '1',
      name: 'CIP Supply',
      drawingNumber: 'P-1',
      status: 'READY'
    })
  })

  it('uploads the selected file through multipart File API metadata', async () => {
    const { files, repository } = createHarness()
    const file = new File(['drawing'], 'PID-1002.dxf', {
      type: 'application/dxf'
    })
    files.upload.mockResolvedValue({
      id: 3,
      originalFileName: file.name,
      storedFileName: 'stored-3.dxf',
      fileSize: file.size,
      uploadedAt: '2026-08-18T12:00:00Z'
    })

    const record = await repository.upload(file, {
      name: 'Return line',
      drawingNumber: 'P-2'
    })

    expect(files.upload).toHaveBeenCalledWith({
      file,
      comment: JSON.stringify({
        name: 'Return line',
        drawingNumber: 'P-2'
      })
    })
    expect(record).toMatchObject({ id: '3', status: 'READY' })
  })

  it('downloads and deletes files by their backend stored name', async () => {
    const { files, repository } = createHarness()
    files.list.mockResolvedValue([
      {
        id: 4,
        originalFileName: 'PID-1004.dwg',
        storedFileName: 'stored drawing.dwg'
      }
    ])
    files.download.mockResolvedValue(new Blob(['content']))
    await repository.list()

    const content = await repository.getContent('4')
    await repository.delete('4')

    expect(new TextDecoder().decode(content)).toBe('content')
    expect(files.download).toHaveBeenCalledWith('stored drawing.dwg')
    expect(files.delete).toHaveBeenCalledWith('stored drawing.dwg')
  })
})