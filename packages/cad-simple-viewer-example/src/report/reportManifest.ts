import type { PhaseWorkspaceState } from '../phase/types'

export const REPORT_MANIFEST_STORAGE_KEY =
  'cad-simple-viewer-example-report-manifest'
export const ALL_REPORT_PROCESSES_ID = 'all'

export interface PhaseReportPageSource {
  kind: 'phase'
  processId: string
  sequenceId: string
  phaseId: string
}

export interface ReportPageSlot {
  id: string
  processId: string
  sequenceId: string
  phaseId: string
  excluded: boolean
  replacement?: PhaseReportPageSource
}

export interface ReportManifest {
  id: string
  processId?: string
  pages: ReportPageSlot[]
  createdAt: string
  updatedAt: string
}

export type ReportPreflightIssueCode =
  | 'empty-sequence'
  | 'missing-drawing'
  | 'duplicate-phase-number'
  | 'invalid-replacement'
  | 'missing-drawing-asset'
  | 'drawing-load-failed'

export interface ReportPreflightIssue {
  code: ReportPreflightIssueCode
  severity: 'error' | 'warning'
  processId: string
  sequenceId: string
  phaseId?: string
  slotId?: string
}

const pageKey = (sequenceId: string, phaseId: string) =>
  `${sequenceId}\u0000${phaseId}`

const cloneSlot = (slot: ReportPageSlot): ReportPageSlot => ({
  ...slot,
  replacement: slot.replacement ? { ...slot.replacement } : undefined
})

const cloneManifest = (manifest: ReportManifest): ReportManifest => ({
  ...manifest,
  pages: manifest.pages.map(cloneSlot)
})

const isManifest = (value: unknown): value is ReportManifest => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ReportManifest>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    Array.isArray(candidate.pages)
  )
}

export class ReportManifestStore {
  private manifest: ReportManifest
  private readonly failedDrawingAssetIds = new Set<string>()

  constructor(
    initialManifest?: ReportManifest,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString()
  ) {
    const timestamp = this.now()
    this.manifest = initialManifest
      ? cloneManifest(initialManifest)
      : {
        id: this.createId(),
        pages: [],
        createdAt: timestamp,
        updatedAt: timestamp
      }
  }

