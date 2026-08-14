import JSZip from 'jszip'

import type { PhaseWorkspaceState } from '../src/phase/types'
import { PhaseReportExporter } from '../src/report/PhaseReportExporter'
import type { ReportManifest } from '../src/report/reportManifest'

const workspace: PhaseWorkspaceState = {
  version: 3,
  activeProcessId: 'process',
  drawingAssets: {},
  processes: [
    {
      id: 'process',
      name: 'CIP',
      activeSequenceId: 'sequence-1',
      createdAt: 'now',
      updatedAt: 'now',
      sequences: [1, 2].map(sequenceNumber => ({
        id: `sequence-${sequenceNumber}`,
        number: sequenceNumber,
        name: `Tank ${sequenceNumber}`,
        activePhaseId: sequenceNumber === 1 ? 'phase-1-1' : undefined,
        createdAt: 'now',
        updatedAt: 'now',
        phases: [1, 2].map(phaseNumber => ({
          id: `phase-${sequenceNumber}-${phaseNumber}`,
          number: phaseNumber,
          name: `Step ${phaseNumber}`,
          drawing: { kind: 'unassigned' as const },
          flowState: { openBoundaryHandleKeys: [] },
          deviceStates: {},
          createdAt: 'now',
          updatedAt: 'now'
        }))
      }))
    }
  ]
}

const manifest: ReportManifest = {
  id: 'manifest',
  processId: 'process',
  createdAt: 'now',
  updatedAt: 'now',
  pages: [
    ['slot-1', 'sequence-1', 'phase-1-1'],
    ['slot-2', 'sequence-1', 'phase-1-2'],
    ['slot-3', 'sequence-2', 'phase-2-1'],
    ['slot-4', 'sequence-2', 'phase-2-2']
  ].map(([id, sequenceId, phaseId]) => ({
    id,
    processId: 'process',
    sequenceId,
    phaseId,
    excluded: false
  }))
}

const createHarness = () => {
  const activated: string[] = []
  const restore = jest.fn(async () => undefined)
  const compose = jest.fn(async (pages: readonly Uint8Array[]) =>
    new Uint8Array(pages.flatMap(page => [...page]))
  )
  const exporter = new PhaseReportExporter({
    activate: async location => {
      activated.push(location.phaseId)
    },
    renderPage: async () => {
      const parts = activated[activated.length - 1]?.split('-') ?? []
      return new Uint8Array([Number(parts[parts.length - 1])])
    },
    compose,
    restore
  })
  return { exporter, activated, compose, restore }
}

