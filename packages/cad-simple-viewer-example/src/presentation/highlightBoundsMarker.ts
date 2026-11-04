export const buildHighlightBoundsMarkerPositions = (
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
  warning = false
): number[] => {
  const { min, max } = bounds
  if (![min.x, min.y, max.x, max.y].every(Number.isFinite) ||
    max.x < min.x || max.y < min.y) {
    throw new RangeError('Highlight marker bounds must be finite and ordered')
  }
  const padding = Math.max(Math.max(max.x - min.x, max.y - min.y) * 0.06, 1)
  const minX = min.x - padding
  const minY = min.y - padding
  const maxX = max.x + padding
  const maxY = max.y + padding
  const positions = [
    minX, minY, 0, maxX, minY, 0,
    maxX, minY, 0, maxX, maxY, 0,
    maxX, maxY, 0, minX, maxY, 0,
    minX, maxY, 0, minX, minY, 0
  ]
  if (warning) {
    const x = maxX + padding * 2
    positions.push(
      x, maxY, 0, x, maxY - padding * 2.4, 0,
      x - padding * 0.15, maxY - padding * 3.2, 0,
      x + padding * 0.15, maxY - padding * 3.2, 0
    )
  }
  return positions
}
