import {
  parsePhasePidOverlay,
  TextAttachmentPoint
} from '../src/phase/phasePidOverlay'

const createValidOverlay = () => ({
  Index: 1,
  OrderId: 1,
  Name: ' S1-1 ',
  Comment: null,
  drawing: { fileId: 5, displayName: ' PID-1001.dwg ' },
  autoFlowPaths: [],
  flowPaths: [{
    handleKey: ' 43794 ',
    highlightStyleRefId: ' utility-1 '
  }],
  deviceStates: [{
    handleKey: ' 52532 ',
    stateKey: 'Open',
    highlightStyleRefId: ' state-style-1 ',
    deviceType: ' valve-1 '
  }],
  textNotes: [{
    Id: ' note-1 ',
    Content: 'Open valve',
    Position: { X: 1, Y: 2, Z: 0 },
    Width: 20,
    LineSpacingFactor: 1,
    AttachmentPoint: TextAttachmentPoint.MiddleCenter,
    linkedObjectHandleKey: ' 61270 ',
    visible: true,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T01:00:00.000Z'
  }]
})

describe('parsePhasePidOverlay', () => {
  it.each(['auto', 'manual', 'invalid', false, undefined])('ignores obsolete persisted edit mode %s', highlightMode => {
    const result = parsePhasePidOverlay({ ...createValidOverlay(), highlightMode })
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') throw new Error('Expected valid overlay')
    expect(result.overlay).not.toHaveProperty('highlightMode')
    expect(result.warnings).toEqual([])
  })

  it('does not convert legacy style sources into style references', () => {
    const result = parsePhasePidOverlay({
      ...createValidOverlay(),
      autoFlowPaths: [{ id: 'route', name: 'Route', handleKeys: ['26'], styleSource: { kind: 'utility', utilityId: 'water' } }],
      flowPaths: [{ handleKey: '26', style: { color: 0xff0000 }, geometry: 'bounds' }]
    })
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') throw new Error('Expected valid root')
    expect(result.overlay.autoFlowPaths).toEqual([])
    expect(result.overlay.flowPaths).toEqual([])
    expect(result.warnings.map(warning => warning.code)).toEqual(['invalid-auto-flow-path', 'invalid-flow-path'])
  })

  it('parses current data, normalizes values, and preserves stateKey case', () => {
    const result = parsePhasePidOverlay(JSON.stringify(createValidOverlay()))

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.warnings).toEqual([])
    expect(result.overlay.drawing).toEqual({
      fileId: 5,
      displayName: 'PID-1001.dwg'
    })
    expect(result.overlay.Name).toBe('S1-1')
    expect(result.overlay.flowPaths[0]).toEqual({
      handleKey: '43794',
      highlightStyleRefId: 'utility-1'
    })
    expect(result.overlay.deviceStates[0]).toEqual({
      handleKey: '52532',
      stateKey: 'Open',
      highlightStyleRefId: 'state-style-1',
      deviceType: 'valve-1'
    })
    expect(result.overlay.textNotes[0].linkedObjectHandleKey).toBe('61270')
  })

  it('retains backend device states when deviceType is omitted', () => {
    const overlay = createValidOverlay()
    const { deviceType: _deviceType, ...deviceState } = overlay.deviceStates[0]
    overlay.deviceStates = [deviceState as typeof overlay.deviceStates[number]]

    const result = parsePhasePidOverlay(overlay)

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.warnings).toEqual([])
    expect(result.overlay.deviceStates).toEqual([{
      handleKey: '52532',
      stateKey: 'Open',
      highlightStyleRefId: 'state-style-1'
    }])
  })

  it('normalizes null overlay collections from direct Process imports', () => {
    const overlay = createValidOverlay()
    overlay.flowPaths = null as unknown as typeof overlay.flowPaths
    overlay.deviceStates = null as unknown as typeof overlay.deviceStates
    overlay.textNotes = null as unknown as typeof overlay.textNotes

    const result = parsePhasePidOverlay(overlay)

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.overlay.drawing).toEqual({
      fileId: 5,
      displayName: 'PID-1001.dwg'
    })
    expect(result.overlay.flowPaths).toEqual([])
    expect(result.overlay.deviceStates).toEqual([])
    expect(result.overlay.textNotes).toEqual([])
  })

  it('skips invalid and duplicate entries while retaining valid entries', () => {
    const overlay = createValidOverlay()
    overlay.flowPaths.push(
      { ...overlay.flowPaths[0], handleKey: 'not-a-handle', highlightStyleRefId: 'utility-2' },
      { ...overlay.flowPaths[0], handleKey: '43794', highlightStyleRefId: 'utility-2' }
    )
    overlay.deviceStates.push({
      handleKey: '52532',
      stateKey: 'Closed',
      highlightStyleRefId: 'state-style-2',
      deviceType: 'valve-1'
    })
    overlay.textNotes.push({ ...overlay.textNotes[0] })

    const result = parsePhasePidOverlay(overlay)

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.overlay.flowPaths).toHaveLength(1)
    expect(result.overlay.deviceStates).toHaveLength(1)
    expect(result.overlay.textNotes).toHaveLength(1)
    expect(result.warnings.map(warning => warning.code)).toEqual([
      'invalid-flow-path',
      'duplicate-flow-path',
      'duplicate-device-state',
      'duplicate-text-note-id'
    ])
  })

  it('rejects the removed schemaVersion and highlightedObjects format', () => {
    expect(parsePhasePidOverlay({
      schemaVersion: 2,
      highlightedObjects: { flowPaths: [], deviceStates: [] },
      textNotes: []
    })).toEqual({
      status: 'invalid',
      reason: 'invalid-root',
      warnings: []
    })
  })

  it('rejects invalid JSON and malformed current roots', () => {
    expect(parsePhasePidOverlay('{invalid')).toEqual({
      status: 'invalid',
      reason: 'invalid-json',
      warnings: []
    })
    expect(parsePhasePidOverlay({ Index: 1 })).toEqual({
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