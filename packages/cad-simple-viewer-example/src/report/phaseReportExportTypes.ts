export type PhaseReportOutputMode = 'merged' | 'per-sequence'

export interface PhaseReportProgress {
  completed: number
  total: number
  pageNumber: number
  sequenceId: string
  phaseId: string
}

export interface PhaseReportFailure extends PhaseReportProgress {
  slotId: string
  error: unknown
}

export interface PhaseReportRetryOptions {
  signal?: AbortSignal
  onProgress?(progress: PhaseReportProgress): void
}

export type PhaseReportExportResult =
  | { status: 'completed'; fileName: string; bytes: Uint8Array }
  | { status: 'canceled' }
  | {
    status: 'failed'
    failures: PhaseReportFailure[]
    retry(options?: PhaseReportRetryOptions): Promise<PhaseReportExportResult>
  }