import {
  AcCmColor,
  AcCmTransparency,
  AcDbRenderingCache,
  AcGeArea2d,
  AcGeBox2d,
  AcGeCircArc3d,
  AcGeEllipseArc3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGiContext,
  AcGiEntity,
  AcGiFontMapping,
  AcGiImageStyle,
  AcGiLineWeight,
  AcGiMTextData,
  AcGiPointStyle,
  AcGiRenderer,
  AcGiShapeData,
  AcGiSubEntityTraits,
  AcGiTextStyle
} from '@mlightcad/data-model'

import { AcSvgArea } from './AcSvgArea'
import { AcSvgCircArc } from './AcSvgCircArc'
import { AcTrEllipticalArc } from './AcSvgEllipticalArc'
import { AcSvgEntity } from './AcSvgEntity'
import { AcSvgExportUtil } from './AcSvgExportUtil'
import { AcSvgGroup } from './AcSvgGroup'
import { AcSvgImage } from './AcSvgImage'
import { AcSvgLine } from './AcSvgLine'
import { AcSvgLineSegments } from './AcSvgLineSegments'
import { AcSvgMText } from './AcSvgMText'
import { AcSvgMTextPathRenderer } from './AcSvgMTextPathUtil'
import { AcSvgPoint } from './AcSvgPoint'
import { AcSvgShape } from './AcSvgShape'
import { AcSvgStyleContext, AcSvgStyleUtil } from './AcSvgStyleUtil'

export interface AcSvgEntityStyleOverride {
  entityIds: ReadonlySet<string>
  strokeColor: number
  strokeWidthPx: number
  opacity: number
}

export class AcSvgRenderer implements AcGiRenderer<AcSvgEntity> {
  /**
   * Clears the shared block rendering cache before SVG/PDF export.
   *
   * The cache stores drawable objects from the last renderer that populated it
   * (typically Three.js). Reusing those entries during export causes failures
   * such as `renderSvg is not a function` when dimensions or block references
   * are resolved from cache.
   */
  static prepareExport(): void {
    AcDbRenderingCache.instance.clear()
  }

  private _entities: AcSvgEntity[]
  private _bbox: AcGeBox2d
  private _subEntityTraits: AcGiSubEntityTraits
  private _fontMapping: AcGiFontMapping
  private _ltscale = 1
  private _celtscale = 1
  private _currentBackgroundColor = 0x000000
  private _foregroundColor = 0x000000
  private _showLineWeight = false
  private _mtextPathRenderer?: AcSvgMTextPathRenderer
  private _pendingImages: Promise<void>[]
  private _excludedLayers: Set<string>

  constructor() {
    this._entities = []
    this._bbox = new AcGeBox2d()
    this._fontMapping = {}
    this._pendingImages = []
    this._excludedLayers = new Set()
    this._subEntityTraits = {
      color: new AcCmColor(),
      lineType: {
        type: 'ByLayer',
        name: 'Continuous',
        standardFlag: 0,
        description: 'Solid line',
        totalPatternLength: 0
      },
      lineTypeScale: 1,
      lineWeight: AcGiLineWeight.ByLayer,
      fillType: {
        solidFill: true,
        patternAngle: 0,
        definitionLines: []
      },
      transparency: new AcCmTransparency(),
      thickness: 0,
      layer: '0',
      drawOrder: 0
    }
  }

  /**
   * @inheritdoc
   */
  get subEntityTraits() {
    return this._subEntityTraits
  }

  /**
   * @inheritdoc
   */
  get context(): AcGiContext {
    return AcGiContext.fromBackgroundColor(this._currentBackgroundColor)
  }

  /**
   * @inheritdoc
   */
  setFontMapping(mapping: AcGiFontMapping) {
    this._fontMapping = mapping
  }

  /**
   * Sets global ltscale for linetype dash scaling.
   */
  set ltscale(scale: number) {
    this._ltscale = scale
  }

  /**
   * Sets global celtscale for linetype dash scaling.
   */
  set celtscale(scale: number) {
    this._celtscale = scale
  }

  /**
   * Canvas background colour tracked for ACI 7 resolution and SVG export.
   *
   * Mirrors {@link AcTrRenderer.currentBackgroundColor}.
   */
  get currentBackgroundColor(): number {
    return this._currentBackgroundColor
  }

  set currentBackgroundColor(value: number) {
    this._currentBackgroundColor = value
  }

  /**
   * Foreground colour used when resolving ACI 7 linework and patterned hatches.
   * Mirrors {@link AcTrRenderer.changeForeground}.
   */
  changeForeground(color: number) {
    this._foregroundColor = color
  }