describe('PhaseReportExporter', () => {
  it('renders included pages sequentially, honors replacement, and restores state', async () => {
    const { exporter, activated, compose, restore } = createHarness()
    const report = JSON.parse(JSON.stringify(manifest)) as ReportManifest
    report.pages[1].excluded = true
    report.pages[2].replacement = {
      kind: 'phase',
      processId: 'process',
      sequenceId: 'sequence-1',
      phaseId: 'phase-1-2'
    }

    const result = await exporter.export(workspace, report, { mode: 'merged' })

    expect(result.status).toBe('completed')
    expect(activated).toEqual(['phase-1-1', 'phase-1-2', 'phase-2-2'])
    expect(compose.mock.calls[0][0]).toHaveLength(3)
    expect(restore).toHaveBeenCalledWith({
      processId: 'process',
      sequenceId: 'sequence-1',
      phaseId: 'phase-1-1'
    })
  })

  it('yields to the main thread before rendering pages and composing output', async () => {
    const events: string[] = []
    const exporter = new PhaseReportExporter({
      activate: async location => {
        events.push(`activate:${location.phaseId}`)
      },
      yieldToMainThread: async () => {
        events.push('yield')
      },
      renderPage: async () => {
        events.push('render')
        return new Uint8Array([1])
      },
      compose: async () => {
        events.push('compose')
        return new Uint8Array([1])
      },
      restore: async () => undefined
    })

    await exporter.export(workspace, manifest, { mode: 'merged' })

    expect(events).toEqual([
      'activate:phase-1-1',
      'yield',
      'render',
      'activate:phase-1-2',
      'yield',
      'render',
      'activate:phase-2-1',
      'yield',
      'render',
      'activate:phase-2-2',
      'yield',
      'render',
      'yield',
      'compose'
    ])
  })

  it('creates one ordered PDF per sequence inside a ZIP', async () => {
    const { exporter, compose } = createHarness()
    const result = await exporter.export(workspace, manifest, {
      mode: 'per-sequence'
    })
    expect(result.status).toBe('completed')
    if (result.status !== 'completed') return

    const zip = await JSZip.loadAsync(result.bytes)
    expect(Object.keys(zip.files)).toEqual(['01-Tank 1.pdf', '02-Tank 2.pdf'])
    expect(compose.mock.calls.map(call => call[0].length)).toEqual([2, 2])
  })

  it('records page failures without composing a blank page and restores state', async () => {
    const restore = jest.fn(async () => undefined)
    const compose = jest.fn(async () => new Uint8Array())
    const exporter = new PhaseReportExporter({
      activate: async location => {
        if (location.phaseId === 'phase-1-2') throw new Error('load failed')
      },
      renderPage: async () => new Uint8Array([1]),
      compose,
      restore
    })

    const result = await exporter.export(workspace, manifest, { mode: 'merged' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') return
    expect(result.failures[0]).toMatchObject({
      pageNumber: 2,
      sequenceId: 'sequence-1',
      phaseId: 'phase-1-2',
      slotId: 'slot-2'
    })
    expect(compose).not.toHaveBeenCalled()
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('retries only failed pages and then composes the complete report', async () => {
    const attempts = new Map<string, number>()
    let activePhaseId = ''
    const compose = jest.fn(async (pages: readonly Uint8Array[]) =>
      new Uint8Array(pages.flatMap(page => [...page]))
    )
    const exporter = new PhaseReportExporter({
      activate: async location => {
        activePhaseId = location.phaseId
      },
      renderPage: async () => {
        const attempt = (attempts.get(activePhaseId) ?? 0) + 1
        attempts.set(activePhaseId, attempt)
        if (activePhaseId === 'phase-1-2' && attempt === 1) {
          throw new Error('temporary failure')
        }
        return new Uint8Array([Number(activePhaseId.slice(-1))])
      },
      compose,
      restore: async () => undefined
    })

    const first = await exporter.export(workspace, manifest, { mode: 'merged' })
    expect(first.status).toBe('failed')
    if (first.status !== 'failed') return

    const retried = await first.retry()
    expect(retried.status).toBe('completed')
    expect(Object.fromEntries(attempts)).toEqual({
      'phase-1-1': 1,
      'phase-1-2': 2,
      'phase-2-1': 1,
      'phase-2-2': 1
    })
    expect(compose).toHaveBeenCalledTimes(1)
    expect(compose.mock.calls[0][0]).toHaveLength(4)
  })

  it('supports cancellation and still restores the original Phase', async () => {
    const controller = new AbortController()
    const restore = jest.fn(async () => undefined)
    const exporter = new PhaseReportExporter({
      activate: async () => controller.abort(),
      renderPage: async () => new Uint8Array([1]),
      compose: async () => new Uint8Array([1]),
      restore
    })

    await expect(
      exporter.export(workspace, manifest, {
        mode: 'merged',
        signal: controller.signal
      })
    ).resolves.toEqual({ status: 'canceled' })
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('does not compose when cancellation occurs during page rendering', async () => {
    const controller = new AbortController()
    const compose = jest.fn(async () => new Uint8Array([1]))
    const exporter = new PhaseReportExporter({
      activate: async () => undefined,
      renderPage: async () => {
        controller.abort()
        return new Uint8Array([1])
      },
      compose,
      restore: async () => undefined
    })

    await expect(
      exporter.export(workspace, manifest, {
        mode: 'merged',
        signal: controller.signal
      })
    ).resolves.toEqual({ status: 'canceled' })
    expect(compose).not.toHaveBeenCalled()
  })

  it('discards composed bytes when cancellation occurs during composition', async () => {
    const controller = new AbortController()
    const compose = jest.fn(async () => {
      controller.abort()
      return new Uint8Array([1])
    })
    const restore = jest.fn(async () => undefined)
    const exporter = new PhaseReportExporter({
      activate: async () => undefined,
      renderPage: async () => new Uint8Array([1]),
      compose,
      restore
    })

    await expect(
      exporter.export(workspace, manifest, {
        mode: 'merged',
        signal: controller.signal
      })
    ).resolves.toEqual({ status: 'canceled' })
    expect(compose).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
  })
})
