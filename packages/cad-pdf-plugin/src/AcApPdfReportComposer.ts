import { PDFDocument } from 'pdf-lib'

export interface AcApPdfReportPage {
  bytes: Uint8Array
}

/** Combines independently rendered one-page PDFs without re-rendering content. */
export class AcApPdfReportComposer {
  async compose(pages: readonly AcApPdfReportPage[]): Promise<Uint8Array> {
    if (pages.length === 0) {
      throw new Error('At least one PDF page is required.')
    }

    const report = await PDFDocument.create()
    for (const page of pages) {
      const source = await PDFDocument.load(page.bytes)
      const indices = source.getPageIndices()
      if (indices.length !== 1) {
        throw new Error('Each report page source must contain exactly one page.')
      }
      const [copiedPage] = await report.copyPages(source, indices)
      report.addPage(copiedPage)
    }
    return report.save()
  }
}
