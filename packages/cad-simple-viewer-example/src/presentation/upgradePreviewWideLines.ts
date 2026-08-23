import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

import { extractLineDrawRangePositions } from './extractLineDrawRangePositions'
import type { ResolvedEntityPresentation } from './presentationStyleResolver'

export function upgradePreviewWideLines(
  root: THREE.Object3D,
  style: ResolvedEntityPresentation,
  width: number,
  height: number
) {
  const thinLines: THREE.LineSegments[] = []
  root.traverse(object => {
    if (
      object instanceof THREE.LineSegments &&
      !(object instanceof LineSegments2) &&
      object.material instanceof THREE.LineBasicMaterial
    ) {
      thinLines.push(object)
    }
  })

  thinLines.forEach(line => {
    const parent = line.parent
    if (!parent) return
    const positions = extractLineDrawRangePositions(line.geometry)
    if (!positions) return
    const geometry = new LineSegmentsGeometry()
    geometry.setPositions(positions)
    const material = new LineMaterial({
      color: style.color,
      linewidth: style.lineWidthPx,
      opacity: style.opacity,
      transparent: style.opacity < 1,
      depthTest: false,
      depthWrite: false
    })
    material.resolution.set(Math.max(1, width), Math.max(1, height))
    const wideLine = new LineSegments2(geometry, material)
    wideLine.name = line.name
    wideLine.position.copy(line.position)
    wideLine.quaternion.copy(line.quaternion)
    wideLine.scale.copy(line.scale)
    wideLine.renderOrder = line.renderOrder
    wideLine.visible = line.visible
    wideLine.userData = {
      ...line.userData,
      disposeGeometryOnRemove: true
    }
    const childIndex = parent.children.indexOf(line)
    parent.remove(line)
    parent.add(wideLine)
    if (childIndex >= 0) {
      parent.children.splice(parent.children.indexOf(wideLine), 1)
      parent.children.splice(childIndex, 0, wideLine)
    }
    if (Array.isArray(line.material)) {
      line.material.forEach(item => item.dispose())
    } else {
      line.material.dispose()
    }
  })
}
