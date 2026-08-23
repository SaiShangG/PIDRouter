import * as THREE from 'three'

import { extractLineDrawRangePositions } from '../src/presentation/extractLineDrawRangePositions'

describe('extractLineDrawRangePositions', () => {
  it('copies only the active range from shared non-indexed line geometry', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0, 0,
          1, 0, 0,
          10, 0, 0,
          11, 0, 0,
          20, 0, 0,
          21, 0, 0
        ],
        3
      )
    )
    geometry.setDrawRange(2, 2)

    expect([...extractLineDrawRangePositions(geometry)!]).toEqual([
      10, 0, 0,
      11, 0, 0
    ])
  })

  it('resolves indexed draw ranges without copying neighboring segments', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0, 0,
          1, 0, 0,
          10, 0, 0,
          11, 0, 0
        ],
        3
      )
    )
    geometry.setIndex([0, 1, 2, 3])
    geometry.setDrawRange(2, 2)

    expect([...extractLineDrawRangePositions(geometry)!]).toEqual([
      10, 0, 0,
      11, 0, 0
    ])
  })
})
