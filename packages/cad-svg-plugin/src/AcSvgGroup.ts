import { AcGiEntity } from '@mlightcad/data-model'

import { AcSvgEntity } from './AcSvgEntity'
import { AcSvgMatrixUtil } from './AcSvgMatrixUtil'

/**
 * SVG group entity: wraps child SVG markup inside a `<g>` element.
 *
 * Unlike the previous implementation that flattened children into a string at
 * construction time, this group keeps live references to its child entities and
 * renders them on demand in {@link renderSvg}. Retaining the children is what
 * makes {@link addChild} work after construction: `AcDbRenderingCache.draw`
 * appends block-reference attributes to the block group *after* the INSERT
 * transform has been applied, and those children must still appear in the final
 * SVG wrapped in this group's world transform.
 */
export class AcSvgGroup extends AcSvgEntity {
  private _children: AcSvgEntity[]

  constructor(entities: AcSvgEntity[] = []) {
    super()
    this._children = []
    for (const entity of entities) {
      this.addChild(entity)
    }
  }

  /**
   * The live list of child entities rendered inside this group.
   */
  get children(): readonly AcSvgEntity[] {
    return this._children
  }

  /**
   * @inheritdoc
   *
   * Appends `entity` as a child of this group and marks it so the renderer does
   * not also emit it at the top level. The child keeps its own local transform;
   * this group's transform is applied around all children in {@link renderSvg}.
   *
   * `AcDbRenderingCache.draw` converts block-reference attributes into
   * block-local space (via the inverse INSERT transform) and then calls this
   * method, so `groupWorldTransform × attributeLocalTransform` restores the
   * original WCS placement.
   */
  override addChild(entity: AcGiEntity) {
    if (!(entity instanceof AcSvgEntity)) {
      return
    }
    entity.parent = this
    this._children.push(entity)
    if (!entity.box.isEmpty()) {
      this._box.union(entity.box)
    }
  }

  /**
   * @inheritdoc
   *
   * Renders every child (each with its own local transform) and wraps them in a
   * single `<g>` carrying this group's accumulated transform.
   */
  override renderSvg(): string {
    if (!this.visible) {
      return ''
    }
    const parts: string[] = []
    for (const child of this._children) {
      const svg = child.renderSvg()
      if (svg) {
        parts.push(svg)
      }
    }
    if (parts.length === 0) {
      return ''
    }
    const inner = parts.join('\n')
    if (!this._matrix) {
      return inner
    }
    const transform = AcSvgMatrixUtil.toSvgTransform(this._matrix)
    return `<g transform="${transform}">\n${inner}\n</g>`
  }

  /**
   * @inheritdoc
   *
   * Produces an independent object tree: this group's own state is copied and
   * every child is recursively deep-cloned. Each INSERT of a cached block
   * therefore receives its own children and transform, preventing the instance
   * dropping and matrix accumulation seen when clones shared child references.
   */
  override fastDeepClone(): AcSvgGroup {
    const cloned = new AcSvgGroup()
    // Copy box/matrix/metadata first so the authoritative bounding box from the
    // source is preserved (adding children below would otherwise re-union
    // block-local child boxes into an already world-transformed box).
    cloned.copyFrom(this)
    for (const child of this._children) {
      const childClone = child.fastDeepClone()
      childClone.parent = cloned
      cloned._children.push(childClone)
    }
    return cloned
  }
}
