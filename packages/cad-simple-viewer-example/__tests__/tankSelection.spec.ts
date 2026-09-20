import { readDocumentTanks, TankLocator } from '../src/phase/tankSelection'

describe('Tank selection', () => {
  it('maps decimal CAD handles to drawing-scoped vessels in document order', () => {
    const document = { Map: { Data: { Tanks: [3685, 6972, 11153, 11265] } } }
    expect(readDocumentTanks(document, 'file:5')).toEqual([
      { id: 'file:5:E65', name: 'Vessel_1', handleKey: 'E65' },
      { id: 'file:5:1B3C', name: 'Vessel_2', handleKey: '1B3C' },
      { id: 'file:5:2B91', name: 'Vessel_3', handleKey: '2B91' },
      { id: 'file:5:2C01', name: 'Vessel_4', handleKey: '2C01' }
    ])
    expect(readDocumentTanks(document, 'file:6')[0].id).not.toBe('file:5:E65')
    expect(readDocumentTanks({}, 'file:5')).toEqual([])
    expect(readDocumentTanks({ Map: { Data: { Tanks: [3685, 3685, -1, 1.5] } } }, 'file:5')).toHaveLength(1)
  })

  it('blinks only the locator and disposes it on cancellation or replacement', () => {
    jest.useFakeTimers()
    const first = { setVisible: jest.fn(), dispose: jest.fn() }
    const second = { setVisible: jest.fn(), dispose: jest.fn() }
    const createOverlay = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
    const locator = new TankLocator(createOverlay)
    expect(locator.start('E65')).toBe(true)
    jest.advanceTimersByTime(500)
    expect(first.setVisible).toHaveBeenLastCalledWith(false)
    jest.advanceTimersByTime(500)
    expect(first.setVisible).toHaveBeenLastCalledWith(true)
    locator.start('1B3C')
    expect(first.dispose).toHaveBeenCalledTimes(1)
    locator.stop()
    expect(second.dispose).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
    expect(locator.start('missing')).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
    jest.useRealTimers()
  })
})