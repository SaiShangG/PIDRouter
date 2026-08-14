import {
  AcGeBox2d,
  AcGiMTextData,
  AcGiSubEntityTraits,
  AcGiTextStyle
} from '@mlightcad/data-model'
import * as THREE from 'three'

import { AcSvgStyleUtil } from './AcSvgStyleUtil'

export interface AcSvgMTextPathBuildResult {
  localSvg: string
  box: AcGeBox2d
}

export interface AcSvgObjectPathOptions {
  color?: number
  dispose?: boolean
  strokeWidth?: number
}

export type AcSvgMTextPathRenderer = (
  mtext: AcGiMTextData,
  style: AcGiTextStyle,
  traits: AcGiSubEntityTraits
) => THREE.Object3D & { dispose?: () => void }

/**
 * Serializes the viewer's final MTEXT geometry as SVG paths.
 *
 * This deliberately uses the active Three.js text renderer so PDF export shares
 * font fallback, glyph outlines, wrapping, alignment, and placement with the PID view.
 */
export function buildSvgMTextPaths(
  mtext: AcGiMTextData,
  style: AcGiTextStyle,
  traits: AcGiSubEntityTraits,
  render: AcSvgMTextPathRenderer
): AcSvgMTextPathBuildResult {
  const rendered = render(mtext, style, traits)
  return buildSvgObjectPaths(rendered, { dispose: true })
}

/** Serializes Three.js mesh and line geometry as world-space SVG paths. */
export function buildSvgObjectPaths(
  rendered: THREE.Object3D & { dispose?: () => void },
  options: AcSvgObjectPathOptions = {}
): AcSvgMTextPathBuildResult {
  const box = new AcGeBox2d()
  const paths: string[] = []

  try {
    rendered.updateMatrixWorld(true)
    rendered.traverse(object => {
      const drawable = object as THREE.Mesh | THREE.Line
      if (!drawable.visible || !drawable.geometry) return

      const instanceStart = drawable.geometry.getAttribute('instanceStart')
      const instanceEnd = drawable.geometry.getAttribute('instanceEnd')
      const position = drawable.geometry.getAttribute('position')

      if (instanceStart && instanceEnd) {
        const d = buildInstancedLinePath(
          drawable,
          instanceStart,
          instanceEnd,
          box
        )
        if (d) {
          paths.push(
            AcSvgStyleUtil.tag('path', {
              d,
              ...materialAttributes(
                drawable.material,
                false,
                options.color,
                options.strokeWidth
              )
            })
          )
        }
      } else if (!(position instanceof THREE.BufferAttribute)) {
        return
      } else if (drawable instanceof THREE.Mesh) {
        const d = buildTrianglePath(drawable, position, box)
        if (d) {
          paths.push(
            AcSvgStyleUtil.tag('path', {
              d,
              ...materialAttributes(drawable.material, true, options.color)
            })
          )
        }
      } else if (drawable instanceof THREE.Line) {
        const d = buildLinePath(drawable, position, box)
        if (d) {
          paths.push(
            AcSvgStyleUtil.tag('path', {
              d,
              ...materialAttributes(
                drawable.material,
                false,
                options.color,
                options.strokeWidth
              )
            })
          )
        }
      }
    })
  } finally {
    if (options.dispose) rendered.dispose?.()
  }

  return { localSvg: paths.join('\n'), box }
}

function buildInstancedLinePath(
  object: THREE.Object3D,
  starts: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  ends: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  box: AcGeBox2d
): string {
  const count = Math.min(starts.count, ends.count)
  let d = ''

  for (let index = 0; index < count; index++) {
    const start = transformedAttributePoint(starts, index, object)
    const end = transformedAttributePoint(ends, index, object)
    box.expandByPoint(start)
    box.expandByPoint(end)
    d += `M${start.x},${start.y}L${end.x},${end.y}`
  }

  return d
}

function buildTrianglePath(
  mesh: THREE.Mesh,
  position: THREE.BufferAttribute,
  box: AcGeBox2d
): string {
  const index = mesh.geometry.getIndex()
  const count = index?.count ?? position.count
  let d = ''

  for (let offset = 0; offset + 2 < count; offset += 3) {
    const points = [0, 1, 2].map(step =>
      transformedPoint(position, index?.getX(offset + step) ?? offset + step, mesh)
    )
    for (const point of points) box.expandByPoint(point)
    d += `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}L${points[2].x},${points[2].y}Z`
  }

  return d
}

function buildLinePath(
  line: THREE.Line,
  position: THREE.BufferAttribute,
  box: AcGeBox2d
): string {
  const index = line.geometry.getIndex()
  const count = index?.count ?? position.count
  const isSegments = line instanceof THREE.LineSegments
  let d = ''

  for (let offset = 0; offset < count; offset++) {
    const vertexIndex = index?.getX(offset) ?? offset
    const point = transformedPoint(position, vertexIndex, line)
    box.expandByPoint(point)
    d += offset === 0 || (isSegments && offset % 2 === 0) ? 'M' : 'L'
    d += `${point.x},${point.y}`
  }

  return d
}

function transformedPoint(
  position: THREE.BufferAttribute,
  index: number,
  object: THREE.Object3D
) {
  const point = new THREE.Vector3(
    position.getX(index),
    position.getY(index),
    position.getZ(index)
  ).applyMatrix4(object.matrixWorld)
  return { x: point.x, y: point.y }
}

function transformedAttributePoint(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number,
  object: THREE.Object3D
) {
  const point = new THREE.Vector3(
    attribute.getX(index),
    attribute.getY(index),
    attribute.getZ(index)
  ).applyMatrix4(object.matrixWorld)
  return { x: point.x, y: point.y }
}

function materialAttributes(
  material: THREE.Material | THREE.Material[],
  filled: boolean,
  colorOverride?: number,
  strokeWidth = 0.05
): Record<string, string> {
  const resolved = Array.isArray(material) ? material[0] : material
  const colored = resolved as THREE.Material & { color?: THREE.Color }
  const color =
    colorOverride == null
      ? colored.color
        ? `#${colored.color.getHexString()}`
        : '#000000'
      : `#${colorOverride.toString(16).padStart(6, '0')}`
  const attrs: Record<string, string> = filled
    ? { fill: color, stroke: 'none', 'fill-rule': 'nonzero' }
    : {
        fill: 'none',
        stroke: color,
        'stroke-width': String(strokeWidth),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }

  if (resolved.transparent && resolved.opacity < 1) {
    attrs[filled ? 'fill-opacity' : 'stroke-opacity'] = String(resolved.opacity)
  }
  return attrs
}