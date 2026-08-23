import * as THREE from 'three'

/**
 * Copies only the active LineSegments draw range into a standalone position buffer.
 * Batched preview objects share their source geometry and isolate one entity through
 * `geometry.drawRange`; consumers must preserve that range when rebuilding geometry.
 */
export function extractLineDrawRangePositions(
  geometry: THREE.BufferGeometry
): Float32Array | null {
  const position = geometry.getAttribute('position')
  if (!position || position.count < 2) return null

  const index = geometry.getIndex()
  const availableCount = index?.count ?? position.count
  const start = Math.min(
    availableCount,
    Math.max(0, Math.floor(geometry.drawRange.start || 0))
  )
  const requestedCount = Number.isFinite(geometry.drawRange.count)
    ? Math.max(0, Math.floor(geometry.drawRange.count))
    : availableCount - start
  const clampedCount = Math.min(requestedCount, availableCount - start)
  const segmentVertexCount = clampedCount - (clampedCount % 2)
  if (segmentVertexCount < 2) return null

  const positions = new Float32Array(segmentVertexCount * 3)
  for (let offset = 0; offset < segmentVertexCount; offset++) {
    const drawIndex = start + offset
    const vertexIndex = index ? index.getX(drawIndex) : drawIndex
    const target = offset * 3
    positions[target] = position.getX(vertexIndex)
    positions[target + 1] = position.getY(vertexIndex)
    positions[target + 2] = position.itemSize >= 3 ? position.getZ(vertexIndex) : 0
  }
  return positions
}
