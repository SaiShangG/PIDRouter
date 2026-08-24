import { createDefaultPresentationProfile } from '../src/phase/phaseWorkspaceStore'
import { resolveEntityPresentation } from '../src/presentation/presentationStyleResolver'
import {
  resolveEntityHighlight,
  resolvePrimaryFlowHighlight
} from '../src/presentation/resolveEntityHighlight'

describe('resolveEntityHighlight', () => {
  const profile = createDefaultPresentationProfile()
  const ordinaryStyle = resolveEntityPresentation(profile)
  const brushStyle = resolveEntityPresentation(profile, {
    diagnosticStyle: {
      color: 0x123456,
      lineWidthPx: 2,
      opacity: 1,
      visible: true
    }
  })
  const selectionStyle = resolveEntityPresentation(profile, {
    diagnosticStyle: {
      color: 0x234567,
      lineWidthPx: 2,
      opacity: 1,
      visible: true
    }
  })
  const hoverStyle = resolveEntityPresentation(profile, {
    diagnosticStyle: {
      color: 0x345678,
      lineWidthPx: 2,
      opacity: 1,
      visible: true
    }
  })

  it('prefers active flow, then brush, selection, hover, and ordinary styles', () => {
    expect(resolveEntityHighlight({
      flowStyles: [
        { flowPathId: 'low', priority: 1, style: ordinaryStyle },
        { flowPathId: 'high', priority: 2, style: brushStyle }
      ],
      brushStyle,
      ordinaryStyle,
      selectionStyle,
      hoverStyle,
      selected: true,
      hovered: true
    }, 'low')).toMatchObject({ source: 'flow', style: ordinaryStyle })

    expect(resolveEntityHighlight({
      brushStyle,
      ordinaryStyle,
      selectionStyle,
      selected: true
    })).toMatchObject({ source: 'brush', style: brushStyle })
    expect(resolveEntityHighlight({
      ordinaryStyle,
      selectionStyle,
      selected: true,
      hovered: true,
      hoverStyle
    })).toMatchObject({ source: 'selection', style: selectionStyle })
    expect(resolveEntityHighlight({
      ordinaryStyle,
      hoverStyle,
      hovered: true
    })).toMatchObject({ source: 'hover', style: hoverStyle })
  })

  it('chooses a stable primary flow when no flow is active', () => {
    expect(resolvePrimaryFlowHighlight([
      { flowPathId: 'z-path', priority: 3, style: ordinaryStyle },
      { flowPathId: 'a-path', priority: 3, style: brushStyle }
    ])).toMatchObject({ flowPathId: 'a-path' })
  })
})