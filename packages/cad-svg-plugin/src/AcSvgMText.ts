import {
  AcGiMTextData,
  AcGiSubEntityTraits,
  AcGiTextStyle
} from '@mlightcad/data-model'

import { AcSvgEntity } from './AcSvgEntity'
import {
  AcSvgMTextPathRenderer,
  buildSvgMTextPaths
} from './AcSvgMTextPathUtil'
import { buildSvgMText } from './AcSvgMTextUtil'
import { AcSvgStyleContext } from './AcSvgStyleUtil'

/**
 * SVG mtext entity rendered from parsed MTEXT tokens via {@link @mlightcad/mtext-parser}.
 */
export class AcSvgMText extends AcSvgEntity {
  constructor(
    mtext: AcGiMTextData,
    style: AcGiTextStyle,
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext,
    pathRenderer?: AcSvgMTextPathRenderer
  ) {
    super()
    const built = pathRenderer
      ? buildSvgMTextPaths(mtext, style, traits, pathRenderer)
      : buildSvgMText(mtext, style, traits, ctx)
    this._localSvg = built.localSvg
    this._box = built.box
  }
}
