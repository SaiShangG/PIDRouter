import type { AcApContext, AcTrView2d } from '@mlightcad/cad-simple-viewer'
import {
  AcApSettingManager,
  resolveExportDownloadName
} from '@mlightcad/cad-simple-viewer'
import { AcSvgRenderer } from '@mlightcad/cad-svg-plugin'
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'

const DEFAULT_PDF_SIZE_MM = { width: 297, height: 210 }
const MAX_PDF_PAGE_SIDE_MM = 3360
const ENTITY_BATCH_SIZE = 100
export const PDF_STROKE_POINTS_PER_VIEWER_PIXEL = 0.75

export interface PdfEntityStyleOverride {
  entityIds: ReadonlySet<string>
  strokeColor: number
  strokeWidthPx: number
  opacity: number
}

/**
 * Rectangular world-space bounds used as the export view frame for the PDF.
 */
export interface AcApPdfExportBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Options controlling how a drawing is exported to PDF.
 */
export interface AcApPdfConvertOptions {
  /** World-space bounds used to crop/size the exported page. */
  bounds?: AcApPdfExportBounds
  /** Background colour override (0xRRGGBB). */
  backgroundColor?: number
  /** Layer names excluded from the exported drawing. */
  excludedLayers?: readonly string[]
  /** Whether the background rectangle is kept in the exported PDF. */
  includeBackground?: boolean
  /** Database entity IDs whose existing linework is recoloured for this Phase. */
  highlightedEntityIds?: ReadonlySet<string>
  /** RGB colour applied to highlighted entity strokes. */
  highlightColor?: number
  /** Structured entity stroke styles. Takes precedence over legacy highlight options. */
  entityStyleOverrides?: readonly PdfEntityStyleOverride[]
}

type PdfViewBox = { x: number; y: number; width: number; height: number }

/**
 * Utility class for converting CAD drawings to PDF format.
 *
 * Reuses the SVG renderer pipeline and converts the resulting SVG to a
 * vector PDF using jsPDF + svg2pdf.js.
 */
export class AcApPdfConvertor {
  /**
   * Renders the current drawing to PDF and triggers a browser download.
   */
  async convert(context: AcApContext, options: AcApPdfConvertOptions = {}) {
    const svgString = await this.renderSvg(context, options)
    const downloadName = resolveExportDownloadName(
      context.doc.fileName || context.doc.docTitle,
      'pdf'
    )
    const pdf = await this.renderPdf(svgString, options)
    pdf.save(downloadName)
  }

