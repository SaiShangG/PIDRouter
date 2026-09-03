import type { PhaseReportExportOptions } from './ReportWorkspaceModal'

export const buildPhaseReportSelection = (
  options: PhaseReportExportOptions,
  resolveBackendId: (value: string, label: string) => number
) => {
  const selection: Record<string, Record<string, number[]>> = {}
  for (const page of options.pages) {
    const processId = String(resolveBackendId(page.processId, 'Process'))
    const sequenceId = String(resolveBackendId(page.sequenceId, 'Sequence'))
    const phaseId = resolveBackendId(page.phaseId, 'Phase')
    const sequences = selection[processId] ?? {}
    const phaseIds = sequences[sequenceId] ?? []
    phaseIds.push(phaseId)
    sequences[sequenceId] = phaseIds
    selection[processId] = sequences
  }
  return selection
}