  /**
   * Whether lineweights are rendered. Mirrors the LWDISPLAY system variable.
   */
  get showLineWeight(): boolean {
    return this._showLineWeight
  }

  set showLineWeight(value: boolean) {
    this._showLineWeight = value
  }

  /** Uses externally rendered viewer glyph geometry instead of SVG text. */
  setMTextPathRenderer(renderer: AcSvgMTextPathRenderer) {
    this._mtextPathRenderer = renderer
  }

  setExcludedLayers(layers: readonly string[]) {
    this._excludedLayers = new Set(
      layers.map(layer => this.normalizeLayerName(layer)).filter(Boolean)
    )
  }

  /** Recolours matching database entities in place without adding overlays. */
  overrideEntityStrokeColors(objectIds: ReadonlySet<string>, color: number) {
    this.overrideEntityStyles([
      {
        entityIds: objectIds,
        strokeColor: color,
        strokeWidthPx: 1,
        opacity: 1
      }
    ], false)
  }

  /** Applies structured stroke styles to matching entities and descendants. */
  overrideEntityStyles(
    overrides: readonly AcSvgEntityStyleOverride[],
    includeDimensions = true
  ) {
    const visit = (entity: AcSvgEntity, inheritedMatch = false) => {
      const override = overrides.find(
        item => inheritedMatch || item.entityIds.has(entity.objectId)
      )
      if (override) {
        entity.setStyleOverride({
          strokeColor: AcSvgStyleUtil.rgbToHex(override.strokeColor),
          strokeWidth: includeDimensions ? override.strokeWidthPx : undefined,
          opacity: includeDimensions ? override.opacity : undefined
        })
      }
      if (entity instanceof AcSvgGroup) {
        entity.children.forEach(child => visit(child, Boolean(override)))
      }
    }
    this._entities.forEach(entity => visit(entity))
  }

  private get styleContext(): AcSvgStyleContext {
    return {
      ltscale: this._ltscale,
      celtscale: this._celtscale,
      backgroundColor: this._currentBackgroundColor,
      foregroundColor: this._foregroundColor,
      showLineWeight: this._showLineWeight
    }
  }

  private pushEntity(entity: AcSvgEntity) {
    entity.layerName = this._subEntityTraits.layer
    if (this.isLayerExcluded(entity.layerName)) {
      return _tempEntity
    }

    this._entities.push(entity)
    return entity
  }

  /**
   * Registers a top-level drawable returned by {@link AcGiEntity.worldDraw}.
   *
   * Most entities self-register through {@link pushEntity} while they are being
   * drawn. Block references drawn from `AcDbRenderingCache`, however, return a
   * fresh clone for every INSERT after the first (`AcDbRenderingCache.get`
   * deep-clones the cached group). Those clones never pass through
   * {@link group}/{@link pushEntity}, so without this call every repeated INSERT
   * would be dropped from the export. Entities already tracked (the first
   * instance, plain primitives) or moved into a group (attributes) are ignored,
   * so calling this for every top-level `worldDraw` result is idempotent.
   */
  add(entity: AcGiEntity | undefined) {
    if (!(entity instanceof AcSvgEntity) || entity === _tempEntity) {
      return
    }
    if (entity.parent != null) {
      return
    }
    if (this._entities.includes(entity)) {
      return
    }
    if (this.isLayerExcluded(entity.layerName)) {
      return
    }
    this._entities.push(entity)
  }

  private isLayerExcluded(layerName: string) {
    return this._excludedLayers.has(this.normalizeLayerName(layerName))
  }

  private normalizeLayerName(layerName: string) {
    return layerName.trim().toUpperCase()
  }

  private removeEntities(entities: AcSvgEntity[]) {
    for (const entity of entities) {
      const index = this._entities.indexOf(entity)
      if (index >= 0) {
        this._entities.splice(index, 1)
      }
    }
  }

  /**
   * @inheritdoc
   */
  group(entities: AcSvgEntity[]) {
    const drawableEntities = entities.filter(entity => entity.renderSvg())
    this.removeEntities(drawableEntities)
    return this.pushEntity(new AcSvgGroup(drawableEntities))
  }

