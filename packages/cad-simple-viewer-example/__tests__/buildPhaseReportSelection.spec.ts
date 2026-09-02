import { buildPhaseReportSelection } from '../src/report/buildPhaseReportSelection'
import type { PhaseReportExportOptions } from '../src/report/ReportWorkspaceModal'

describe('buildPhaseReportSelection', () => {
  it('preserves page order while omitting excluded pages and using replacements', () => {
    const options: PhaseReportExportOptions = {
      mode: 'merged',
      fileName: 'CIP-report.pdf',
      processId: 'process-10',
      sequenceIds: ['sequence-20', 'sequence-30'],
      pages: [
        { sequenceId: 'sequence-20', phaseId: 'phase-202' },
        { sequenceId: 'sequence-20', phaseId: 'phase-203' },
        { sequenceId: 'sequence-30', phaseId: 'phase-301' }
      ]
    }

    expect(
      buildPhaseReportSelection(options, value =>
        Number(value.slice(value.lastIndexOf('-') + 1))
      )
    ).toEqual({
      processId: 10,
      sequences: {
        20: [202, 203],
        30: [301]
      }
    })
  })
})