  static load(
    storage: Pick<Storage, 'getItem'> = localStorage,
    createId?: () => string,
    now?: () => string
  ) {
    try {
      const raw = storage.getItem(REPORT_MANIFEST_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : undefined
      return new ReportManifestStore(
        isManifest(parsed) ? parsed : undefined,
        createId,
        now
      )
    } catch {
      return new ReportManifestStore(undefined, createId, now)
    }
  }

  snapshot(): ReportManifest {
    return cloneManifest(this.manifest)
  }

  freeze(): ReportManifest {
    return cloneManifest(this.manifest)
  }

  persist(storage: Pick<Storage, 'setItem'> = localStorage): boolean {
    try {
      storage.setItem(REPORT_MANIFEST_STORAGE_KEY, JSON.stringify(this.manifest))
      return true
    } catch {
      return false
    }
  }

  reconcile(workspace: PhaseWorkspaceState): ReportManifest {
    const existing = new Map(
      this.manifest.pages.map(slot => [pageKey(slot.sequenceId, slot.phaseId), slot])
    )
    const pages: ReportPageSlot[] = []
    const processes = workspace.activeProcessId === ALL_REPORT_PROCESSES_ID
      ? workspace.processes
      : [
        workspace.processes.find(item => item.id === workspace.activeProcessId) ??
        workspace.processes[0]
      ].filter((process): process is NonNullable<typeof process> => Boolean(process))
    for (const process of processes) {
      for (const sequence of process.sequences) {
        for (const phase of sequence.phases) {
          const previous = existing.get(pageKey(sequence.id, phase.id))
          pages.push(
            previous
              ? { ...cloneSlot(previous), processId: process.id }
              : {
                id: this.createId(),
                processId: process.id,
                sequenceId: sequence.id,
                phaseId: phase.id,
                excluded: false
              }
          )
        }
      }
    }
    this.manifest.processId = workspace.activeProcessId === ALL_REPORT_PROCESSES_ID
      ? ALL_REPORT_PROCESSES_ID
      : processes[0]?.id
    this.manifest.pages = pages
    this.manifest.updatedAt = this.now()
    return this.snapshot()
  }

  setExcluded(slotId: string, excluded: boolean): ReportPageSlot {
    const slot = this.requireSlot(slotId)
    slot.excluded = excluded
    this.manifest.updatedAt = this.now()
    return cloneSlot(slot)
  }

  replace(slotId: string, source: PhaseReportPageSource): ReportPageSlot {
    const slot = this.requireSlot(slotId)
    slot.replacement = { ...source }
    this.manifest.updatedAt = this.now()
    return cloneSlot(slot)
  }

  restoreOriginal(slotId: string): ReportPageSlot {
    const slot = this.requireSlot(slotId)
    delete slot.replacement
    this.manifest.updatedAt = this.now()
    return cloneSlot(slot)
  }

  setDrawingLoadFailed(assetId: string, failed: boolean) {
    if (failed) this.failedDrawingAssetIds.add(assetId)
    else this.failedDrawingAssetIds.delete(assetId)
  }

  preflight(workspace: PhaseWorkspaceState): ReportPreflightIssue[] {
    const issues: ReportPreflightIssue[] = []
    const phaseLocations = new Map<string, { processId: string; sequenceId: string }>()
    const reportProcesses = this.manifest.processId === ALL_REPORT_PROCESSES_ID
      ? workspace.processes
      : workspace.processes.filter(process => process.id === this.manifest.processId)
    for (const process of reportProcesses) {
      for (const sequence of process.sequences) {
        if (sequence.phases.length === 0) {
          issues.push({
            code: 'empty-sequence',
            severity: 'warning',
            processId: process.id,
            sequenceId: sequence.id
          })
        }
        const numbers = new Set<number>()
        for (const phase of sequence.phases) {
          phaseLocations.set(phase.id, {
            processId: process.id,
            sequenceId: sequence.id
          })
          if (numbers.has(phase.number)) {
            issues.push({
              code: 'duplicate-phase-number',
              severity: 'error',
              processId: process.id,
              sequenceId: sequence.id,
              phaseId: phase.id
            })
          }
          numbers.add(phase.number)
          if (phase.drawing.kind === 'unassigned') {
            issues.push({
              code: 'missing-drawing',
              severity: 'error',
              processId: process.id,
              sequenceId: sequence.id,
              phaseId: phase.id
            })
          } else if (!workspace.drawingAssets[phase.drawing.assetId]) {
            issues.push({
              code: 'missing-drawing-asset',
              severity: 'error',
              processId: process.id,
              sequenceId: sequence.id,
              phaseId: phase.id
            })
          } else if (this.failedDrawingAssetIds.has(phase.drawing.assetId)) {
            issues.push({
              code: 'drawing-load-failed',
              severity: 'error',
              processId: process.id,
              sequenceId: sequence.id,
              phaseId: phase.id
            })
          }
        }
      }
    }
    for (const slot of this.manifest.pages) {
      if (!slot.replacement) continue
      const location = phaseLocations.get(slot.replacement.phaseId)
      if (
        !location ||
        location.processId !== slot.replacement.processId ||
        location.sequenceId !== slot.replacement.sequenceId
      ) {
        issues.push({
          code: 'invalid-replacement',
          severity: 'error',
          processId: slot.processId,
          sequenceId: slot.sequenceId,
          phaseId: slot.phaseId,
          slotId: slot.id
        })
      }
    }
    return issues
  }

  private requireSlot(slotId: string): ReportPageSlot {
    const slot = this.manifest.pages.find(candidate => candidate.id === slotId)
    if (!slot) throw new Error('Report page was not found')
    return slot
  }
}
