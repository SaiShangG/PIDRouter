/** @jest-environment jsdom */

import { defaultValveDebugLabels } from '../src/flow/ValveDebugFeature'
import { ValveDebugPanel } from '../src/flow/ValveDebugPanel'
import type { FlowDebugTreeNode } from '../src/flow/types'

const root: FlowDebugTreeNode = {
  key: '1A',
  node: { key: '1A', handle: 26, kind: 'valve', label: 'V-1' },
  status: 'start',
  depth: 0,
  children: [
    {
      key: '1B',
      node: { key: '1B', handle: 27, kind: 'line', label: 'Line 1' },
      status: 'line',
      depth: 1,
      children: []
    }
  ]
}

describe('ValveDebugPanel', () => {
  it('renders a tree, locates nodes, and supports collapse', () => {
    const host = document.createElement('div')
    const clicked: string[] = []
    const panel = new ValveDebugPanel(host, defaultValveDebugLabels('en'), {
      onCollapseChanged: () => undefined,
      onNodeClick: key => clicked.push(key)
    })

    panel.render({ root, state: 'open' })
    expect(host.querySelectorAll('.valve-debug-tree-node')).toHaveLength(2)
    expect(host.textContent).toContain('V-1')
    expect(host.textContent).toContain('Line 1')

    host.querySelector<HTMLButtonElement>('[data-handle-key="1B"]')?.click()
    expect(clicked).toEqual(['1B'])

    const branchToggle = host.querySelector<HTMLButtonElement>('[data-branch-key="1A"]')!
    expect(branchToggle.getAttribute('aria-expanded')).toBe('true')
    expect(branchToggle.getAttribute('aria-label')).toBe('Collapse branch: V-1')
    branchToggle.click()
    expect(host.querySelector('[data-handle-key="1B"]')).toBeNull()
    expect(host.querySelector('[data-branch-key="1A"]')?.getAttribute('aria-expanded')).toBe('false')
    host.querySelector<HTMLButtonElement>('[data-branch-key="1A"]')?.click()
    expect(host.querySelector('[data-handle-key="1B"]')).not.toBeNull()
    expect(host.querySelector('[data-branch-key="1B"]')).toBeNull()

    panel.setCollapsed(true)
    expect(panel.element.classList.contains('is-collapsed')).toBe(true)
    expect(panel.element.querySelector('.valve-debug-panel-body')?.matches(':not([hidden])')).toBe(true)
  })

  it('marks a node that cannot be located', () => {
    const host = document.createElement('div')
    const panel = new ValveDebugPanel(host, defaultValveDebugLabels('zh'), {
      onCollapseChanged: () => undefined,
      onNodeClick: () => undefined
    })
    panel.render({ root, state: 'closed' })
    panel.markNodeUnavailable('1B')
    expect(host.querySelector('[data-handle-key="1B"]')?.textContent).toContain('无法定位')
  })

  it('supports keyboard width resizing and exposes an accessible separator', () => {
    const host = document.createElement('div')
    const widths: number[] = []
    const panel = new ValveDebugPanel(host, defaultValveDebugLabels('en'), {
      onCollapseChanged: () => undefined,
      onWidthChanged: width => widths.push(width),
      onNodeClick: () => undefined
    })

    const handle = host.querySelector<HTMLElement>('[role="separator"]')
    expect(handle?.getAttribute('aria-orientation')).toBe('vertical')
    expect(panel.width).toBe(360)

    handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))

    expect(panel.width).toBe(376)
    expect(widths).toEqual([376])
    expect(handle?.getAttribute('aria-valuenow')).toBe('376')
  })
})