  /**
   * @inheritdoc
   */
  point(point: AcGePoint3d, style: AcGiPointStyle) {
    return this.pushEntity(
      new AcSvgPoint(point, style, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  circularArc(arc: AcGeCircArc3d) {
    return this.pushEntity(
      new AcSvgCircArc(arc, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  ellipticalArc(ellipseArc: AcGeEllipseArc3d) {
    return this.pushEntity(
      new AcTrEllipticalArc(
        ellipseArc,
        this._subEntityTraits,
        this.styleContext
      )
    )
  }

  /**
   * @inheritdoc
   */
  lines(points: AcGePoint3dLike[]) {
    return this.pushEntity(
      new AcSvgLine(points, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  lineSegments(array: Float32Array, itemSize: number, indices: Uint16Array) {
    return this.pushEntity(
      new AcSvgLineSegments(
        array,
        itemSize,
        indices,
        this._subEntityTraits,
        this.styleContext
      )
    )
  }

  /**
   * @inheritdoc
   */
  area(area: AcGeArea2d) {
    return this.pushEntity(
      new AcSvgArea(area, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  mtext(mtext: AcGiMTextData, style: AcGiTextStyle, _delay?: boolean) {
    const mappedFont = this._fontMapping[style.font] ?? style.font
    const resolvedStyle: AcGiTextStyle =
      mappedFont !== style.font ? { ...style, font: mappedFont } : style
    return this.pushEntity(
      new AcSvgMText(
        mtext,
        resolvedStyle,
        this._subEntityTraits,
        this.styleContext,
        this._mtextPathRenderer
      )
    )
  }

  /**
   * @inheritdoc
   */
  shape(shape: AcGiShapeData, style: AcGiTextStyle, _delay?: boolean) {
    const mappedFont = this._fontMapping[style.font] ?? style.font
    const resolvedStyle: AcGiTextStyle =
      mappedFont !== style.font ? { ...style, font: mappedFont } : style
    return this.pushEntity(
      new AcSvgShape(
        shape,
        resolvedStyle,
        this._subEntityTraits,
        this.styleContext
      )
    )
  }

  /**
   * @inheritdoc
   */
  image(blob: Blob, style: AcGiImageStyle) {
    const traits = { ...this._subEntityTraits }
    const ctx = this.styleContext
    const pending = AcSvgImage.fromBlob(blob, style, traits, ctx).then(entity =>
      this.pushEntity(entity)
    )
    this._pendingImages.push(pending.then(() => undefined))
    return _tempEntity
  }

  /**
   * Exports accumulated SVG markup. Awaits any pending raster images first.
   */
  async exportAsync(): Promise<string> {
    await Promise.all(this._pendingImages)
    return this.export()
  }

  /**
   * Synchronous export. Raster images added via {@link image} may be missing
   * unless {@link exportAsync} is used.
   */
  export() {
    const parts: string[] = []
    const bbox = new AcGeBox2d()
    for (const entity of this._entities) {
      // Entities owned by a group (for example block-reference attributes moved
      // into the block group by AcDbRenderingCache.draw) are emitted through
      // their group, so skip them here to avoid duplicate, mislocated output.
      if (entity.parent != null) {
        continue
      }
      const svg = entity.renderSvg()
      if (svg) {
        parts.push(svg)
        bbox.union(entity.box)
      }
    }
    this._bbox = bbox
    const elements = parts.join('\n')
    const padding = this._bbox.isEmpty()
      ? 0
      : Math.max(
          this._bbox.max.x - this._bbox.min.x,
          this._bbox.max.y - this._bbox.min.y
        ) * 0.02
    const viewBox = this._bbox.isEmpty()
      ? {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }
      : {
          x: this._bbox.min.x - padding,
          y: -(this._bbox.max.y + padding),
          width: this._bbox.max.x - this._bbox.min.x + padding * 2,
          height: this._bbox.max.y - this._bbox.min.y + padding * 2
        }
    const width = Math.max(viewBox.width, 1)
    const height = Math.max(viewBox.height, 1)
    const backgroundRect = this.buildBackgroundRect(viewBox)
    const svgMarkup = AcSvgExportUtil.sanitizeExternalReferences(
      `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"
  preserveAspectRatio="xMinYMin meet"
  viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"
  width="${width}" height="${height}">
${backgroundRect}
  <g transform="matrix(1,0,0,-1,0,0)">
${elements}
  </g>
</svg>`
    )
    return svgMarkup
  }

  private buildBackgroundRect(viewBox: {
    x: number
    y: number
    width: number
    height: number
  }): string {
    const fill = AcSvgStyleUtil.rgbToHex(this._currentBackgroundColor)
    const width = Math.max(viewBox.width, 1)
    const height = Math.max(viewBox.height, 1)
    return `  <rect x="${viewBox.x}" y="${viewBox.y}" width="${width}" height="${height}" fill="${fill}"/>`
  }
}

const _tempEntity = /*@__PURE__*/ new AcSvgEntity()
