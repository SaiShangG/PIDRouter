import { buildHighlightBoundsMarkerPositions } from '../src/presentation/highlightBoundsMarker'

describe('highlight bounds markers', () => {
  const bounds = { min: { x: 0, y: 0 }, max: { x: 10, y: 5 } }

  it('preserves the padded rectangular locator frame', () => {
    expect(buildHighlightBoundsMarkerPositions(bounds)).toEqual([
      -1, -1, 0, 11, -1, 0,
      11, -1, 0, 11, 6, 0,
      11, 6, 0, -1, 6, 0,
      -1, 6, 0, -1, -1, 0
    ])
  })

  it('adds a separated exclamation stem and dot outside the device bounds', () => {
    const frame = buildHighlightBoundsMarkerPositions(bounds)
    const warning = buildHighlightBoundsMarkerPositions(bounds, true)
    expect(warning.slice(0, frame.length)).toEqual(frame)
    expect(warning).toHaveLength(36)
    const [stemX, topY, , endX, stemEndY, , dotLeft, dotY, , dotRight] = warning.slice(24)
    expect(stemX).toBeGreaterThan(bounds.max.x)
    expect(endX).toBe(stemX)
    expect(topY).toBeGreaterThan(stemEndY)
    expect(stemEndY).toBeGreaterThan(dotY)
    expect(dotLeft).toBeLessThan(stemX)
    expect(dotRight).toBeGreaterThan(stemX)
  })

  it('creates a visible finite marker even for point-like geometry', () => {
    const result = buildHighlightBoundsMarkerPositions({
      min: { x: -20, y: 2 }, max: { x: -20, y: 2 }
    }, true)
    expect(result.every(Number.isFinite)).toBe(true)
    expect(result[0]).toBeLessThan(-20)
    expect(result[3]).toBeGreaterThan(-20)
    expect(result[25]).toBeGreaterThan(result[28])
  })

  it.each([
    { min: { x: NaN, y: 0 }, max: { x: 1, y: 1 } },
    { min: { x: 0, y: 0 }, max: { x: Infinity, y: 1 } },
    { min: { x: 2, y: 0 }, max: { x: 1, y: 1 } },
    { min: { x: 0, y: 2 }, max: { x: 1, y: 1 } }
  ])('explicitly rejects invalid bounds %j', invalid => {
    expect(() => buildHighlightBoundsMarkerPositions(invalid, true)).toThrow(RangeError)
  })
})
