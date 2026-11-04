import { countFlowTreeNodes, countFlowTreeStops } from './flowTraversal'
import type {
  FlowDebugTreeNode,
  ValveDebugPanelCallbacks,
  ValveDebugPanelLabels,
  ValveRuntimeState
} from './types'

export interface ValveDebugPanelSnapshot {
  root?: FlowDebugTreeNode
  state?: ValveRuntimeState
  nodeCount?: number
  stoppedCount?: number
}

const STYLE_ID = 'valve-debug-panel-styles'
const DEFAULT_PANEL_WIDTH = 360
const MIN_PANEL_WIDTH = 260
const MAX_PANEL_WIDTH = 640
const COLLAPSED_PANEL_WIDTH = 34

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .valve-debug-panel {
      --valve-debug-border: var(--reference-line, #c8d4d6);
      --valve-debug-surface: var(--reference-panel, #f8fafa);
      --valve-debug-ink: var(--reference-ink, #17343b);
      --valve-debug-muted: var(--reference-muted, #60767d);
      --valve-debug-accent: var(--reference-green, #087b58);
      position: relative;
      z-index: 80;
      display: flex;
      flex: 0 0 var(--valve-debug-width, ${DEFAULT_PANEL_WIDTH}px);
      flex-direction: column;
      width: var(--valve-debug-width, ${DEFAULT_PANEL_WIDTH}px);
      min-width: 0;
      height: 100%;
      overflow: hidden;
      border-left: 1px solid var(--valve-debug-border);
      background: var(--valve-debug-surface);
      color: var(--valve-debug-ink);
      transition: flex-basis 160ms ease, width 160ms ease;
    }
    .valve-debug-panel[hidden] { display: none; }
    .valve-debug-panel.is-collapsed {
      flex-basis: ${COLLAPSED_PANEL_WIDTH}px;
      width: ${COLLAPSED_PANEL_WIDTH}px;
    }
    .valve-debug-panel.is-resizing {
      transition: none;
      user-select: none;
    }
    .valve-debug-panel-resize {
      position: absolute;
      z-index: 2;
      top: 0;
      bottom: 0;
      left: -5px;
      width: 10px;
      border: 0;
      background: transparent;
      cursor: ew-resize;
      touch-action: none;
    }
    .valve-debug-panel-resize:hover,
    .valve-debug-panel-resize:focus-visible,
    .valve-debug-panel.is-resizing .valve-debug-panel-resize {
      background: color-mix(in srgb, var(--valve-debug-accent) 22%, transparent);
      outline: none;
    }
    .valve-debug-panel-resize::after {
      position: absolute;
      top: 50%;
      left: 3px;
      width: 3px;
      height: 38px;
      border-right: 1px solid var(--valve-debug-accent);
      border-left: 1px solid var(--valve-debug-accent);
      content: '';
      opacity: 0;
      transform: translateY(-50%);
    }
    .valve-debug-panel-resize:hover::after,
    .valve-debug-panel-resize:focus-visible::after,
    .valve-debug-panel.is-resizing .valve-debug-panel-resize::after {
      opacity: .8;
    }
    .valve-debug-panel.is-collapsed .valve-debug-panel-resize {
      display: none;
    }
    .valve-debug-panel-header {
      display: flex;
      flex: 0 0 44px;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      border-bottom: 1px solid var(--valve-debug-border);
      background: var(--reference-white, #fff);
    }
    .valve-debug-panel-title {
      min-width: 0;
      overflow: hidden;
      flex: 1;
      font-size: 13px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .valve-debug-panel-collapse {
      display: inline-flex;
      flex: 0 0 26px;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid var(--valve-debug-border);
      border-radius: 4px;
      background: transparent;
      color: var(--valve-debug-muted);
      cursor: pointer;
    }
    .valve-debug-panel-collapse:hover,
    .valve-debug-panel-collapse:focus-visible {
      border-color: var(--valve-debug-accent);
      color: var(--valve-debug-accent);
      outline: none;
    }
    .valve-debug-panel.is-collapsed .valve-debug-panel-header {
      justify-content: center;
      padding: 0 4px;
    }
    .valve-debug-panel.is-collapsed .valve-debug-panel-title,
    .valve-debug-panel.is-collapsed .valve-debug-panel-body {
      display: none;
    }
    .valve-debug-panel.is-collapsed .valve-debug-panel-collapse {
      transform: rotate(180deg);
    }
    .valve-debug-panel-body {
      display: flex;
      min-height: 0;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }
    .valve-debug-panel-tabs {
      display: flex;
      gap: 6px;
      padding: 8px;
      border-bottom: 1px solid var(--valve-debug-border);
    }
    .valve-debug-panel-tabs button,
    .brush-debug-toolbar button {
      padding: 5px 8px;
      border: 1px solid var(--valve-debug-border);
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .valve-debug-panel-tabs button[aria-pressed="true"],
    .brush-debug-entity[aria-pressed="true"] {
      border-color: var(--valve-debug-accent);
      background: var(--app-success-surface, #edf8f4);
    }
    .valve-debug-panel-content,
    .brush-debug-panel {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .valve-debug-panel-tabs[hidden],
    .valve-debug-panel-tabs button[hidden],
    .valve-debug-panel-content[hidden],
    .brush-debug-panel[hidden],
    .brush-debug-panel > [hidden] { display: none; }
    .brush-debug-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
      font-size: 12px;
    }
    .brush-debug-toolbar button:disabled { opacity: .5; cursor: default; }
    .brush-debug-hint {
      margin: 0;
      padding: 0 12px 8px;
      color: var(--valve-debug-muted);
      font-size: 11px;
      line-height: 1.5;
    }
    .brush-debug-entity {
      display: grid;
      gap: 4px;
      width: 100%;
      margin-bottom: 4px;
      padding: 8px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      text-align: left;
      font-size: 12px;
      overflow-wrap: anywhere;
      cursor: pointer;
    }
    .brush-debug-entity .valve-debug-tree-meta { white-space: pre-line; }
    .brush-debug-status { color: var(--valve-debug-muted); font-size: 11px; }
    .brush-debug-entity:hover { background: var(--app-success-surface, #edf8f4); }
    .valve-debug-panel-tabs button:focus-visible,
    .brush-debug-toolbar button:focus-visible,
    .brush-debug-entity:focus-visible {
      outline: 2px solid var(--valve-debug-accent);
      outline-offset: -2px;
    }
    .valve-debug-panel-summary {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 4px 8px;
      margin: 0;
      padding: 10px 12px;
      border-bottom: 1px solid var(--valve-debug-border);
      font-size: 11px;
    }
    .valve-debug-panel-summary dt {
      color: var(--valve-debug-muted);
      font-weight: 600;
    }
    .valve-debug-panel-summary dd {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .valve-debug-panel-tree {
      min-height: 0;
      flex: 1;
      margin: 0;
      padding: 8px 6px 14px;
      overflow-x: hidden;
      overflow-y: auto;
      list-style: none;
    }
    .valve-debug-panel-tree.is-nested {
      flex: none;
      padding: 0;
      overflow: visible;
    }
    .valve-debug-panel-empty {
      padding: 16px 12px;
      color: var(--valve-debug-muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .valve-debug-tree-item {
      display: block;
      margin: 0;
      padding: 0;
      min-width: 0;
    }
    .valve-debug-tree-row {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      align-items: center;
      min-width: 0;
    }
    .valve-debug-tree-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 24px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--valve-debug-muted);
      cursor: pointer;
      font-size: 11px;
    }
    .valve-debug-tree-toggle:hover,
    .valve-debug-tree-toggle:focus-visible {
      color: var(--valve-debug-accent);
      outline: none;
    }
    .valve-debug-tree-toggle-placeholder {
      width: 16px;
      height: 1px;
    }
    .valve-debug-tree-node {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr) minmax(44px, 26%);
      align-items: center;
      gap: 6px;
      width: 100%;
      min-width: 0;
      min-height: 32px;
      padding: 5px 6px;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      box-sizing: border-box;
    }
    .valve-debug-tree-node:hover,
    .valve-debug-tree-node:focus-visible {
      background: #e6f3ee;
      outline: none;
    }
    .valve-debug-tree-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      background: #e2eaeb;
      color: #49636a;
      font-size: 10px;
      font-weight: 700;
    }
    .valve-debug-tree-icon.is-valve { background: #dff3ea; color: #087b58; }
    .valve-debug-tree-icon.is-line { background: #e5e9fb; color: #4857a7; }
    .valve-debug-tree-icon.is-closed { background: #fde4e4; color: #b3261e; }
    .valve-debug-tree-main {
      min-width: 0;
      overflow: hidden;
    }
    .valve-debug-tree-label {
      display: block;
      font-size: 11px;
      font-weight: 650;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .valve-debug-tree-meta {
      display: block;
      color: var(--valve-debug-muted);
      font: 10px/1.3 "IBM Plex Mono", monospace;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .valve-debug-tree-status {
      min-width: 0;
      max-width: none;
      color: var(--valve-debug-muted);
      font-size: 10px;
      overflow-wrap: anywhere;
      word-break: break-word;
      text-align: right;
      white-space: normal;
    }
    @media (max-width: ${640}px) {
      .valve-debug-panel {
        position: fixed;
        z-index: 290;
        top: var(--app-toolbar-height, 56px);
        right: 0;
        bottom: 0;
        height: auto;
        box-shadow: -10px 0 28px rgba(9, 30, 35, .18);
      }
    }
  `
  document.head.appendChild(style)
}

const text = (value: string) => document.createTextNode(value)

export class ValveDebugPanel {
  readonly element: HTMLElement
  private readonly resizeHandle: HTMLDivElement
  private readonly titleElement: HTMLElement
  private readonly bodyElement: HTMLElement
  private readonly valveContent = document.createElement('div')
  private readonly tabsElement = document.createElement('div')
  private readonly valveTab = document.createElement('button')
  private readonly brushTab = document.createElement('button')
  private brushContent?: HTMLElement
  private valveEnabled = true
  private brushEnabled = false
  private activeMode: 'valve' | 'brush' = 'valve'
  private readonly summaryElement: HTMLElement
  private readonly treeElement: HTMLOListElement
  private readonly emptyElement: HTMLElement
  private readonly collapseButton: HTMLButtonElement
  private labels: ValveDebugPanelLabels
  private collapsed = false
  private panelWidth = DEFAULT_PANEL_WIDTH
  private resizing = false
  private resizeStartX = 0
  private resizeStartWidth = DEFAULT_PANEL_WIDTH
  private unavailableKeys = new Set<string>()
  private collapsedBranchKeys = new Set<string>()

  constructor(
    host: HTMLElement,
    labels: ValveDebugPanelLabels,
    private readonly callbacks: ValveDebugPanelCallbacks
  ) {
    injectStyles()
    this.labels = labels
    this.element = document.createElement('aside')
    this.element.className = 'valve-debug-panel'
    this.panelWidth = this.clampWidth(DEFAULT_PANEL_WIDTH)
    this.element.style.setProperty('--valve-debug-width', `${this.panelWidth}px`)
    this.element.setAttribute('role', 'region')
    this.element.setAttribute('aria-label', labels.title)

    this.resizeHandle = document.createElement('div')
    this.resizeHandle.className = 'valve-debug-panel-resize'
    this.resizeHandle.setAttribute('role', 'separator')
    this.resizeHandle.setAttribute('aria-orientation', 'vertical')
    this.resizeHandle.tabIndex = 0
    this.resizeHandle.addEventListener('pointerdown', this.handleResizePointerDown)
    this.resizeHandle.addEventListener('keydown', this.handleResizeKeyDown)

    const header = document.createElement('header')
    header.className = 'valve-debug-panel-header'
    this.titleElement = document.createElement('strong')
    this.titleElement.className = 'valve-debug-panel-title'
    this.collapseButton = document.createElement('button')
    this.collapseButton.className = 'valve-debug-panel-collapse'
    this.collapseButton.type = 'button'
    this.collapseButton.textContent = '‹'
    this.collapseButton.addEventListener('click', () => this.setCollapsed(!this.collapsed))
    header.append(this.titleElement, this.collapseButton)

    this.bodyElement = document.createElement('div')
    this.bodyElement.className = 'valve-debug-panel-body'
    this.summaryElement = document.createElement('dl')
    this.summaryElement.className = 'valve-debug-panel-summary'
    this.emptyElement = document.createElement('div')
    this.emptyElement.className = 'valve-debug-panel-empty'
    this.treeElement = document.createElement('ol')
    this.treeElement.className = 'valve-debug-panel-tree'
    this.valveContent.className = 'valve-debug-panel-content'
    this.valveContent.append(this.summaryElement, this.emptyElement, this.treeElement)
    this.tabsElement.className = 'valve-debug-panel-tabs'
    this.tabsElement.hidden = true
    for (const [mode, button] of [
      ['valve', this.valveTab], ['brush', this.brushTab]
    ] as const) {
      button.type = 'button'
      button.dataset.debugMode = mode
      button.addEventListener('click', () => this.setActiveMode(mode))
      this.tabsElement.append(button)
    }
    this.bodyElement.append(this.tabsElement, this.valveContent)
    this.element.append(this.resizeHandle, header, this.bodyElement)
    host.append(this.element)
    this.setLabels(labels)
    this.updateResizeHandleAria()
    this.render({})
  }

  setLabels(labels: ValveDebugPanelLabels) {
    this.labels = labels
    const title = this.brushContent ? labels.debugTitle : labels.title
    this.titleElement.textContent = title
    this.element.setAttribute('aria-label', title)
    this.valveTab.textContent = labels.title
    this.brushTab.textContent = labels.brushDebug
    this.collapseButton.setAttribute(
      'aria-label',
      this.collapsed ? labels.expand : labels.collapse
    )
    this.collapseButton.setAttribute('aria-expanded', String(!this.collapsed))
    this.resizeHandle.setAttribute('aria-label', labels.resize ?? labels.title)
    this.renderSummary(undefined)
  }

  setBrushContent(content: HTMLElement) {
    this.brushContent?.remove()
    this.brushContent = content
    this.bodyElement.append(content)
    this.setLabels(this.labels)
    this.updateModes()
  }

  setDebugModes(valveEnabled: boolean, brushEnabled: boolean) {
    this.valveEnabled = valveEnabled
    this.brushEnabled = brushEnabled
    this.element.hidden = !valveEnabled && !brushEnabled
    if (this.activeMode === 'valve' && !valveEnabled) this.activeMode = 'brush'
    else if (this.activeMode === 'brush' && !brushEnabled) this.activeMode = 'valve'
    this.updateModes()
  }

  private setActiveMode(mode: 'valve' | 'brush') {
    if (mode === this.activeMode) return
    this.activeMode = mode
    this.updateModes()
    this.callbacks.onDebugModeChanged?.()
  }

  private updateModes() {
    this.tabsElement.hidden = !this.brushContent
    this.valveTab.hidden = !this.valveEnabled
    this.brushTab.hidden = !this.brushEnabled
    this.valveTab.setAttribute('aria-pressed', String(this.activeMode === 'valve'))
    this.brushTab.setAttribute('aria-pressed', String(this.activeMode === 'brush'))
    this.valveContent.hidden = this.activeMode !== 'valve'
    if (this.brushContent) this.brushContent.hidden = this.activeMode !== 'brush'
  }

  setCollapsed(collapsed: boolean) {
    if (collapsed && this.resizing) this.stopResizing()
    this.collapsed = collapsed
    this.element.classList.toggle('is-collapsed', collapsed)
    this.collapseButton.setAttribute(
      'aria-label',
      collapsed ? this.labels.expand : this.labels.collapse
    )
    this.collapseButton.setAttribute('aria-expanded', String(!collapsed))
    this.callbacks.onCollapseChanged(collapsed)
  }

  get width() {
    return this.panelWidth
  }

  setWidth(width: number, notify = true) {
    const nextWidth = this.clampWidth(width)
    if (nextWidth === this.panelWidth) {
      this.updateResizeHandleAria()
      return
    }
    this.panelWidth = nextWidth
    this.element.style.setProperty('--valve-debug-width', `${nextWidth}px`)
    this.updateResizeHandleAria()
    if (notify) this.callbacks.onWidthChanged?.(nextWidth)
  }

  fitToViewport() {
    this.setWidth(this.panelWidth, false)
  }

  dispose() {
    this.stopResizing()
    this.resizeHandle.removeEventListener('pointerdown', this.handleResizePointerDown)
    this.resizeHandle.removeEventListener('keydown', this.handleResizeKeyDown)
    this.element.remove()
  }

  get isCollapsed() {
    return this.collapsed
  }

  render(snapshot: ValveDebugPanelSnapshot) {
    this.unavailableKeys.clear()
    this.renderSummary(snapshot)
    this.treeElement.replaceChildren()
    const root = snapshot.root
    this.emptyElement.hidden = Boolean(root)
    this.emptyElement.textContent = this.labels.empty
    if (!root) return
    this.appendTreeNode(root, this.treeElement)
  }

  markNodeUnavailable(key: string) {
    this.unavailableKeys.add(key)
    const button = [...this.element.querySelectorAll<HTMLButtonElement>('button[data-handle-key]')]
      .find(item => item.dataset.handleKey === key)
    const status = button?.querySelector<HTMLElement>('.valve-debug-tree-status')
    if (status) status.textContent = this.labels.locateUnavailable
  }

  private renderSummary(snapshot?: ValveDebugPanelSnapshot) {
    this.summaryElement.replaceChildren()
    const root = snapshot?.root
    if (!root) {
      this.summaryElement.hidden = true
      return
    }
    this.summaryElement.hidden = false
    const state = snapshot?.state ?? 'closed'
    const rows: Array<[string, string]> = [
      [this.labels.currentStart, root.node.label],
      [this.labels.state, state === 'open' ? this.labels.open : this.labels.closed],
      [this.labels.nodeCount, String(snapshot?.nodeCount ?? countFlowTreeNodes(root))],
      [this.labels.stoppedCount, String(snapshot?.stoppedCount ?? countFlowTreeStops(root))]
    ]
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt')
      dt.append(text(label))
      const dd = document.createElement('dd')
      dd.append(text(value))
      this.summaryElement.append(dt, dd)
    })
  }

  private appendTreeNode(node: FlowDebugTreeNode, parent: HTMLOListElement) {
    const item = document.createElement('li')
    item.className = 'valve-debug-tree-item'
    const row = document.createElement('div')
    row.className = 'valve-debug-tree-row'
    row.style.paddingLeft = `${node.depth * 14}px`
    const hasChildren = node.children.length > 0
    const isExpanded = !this.collapsedBranchKeys.has(node.key)
    const toggle = hasChildren
      ? document.createElement('button')
      : document.createElement('span')
    toggle.className = hasChildren
      ? 'valve-debug-tree-toggle'
      : 'valve-debug-tree-toggle-placeholder'
    if (toggle instanceof HTMLButtonElement) {
      toggle.type = 'button'
      toggle.textContent = isExpanded ? '▾' : '▸'
      toggle.dataset.branchKey = node.key
      toggle.setAttribute('aria-expanded', String(isExpanded))
      toggle.setAttribute(
        'aria-label',
        `${isExpanded ? this.labels.collapseBranch : this.labels.expandBranch}: ${node.node.label}`
      )
      toggle.addEventListener('click', () => {
        if (isExpanded) this.collapsedBranchKeys.add(node.key)
        else this.collapsedBranchKeys.delete(node.key)
        this.renderBranch(item, node)
      })
    }
    const button = document.createElement('button')
    button.className = 'valve-debug-tree-node'
    button.type = 'button'
    button.dataset.handleKey = node.key
    button.title = `${node.node.label} · ${node.key}`
    button.addEventListener('click', () => this.callbacks.onNodeClick(node.key))

    const icon = document.createElement('span')
    icon.className = `valve-debug-tree-icon is-${node.node.kind}`
    if (['closed', 'unselected', 'missing-state'].includes(node.status)) icon.classList.add('is-closed')
    icon.textContent = node.node.kind === 'valve' ? 'V' : node.node.kind === 'line' ? 'L' : 'E'

    const main = document.createElement('span')
    main.className = 'valve-debug-tree-main'
    const label = document.createElement('span')
    label.className = 'valve-debug-tree-label'
    label.textContent = node.node.label
    const meta = document.createElement('span')
    meta.className = 'valve-debug-tree-meta'
    const kindLabel = node.node.kind === 'valve'
      ? this.labels.valve
      : node.node.kind === 'line'
        ? this.labels.line
        : this.labels.equipment
    meta.textContent = `${kindLabel} · ${node.key}`
    main.append(label, meta)

    const status = document.createElement('span')
    status.className = 'valve-debug-tree-status'
    status.textContent = this.unavailableKeys.has(node.key)
      ? this.labels.locateUnavailable
      : this.statusLabel(node.status)
    button.append(icon, main, status)
    row.append(toggle, button)
    item.append(row)

    if (hasChildren && isExpanded) this.appendBranchChildren(item, node)
    parent.append(item)
  }

  private renderBranch(item: HTMLLIElement, node: FlowDebugTreeNode) {
    const parent = item.parentElement as HTMLOListElement
    const replacement = document.createElement('ol')
    this.appendTreeNode(node, replacement)
    parent.replaceChild(replacement.firstElementChild!, item)
  }

  private appendBranchChildren(item: HTMLLIElement, node: FlowDebugTreeNode) {
    const children = document.createElement('ol')
    children.className = 'valve-debug-panel-tree is-nested'
    node.children.forEach(child => this.appendTreeNode(child, children))
    item.append(children)
  }

  private statusLabel(status: FlowDebugTreeNode['status']) {
    if (status === 'neutral') return this.labels.neutral ?? this.labels.equipment
    if (status === 'unselected') return this.labels.unselected ?? this.labels.truncated
    if (status === 'missing-state') return this.labels.missingState ?? this.labels.missing
    if (status === 'start') return this.labels.start
    if (status === 'open') return this.labels.open
    if (status === 'closed') return this.labels.truncated
    if (status === 'missing') return this.labels.missing
    if (status === 'line') return this.labels.line
    if (status === 'equipment') return this.labels.equipment
    return ''
  }

  private readonly handleResizePointerDown = (event: PointerEvent) => {
    if (this.collapsed) return
    event.preventDefault()
    event.stopPropagation()
    this.resizing = true
    this.resizeStartX = event.clientX
    this.resizeStartWidth = this.panelWidth
    this.element.classList.add('is-resizing')
    this.resizeHandle.setPointerCapture?.(event.pointerId)
    window.addEventListener('pointermove', this.handleResizePointerMove)
    window.addEventListener('pointerup', this.handleResizePointerUp)
    window.addEventListener('pointercancel', this.handleResizePointerUp)
  }

  private readonly handleResizePointerMove = (event: PointerEvent) => {
    if (!this.resizing) return
    event.preventDefault()
    this.setWidth(this.resizeStartWidth + this.resizeStartX - event.clientX)
  }

  private readonly handleResizePointerUp = () => {
    this.stopResizing()
  }

  private readonly handleResizeKeyDown = (event: KeyboardEvent) => {
    if (this.collapsed) return
    const step = 16
    let nextWidth: number | undefined
    if (event.key === 'ArrowLeft') nextWidth = this.panelWidth + step
    if (event.key === 'ArrowRight') nextWidth = this.panelWidth - step
    if (event.key === 'Home') nextWidth = MIN_PANEL_WIDTH
    if (event.key === 'End') nextWidth = this.getMaxWidth()
    if (nextWidth === undefined) return
    event.preventDefault()
    this.setWidth(nextWidth)
  }

  private stopResizing() {
    if (!this.resizing) return
    this.resizing = false
    this.element.classList.remove('is-resizing')
    window.removeEventListener('pointermove', this.handleResizePointerMove)
    window.removeEventListener('pointerup', this.handleResizePointerUp)
    window.removeEventListener('pointercancel', this.handleResizePointerUp)
  }

  private clampWidth(width: number) {
    if (!Number.isFinite(width)) return this.panelWidth
    return Math.round(Math.min(this.getMaxWidth(), Math.max(MIN_PANEL_WIDTH, width)))
  }

  private getMaxWidth() {
    if (typeof window === 'undefined' || !Number.isFinite(window.innerWidth)) {
      return MAX_PANEL_WIDTH
    }
    const available = window.innerWidth <= 640
      ? window.innerWidth - 16
      : window.innerWidth - 360
    return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.floor(available)))
  }

  private updateResizeHandleAria() {
    this.resizeHandle.setAttribute('aria-valuemin', String(MIN_PANEL_WIDTH))
    this.resizeHandle.setAttribute('aria-valuemax', String(this.getMaxWidth()))
    this.resizeHandle.setAttribute('aria-valuenow', String(this.panelWidth))
  }
}
