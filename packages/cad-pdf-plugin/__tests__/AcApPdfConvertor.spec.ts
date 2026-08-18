/** @jest-environment jsdom */

import { resolveExportDownloadName } from '@mlightcad/cad-simple-viewer'
import { jsPDF } from 'jspdf'

import {
  AcApPdfConvertor,
  PDF_STROKE_POINTS_PER_VIEWER_PIXEL
} from '../src/AcApPdfConvertor'

jest.mock('@mlightcad/cad-simple-viewer', () => ({
  AcApSettingManager: { instance: { fontMapping: {} } },
  resolveExportDownloadName: jest.fn()
}))
jest.mock('@mlightcad/cad-svg-plugin', () => ({
  AcSvgRenderer: class {}
}))
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }))
jest.mock('svg2pdf.js', () => ({ svg2pdf: jest.fn() }))

describe('AcApPdfConvertor text path rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the initialized renderer owned by the active view', () => {
    const renderMTextGeometry = jest.fn(() => ({ id: 'glyph-root' }))
    const setMTextPathRenderer = jest.fn()
    const renderer = {
      set ltscale(_value: number) {},
      set celtscale(_value: number) {},
      set showLineWeight(_value: boolean) {},
      set currentBackgroundColor(_value: number) {},
      setMTextPathRenderer,
      setFontMapping: jest.fn(),
      changeForeground: jest.fn()
    }
    const context = {
      doc: { database: { ltscale: 1, celtscale: 1, lwdisplay: false } },
      view: {
        backgroundColor: 0,
        renderer: { renderMTextGeometry }
      }
    }

    const converter = new AcApPdfConvertor() as unknown as {
      configureRenderer(
        renderer: object,
        context: object,
        options: { backgroundColor: number }
      ): void
    }
    converter.configureRenderer(renderer, context, {
      backgroundColor: 0xffffff
    })

    const renderPaths = setMTextPathRenderer.mock.calls[0][0]
    const mtext = { text: 'PID' }
    const style = { font: 'simplex.shx' }
    const traits = { layer: '0' }
    expect(renderPaths(mtext, style, traits)).toEqual({ id: 'glyph-root' })
    expect(renderMTextGeometry).toHaveBeenCalledWith(
      mtext,
      style,
      traits,
      0xffffff
    )
  })

  it('renders PDF bytes without downloading and preserves convert download', async () => {
    const save = jest.fn()
    const output = jest.fn(() => new Uint8Array([1, 2, 3]).buffer)
    ;(jsPDF as unknown as jest.Mock).mockImplementation(() => ({ save, output }))
    ;(resolveExportDownloadName as jest.Mock).mockReturnValue('drawing.pdf')
    const converter = new AcApPdfConvertor()
    jest
      .spyOn(converter, 'renderSvg')
      .mockResolvedValue('<svg viewBox="0 0 100 50"><path d="M0 0"/></svg>')
    const context = {
      doc: { fileName: 'drawing.dwg', docTitle: 'drawing' }
    } as never

    await expect(converter.renderPdfBytes(context)).resolves.toEqual(
      new Uint8Array([1, 2, 3])
    )
    expect(save).not.toHaveBeenCalled()

    await converter.convert(context)
    expect(save).toHaveBeenCalledWith('drawing.pdf')
  })

  it('converts structured widths and preserves legacy highlight options', () => {
    const converter = new AcApPdfConvertor() as unknown as {
      resolveEntityStyleOverrides(options: object): Array<{
        entityIds: ReadonlySet<string>
        strokeColor: number
        strokeWidthPx: number
        opacity: number
      }>
    }
    const ids = new Set(['1a'])
    expect(
      converter.resolveEntityStyleOverrides({
        entityStyleOverrides: [
          {
            entityIds: ids,
            strokeColor: 0x123456,
            strokeWidthPx: 4,
            opacity: 0.5
          }
        ]
      })
    ).toEqual([
      {
        entityIds: ids,
        strokeColor: 0x123456,
        strokeWidthPx: 4 * PDF_STROKE_POINTS_PER_VIEWER_PIXEL,
        opacity: 0.5
      }
    ])
    expect(
      converter.resolveEntityStyleOverrides({
        highlightedEntityIds: ids,
        highlightColor: 0x00c853
      })
    ).toEqual([
      {
        entityIds: ids,
        strokeColor: 0x00c853,
        strokeWidthPx: 1,
        opacity: 1
      }
    ])
  })
})
