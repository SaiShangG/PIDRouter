import { PDFDocument } from 'pdf-lib'

import { AcApPdfReportComposer } from '../src/AcApPdfReportComposer'

const createPage = async (width: number) => {
  const pdf = await PDFDocument.create()
  pdf.addPage([width, 100])
  return pdf.save()
}

describe('AcApPdfReportComposer', () => {
  it('copies independent page PDFs in source order', async () => {
    const composer = new AcApPdfReportComposer()
    const bytes = await composer.compose([
      { bytes: await createPage(101) },
      { bytes: await createPage(202) },
      { bytes: await createPage(303) }
    ])
    const report = await PDFDocument.load(bytes)

    expect(report.getPageCount()).toBe(3)
    expect(report.getPages().map(page => page.getWidth())).toEqual([
      101, 202, 303
    ])
  })

  it('rejects empty reports and multi-page page sources', async () => {
    const composer = new AcApPdfReportComposer()
    await expect(composer.compose([])).rejects.toThrow(
      'At least one PDF page is required.'
    )

    const source = await PDFDocument.create()
    source.addPage()
    source.addPage()
    await expect(
      composer.compose([{ bytes: await source.save() }])
    ).rejects.toThrow('exactly one page')
  })
})
