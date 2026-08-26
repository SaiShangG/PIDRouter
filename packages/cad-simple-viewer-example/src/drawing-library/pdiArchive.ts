import JSZip, { type JSZipObject } from 'jszip'

export interface PdiArchiveContent {
  cadFileName: string
  cadContent: ArrayBuffer
  flowConnectionJsonText: string
}

const normalizedPath = (entry: JSZipObject) => entry.name.replace(/\\/g, '/')

const findFile = (
  files: readonly JSZipObject[],
  predicate: (path: string) => boolean
) =>
  files
    .filter(entry => !entry.dir && predicate(normalizedPath(entry)))
    .sort((left, right) =>
      normalizedPath(left).localeCompare(normalizedPath(right))
    )[0]

export async function extractPdiArchive(
  content: ArrayBuffer
): Promise<PdiArchiveContent> {
  let archive: JSZip
  try {
    archive = await JSZip.loadAsync(content)
  } catch {
    throw new Error('PDI 文件不是有效的 ZIP 压缩包')
  }

  const files = Object.values(archive.files)
  const documentEntry = findFile(
    files,
    path => path.split('/').pop()?.toLowerCase() === 'document.json'
  )
  if (!documentEntry) throw new Error('PDI 压缩包中缺少 Document.json')

  const dwgEntry = findFile(files, path => path.toLowerCase().endsWith('.dwg'))
  const dxfEntry = findFile(files, path => path.toLowerCase().endsWith('.dxf'))
  const cadEntry = dwgEntry ?? dxfEntry
  if (!cadEntry) throw new Error('PDI 压缩包中缺少 DWG 或 DXF 图纸')

  const flowConnectionJsonText = await documentEntry.async('text')
  try {
    JSON.parse(flowConnectionJsonText)
  } catch {
    throw new Error('PDI 压缩包中的 Document.json 格式无效')
  }

  return {
    cadFileName: normalizedPath(cadEntry).split('/').pop()!,
    cadContent: await cadEntry.async('arraybuffer'),
    flowConnectionJsonText
  }
}