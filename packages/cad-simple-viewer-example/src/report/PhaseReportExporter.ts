import JSZip from 'jszip'

import type { PhaseWorkspaceState } from '../phase/types'
import type { ReportManifest, ReportPageSlot } from './reportManifest'

export type PhaseReportOutputMode = 'merged' | 'per-sequence'

export interface PhaseReportLocation {
  processId: string
  sequenceId: string
  phaseId: string
}

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

export interface PhaseReportExporterDependencies {
  activate(location: PhaseReportLocation): Promise<void>
  renderPage(): Promise<Uint8Array>
  compose(pages: readonly Uint8Array[]): Promise<Uint8Array>
  restore(location?: PhaseReportLocation): Promise<void>
  yieldToMainThread?(): Promise<void>
}

export interface PhaseReportExportOptions {
  mode: PhaseReportOutputMode
  signal?: AbortSignal
  onProgress?(progress: PhaseReportProgress): void
}

interface ResolvedPage {
  slot: ReportPageSlot
  pageNumber: number
  source: PhaseReportLocation
}

const sanitizeFileName = (value: string) =>
  [...value.trim()]
    .map(character => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_') || 'report'

const activeLocation = (
  workspace: PhaseWorkspaceState
): PhaseReportLocation | undefined => {
  const process = workspace.processes.find(
    item => item.id === workspace.activeProcessId
  )
  const sequence = process?.sequences.find(
    item => item.id === process.activeSequenceId
  )
  const phase = sequence?.phases.find(item => item.id === sequence.activePhaseId)
  return process && sequence && phase
    ? { processId: process.id, sequenceId: sequence.id, phaseId: phase.id }
    : undefined
}

const resolvePages = (
  workspace: PhaseWorkspaceState,
  manifest: ReportManifest
): ResolvedPage[] => {
  const phaseIds = new Set(
    workspace.processes.flatMap(process =>
      process.sequences.flatMap(sequence =>
        sequence.phases.map(phase =>
          `${process.id}\u0000${sequence.id}\u0000${phase.id}`
        )
      )
    )
  )
  return manifest.pages.flatMap((slot, index) => {
    if (slot.excluded) return []
    const source = slot.replacement ?? {
      kind: 'phase' as const,
      processId: slot.processId,
      sequenceId: slot.sequenceId,
      phaseId: slot.phaseId
    }
    const key = `${source.processId}\u0000${source.sequenceId}\u0000${source.phaseId}`
    if (!phaseIds.has(key)) {
      throw new Error(`Report page ${index + 1} has an invalid Phase source.`)
    }
    return [{ slot, pageNumber: index + 1, source }]
  })
}

export class PhaseReportExporter {
  constructor(private readonly dependencies: PhaseReportExporterDependencies) {}

  private yieldToMainThread() {
    return this.dependencies.yieldToMainThread?.() ??
      new Promise<void>(resolve => setTimeout(resolve, 0))
  }

  async export(
    workspace: PhaseWorkspaceState,
    manifest: ReportManifest,
    options: PhaseReportExportOptions
  ): Promise<PhaseReportExportResult> {
    const original = activeLocation(workspace)
    const pages = resolvePages(workspace, manifest)
    const process = workspace.processes.find(item => item.id === manifest.processId)
    const processName = sanitizeFileName(process?.name ?? 'report')
    const rendered = new Map<string, Uint8Array>()

    const composeOutput = async (
      signal?: AbortSignal
    ): Promise<PhaseReportExportResult> => {
      if (signal?.aborted) return { status: 'canceled' }
      await this.yieldToMainThread()
      if (signal?.aborted) return { status: 'canceled' }
      if (options.mode === 'merged') {
        const bytes = await this.dependencies.compose(
          pages.map(page => rendered.get(page.slot.id)!)
        )
        if (signal?.aborted) return { status: 'canceled' }
        return {
          status: 'completed',
          fileName: `${processName}-report.pdf`,
          bytes
        }
      }

      const zip = new JSZip()
      for (const sequence of process?.sequences ?? []) {
        if (signal?.aborted) return { status: 'canceled' }
        const sequencePages = pages
          .filter(page => page.slot.sequenceId === sequence.id)
          .map(page => rendered.get(page.slot.id)!)
        if (sequencePages.length === 0) continue
        const pdf = await this.dependencies.compose(sequencePages)
        if (signal?.aborted) return { status: 'canceled' }
        const number = String(sequence.number).padStart(2, '0')
        zip.file(`${number}-${sanitizeFileName(sequence.name)}.pdf`, pdf)
      }
      const bytes = await zip.generateAsync({ type: 'uint8array' })
      if (signal?.aborted) return { status: 'canceled' }
      return {
        status: 'completed',
        fileName: `${processName}-reports.zip`,
        bytes
      }
    }

    const run = async (
      pendingPages: ResolvedPage[],
      retryOptions: PhaseReportRetryOptions
    ): Promise<PhaseReportExportResult> => {
      const failures: PhaseReportFailure[] = []
      try {
        for (const page of pendingPages) {
          if (retryOptions.signal?.aborted) return { status: 'canceled' }
          try {
            await this.dependencies.activate(page.source)
            if (retryOptions.signal?.aborted) return { status: 'canceled' }
            await this.yieldToMainThread()
            if (retryOptions.signal?.aborted) return { status: 'canceled' }
            const bytes = await this.dependencies.renderPage()
            if (retryOptions.signal?.aborted) return { status: 'canceled' }
            rendered.set(page.slot.id, bytes)
            retryOptions.onProgress?.({
              completed: rendered.size,
              total: pages.length,
              pageNumber: page.pageNumber,
              sequenceId: page.slot.sequenceId,
              phaseId: page.source.phaseId
            })
          } catch (error) {
            if (retryOptions.signal?.aborted) return { status: 'canceled' }
            failures.push({
              completed: rendered.size,
              total: pages.length,
              pageNumber: page.pageNumber,
              sequenceId: page.slot.sequenceId,
              phaseId: page.source.phaseId,
              slotId: page.slot.id,
              error
            })
          }
        }

        if (failures.length > 0) {
          const failedSlotIds = new Set(failures.map(failure => failure.slotId))
          return {
            status: 'failed',
            failures,
            retry: nextOptions =>
              run(
                pages.filter(page => failedSlotIds.has(page.slot.id)),
                nextOptions ?? {}
              )
          }
        }
        return composeOutput(retryOptions.signal)
      } finally {
        await this.dependencies.restore(original)
      }
    }

    if (pages.length === 0) {
      return {
        status: 'failed',
        failures: [
          {
            completed: 0,
            total: 0,
            pageNumber: 0,
            sequenceId: '',
            phaseId: '',
            slotId: '',
            error: new Error('The report has no included pages.')
          }
        ],
        retry: async () => this.export(workspace, manifest, options)
      }
    }

    return run(pages, options)
  }
}
