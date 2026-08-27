import type { AcDbObjectId } from '@mlightcad/data-model'

import type {
  DeviceStateStyleDefinition,
  UtilityStyleDefinition
} from '../phase/types'
import { buildFlowGraphIndex, normalizeFlowHandle } from './flowGraph'
import {
  countFlowTreeNodes,
  countFlowTreeStops,
  mergeFlowHighlightKeys,
  traverseFlowFromValve
} from './flowTraversal'
import type {
  FlowConnectionDocumentInput,
  FlowGraphIndex,
  ValveDebugOverlay,
  ValveDebugPanelLabels,
  ValveDebugView,
  ValveRuntimeState
} from './types'
import { ValveDebugPanel, type ValveDebugPanelSnapshot } from './ValveDebugPanel'

export type ValveDebugLocale = 'zh' | 'en'

export interface ValveDebugFeatureOptions {
  panelHost: HTMLElement
  graphDocument: FlowConnectionDocumentInput
  getView(): ValveDebugView | undefined
  resolveObjectId(handleKey: string): AcDbObjectId | undefined
  resolveHandleKeys(objectId: AcDbObjectId): readonly string[]
  createOverlay(
    objectIds: readonly AcDbObjectId[],
    kind: 'path' | 'locator'
  ): ValveDebugOverlay | null
  /** Optional legacy adapter hook; tree clicks intentionally do not zoom the CAD view. */
  zoomToObject?(objectId: AcDbObjectId): boolean
  getLabels(locale: ValveDebugLocale): ValveDebugPanelLabels
  getLocale(): ValveDebugLocale
  requestStateChange?(
    handleKey: string,
    state: ValveRuntimeState
  ): boolean | Promise<boolean>
  onStateChanged?(handleKey: string, state: ValveRuntimeState): void
  getConfiguredStates?(handleKey: string): readonly DeviceStateStyleDefinition[]
  getConfiguredStateKey?(handleKey: string): string | undefined
  getUtilities?(): readonly UtilityStyleDefinition[]
  requestConfiguredStateChange?(
    handleKey: string,
    state: DeviceStateStyleDefinition,
    utilityId: string | undefined
  ): boolean | Promise<boolean>
  renderPathOverlay?: boolean
}

const MENU_STYLE_ID = 'valve-debug-context-menu-styles'

