import JSZip from 'jszip'
import { extractPdiArchive } from '../src/drawing-library/pdiArchive'

const createArchive = async (
  entries: Record<string, string | Uint8Array>
): Promise<ArrayBuffer> => {
  const archive = new JSZip()
  Object.entries(entries).forEach(([path, content]) => archive.file(path, content))
  return archive.generateAsync({ type: 'arraybuffer' })
}

describe('extractPdiArchive', () => {
  it('extracts nested Document.json and prefers DWG over DXF', async () => {
    const content = await createArchive({
      'ParseResult/Document.json': JSON.stringify({ Areas: [] }),
      'ParseResult/assets/drawing.dxf': 'dxf-content',
      'ParseResult/assets/drawing.dwg': 'dwg-content'
    })

    const result = await extractPdiArchive(content)

    expect(result.cadFileName).toBe('drawing.dwg')
    expect(new TextDecoder().decode(result.cadContent)).toBe('dwg-content')
    expect(JSON.parse(result.flowConnectionJsonText)).toEqual({ Areas: [] })
  })

  it('falls back to DXF when the archive has no DWG', async () => {
    const content = await createArchive({
      'Document.json': '{}',
      'assets/drawing.dxf': 'dxf-content'
    })

    await expect(extractPdiArchive(content)).resolves.toMatchObject({
      cadFileName: 'drawing.dxf'
    })
  })

  it('rejects an archive without Document.json', async () => {
    const content = await createArchive({ 'drawing.dwg': 'dwg-content' })

    await expect(extractPdiArchive(content)).rejects.toThrow(
      'PDI 压缩包中缺少 Document.json'
    )
  })

  it('rejects an archive without a CAD drawing', async () => {
    const content = await createArchive({ 'Document.json': '{}' })

    await expect(extractPdiArchive(content)).rejects.toThrow(
      'PDI 压缩包中缺少 DWG 或 DXF 图纸'
    )
  })
})