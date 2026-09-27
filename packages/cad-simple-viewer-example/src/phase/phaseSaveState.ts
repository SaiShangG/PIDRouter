import { isEqual } from 'lodash-es'
import { translate, type AppLocale } from '../locale'

import type { PhaseSnapshot } from './types'

export type PhaseChangeKind = 'details' | 'drawing' | 'highlights' | 'devices' | 'notes' | 'order' | 'styles'

const values = (phase: PhaseSnapshot): Record<Exclude<PhaseChangeKind, 'order' | 'styles'>, unknown> => ({
  details: { name: phase.name, number: phase.number, tankId: phase.tankId ?? null },
  drawing: phase.drawing,
  highlights: { flowPaths: phase.flowState.flowPaths, activeFlowPathId: phase.flowState.activeFlowPathId ?? null },
  devices: phase.flowState.deviceStates ?? {},
  notes: phase.textNotes ?? []
})

export class PhaseSaveState {
  private readonly saved = new Map<string, ReturnType<typeof values>>()
  private readonly savedOrder = new Map<string, number>()
  private readonly pending = new Map<string, number>()
  private readonly failed = new Set<string>()
  private savedStyles: unknown
  private stylesSaving = 0
  private stylesFailed = false

  reset(phases: readonly PhaseSnapshot[]): void {
    this.saved.clear()
    this.savedOrder.clear()
    this.pending.clear()
    this.failed.clear()
    this.savedStyles = undefined
    this.stylesSaving = 0
    this.stylesFailed = false
    phases.forEach(phase => this.accept(phase))
  }

  accept(phase: PhaseSnapshot, orderIndex?: number): void {
    this.saved.set(phase.id, JSON.parse(JSON.stringify(values(phase))))
    if (orderIndex !== undefined) this.savedOrder.set(phase.id, orderIndex)
    this.failed.delete(phase.id)
  }

  acceptStyles(styles: unknown): void {
    this.savedStyles = JSON.parse(JSON.stringify(styles))
    this.stylesFailed = false
  }

  beginStyles(): void {
    this.stylesSaving++
    this.stylesFailed = false
  }

  finishStyles(failed = false): void {
    this.stylesSaving = Math.max(0, this.stylesSaving - 1)
    if (failed) this.stylesFailed = true
  }

  has(phaseId: string): boolean {
    return this.saved.has(phaseId)
  }

  begin(phaseId: string): void {
    this.pending.set(phaseId, (this.pending.get(phaseId) ?? 0) + 1)
    this.failed.delete(phaseId)
  }

  finish(phaseId: string, failed = false): void {
    const count = Math.max(0, (this.pending.get(phaseId) ?? 0) - 1)
    if (count) this.pending.set(phaseId, count)
    else this.pending.delete(phaseId)
    if (failed) this.failed.add(phaseId)
  }

  get(phase: PhaseSnapshot, options: { orderIndex?: number; styles?: unknown } = {}) {
    const baseline = this.saved.get(phase.id)
    const current: ReturnType<typeof values> = JSON.parse(JSON.stringify(values(phase)))
    const changes: PhaseChangeKind[] = (Object.keys(current) as (keyof typeof current)[])
      .filter(kind => !baseline || !isEqual(baseline[kind], current[kind]))
    if (options.orderIndex !== undefined && this.savedOrder.get(phase.id) !== options.orderIndex) changes.push('order')
    if (options.styles !== undefined && (this.stylesFailed || !isEqual(this.savedStyles, options.styles))) changes.push('styles')
    const saving = this.pending.has(phase.id) || (options.styles !== undefined && this.stylesSaving > 0)
    const failed = this.failed.has(phase.id) || (options.styles !== undefined && this.stylesFailed)
    return {
      changes,
      saving,
      failed,
      saved: Boolean(baseline) && !changes.length && !saving && !failed
    }
  }
}

export function phaseSaveStatusText(locale: AppLocale, state: ReturnType<PhaseSaveState['get']>): string {
  if (state.saved) return translate(locale, 'phaseSaved')
  const labels: Record<PhaseChangeKind, string> = {
    details: translate(locale, 'phaseChangeDetails'),
    drawing: translate(locale, 'phaseChangeDrawing'),
    highlights: translate(locale, 'phaseChangeHighlights'),
    devices: translate(locale, 'phaseChangeDevices'),
    notes: translate(locale, 'phaseChangeNotes'),
    order: translate(locale, 'phaseChangeOrder'),
    styles: translate(locale, 'phaseChangeStyles')
  }
  const items = state.changes.map(kind => labels[kind]).join(locale === 'zh' ? '、' : ', ')
  if (state.saving) return `${translate(locale, 'phaseSaving')}${items ? `: ${items}` : ''}`
  const prefix = state.failed ? translate(locale, 'phaseSaveFailed') : translate(locale, 'phaseUnsaved')
  return `${prefix}${items ? `: ${items}` : ''} · ${translate(locale, 'phaseSaveReminder')}`
}