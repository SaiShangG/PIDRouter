import {
  AcGeBox2d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGiEntity
} from '@mlightcad/data-model'

import { AcSvgMatrixUtil } from './AcSvgMatrixUtil'

/**
 * Represent the display object of one drawing entity.
 */
export class AcSvgEntity implements AcGiEntity {
  private _objectId: string
  private _ownerId: string
  private _layerName: string
  private _visible: boolean
  private _userData: object
  private _strokeColorOverride?: string
  protected _box: AcGeBox2d
  protected _localSvg: string
  protected _matrix?: AcGeMatrix3d
  protected _basePoint?: AcGePoint3d
  private _parent?: AcSvgEntity

  constructor() {
    this._objectId = ''
    this._ownerId = ''
    this._layerName = ''
    this._visible = true
    this._userData = {}
    this._box = new AcGeBox2d()
    this._localSvg = ''
  }

  /**
   * The bounding box of this object in world coordinates (includes transforms).
   */
  get box() {
    return this._box
  }
  set box(value: AcGeBox2d) {
    this._box.copy(value)
  }

  get basePoint() {
    return this._basePoint
  }
  set basePoint(value: AcGePoint3d | undefined) {
    if (value == null) {
      this._basePoint = value
    } else {
      this._basePoint = this._basePoint
        ? this._basePoint.copy(value)
        : new AcGePoint3d(value)
    }
  }

  /**
   * SVG markup including any transforms applied via {@link applyMatrix}.
   */
  get svg() {
    return this.renderSvg()
  }
  set svg(value: string) {
    this._localSvg = value
  }

  /**
   * Local SVG markup without wrapping transforms.
   */
  getLocalSvg(): string {
    return this._localSvg
  }

  /**
   * Final SVG fragment with accumulated transforms applied.
   */
  renderSvg(): string {
    if (!this._visible || !this._localSvg) {
      return ''
    }
    const localSvg = this._strokeColorOverride
      ? this._localSvg.replace(
          /stroke="(?!none")[^"]+"/g,
          `stroke="${this._strokeColorOverride}"`
        )
      : this._localSvg
    if (!this._matrix) {
      return localSvg
    }
    const transform = AcSvgMatrixUtil.toSvgTransform(this._matrix)
    return `<g transform="${transform}">\n${localSvg}\n</g>`
  }

  /** Overrides visible stroke colours without adding duplicate geometry. */
  setStrokeColorOverride(color?: string) {
    this._strokeColorOverride = color
  }

  get objectId() {
    return this._objectId
  }
  set objectId(value: string) {
    this._objectId = value
  }

  get ownerId() {
    return this._ownerId
  }
  set ownerId(value: string) {
    this._ownerId = value
  }

  get layerName() {
    return this._layerName
  }
  set layerName(value: string) {
    this._layerName = value
  }

  get visible() {
    return this._visible
  }
  set visible(value: boolean) {
    this._visible = value
  }

  get userData(): object {
    return this._userData
  }
  set userData(value: object) {
    this._userData = value
  }

  /**
   * The group that currently owns this entity as a child, or `undefined` when
   * the entity is rendered at the top level.
   *
   * {@link AcSvgGroup.addChild} sets this so {@link AcSvgRenderer.export} can
   * skip entities that are already emitted through their owning group (for
   * example block-reference attributes moved into a block group by
   * `AcDbRenderingCache.draw`). Without this flag those attributes would render
   * twice: once flat at their block-local position and once inside the group.
   */
  get parent(): AcSvgEntity | undefined {
    return this._parent
  }
  set parent(value: AcSvgEntity | undefined) {
    this._parent = value
  }

  /**
   * @inheritdoc
   */
  applyMatrix(matrix: AcGeMatrix3d) {
    if (!this._matrix) {
      this._matrix = matrix.clone()
    } else {
      this._matrix = matrix.clone().multiply(this._matrix)
    }
    AcSvgMatrixUtil.transformBox(this._box, matrix)
  }

  recomputeBoundingBox() {
    // Bounding boxes are maintained during draw and applyMatrix.
  }

  highlight() {
    // Do nothing
  }

  unhighlight() {
    // Do nothing
  }

  /**
   * Copies all render-affecting state from `source` onto this entity.
   *
   * Used by {@link fastDeepClone} (and {@link AcSvgGroup.fastDeepClone}) to
   * produce a self-contained duplicate. Every mutable field that influences the
   * exported SVG is copied into a fresh object so the clone can be transformed
   * via {@link applyMatrix} without mutating the source. The parent link is
   * intentionally not copied: a fresh clone starts detached from any group.
   */
  protected copyFrom(source: AcSvgEntity) {
    this.objectId = source.objectId
    this.ownerId = source.ownerId
    this.layerName = source.layerName
    this.visible = source.visible
    this._userData = { ...source._userData }
    this._box = source._box.clone()
    this._localSvg = source._localSvg
    this._strokeColorOverride = source._strokeColorOverride
    this._matrix = source._matrix ? source._matrix.clone() : undefined
    this._basePoint = source._basePoint
      ? new AcGePoint3d(source._basePoint)
      : undefined
  }

  /**
   * @inheritdoc
   *
   * Returns an independent deep copy. `AcDbRenderingCache` clones a block's
   * rendered result once per INSERT; returning `this` (the previous behaviour)
   * made every instance share a single object, so repeated
   * {@link applyMatrix} calls accumulated `Tn·…·T1` onto one entity and all but
   * one instance were dropped from export.
   */
  fastDeepClone(): AcSvgEntity {
    const cloned = new AcSvgEntity()
    cloned.copyFrom(this)
    return cloned
  }

  addChild(_entity: AcGiEntity) {
    // Leaf entities have no children. AcSvgGroup overrides this to collect
    // block-definition geometry and block-reference attributes.
  }
}