  /** Renders the active drawing as SVG without triggering a download. */
  async renderSvg(
    context: AcApContext,
    options: AcApPdfConvertOptions = {}
  ): Promise<string> {
    AcSvgRenderer.prepareExport()

    const entities = this.getExportBlockTableRecord(context).newIterator()
    const renderer = new AcSvgRenderer()
    this.configureRenderer(renderer, context, options)

    if (options.excludedLayers && options.excludedLayers.length > 0) {
      renderer.setExcludedLayers(options.excludedLayers)
    }

    let entityCount = 0
    for (const entity of entities) {
      renderer.add(entity.worldDraw(renderer))
      entityCount += 1
      if (entityCount % ENTITY_BATCH_SIZE === 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }
    const styleOverrides = this.resolveEntityStyleOverrides(options)
    if (styleOverrides.length > 0) {
      renderer.overrideEntityStyles(styleOverrides)
    }
    return renderer.exportAsync()
  }

  private resolveEntityStyleOverrides(options: AcApPdfConvertOptions) {
    if (options.entityStyleOverrides) {
      return options.entityStyleOverrides.map(override => ({
        ...override,
        strokeWidthPx:
          override.strokeWidthPx * PDF_STROKE_POINTS_PER_VIEWER_PIXEL
      }))
    }
    if (options.highlightedEntityIds && options.highlightColor != null) {
      return [
        {
          entityIds: options.highlightedEntityIds,
          strokeColor: options.highlightColor,
          strokeWidthPx: 1,
          opacity: 1
        }
      ]
    }
    return []
  }

  /** Renders the active drawing as standalone PDF bytes without downloading. */
  async renderPdfBytes(
    context: AcApContext,
    options: AcApPdfConvertOptions = {}
  ): Promise<Uint8Array> {
    const svgString = await this.renderSvg(context, options)
    const pdf = await this.renderPdf(svgString, options)
    return new Uint8Array(pdf.output('arraybuffer'))
  }

  private getExportBlockTableRecord(context: AcApContext) {
    const db = context.doc.database
    const blockTable = db.tables.blockTable
    const view = context.view as { activeLayoutBtrId?: string } | undefined
    const activeLayoutBtrId = view?.activeLayoutBtrId || db.currentSpaceId
    return blockTable.getIdAt(activeLayoutBtrId) ?? blockTable.modelSpace
  }

  private configureRenderer(
    renderer: AcSvgRenderer,
    context: AcApContext,
    options: AcApPdfConvertOptions
  ) {
    const db = context.doc.database
    renderer.ltscale = db.ltscale
    renderer.celtscale = db.celtscale
    renderer.showLineWeight = !!db.lwdisplay
    const view = context.view as { backgroundColor?: number } | undefined
    const bg = options.backgroundColor ?? view?.backgroundColor ?? 0xffffff
    const viewRenderer = (context.view as AcTrView2d).renderer
    if (!viewRenderer) {
      throw new Error('The active view does not provide a text renderer.')
    }
    renderer.setMTextPathRenderer((mtext, style, traits) =>
      viewRenderer.renderMTextGeometry(mtext, style, traits, bg)
    )
    renderer.setFontMapping(AcApSettingManager.instance.fontMapping)
    renderer.currentBackgroundColor = bg
    renderer.changeForeground(bg === 0 ? 0xffffff : 0x000000)
  }

  private async renderPdf(
    svgString: string,
    options: AcApPdfConvertOptions
  ) {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgEl = svgDoc.documentElement as unknown as SVGSVGElement

    if (options.includeBackground === false) {
      this.removeBackgroundRect(svgEl)
    }

    const viewBox = options.bounds
      ? this.boundsToViewBox(options.bounds)
      : this.parseViewBox(svgEl)
    if (!viewBox) {
      throw new Error('No drawable geometry was found for PDF export.')
    }
    this.normalizeSvgForPdf(svgEl, viewBox)
    const pageSize = this.fitPdfPageSize(viewBox.width, viewBox.height)

    const orientation =
      pageSize.width >= pageSize.height ? 'landscape' : 'portrait'

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [pageSize.width, pageSize.height]
    })

    await svg2pdf(svgEl, pdf, {
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height
    })

    return pdf
  }

  private removeBackgroundRect(svgEl: SVGSVGElement) {
    const backgroundRect = Array.from(svgEl.children).find(
      child => child.tagName.toLowerCase() === 'rect'
    )
    backgroundRect?.parentNode?.removeChild(backgroundRect)
  }

  private boundsToViewBox(bounds: AcApPdfExportBounds): PdfViewBox | null {
    const width = Math.abs(bounds.maxX - bounds.minX)
    const height = Math.abs(bounds.maxY - bounds.minY)
    if (width <= 0 || height <= 0) {
      return null
    }
    // The exported SVG flips the Y axis via `matrix(1,0,0,-1,0,0)`, so the
    // view frame origin in SVG space is the top-left corner (minX, -maxY).
    return { x: bounds.minX, y: -bounds.maxY, width, height }
  }

  private parseViewBox(svgEl: SVGSVGElement): PdfViewBox | null {
    const values = svgEl
      .getAttribute('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number)

    if (!values || values.length !== 4 || values.some(Number.isNaN)) {
      return null
    }

    const width = Math.abs(values[2])
    const height = Math.abs(values[3])
    if (width <= 0 || height <= 0) {
      return null
    }

    return { x: values[0], y: values[1], width, height }
  }

  private normalizeSvgForPdf(svgEl: SVGSVGElement, viewBox: PdfViewBox) {
    const namespace = svgEl.namespaceURI ?? 'http://www.w3.org/2000/svg'
    const wrapper = svgEl.ownerDocument.createElementNS(namespace, 'g')
    wrapper.setAttribute('transform', `translate(${-viewBox.x}, ${-viewBox.y})`)

    while (svgEl.firstChild) {
      wrapper.appendChild(svgEl.firstChild)
    }

    svgEl.appendChild(wrapper)
    svgEl.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`)
    svgEl.setAttribute('width', String(viewBox.width))
    svgEl.setAttribute('height', String(viewBox.height))
  }

  private fitPdfPageSize(width: number, height: number) {
    const longestSide = Math.max(width, height)
    if (longestSide <= 0) {
      return DEFAULT_PDF_SIZE_MM
    }

    const scale = Math.min(1, MAX_PDF_PAGE_SIDE_MM / longestSide)
    return {
      width: Math.max(width * scale, 1),
      height: Math.max(height * scale, 1)
    }
  }
}
