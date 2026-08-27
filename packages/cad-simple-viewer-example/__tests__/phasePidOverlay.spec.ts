import {
  parsePhasePidOverlay,
  TextAttachmentPoint
} from '../src/phase/phasePidOverlay'

const createValidOverlay = () => ({
  schemaVersion: 2,
  drawing: { fileId: 5, displayName: ' PID-1001.dwg ' },
  highlightedObjects: {
    flowPaths: [{ handleKey: ' 43794 ', highlightStyleRefId: ' utility-1 ' }],
    deviceStates: [{
      handleKey: ' 52532 ',
      stateKey: 'Open',
      highlightStyleRefId: ' state-style-1 ',
      deviceType: ' valve-1 '
    }]
  },
  textNotes: [{
    id: ' note-1 ',
    contents: 'Open valve',
    location: { x: 1, y: 2, z: 0 },
    width: 20,
    rotation: Math.PI / 2,
    attachmentPoint: TextAttachmentPoint.MiddleCenter,
    linkedObjectHandleKey: ' 61270 ',
    visible: true,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T01:00:00.000Z'
  }]
})

describe('parsePhasePidOverlay', () => {
  it('parses v2 data, normalizes handles, and preserves stateKey case', () => {
    const result = parsePhasePidOverlay(JSON.stringify(createValidOverlay()))

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.warnings).toEqual([])
    expect(result.overlay.drawing).toEqual({
      fileId: 5,
      displayName: 'PID-1001.dwg'
    })
    expect(result.overlay.highlightedObjects.flowPaths[0]).toEqual({
      handleKey: '43794',
      highlightStyleRefId: 'utility-1'
    })
    expect(result.overlay.highlightedObjects.deviceStates[0]).toEqual({
      handleKey: '52532',
      stateKey: 'Open',
      highlightStyleRefId: 'state-style-1',
      deviceType: 'valve-1'
    })
    expect(result.overlay.textNotes[0].linkedObjectHandleKey).toBe('61270')
  })

  it('skips invalid and duplicate entries while retaining valid entries', () => {
    const overlay = createValidOverlay()
    overlay.highlightedObjects.flowPaths.push(
      { handleKey: 'not-a-handle', highlightStyleRefId: 'utility-2' },
      { handleKey: '43794', highlightStyleRefId: 'utility-2' }
    )
    overlay.highlightedObjects.deviceStates.push({
      handleKey: '52532',
      stateKey: 'Closed',
      highlightStyleRefId: 'state-style-2',
      deviceType: 'valve-1'
    })
    overlay.textNotes.push({ ...overlay.textNotes[0] })

    const result = parsePhasePidOverlay(overlay)

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.overlay.highlightedObjects.flowPaths).toHaveLength(1)
    expect(result.overlay.highlightedObjects.deviceStates).toHaveLength(1)
    expect(result.overlay.textNotes).toHaveLength(1)
    expect(result.warnings.map(warning => warning.code)).toEqual([
      'invalid-flow-path',
      'duplicate-flow-path',
      'duplicate-device-state',
      'duplicate-text-note-id'
    ])
  })

  it('rejects v1 and unknown schema versions as unsupported', () => {
    expect(parsePhasePidOverlay({ schemaVersion: 1 })).toEqual({
      status: 'unsupported',
      schemaVersion: 1,
      warnings: []
    })
    expect(parsePhasePidOverlay({ schemaVersion: 3 })).toEqual({
      status: 'unsupported',
      schemaVersion: 3,
      warnings: []
    })
  })

  it('rejects invalid JSON and malformed v2 roots', () => {
    expect(parsePhasePidOverlay('{invalid')).toEqual({
      status: 'invalid',
      reason: 'invalid-json',
      warnings: []
    })
    expect(parsePhasePidOverlay({ schemaVersion: 2 })).toEqual({
      status: 'invalid',
      reason: 'invalid-root',
      warnings: []
    })
  })

  it('omits an invalid optional drawing and invalid text notes with warnings', () => {
    const overlay = createValidOverlay()
    overlay.drawing.fileId = 0
    overlay.textNotes[0].createdAt = '2026-08-27'

    const result = parsePhasePidOverlay(overlay)

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.overlay.drawing).toBeUndefined()
    expect(result.overlay.textNotes).toEqual([])
    expect(result.warnings).toEqual([
      { code: 'invalid-drawing', path: 'drawing' },
      { code: 'invalid-text-note', path: 'textNotes[0]' }
    ])
  })
})