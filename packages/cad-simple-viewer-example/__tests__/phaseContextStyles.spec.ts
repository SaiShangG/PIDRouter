/** @jest-environment jsdom */

import { injectUiReferenceThemeStyles } from '../src/uiReferenceThemeStyles'

describe('phase context select sizing', () => {
  beforeEach(() => {
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it('uses content width without shrinking or changing the other selectors', () => {
    injectUiReferenceThemeStyles()
    const field = document.createElement('label')
    field.className = 'phase-context-field'
    const phase = document.createElement('select')
    phase.id = 'phaseContextPhase'
    phase.add(new Option('Phase 8010 · CIP preparation', '8010'))
    phase.add(
      new Option('Phase 8020 · Complete cleaning and sterilization', '8020')
    )
    field.append(phase)
    const process = document.createElement('select')
    const processField = document.createElement('label')
    processField.className = 'phase-context-field'
    processField.append(process)
    document.body.append(field, processField)

    const style = getComputedStyle(phase)
    expect(style.width).toBe('auto')
    expect(style.minWidth).toBe('160px')
    expect(style.flexShrink).toBe('0')
    expect(getComputedStyle(process).width).toBe('160px')
    expect(
      document.getElementById('ui-reference-theme-styles')?.textContent
    ).toContain('field-sizing: content')
    expect(Array.from(phase.options, option => option.text)).toEqual([
      'Phase 8010 · CIP preparation',
      'Phase 8020 · Complete cleaning and sterilization'
    ])
  })
})
