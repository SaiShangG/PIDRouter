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
        { processId: 'process-10', sequenceId: 'sequence-20', phaseId: 'phase-202' },
        { processId: 'process-10', sequenceId: 'sequence-20', phaseId: 'phase-203' },
        { processId: 'process-11', sequenceId: 'sequence-30', phaseId: 'phase-301' }
      ]
    }

    expect(
      buildPhaseReportSelection(options, value =>
        Number(value.slice(value.lastIndexOf('-') + 1))
      )
    ).toEqual({
      10: {
        20: [202, 203],
      },
      11: {
        30: [301]
      }
    })
  })
})