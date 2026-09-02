import type { PhaseReportExportOptions } from './ReportWorkspaceModal'

export const buildPhaseReportSelection = (
  options: PhaseReportExportOptions,
  resolveBackendId: (value: string, label: string) => number
) => {
  const sequences: Record<string, number[]> = {}
  for (const page of options.pages) {
    const sequenceId = String(resolveBackendId(page.sequenceId, 'Sequence'))
    const phaseId = resolveBackendId(page.phaseId, 'Phase')
    const phaseIds = sequences[sequenceId] ?? []
    phaseIds.push(phaseId)
    sequences[sequenceId] = phaseIds
  }
  return {
    processId: resolveBackendId(options.processId, 'Process'),
    sequences
  }
}