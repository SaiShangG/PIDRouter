import {
  AcCmColor,
  AcCmTransparency,
  AcGiLineWeight,
  AcGiSubEntityTraits
} from '@mlightcad/data-model'
import * as THREE from 'three'

import {
  buildSvgMTextPaths,
  buildSvgObjectPaths
} from '../src/AcSvgMTextPathUtil'

function createTraits(): AcGiSubEntityTraits {
  const color = new AcCmColor()
  color.setRGB(255, 0, 0)
  return {
    color,
    lineType: {
      type: 'ByLayer',
      name: 'Continuous',
      standardFlag: 0,
      description: 'Solid line',
      totalPatternLength: 0
    },
    lineTypeScale: 1,
    lineWeight: AcGiLineWeight.LineWeight013,
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

describe('buildSvgMTextPaths', () => {
  it('serializes viewer glyph meshes as paths without SVG text', () => {
    const rendered = new THREE.Group() as THREE.Group & { dispose(): void }
    rendered.dispose = jest.fn()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 3, 0], 3)
    )
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(10, 20, 0)
    rendered.add(mesh)

    const result = buildSvgMTextPaths(
      {
        text: 'A',
        height: 3,
        position: { x: 10, y: 20, z: 0 }
      } as never,
      { font: 'simplex.shx' } as never,
      createTraits(),
      () => rendered as never
    )

    expect(result.localSvg).toContain('<path')
    expect(result.localSvg).toContain('M10,20L12,20L10,23Z')
    expect(result.localSvg).not.toContain('<text')
    expect(result.localSvg).not.toContain('<tspan')
    expect(result.box.min.x).toBe(10)
    expect(result.box.max.y).toBe(23)
  })

  it('exports viewer-owned Phase overlays with the configured highlight color', () => {
    const rendered = new THREE.Group() as THREE.Group & { dispose(): void }
    rendered.dispose = jest.fn()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 5, 0, 0], 3)
    )
    rendered.add(
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x000000 })
      )
    )

    const result = buildSvgObjectPaths(rendered, { color: 0x00c853 })

    expect(result.localSvg).toContain('stroke="#00c853"')
    expect(result.localSvg).toContain('M0,0L5,0')
    expect(rendered.dispose).not.toHaveBeenCalled()
  })

  it('serializes LineSegments2 instance endpoints instead of template triangles', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 0, 1, 0], 3)
    )
    geometry.setAttribute(
      'instanceStart',
      new THREE.Float32BufferAttribute([0, 0, 0, 5, 1, 0], 3)
    )
    geometry.setAttribute(
      'instanceEnd',
      new THREE.Float32BufferAttribute([5, 0, 0, 5, 4, 0], 3)
    )
    const line = new THREE.Mesh(geometry)
    line.position.set(10, 20, 0)
    const rendered = new THREE.Group()
    rendered.add(line)

    const result = buildSvgObjectPaths(rendered, {
      color: 0x00c853,
      strokeWidth: 0.2
    })

    expect(result.localSvg).toContain('d="M10,20L15,20M15,21L15,24"')
    expect(result.localSvg).toContain('stroke="#00c853"')
    expect(result.localSvg).toContain('stroke-width="0.2"')
    expect(result.localSvg.match(/<path/g)).toHaveLength(1)
    expect(result.box.min.x).toBe(10)
    expect(result.box.max.y).toBe(24)
  })
})