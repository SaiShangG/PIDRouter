import { AcApContext, AcEdCommand } from '@mlightcad/cad-simple-viewer'

import { AcApPdfConvertor, AcApPdfExportBounds } from './AcApPdfConvertor'

// Empty list means all layers (including the $PHI_RASTER P&ID raster underlay)
// are rendered into the exported PDF.
const DEFAULT_EXCLUDED_PDF_LAYERS: string[] = []

/**
 * Command for converting the current CAD drawing to PDF format.
 * The command name is `cpdf`.
 */
export class AcApConvertToPdfCmd extends AcEdCommand {
  /**
   * Renders the current drawing to PDF and downloads it in the browser.
   *
   * @param context - Application context for the active document
   */
  async execute(context: AcApContext) {
    const converter = new AcApPdfConvertor()
    await converter.convert(context, {
      backgroundColor: 0xffffff,
      bounds: this.getCurrentViewBounds(context),
      excludedLayers: DEFAULT_EXCLUDED_PDF_LAYERS,
      includeBackground: false
    })
  }

  private getCurrentViewBounds(
    context: AcApContext
  ): AcApPdfExportBounds | undefined {
    const view = context.view as {
      width?: number
      height?: number
      screenToWorld?: (point: { x: number; y: number }) => { x: number; y: number }
    }

    if (!view.screenToWorld || !view.width || !view.height) {
      return undefined
    }

    const topLeft = view.screenToWorld({ x: 0, y: 0 })
    const bottomRight = view.screenToWorld({ x: view.width, y: view.height })
    const minX = Math.min(topLeft.x, bottomRight.x)
    const minY = Math.min(topLeft.y, bottomRight.y)
    const maxX = Math.max(topLeft.x, bottomRight.x)
    const maxY = Math.max(topLeft.y, bottomRight.y)

    if (maxX <= minX || maxY <= minY) {
      return undefined
    }

    return { minX, minY, maxX, maxY }
  }
}
