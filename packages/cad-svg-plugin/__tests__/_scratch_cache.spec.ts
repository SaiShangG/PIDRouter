import { AcDbRenderingCache, AcGeMatrix3d } from '@mlightcad/data-model'

import { AcSvgEntity } from '../src/AcSvgEntity'
import { AcSvgRenderer } from '../src/AcSvgRenderer'

// Faithfully reproduce AcDbRenderingCache.draw() push behaviour for the SVG
// renderer to see how many block instances actually reach export().
function drawInsert(
  renderer: AcSvgRenderer,
  key: string,
  transform: AcGeMatrix3d
): AcSvgEntity {
  const cache = AcDbRenderingCache.instance
  let block: AcSvgEntity
  if (cache.has(key)) {
    block = cache.get(key) as unknown as AcSvgEntity
  } else {
    const child = renderer.lines([
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 }
    ])
    block = renderer.group([child])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache.set(key, block as any)
  }
  block.applyMatrix(transform)
  // Mirrors the convertor loop: register the top-level worldDraw result.
  renderer.add(block)
  return block
}

describe('scratch: cache instance registration', () => {
  it('counts how many instances of the same block reach export', () => {
    AcSvgRenderer.prepareExport()
    const renderer = new AcSvgRenderer()

    drawInsert(renderer, 'B', new AcGeMatrix3d().makeTranslation(0, 0, 0))
    drawInsert(renderer, 'B', new AcGeMatrix3d().makeTranslation(100, 0, 0))
    drawInsert(renderer, 'B', new AcGeMatrix3d().makeTranslation(200, 0, 0))

    const svg = renderer.export()
    const pathCount = (svg.match(/<path /g) ?? []).length
    // eslint-disable-next-line no-console
    console.log('PATH_COUNT=', pathCount)
    // eslint-disable-next-line no-console
    console.log(svg)
    expect(pathCount).toBe(3)
  })
})