const injectMenuStyles = () => {
  if (document.getElementById(MENU_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = MENU_STYLE_ID
  style.textContent = `
    .valve-debug-context-menu {
      position: fixed;
      z-index: 1200;
      min-width: 184px;
      padding: 7px;
      border: 1px solid #49686f;
      border-radius: 6px;
      background: #123038;
      color: #edf7f5;
      box-shadow: 0 12px 32px rgba(3, 18, 23, .35);
    }
    .valve-debug-context-menu[hidden] { display: none; }
    .valve-debug-context-menu-title {
      padding: 5px 7px 7px;
      border-bottom: 1px solid #35545b;
      color: #a8c4c5;
      font: 11px/1.3 "IBM Plex Mono", monospace;
      overflow-wrap: anywhere;
    }
    .valve-debug-context-menu-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-top: 6px;
    }
    .valve-debug-context-menu-actions[hidden],
    .valve-debug-context-menu-form[hidden],
    .valve-debug-context-menu-field[hidden] { display: none; }
    .valve-debug-context-menu-action {
      width: 100%;
      padding: 7px 8px;
      border: 1px solid #3b7e6b;
      border-radius: 4px;
      background: #17604d;
      color: #fff;
      font: 600 12px/1.2 inherit;
      text-align: left;
      cursor: pointer;
    }
    .valve-debug-context-menu-action:disabled {
      opacity: .5;
      cursor: default;
    }
    .valve-debug-context-menu-action:hover,
    .valve-debug-context-menu-action:focus-visible {
      border-color: #a8e6d1;
      background: #087b58;
      outline: none;
    }
    .valve-debug-context-menu-form {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }
    .valve-debug-context-menu-field {
      display: grid;
      grid-template-columns: 14px minmax(0, 1fr);
      gap: 4px 7px;
      align-items: center;
      color: #a8c4c5;
      font: 11px/1.3 inherit;
    }
    .valve-debug-context-menu-field select {
      grid-column: 1 / 3;
      width: 100%;
      min-width: 0;
      padding: 6px 7px;
      border: 1px solid #49686f;
      border-radius: 4px;
      background: #0c242a;
      color: #edf7f5;
      font: 12px/1.3 inherit;
    }
    .valve-debug-context-menu-swatch {
      width: 12px;
      height: 12px;
      border: 1px solid rgba(255, 255, 255, .55);
      border-radius: 2px;
      background: var(--valve-menu-swatch, transparent);
    }
    .valve-debug-context-menu-empty {
      color: #f4c873;
      font: 11px/1.35 inherit;
    }
  `
  document.head.appendChild(style)
}

const getLabels = (locale: ValveDebugLocale): ValveDebugPanelLabels =>
  locale === 'en'
    ? {
      title: 'Valve debug',
      empty: 'Right-click a valve to inspect its connected path.',
      currentStart: 'Start',
      state: 'State',
      open: 'Open',
      close: 'Close',
      closed: 'Closed',
      nodeCount: 'Nodes',
      stoppedCount: 'Stops',
      locateUnavailable: 'Not drawable',
      start: 'Start',
      valve: 'Valve',
      line: 'Line',
      equipment: 'Equipment',
      truncated: 'Truncated',
      missing: 'Missing',
      collapse: 'Collapse valve debug panel',
      expand: 'Expand valve debug panel',
      collapseBranch: 'Collapse branch',
      expandBranch: 'Expand branch',
      resize: 'Resize valve debug panel'
    }
    : {
      title: '阀门调试',
      empty: '右键选择阀门，查看其连接路径。',
      currentStart: '起点',
      state: '状态',
      open: '打开',
      close: '关闭',
      closed: '关闭',
      nodeCount: '节点',
      stoppedCount: '截断',
      locateUnavailable: '无法定位',
      start: '起点',
      valve: '阀门',
      line: '线路',
      equipment: '设备',
      truncated: '关闭/截断',
      missing: '缺失',
      collapse: '折叠阀门调试面板',
      expand: '展开阀门调试面板',
      collapseBranch: '折叠分支',
      expandBranch: '展开分支',
      resize: '调整阀门调试面板宽度'
    }

export const defaultValveDebugLabels = getLabels

export class ValveDebugFeature {
  graph: FlowGraphIndex
  readonly panel: ValveDebugPanel
  private readonly states = new Map<string, ValveRuntimeState>()
  private readonly results = new Map<string, ReturnType<typeof traverseFlowFromValve>>()
  private readonly contextMenu: HTMLDivElement
  private readonly menuTitle: HTMLDivElement
  private readonly menuActions: HTMLDivElement
  private readonly openMenuAction: HTMLButtonElement
  private readonly closeMenuAction: HTMLButtonElement
  private readonly configuredForm: HTMLDivElement
  private readonly stateLabel: HTMLLabelElement
  private readonly stateSwatch: HTMLSpanElement
  private readonly stateSelect: HTMLSelectElement
  private readonly utilityLabel: HTMLLabelElement
  private readonly utilitySwatch: HTMLSpanElement
  private readonly utilitySelect: HTMLSelectElement
  private readonly utilityEmpty: HTMLDivElement
  private readonly applyMenuAction: HTMLButtonElement
  private attachedCanvas?: HTMLCanvasElement
  private activeKey?: string
  private pathOverlay?: ValveDebugOverlay
  private locatorOverlay?: ValveDebugOverlay
  private locatorTimer?: number
  private locatorBlinkTimer?: number
  private disposed = false

  constructor(private readonly options: ValveDebugFeatureOptions) {
    this.graph = buildFlowGraphIndex(options.graphDocument)
    this.panel = new ValveDebugPanel(options.panelHost, options.getLabels(options.getLocale()), {
      onCollapseChanged: () => this.resize(),
      onWidthChanged: () => this.resize(),
      onNodeClick: key => this.locateNode(key)
    })

    injectMenuStyles()
    this.contextMenu = document.createElement('div')
    this.contextMenu.className = 'valve-debug-context-menu'
    this.contextMenu.hidden = true
    this.contextMenu.setAttribute('role', 'menu')
    this.menuTitle = document.createElement('div')
    this.menuTitle.className = 'valve-debug-context-menu-title'
    this.menuActions = document.createElement('div')
    this.menuActions.className = 'valve-debug-context-menu-actions'
    this.openMenuAction = this.createMenuAction('open', () => {
      const key = this.openMenuAction.dataset.handleKey
      if (key) this.requestValveState(key, 'open')
    })
    this.closeMenuAction = this.createMenuAction('close', () => {
      const key = this.closeMenuAction.dataset.handleKey
      if (key) this.requestValveState(key, 'closed')
    })
    this.configuredForm = document.createElement('div')
    this.configuredForm.className = 'valve-debug-context-menu-form'
    this.stateLabel = document.createElement('label')
    this.stateLabel.className = 'valve-debug-context-menu-field'
    this.stateSwatch = document.createElement('span')
    this.stateSwatch.className = 'valve-debug-context-menu-swatch'
    this.stateSelect = document.createElement('select')
    this.stateSelect.dataset.valveStateSelect = 'true'
    this.stateSelect.addEventListener('change', () => this.updateConfiguredPreview())
    this.stateLabel.append(this.stateSwatch, document.createElement('span'), this.stateSelect)
    this.utilityLabel = document.createElement('label')
    this.utilityLabel.className = 'valve-debug-context-menu-field'
    this.utilitySwatch = document.createElement('span')
    this.utilitySwatch.className = 'valve-debug-context-menu-swatch'
    this.utilitySelect = document.createElement('select')
    this.utilitySelect.dataset.valveUtilitySelect = 'true'
    this.utilitySelect.addEventListener('change', () => this.updateConfiguredPreview())
    this.utilityLabel.append(this.utilitySwatch, document.createElement('span'), this.utilitySelect)
    this.utilityEmpty = document.createElement('div')
    this.utilityEmpty.className = 'valve-debug-context-menu-empty'
    this.applyMenuAction = this.createMenuAction('open', () => this.applyConfiguredSelection())
    this.applyMenuAction.dataset.valveAction = 'apply-configured'
    this.configuredForm.append(
      this.stateLabel,
      this.utilityLabel,
      this.utilityEmpty,
      this.applyMenuAction
    )
    this.menuActions.append(this.openMenuAction, this.closeMenuAction)
    this.contextMenu.append(this.menuTitle, this.menuActions, this.configuredForm)
    document.body.append(this.contextMenu)

    document.addEventListener('pointerdown', this.handleDocumentPointerDown, true)
    document.addEventListener('click', this.handleDocumentClick, true)
    document.addEventListener('keydown', this.handleDocumentKeyDown, true)
    const compact =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 640px)').matches
    this.panel.setCollapsed(compact)
    this.renderPanel()
  }

  attach() {
    if (this.disposed) return
    const canvas = this.options.getView()?.canvas
    if (!canvas || canvas === this.attachedCanvas) return
    if (this.attachedCanvas) {
      this.attachedCanvas.removeEventListener('contextmenu', this.handleContextMenu, true)
    }
    this.attachedCanvas = canvas
    canvas.addEventListener('contextmenu', this.handleContextMenu, true)
    console.log('[ValveDebugFeature] Attached context menu listener', { canvas })
  }

  setGraphDocument(document: FlowConnectionDocumentInput) {
    if (this.disposed) return
    this.graph = buildFlowGraphIndex(document)
    this.reset()
  }

  reset() {
    this.closeMenu()
    this.states.clear()
    this.results.clear()
    this.activeKey = undefined
    this.disposePathOverlay()
    this.disposeLocatorOverlay()
    this.renderPanel()
  }

  restoreOpenStates(handleKeys: readonly string[]) {
    this.states.clear()
    handleKeys.forEach(key => {
      const valveKey = this.resolveValveKey(key)
      if (valveKey) this.states.set(valveKey, 'open')
    })
    const restoredKeys = [...this.states.keys()]
    this.activeKey = restoredKeys[restoredKeys.length - 1]
    this.recomputeResults()
  }

  setLocale(locale: ValveDebugLocale) {
    this.panel.setLabels(this.options.getLabels(locale))
    const key = this.openMenuAction.dataset.handleKey
    if (key && !this.contextMenu.hidden) {
      const state = this.states.get(key) ?? 'closed'
      const labels = this.options.getLabels(locale)
      this.updateMenuActions(key, state, labels)
    }
    this.renderPanel()
  }

  resize() {
    if (this.disposed) return
    this.panel.fitToViewport()
    const view = this.options.getView()
    if (view) view.isDirty = true
    this.disposePathOverlay()
    this.disposeLocatorOverlay()
    this.renderHighlights()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.reset()
    this.attachedCanvas?.removeEventListener('contextmenu', this.handleContextMenu, true)
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true)
    document.removeEventListener('click', this.handleDocumentClick, true)
    document.removeEventListener('keydown', this.handleDocumentKeyDown, true)
    this.contextMenu.remove()
    this.panel.dispose()
  }

  private readonly handleContextMenu = (event: MouseEvent) => {
    console.log('[ValveDebugFeature] Right-click received', {
      target: event.target,
      currentTarget: event.currentTarget,
      clientX: event.clientX,
      clientY: event.clientY
    })
    const view = this.options.getView()
    if (!view) {
      console.warn('[ValveDebugFeature] Right-click ignored: no active view')
      return
    }
    if (event.currentTarget !== view.canvas) {
      console.warn('[ValveDebugFeature] Right-click ignored: canvas mismatch')
      return
    }
    const canvasPoint = view.viewportToCanvas({ x: event.clientX, y: event.clientY })
    const worldPoint = view.screenToWorld(canvasPoint)
    const pickedItems = view.pick(worldPoint, undefined, true)
    const candidateHandleKeys = pickedItems.flatMap(item => this.getCandidateHandleKeys(item.id))
    const hit = pickedItems
      .flatMap(item => this.getCandidateHandleKeys(item.id))
      .map(key => this.resolveValveKey(key))
      .find((key): key is string => key != null)
    if (!hit) {
      console.warn('[ValveDebugFeature] Right-click did not resolve to a valve', {
        canvasPoint,
        worldPoint,
        pickedIds: pickedItems.map(item => String(item.id)),
        candidateHandleKeys,
        valveKeys: [...this.graph.valveKeys]
      })
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    console.log('[ValveDebugFeature] Right-click selected valve', {
      key: hit,
      label: this.graph.nodes.get(hit)?.label ?? hit,
      clientX: event.clientX,
      clientY: event.clientY
    })
    this.openMenu(hit, event.clientX, event.clientY)
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent) => {
    if (this.contextMenu.hidden) return
    if (event.target instanceof Node && this.contextMenu.contains(event.target)) return
    this.closeMenu()
  }

  private readonly handleDocumentClick = (event: MouseEvent) => {
    if (this.contextMenu.hidden) return
    if (event.target instanceof Node && this.contextMenu.contains(event.target)) return
    this.closeMenu()
  }

  private readonly handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.closeMenu()
  }

  private openMenu(key: string, clientX: number, clientY: number) {
    const node = this.graph.nodes.get(key)
    if (!node) return
    const state = this.states.get(key) ?? 'closed'
    const labels = this.options.getLabels(this.options.getLocale())
    this.menuTitle.textContent = `${node.label} · ${key}`
    this.updateMenuActions(key, state, labels)
    this.contextMenu.hidden = false
    const inset = 8
    const rect = this.contextMenu.getBoundingClientRect()
    const left = Math.min(clientX + 4, window.innerWidth - rect.width - inset)
    const top = Math.min(clientY + 4, window.innerHeight - rect.height - inset)
    this.contextMenu.style.left = `${Math.max(inset, left)}px`
    this.contextMenu.style.top = `${Math.max(inset, top)}px`
      ; (state === 'open' ? this.closeMenuAction : this.openMenuAction).focus()
  }

  private closeMenu() {
    this.contextMenu.hidden = true
    delete this.openMenuAction.dataset.handleKey
    delete this.closeMenuAction.dataset.handleKey
    delete this.applyMenuAction.dataset.handleKey
  }

  private setValveState(key: string, state: ValveRuntimeState) {
    if (this.states.get(key) === state) {
      this.closeMenu()
      return
    }
    this.states.set(key, state)
    this.activeKey = key
    this.closeMenu()
    this.recomputeResults()
    this.options.onStateChanged?.(key, state)
  }

  private requestValveState(key: string, state: ValveRuntimeState) {
    if (this.states.get(key) === state) {
      this.closeMenu()
      return
    }
    const confirmation = this.options.requestStateChange?.(key, state)
    this.closeMenu()
    if (confirmation instanceof Promise) {
      void confirmation.then(confirmed => {
        if (confirmed && !this.disposed) this.setValveState(key, state)
      })
      return
    }
    if (confirmation !== false) this.setValveState(key, state)
  }

  private createMenuAction(action: 'open' | 'close', onClick: () => void) {
    const button = document.createElement('button')
    button.className = 'valve-debug-context-menu-action'
    button.type = 'button'
    button.setAttribute('role', 'menuitem')
    button.dataset.valveAction = action
    button.addEventListener('click', onClick)
    return button
  }

  private updateMenuActions(
    key: string,
    state: ValveRuntimeState,
    labels: ValveDebugPanelLabels
  ) {
    this.openMenuAction.textContent = labels.open
    this.closeMenuAction.textContent = labels.close
    this.openMenuAction.dataset.handleKey = key
    this.closeMenuAction.dataset.handleKey = key
    this.openMenuAction.disabled = state === 'open'
    this.closeMenuAction.disabled = state === 'closed'
    const configuredStates = [...(this.options.getConfiguredStates?.(key) ?? [])]
      .filter(candidate => candidate.enabled)
      .sort((left, right) => left.order - right.order)
    const utilities = [...(this.options.getUtilities?.() ?? [])]
      .filter(utility => utility.enabled)
      .sort((left, right) => left.order - right.order)
    const hasConfiguredStates = configuredStates.length > 0
    this.menuActions.hidden = hasConfiguredStates
    this.configuredForm.hidden = !hasConfiguredStates
    if (!hasConfiguredStates) return

    const locale = this.options.getLocale()
    this.stateLabel.children[1].textContent = locale === 'zh' ? '阀门状态' : 'Valve state'
    this.utilityLabel.children[1].textContent = locale === 'zh' ? '联通流路样式' : 'Connected flow style'
    this.applyMenuAction.textContent = locale === 'zh' ? '应用' : 'Apply'
    this.utilityEmpty.textContent = locale === 'zh'
      ? '没有已启用的 Utility；状态仍可应用，但不会创建流路高亮。'
      : 'No enabled Utility. The state can be applied without a flow highlight.'
    this.stateSelect.replaceChildren(...configuredStates.map(candidate =>
      new Option(candidate.displayName, candidate.id)
    ))
    const currentStateKey = this.options.getConfiguredStateKey?.(key)
    const currentState = configuredStates.find(candidate => candidate.key === currentStateKey)
    if (currentState) this.stateSelect.value = currentState.id
    this.utilitySelect.replaceChildren(...utilities.map(utility =>
      new Option(utility.name, utility.id)
    ))
    this.utilityLabel.hidden = utilities.length === 0
    this.utilityEmpty.hidden = utilities.length > 0
    this.applyMenuAction.dataset.handleKey = key
    this.updateConfiguredPreview()
  }

  private updateConfiguredPreview() {
    const handleKey = this.applyMenuAction.dataset.handleKey
    const state = handleKey
      ? this.options.getConfiguredStates?.(handleKey).find(
        candidate => candidate.id === this.stateSelect.value
      )
      : undefined
    const utility = this.options.getUtilities?.().find(
      candidate => candidate.id === this.utilitySelect.value
    )
    this.stateSwatch.style.setProperty(
      '--valve-menu-swatch',
      state ? `#${state.color.toString(16).padStart(6, '0')}` : 'transparent'
    )
    this.utilitySwatch.style.setProperty(
      '--valve-menu-swatch',
      utility ? `#${utility.style.color.toString(16).padStart(6, '0')}` : 'transparent'
    )
  }

  private applyConfiguredSelection() {
    const handleKey = this.applyMenuAction.dataset.handleKey
    const configuredState = handleKey
      ? this.options.getConfiguredStates?.(handleKey).find(
        candidate => candidate.id === this.stateSelect.value
      )
      : undefined
    if (!handleKey || !configuredState) return
    const utilityId = this.utilitySelect.value || undefined
    const confirmation = this.options.requestConfiguredStateChange?.(
      handleKey,
      configuredState,
      utilityId
    )
    this.closeMenu()
    if (confirmation instanceof Promise) {
      void confirmation.then(confirmed => {
        if (confirmed && !this.disposed) {
          this.setConfiguredValveState(handleKey, configuredState)
        }
      })
    } else if (confirmation !== false) {
      this.setConfiguredValveState(handleKey, configuredState)
    }
  }

  private setConfiguredValveState(
    handleKey: string,
    state: DeviceStateStyleDefinition
  ) {
    this.states.set(
      handleKey,
      state.flowBehavior === 'blocking' ? 'closed' : 'open'
    )
    this.activeKey = handleKey
    this.recomputeResults()
  }

  private recomputeResults() {
    this.results.clear()
    this.states.forEach((state, key) => {
      if (state === 'open' || key === this.activeKey) {
        this.results.set(key, traverseFlowFromValve(this.graph, key, this.states))
      }
    })
    this.renderHighlights()
    this.renderPanel()
  }

  private renderHighlights() {
    this.disposePathOverlay()
    if (this.options.renderPathOverlay === false) return
    const openResults = [...this.states.entries()]
      .filter(([, state]) => state === 'open')
      .map(([key]) => this.results.get(key) ?? traverseFlowFromValve(this.graph, key, this.states))
    const highlightedKeys = mergeFlowHighlightKeys(openResults)
    const objectIds = [...highlightedKeys]
      .map(key => this.options.resolveObjectId(key))
      .filter((id): id is AcDbObjectId => id != null)
    if (objectIds.length > 0) this.pathOverlay = this.options.createOverlay(objectIds, 'path') ?? undefined
  }

  private renderPanel() {
    const root = this.activeKey ? this.results.get(this.activeKey)?.root : undefined
    const state = this.activeKey ? this.states.get(this.activeKey) ?? 'closed' : undefined
    const snapshot: ValveDebugPanelSnapshot = root
      ? {
        root,
        state,
        nodeCount: countFlowTreeNodes(root),
        stoppedCount: countFlowTreeStops(root)
      }
      : {}
    this.panel.render(snapshot)
  }

  private locateNode(key: string) {
    const objectId = this.options.resolveObjectId(key)
    if (!objectId) {
      this.panel.markNodeUnavailable(key)
      return
    }
    this.disposeLocatorOverlay()
    this.locatorOverlay = this.options.createOverlay([objectId], 'locator') ?? undefined
    if (!this.locatorOverlay) {
      this.panel.markNodeUnavailable(key)
      return
    }
    let visible = true
    this.locatorBlinkTimer = window.setInterval(() => {
      visible = !visible
      this.locatorOverlay?.setVisible?.(visible)
    }, 140)
    this.locatorTimer = window.setTimeout(() => {
      this.disposeLocatorOverlay()
    }, 1200)
  }

  private disposePathOverlay() {
    this.pathOverlay?.dispose()
    this.pathOverlay = undefined
  }

  private disposeLocatorOverlay() {
    if (this.locatorTimer !== undefined) {
      window.clearTimeout(this.locatorTimer)
      this.locatorTimer = undefined
    }
    if (this.locatorBlinkTimer !== undefined) {
      window.clearInterval(this.locatorBlinkTimer)
      this.locatorBlinkTimer = undefined
    }
    this.locatorOverlay?.dispose()
    this.locatorOverlay = undefined
  }

  private getCandidateHandleKeys(objectId: AcDbObjectId) {
    const keys = [...this.options.resolveHandleKeys(objectId)]
    const raw = String(objectId).trim().replace(/^0x/i, '')
    if (/^\d+$/.test(raw)) {
      const numeric = Number(raw)
      if (Number.isSafeInteger(numeric) && numeric >= 0) {
        keys.push(numeric.toString(16).toUpperCase())
      }
    }
    return [...new Set(keys)]
  }

  private resolveValveKey(handleKey: string) {
    const normalized = normalizeFlowHandle(handleKey)
    if (!normalized) return undefined
    const primaryKey = this.graph.primaryHandleByCadHandle.get(normalized) ?? normalized
    return this.graph.valveKeys.has(primaryKey) ? primaryKey : undefined
  }
}

export const createValveDebugFeature = (options: ValveDebugFeatureOptions) =>
  new ValveDebugFeature(options)
