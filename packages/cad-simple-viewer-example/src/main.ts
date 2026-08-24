import {
  type AcApSimpleUiPlugin,
  type AcExDockPanelSide,
  type AcExToolbarPlacement,
  SIMPLE_UI_PLUGIN_NAME
} from '@mlightcad/cad-simple-ui-plugin'
import { registerSimpleUiPlugin } from '@mlightcad/cad-simple-ui-plugin/register'
import {
  AcApDocManager,
  AcApI18n,
  AcApOpenDatabaseOptions,
  AcApOpenViewMode,
  AcApQNewCmd,
  AcEdOpenMode,
  type AcTrView2d,
  applyUiTheme,
  isCompactUiLayout,
  layoutBackgroundSysVar,
  ML_UI_COMPACT_MAX_WIDTH
} from '@mlightcad/cad-simple-viewer'
import {
  AcCmColor,
  AcCmColorMethod,
  type AcDbObjectId,
  AcDbSysVarManager,
  AcGeBox2d,
  log
} from '@mlightcad/data-model'
import { Brush, Eraser, Languages, Palette, PanelLeft, Save } from 'lucide'
import type { Object3D } from 'three'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

import { setupAgentIntegration } from './agentIntegration'
import { createAgentToolbarItem } from './agentToolbarItem'
import { ProcessAssistantClient } from './api/processAssistantClient'
import {
  getProcessAssistantConfig,
  PROCESS_ASSISTANT_API_URL
} from './api/processAssistantConfig'
import { ProcessAssistantFileApi } from './api/processAssistantFileApi'
import { ProcessAssistantOperationApi } from './api/processAssistantOperationApi'
import { ProcessAssistantPhaseApi } from './api/processAssistantPhaseApi'
import { ProcessAssistantProcedureApi } from './api/processAssistantProcedureApi'
import { ProcessAssistantProjectApi } from './api/processAssistantProjectApi'
import { injectAppShellResponsiveStyles } from './appShellResponsiveStyles'
import {
  BrushHighlightFeature,
  type BrushHighlightOverlay,
  type BrushOperation
} from './brush/BrushHighlightFeature'
import { setupCompactPhaseSidebar } from './compactPhaseSidebar'
import { createDemoDockTabPanel } from './demoDockTabPanel'
import {
  applyDemoToolbarLayout,
  getCurrentDemoToolbarLayoutId,
  getDemoToolbarLayouts
} from './demoToolbarPresets'
import { DrawingLibraryModal } from './drawing-library/DrawingLibraryModal'
import { injectDrawingLibraryStyles } from './drawing-library/drawingLibraryStyles'
import { injectParsingDetailsStyles } from './drawing-library/parsingDetailsStyles'
import { ProcessAssistantDrawingRepository } from './drawing-library/ProcessAssistantDrawingRepository'
import type { DrawingRecord } from './drawing-library/types'
import { setupFileSidebarResize } from './fileSidebarResize'
import type {
  ValveDebugOverlay,
  ValveDebugView
} from './flow/types'
import {
  createValveDebugFeature,
  defaultValveDebugLabels,
  type ValveDebugLocale
} from './flow/ValveDebugFeature'
import flowConnectionJsonText from './FlowConnection/1.json?raw'
import {
  type AppLocale,
  loadAppLocale,
  saveAppLocale,
  toggleAppLocale,
  translate
} from './locale'
import { DrawingAssetStore } from './phase/drawingAssetStore'
import { shouldHotSwitchPhase } from './phase/phaseActivationUtils'
import { createPhaseIcon } from './phase/phaseIcons'
import {
  type CopyPhaseRequest,
  type CopySequenceRequest,
  type DrawingAssociationRequest,
  type NewPhaseRequest,
  type NewSequenceRequest,
  PhaseWorkspacePanel
} from './phase/PhaseWorkspacePanel'
import { PhaseWorkspaceRepository } from './phase/phaseWorkspaceRepository'
import { PhaseWorkspaceStore } from './phase/phaseWorkspaceStore'
import { injectPhaseWorkspaceStyles } from './phase/phaseWorkspaceStyles'
import type {
  DrawingAssetRef,
  FlowPathStatus,
  FlowStateSnapshot
} from './phase/types'
import { setupPhaseSidebarResize } from './phaseSidebarResize'
import {
  HighlightStyleDialog,
  type HighlightStyleDraft
} from './presentation/HighlightStyleDialog'
import { PhasePresentationController } from './presentation/PhasePresentationController'
import {
  type ResolvedEntityPresentation,
  resolveEntityPresentation
} from './presentation/presentationStyleResolver'
import { upgradePreviewWideLines } from './presentation/upgradePreviewWideLines'
import { ProcessAssistantProjectRepository } from './project/ProcessAssistantProjectRepository'
import { ProjectManagementModal } from './project/ProjectManagementModal'
import { injectProjectManagementStyles } from './project/projectManagementStyles'
import type { ProjectRecord } from './project/types'
import { registerLazyPlugins } from './register'
import {
  PhaseReportExporter,
  type PhaseReportExportResult
} from './report/PhaseReportExporter'
import { ReportManifestStore } from './report/reportManifest'
import { ReportWorkspaceModal } from './report/ReportWorkspaceModal'
import { injectReportWorkspaceStyles } from './report/reportWorkspaceStyles'
import { injectConfirmationModalStyles } from './ui/confirmationModalStyles'
import { Toast, type ToastTone } from './ui/Toast'
import { injectToastStyles } from './ui/toastStyles'
import { injectUiReferenceThemeStyles } from './uiReferenceThemeStyles'
import { localizeDom, translateUiText } from './uiTranslations'

const EXAMPLE_COMMAND_ALIASES = {
  LINE: ['LX'],
  CIRCLE: ['CI'],
  ZOOM: ['ZZ']
}

const ACTIVE_PROJECT_STORAGE_KEY =
  'cad-simple-viewer-example-active-project-id'

const areEqualNumberSets = (
  left: readonly number[] | undefined,
  right: readonly number[] | undefined
): boolean => {
  const leftSet = new Set(left ?? [])
  const rightSet = new Set(right ?? [])
  if (leftSet.size !== rightSet.size) return false
  for (const value of leftSet) {
    if (!rightSet.has(value)) return false
  }
  return true
}

interface FlowConnectionEdge {
  From?: number
  To?: {
    $values?: number[]
  }
}

interface FlowConnectionLogEdge {
  from: number
  to: number[]
}

interface FlowConnectionAttribute {
  Key?: string
  Value?: string
}

interface FlowConnectionEntity {
  $type?: string
  Handle?: number
  LayerName?: string
  BlockName?: string
  Points?: {
    $values?: FlowConnectionPoint2d[]
  }
  Position?: FlowConnectionPoint2d
  Center?: FlowConnectionPoint2d
  Radius?: number
  Height?: number
  Items?: {
    $values?: FlowConnectionEntity[]
  }
  Attributes?: {
    $values?: FlowConnectionAttribute[]
  }
}

interface FlowConnectionMapItem {
  Graph?: {
    Edges?: {
      $values?: FlowConnectionEdge[]
    }
  }
}

interface FlowConnectionPoint2d {
  X?: number
  Y?: number
}

interface FlowConnectionBBox {
  Min?: FlowConnectionPoint2d
  Max?: FlowConnectionPoint2d
}

interface FlowConnectionArea {
  Id?: string
  BBox?: FlowConnectionBBox
  Components?: {
    $values?: FlowConnectionComponent[]
  }
}

interface FlowConnectionComponent {
  Handle?: number
  Id?: string
  Name?: string
}

interface FlowConnectionDocument {
  Dsl?: {
    Entities?: {
      $values?: FlowConnectionEntity[]
    }
  }
  Map?: {
    Maps?: {
      $values?: FlowConnectionMapItem[]
    }
  }
  Org?: {
    Areas?: {
      $values?: FlowConnectionArea[]
    }
  }
}

interface FlowConnectionBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const CONNECTED_FLOW_STYLE = {
  color: 0x9c27b0,
  lineWidthPx: 3.5,
  opacity: 1,
  visible: true
} as const

// The raster helper layer contains the large regular grid used for P&ID
// positioning. Keep it hidden in the viewer and out of PDF content while
// retaining it for bounds lookup.
const PHI_RASTER_LAYER_NAME = '$PHI_RASTER'
const PDF_EXCLUDED_LAYERS = [PHI_RASTER_LAYER_NAME]
const PDF_PID_RASTER_LAYERS = [PHI_RASTER_LAYER_NAME]
const PDF_PID_SEARCH_PADDING_RATIO = 0.55
const PDF_PID_SEARCH_MIN_PADDING = 600
const PDF_PID_FINAL_PADDING_RATIO = 0.06
const PDF_PID_FINAL_MIN_PADDING = 80

const uniqueHandleKeys = (keys: string[]) => {
  return [
    ...new Set(
      keys
        .map(key => key.trim())
        .filter(Boolean)
        .map(key => key.replace(/^0+/, '') || '0')
    )
  ]
}

const handleKeysFromNumber = (handleId: number) => {
  if (!Number.isFinite(handleId) || handleId < 0) return []

  const integerHandle = Math.trunc(handleId)
  return uniqueHandleKeys([
    integerHandle.toString(16).toUpperCase(),
    String(integerHandle)
  ])
}

const handleKeysFromObjectId = (objectId: AcDbObjectId) => {
  const raw = String(objectId).trim()
  if (!raw) return []

  const withoutPrefix = raw.replace(/^0x/i, '')
  return uniqueHandleKeys([withoutPrefix.toUpperCase(), raw.toUpperCase()])
}

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value)
}

const parseFlowConnectionDocument = (): FlowConnectionDocument => {
  try {
    return JSON.parse(flowConnectionJsonText) as FlowConnectionDocument
  } catch (parseError) {
    log.warn('Failed to parse flow connection json:', parseError)
    return {}
  }
}

const isFlowBoundaryLayerName = (layerName?: string) => {
  const normalized = layerName?.trim().toUpperCase()
  if (!normalized || normalized.includes('TEXT')) return false

  return (
    normalized === 'VALVE' ||
    normalized === 'VALVES' ||
    normalized === 'PUMP' ||
    normalized === 'PUMPS' ||
    normalized.startsWith('P---PVL') ||
    normalized.startsWith('P---PUMP')
  )
}

const hasFlowConnectionPointAttribute = (entity: FlowConnectionEntity) => {
  return (
    entity.Attributes?.$values?.some(
      attribute => attribute.Key?.trim().toUpperCase() === 'PHI_CONNECTIONPOINT'
    ) ?? false
  )
}

const entityHasFlowBoundaryLayer = (entity: FlowConnectionEntity): boolean => {
  return (
    isFlowBoundaryLayerName(entity.LayerName) ||
    (entity.Items?.$values?.some(item => entityHasFlowBoundaryLayer(item)) ??
      false)
  )
}

const isFlowBoundaryEntity = (entity: FlowConnectionEntity) => {
  if (!entityHasFlowBoundaryLayer(entity)) return false

  return (
    isFlowBoundaryLayerName(entity.LayerName) ||
    hasFlowConnectionPointAttribute(entity) ||
    (entity.Items?.$values?.length ?? 0) > 0
  )
}

const addFlowConnectionIndexEntry = (
  index: Map<string, number[]>,
  fromKey: string,
  toHandles: number[]
) => {
  const existing = index.get(fromKey) ?? []
  index.set(fromKey, [...existing, ...toHandles])
}

const addFlowConnectionLogEntry = (
  index: Map<string, FlowConnectionLogEdge[]>,
  fromKey: string,
  edge: FlowConnectionLogEdge
) => {
  const existing = index.get(fromKey) ?? []
  index.set(fromKey, [...existing, edge])
}

const buildFlowConnectionIndex = (document: FlowConnectionDocument) => {
  const index = new Map<string, number[]>()
  const maps = document.Map?.Maps?.$values ?? []

  maps.forEach(mapItem => {
    const edges = mapItem.Graph?.Edges?.$values ?? []
    edges.forEach(edge => {
      if (edge.From == null) return

      const fromHandle = Math.trunc(edge.From)
      const fromKeys = handleKeysFromNumber(fromHandle)
      if (fromKeys.length === 0) return

      const toHandles = edge.To?.$values?.filter(handle => handle >= 0) ?? []
      if (toHandles.length === 0) return

      fromKeys.forEach(fromKey => {
        addFlowConnectionIndexEntry(index, fromKey, toHandles)
      })
    })
  })

  return index
}

const buildFlowConnectionLogIndex = (document: FlowConnectionDocument) => {
  const index = new Map<string, FlowConnectionLogEdge[]>()
  const maps = document.Map?.Maps?.$values ?? []

  maps.forEach(mapItem => {
    const edges = mapItem.Graph?.Edges?.$values ?? []
    edges.forEach(edge => {
      if (edge.From == null) return

      const fromHandle = Math.trunc(edge.From)
      const fromKeys = handleKeysFromNumber(fromHandle)
      if (fromKeys.length === 0) return

      const toHandles = edge.To?.$values?.filter(handle => handle >= 0) ?? []
      if (toHandles.length === 0) return

      const logEdge = {
        from: fromHandle,
        to: toHandles
      }
      fromKeys.forEach(fromKey => {
        addFlowConnectionLogEntry(index, fromKey, logEdge)
      })
    })
  })

  return index
}

const collectFlowBoundaryHandleKeys = (
  entity: FlowConnectionEntity,
  boundaryHandleKeys: Set<string>
) => {
  if (entity.Handle != null && entity.Handle > 0 && isFlowBoundaryEntity(entity)) {
    handleKeysFromNumber(entity.Handle).forEach(handleKey => {
      boundaryHandleKeys.add(handleKey)
    })
  }

  entity.Items?.$values?.forEach(item => {
    collectFlowBoundaryHandleKeys(item, boundaryHandleKeys)
  })
}

const buildFlowBoundaryHandleKeys = (document: FlowConnectionDocument) => {
  const boundaryHandleKeys = new Set<string>()
  const entities = document.Dsl?.Entities?.$values ?? []

  entities.forEach(entity => {
    collectFlowBoundaryHandleKeys(entity, boundaryHandleKeys)
  })

  document.Org?.Areas?.$values?.forEach(area => {
    area.Components?.$values?.forEach(component => {
      const name = component.Name?.trim().toUpperCase() ?? ''
      if (!name.includes('VALVE') && !name.includes('PUMP')) return
      if (component.Handle == null || component.Handle < 0) return
      handleKeysFromNumber(component.Handle).forEach(handleKey => {
        boundaryHandleKeys.add(handleKey)
      })
    })
  })

  return boundaryHandleKeys
}

const buildFlowEdgeHandleKeys = (document: FlowConnectionDocument) => {
  const edgeHandleKeys = new Set<string>()
  const entities = document.Dsl?.Entities?.$values ?? []

  entities.forEach(entity => {
    if (!entity.$type?.includes('.Polyline,')) return
    if (entity.Handle == null || entity.Handle < 0) return
    handleKeysFromNumber(entity.Handle).forEach(handleKey => {
      edgeHandleKeys.add(handleKey)
    })
  })

  return edgeHandleKeys
}

const collectFlowConnectionGraphHandles = (document: FlowConnectionDocument) => {
  const handles = new Set<number>()
  const maps = document.Map?.Maps?.$values ?? []

  maps.forEach(mapItem => {
    const edges = mapItem.Graph?.Edges?.$values ?? []
    edges.forEach(edge => {
      if (edge.From != null && edge.From >= 0) {
        handles.add(Math.trunc(edge.From))
      }
      edge.To?.$values?.forEach(handle => {
        if (handle >= 0) {
          handles.add(Math.trunc(handle))
        }
      })
    })
  })

  return handles
}

const resolveFlowConnectionAreaBounds = (
  document: FlowConnectionDocument
): FlowConnectionBounds | null => {
  const areas = document.Org?.Areas?.$values ?? []
  let bounds: FlowConnectionBounds | null = null

  areas.forEach(area => {
    const min = area.BBox?.Min
    const max = area.BBox?.Max
    if (
      !isFiniteNumber(min?.X) ||
      !isFiniteNumber(min?.Y) ||
      !isFiniteNumber(max?.X) ||
      !isFiniteNumber(max?.Y)
    ) {
      return
    }

    bounds = expandBoundsWithPoint(bounds, min.X, min.Y)
    bounds = expandBoundsWithPoint(bounds, max.X, max.Y)
  })

  return bounds
}

const resolveFlowConnectionPidBounds = (
  document: FlowConnectionDocument
): FlowConnectionBounds | null => {
  const areaBounds = resolveFlowConnectionAreaBounds(document)
  if (!areaBounds) {
    return null
  }

  const graphHandles = collectFlowConnectionGraphHandles(document)
  let seedBounds: FlowConnectionBounds | null = null

  const visitGraphEntity = (
    entity: FlowConnectionEntity,
    offsetX: number,
    offsetY: number,
    includeParent: boolean
  ) => {
    const includeEntity =
      includeParent ||
      (entity.Handle != null && graphHandles.has(Math.trunc(entity.Handle)))

    if (includeEntity) {
      seedBounds = expandBoundsWithEntity(
        seedBounds,
        entity,
        offsetX,
        offsetY,
        areaBounds
      )
    }

    const nextOffsetX = offsetX + (entity.Position?.X ?? 0)
    const nextOffsetY = offsetY + (entity.Position?.Y ?? 0)
    entity.Items?.$values?.forEach(item => {
      visitGraphEntity(item, nextOffsetX, nextOffsetY, includeEntity)
    })
  }

  document.Dsl?.Entities?.$values?.forEach(entity => {
    visitGraphEntity(entity, 0, 0, false)
  })

  if (!seedBounds) {
    return null
  }

  const searchBounds = clampBounds(
    expandBounds(
      seedBounds,
      PDF_PID_SEARCH_PADDING_RATIO,
      PDF_PID_SEARCH_MIN_PADDING
    ),
    areaBounds
  )
  let bounds: FlowConnectionBounds | null = null

  const visitNearbyEntity = (
    entity: FlowConnectionEntity,
    offsetX: number,
    offsetY: number,
    skipParent: boolean
  ) => {
    const skipEntity = skipParent || isPdfLayerExcluded(entity.LayerName)
    if (!skipEntity) {
      const entityBounds = expandBoundsWithEntity(
        null,
        entity,
        offsetX,
        offsetY,
        areaBounds
      )
      if (entityBounds && intersectsBounds(entityBounds, searchBounds)) {
        bounds = mergeBounds(bounds, entityBounds)
      }
    }

    const nextOffsetX = offsetX + (entity.Position?.X ?? 0)
    const nextOffsetY = offsetY + (entity.Position?.Y ?? 0)
    entity.Items?.$values?.forEach(item => {
      visitNearbyEntity(item, nextOffsetX, nextOffsetY, skipEntity)
    })
  }

  document.Dsl?.Entities?.$values?.forEach(entity => {
    visitNearbyEntity(entity, 0, 0, false)
  })

  return bounds
    ? clampBounds(
      expandBounds(
        bounds,
        PDF_PID_FINAL_PADDING_RATIO,
        PDF_PID_FINAL_MIN_PADDING
      ),
      areaBounds
    )
    : searchBounds
}

const isPdfLayerExcluded = (layerName?: string) => {
  const normalized = layerName?.trim().toUpperCase()
  if (!normalized) {
    return false
  }

  return PDF_PID_RASTER_LAYERS.some(
    layer => layer.trim().toUpperCase() === normalized
  )
}

const expandBoundsWithEntity = (
  bounds: FlowConnectionBounds | null,
  entity: FlowConnectionEntity,
  offsetX: number,
  offsetY: number,
  areaBounds: FlowConnectionBounds
) => {
  let nextBounds = bounds

  entity.Points?.$values?.forEach(point => {
    nextBounds = expandBoundsWithAreaPoint(
      nextBounds,
      point.X,
      point.Y,
      offsetX,
      offsetY,
      areaBounds
    )
  })

  if (entity.Center) {
    const radius = isFiniteNumber(entity.Radius) ? entity.Radius : 0
    nextBounds = expandBoundsWithAreaPoint(
      nextBounds,
      entity.Center.X,
      entity.Center.Y,
      offsetX - radius,
      offsetY - radius,
      areaBounds
    )
    nextBounds = expandBoundsWithAreaPoint(
      nextBounds,
      entity.Center.X,
      entity.Center.Y,
      offsetX + radius,
      offsetY + radius,
      areaBounds
    )
  }

  if (entity.Position) {
    const height = isFiniteNumber(entity.Height) ? entity.Height : 0
    nextBounds = expandBoundsWithAreaPoint(
      nextBounds,
      entity.Position.X,
      entity.Position.Y,
      offsetX - height,
      offsetY - height,
      areaBounds
    )
    nextBounds = expandBoundsWithAreaPoint(
      nextBounds,
      entity.Position.X,
      entity.Position.Y,
      offsetX + height,
      offsetY + height,
      areaBounds
    )
  }

  return nextBounds
}

const expandBoundsWithAreaPoint = (
  bounds: FlowConnectionBounds | null,
  x: number | undefined,
  y: number | undefined,
  offsetX: number,
  offsetY: number,
  areaBounds: FlowConnectionBounds
) => {
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return bounds
  }

  const worldX = x + offsetX
  const worldY = y + offsetY
  if (!isPointInsideBounds(worldX, worldY, areaBounds)) {
    return bounds
  }

  return expandBoundsWithPoint(bounds, worldX, worldY)
}

const expandBoundsWithPoint = (
  bounds: FlowConnectionBounds | null,
  x: number,
  y: number
): FlowConnectionBounds => {
  return mergeBounds(bounds, { minX: x, minY: y, maxX: x, maxY: y })!
}

const mergeBounds = (
  bounds: FlowConnectionBounds | null,
  nextBounds: FlowConnectionBounds | null
): FlowConnectionBounds | null => {
  if (!nextBounds) {
    return bounds
  }

  return bounds
    ? {
      minX: Math.min(bounds.minX, nextBounds.minX),
      minY: Math.min(bounds.minY, nextBounds.minY),
      maxX: Math.max(bounds.maxX, nextBounds.maxX),
      maxY: Math.max(bounds.maxY, nextBounds.maxY)
    }
    : nextBounds
}

const expandBounds = (
  bounds: FlowConnectionBounds,
  ratio: number,
  minPadding: number
) => {
  const padding = Math.max(
    minPadding,
    Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * ratio
  )
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding
  }
}

const clampBounds = (
  bounds: FlowConnectionBounds,
  outer: FlowConnectionBounds
) => {
  return {
    minX: Math.max(bounds.minX, outer.minX),
    minY: Math.max(bounds.minY, outer.minY),
    maxX: Math.min(bounds.maxX, outer.maxX),
    maxY: Math.min(bounds.maxY, outer.maxY)
  }
}

const isPointInsideBounds = (
  x: number,
  y: number,
  bounds: FlowConnectionBounds
) => {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
}

const intersectsBounds = (
  left: FlowConnectionBounds,
  right: FlowConnectionBounds
) => {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  )
}

const flowConnectionDocument = parseFlowConnectionDocument()
const flowConnectionIndex = buildFlowConnectionIndex(flowConnectionDocument)
const flowConnectionLogIndex = buildFlowConnectionLogIndex(
  flowConnectionDocument
)
const flowBoundaryHandleKeys = buildFlowBoundaryHandleKeys(
  flowConnectionDocument
)
const flowEdgeHandleKeys = buildFlowEdgeHandleKeys(flowConnectionDocument)
const flowConnectionPidBounds = resolveFlowConnectionPidBounds(
  flowConnectionDocument
)

type ColorWritable = {
  set(value: number): void
}

type PreviewMaterial = {
  color?: ColorWritable
  emissive?: ColorWritable
  uniforms?: Record<string, { value?: ColorWritable }>
  depthTest: boolean
  depthWrite: boolean
  needsUpdate: boolean
  dispose(): void
}

type LayerNamedEntity = {
  layer?: string
  layerName?: string
}

type PreviewGeometry = {
  dispose(): void
}

type PreviewObject = {
  renderOrder: number
  userData: Record<string, unknown>
  material?: PreviewMaterial | PreviewMaterial[] | null
  geometry?: PreviewGeometry | null
  traverse(callback: (object: PreviewObject) => void): void
}

type PreviewRoot = Object3D & PreviewObject & {
  name: string
  removeFromParent(): void
  clear(): void
}

type LayoutObjectHost = {
  add(object: PreviewRoot): void
}

class CadViewerApp {
  private container: HTMLDivElement
  private fileInput: HTMLInputElement
  private centerOpenButton: HTMLButtonElement
  private viewerPane: HTMLElement
  private emptyState: HTMLDivElement
  private predefinedButtons: NodeListOf<HTMLButtonElement>
  private fileSidebarColumn: HTMLElement | null
  private fileSidebar: HTMLElement | null
  private fileSidebarBody: HTMLElement | null
  private fileSidebarToggle: HTMLButtonElement | null
  private fileSidebarSubtitle: HTMLSpanElement | null
  private pidDrawingLibraryButton: HTMLButtonElement
  private projectManagementButton: HTMLButtonElement
  private reportWorkspaceButton: HTMLButtonElement
  private dockButton: HTMLButtonElement
  private dockMenu: HTMLDivElement
  private dockOpenToggle: HTMLButtonElement
  private dockAddTabButton: HTMLButtonElement
  private dockSizeInput: HTMLInputElement
  private dockSizeLabel: HTMLSpanElement
  private toolbarLayoutSelect: HTMLSelectElement
  private viewerToolbarButton: HTMLButtonElement
  private viewerToolbarMenu: HTMLDivElement
  private viewerToolbarVisibilityToggle: HTMLButtonElement
  private viewerToolbarCollapseToggle: HTMLButtonElement
  private viewerToolbarEdgeOffsetInput: HTMLInputElement
  private viewerToolbarPlacementButtons: NodeListOf<HTMLButtonElement>
  private devToolbar: HTMLElement
  private dockMenuOpen = false
  private demoDockTabCount = 0
  private viewerToolbarMenuOpen = false
  private appLocale: AppLocale = loadAppLocale()
  private readonly toast = new Toast(() =>
    translateUiText(this.appLocale, 'Close')
  )
  private isInitialized = false
  private hasOpenedFile = false
  private isLoadingFile = false
  private openHighlightRoots = new Map<AcDbObjectId, PreviewRoot>()
  private openHighlightGroups = new Map<AcDbObjectId, Set<AcDbObjectId>>()
  private openHighlightConnections = new Map<AcDbObjectId, Set<number>>()
  private readonly phasePresentationController = new PhasePresentationController()
  private phaseStore = new PhaseWorkspaceStore()
  private phaseRepository?: PhaseWorkspaceRepository
  private readonly reportStore = ReportManifestStore.load()
  private readonly drawingAssetStore = new DrawingAssetStore()
  private readonly processAssistantClient = new ProcessAssistantClient({
    baseUrl: PROCESS_ASSISTANT_API_URL
  })
  private readonly processAssistantFileApi = new ProcessAssistantFileApi(
    this.processAssistantClient
  )
  private readonly processAssistantProjectApi = new ProcessAssistantProjectApi(
    this.processAssistantClient
  )
  private readonly processAssistantProcedureApi =
    new ProcessAssistantProcedureApi(this.processAssistantClient)
  private readonly processAssistantOperationApi =
    new ProcessAssistantOperationApi(this.processAssistantClient)
  private readonly processAssistantPhaseApi = new ProcessAssistantPhaseApi(
    this.processAssistantClient
  )
  private readonly projectRepository = new ProcessAssistantProjectRepository(
    this.processAssistantProjectApi
  )
  private readonly drawingLibraryRepository =
    new ProcessAssistantDrawingRepository(this.processAssistantFileApi)
  private phasePanel?: PhaseWorkspacePanel
  private drawingLibrary?: DrawingLibraryModal
  private projectManagement?: ProjectManagementModal
  private reportWorkspace?: ReportWorkspaceModal
  private loadedPhase?: { processId: string; sequenceId: string; phaseId: string }
  private loadedDrawingAssetId?: string
  private pendingPhase?: {
    processId: string
    sequenceId: string
    phaseId: string
    token: number
  }
  private readonly backendPhaseSaveTimers = new Map<string, number>()
  private phaseActivationToken = 0
  private projectLoadToken = 0
  private activeProject?: ProjectRecord
  private activeProjectId?: number
  private valveDebugFeature?: ReturnType<typeof createValveDebugFeature>
  private brushHighlightFeature?: BrushHighlightFeature

  constructor() {
    this.container = document.getElementById('cad-container') as HTMLDivElement
    this.fileInput = document.getElementById(
      'fileInputElement'
    ) as HTMLInputElement
    this.centerOpenButton = document.getElementById(
      'centerOpenButton'
    ) as HTMLButtonElement
    this.viewerPane = document.getElementById('viewerPane') as HTMLElement
    this.emptyState = document.getElementById('emptyState') as HTMLDivElement
    this.predefinedButtons = document.querySelectorAll(
      '#predefinedFileList .file-list-item'
    ) as NodeListOf<HTMLButtonElement>
    this.fileSidebarColumn = document.getElementById('fileSidebarColumn')
    this.fileSidebar = document.getElementById('fileSidebar')
    this.fileSidebarBody = document.getElementById('fileSidebarBody')
    this.fileSidebarToggle = document.getElementById(
      'fileSidebarToggle'
    ) as HTMLButtonElement | null
    this.fileSidebarSubtitle = document.getElementById(
      'fileSidebarSubtitle'
    ) as HTMLSpanElement | null
    this.pidDrawingLibraryButton = document.getElementById(
      'pidDrawingLibraryButton'
    ) as HTMLButtonElement
    this.projectManagementButton = document.getElementById(
      'projectManagementButton'
    ) as HTMLButtonElement
    this.reportWorkspaceButton = document.getElementById(
      'reportWorkspaceButton'
    ) as HTMLButtonElement
    this.dockButton = document.getElementById(
      'devDockButton'
    ) as HTMLButtonElement
    this.dockMenu = document.getElementById('devDockMenu') as HTMLDivElement
    this.dockOpenToggle = document.getElementById(
      'devDockOpenToggle'
    ) as HTMLButtonElement
    this.dockAddTabButton = document.getElementById(
      'devDockAddTab'
    ) as HTMLButtonElement
    this.dockSizeInput = document.getElementById(
      'devDockSizeInput'
    ) as HTMLInputElement
    this.dockSizeLabel = document.getElementById(
      'devDockSizeLabel'
    ) as HTMLSpanElement
    this.toolbarLayoutSelect = document.getElementById(
      'devToolbarLayoutSelect'
    ) as HTMLSelectElement
    this.viewerToolbarButton = document.getElementById(
      'devViewerToolbarButton'
    ) as HTMLButtonElement
    this.viewerToolbarMenu = document.getElementById(
      'devViewerToolbarMenu'
    ) as HTMLDivElement
    this.viewerToolbarVisibilityToggle = document.getElementById(
      'devViewerToolbarVisibilityToggle'
    ) as HTMLButtonElement
    this.viewerToolbarCollapseToggle = document.getElementById(
      'devViewerToolbarCollapseToggle'
    ) as HTMLButtonElement
    this.viewerToolbarEdgeOffsetInput = document.getElementById(
      'devViewerToolbarEdgeOffset'
    ) as HTMLInputElement
    this.viewerToolbarPlacementButtons = document.querySelectorAll(
      '[data-viewer-toolbar-placement]'
    ) as NodeListOf<HTMLButtonElement>
    this.devToolbar = document.getElementById('appToolbar') as HTMLElement
    this.setupLanguageToggle()
    this.setupFileHandling()
    this.setupPredefinedFileActions()
    this.setupMobileSidebar()
    const fileSidebarResizeHandle = document.getElementById(
      'fileSidebarResizeHandle'
    )
    if (this.fileSidebarColumn && fileSidebarResizeHandle) {
      setupFileSidebarResize(this.fileSidebarColumn, fileSidebarResizeHandle)
    }
    this.setupDrawingLibrary()
    this.setupProjectManagement()
    this.setupReportWorkspace()
    this.setupDockMenu()
    this.setupViewerToolbarMenu()
    this.updateEmptyStateVisibility()
    this.applyAppLocale()
    void this.initialize()
  }

  private setupLanguageToggle() {
    const button = document.getElementById(
      'languageToggleButton'
    ) as HTMLButtonElement | null
    if (!button) throw new Error('Language toggle button was not found')
    button.replaceChildren(createPhaseIcon(Languages))
    const phaseToggle = document.getElementById(
      'phaseSidebarToggleButton'
    ) as HTMLButtonElement | null
    phaseToggle?.prepend(createPhaseIcon(PanelLeft))
    button.addEventListener('click', () => {
      this.appLocale = toggleAppLocale(this.appLocale)
      saveAppLocale(this.appLocale)
      this.applyAppLocale()
    })
  }

  private applyAppLocale() {
    document.documentElement.lang = this.appLocale === 'zh' ? 'zh-CN' : 'en'
    AcApI18n.setCurrentLocale(this.appLocale)
    const setText = (selector: string, key: Parameters<typeof translate>[1]) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element) element.textContent = translate(this.appLocale, key)
    }
    const setLabel = (selector: string, key: Parameters<typeof translate>[1]) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element) element.setAttribute('aria-label', translate(this.appLocale, key))
    }
    setLabel('#appToolbar', 'appToolbarAria')
    setText('#appToolbarSubtitle', 'appToolbarSubtitle')
    setText('#appToolbarProjectLabel', 'projectLabel')
    setText('#appToolbarDrawingLabel', 'drawingLabel')
    setText('#phaseSidebarToggleLabel', 'phasePanelToggle')
    setLabel('#phaseSidebarToggleButton', 'phasePanelToggle')
    setLabel('#phaseSidebarScrim', 'phasePanelClose')
    setText('#phaseSidebarTitle', 'workspaceTitle')
    setLabel('.phase-sidebar', 'workspaceAria')
    setLabel('#phaseSidebarResizeHandle', 'resizeAria')
    setLabel('.phase-contextbar', 'contextAria')
    setText('.phase-context-field:nth-of-type(1) span', 'process')
    setText('.phase-context-field:nth-of-type(2) span', 'sequence')
    setText('.phase-context-field:nth-of-type(3) span', 'phase')
    setLabel('#phaseContextProcess', 'selectProcess')
    setLabel('#phaseContextSequence', 'selectSequence')
    setLabel('#phaseContextPhase', 'selectPhase')
    setText('#phaseContextSave span', 'savePhase')
    setLabel('#phaseContextSave', 'savePhase')
    const button = document.getElementById('languageToggleButton')
    const buttonLabel = translate(this.appLocale, 'languageButton')
    button?.setAttribute('aria-label', buttonLabel)
    button?.setAttribute('title', translate(this.appLocale, 'switchTo'))
    this.phasePanel?.render()
    this.reportWorkspace?.refreshLocale()
    this.syncPhaseContextBar()
    this.syncDockMenuState()
    this.syncViewerToolbarMenuState()
    localizeDom(document, this.appLocale)
    this.valveDebugFeature?.setLocale(this.appLocale as ValveDebugLocale)
  }

  private setupReportWorkspace() {
    injectReportWorkspaceStyles()
    this.reportWorkspace = new ReportWorkspaceModal(
      () => this.phaseStore.snapshot(),
      this.reportStore,
      {
        preview: async (processId, sequenceId, phaseId) => {
          await this.initialize()
          await this.activateWorkspacePhase(processId, sequenceId, phaseId)
        },
        export: (mode, signal, onProgress) =>
          this.exportPhaseReport(mode, signal, onProgress)
      },
      () => this.appLocale
    )
    this.reportWorkspaceButton.addEventListener('click', () => {
      this.captureLoadedPhaseState()
      this.reportWorkspace?.open()
    })
  }

  private setupDrawingLibrary() {
    injectDrawingLibraryStyles()
    this.drawingLibrary = new DrawingLibraryModal(
      this.drawingLibraryRepository,
      {
        open: record => this.openLibraryDrawing(record)
      }
    )
    this.pidDrawingLibraryButton.addEventListener('click', () => {
      this.captureLoadedPhaseState()
      void this.drawingLibrary?.open()
    })
  }

  private setupProjectManagement() {
    injectProjectManagementStyles()
    this.projectManagement = new ProjectManagementModal(
      this.projectRepository,
      this.drawingLibraryRepository,
      {
        onSelect: project => this.switchProject(project),
        onDelete: projectId => this.handleDeletedProject(projectId)
      }
    )
    this.projectManagementButton.addEventListener('click', () => {
      void this.projectManagement?.open()
    })
  }

  private async openLibraryDrawing(record: DrawingRecord) {
    await this.initialize()
    this.clearMessages()
    this.captureLoadedPhaseState()
    this.invalidateLoadedPhaseBinding()
    this.setLoadingState(true)
    try {
      const content = await this.drawingLibraryRepository.getContent(record.id)
      const success = await AcApDocManager.instance.openDocument(
        record.originalFileName,
        content,
        {
          minimumChunkSize: 1000,
          progressiveRendering: true,
          mode: AcEdOpenMode.Write,
          openViewMode: AcApOpenViewMode.Extents,
          sysVars: { lwdisplay: false }
        }
      )
      if (!success) throw new Error(`无法打开 ${record.name}`)
      this.predefinedButtons.forEach(item => item.classList.remove('active'))
      document.title = record.name
      this.showMessage(`Successfully loaded: ${record.name}`, 'success')
    } finally {
      this.finishLoadingState()
    }
  }

  private async exportPhaseReport(
    mode: 'merged' | 'per-sequence',
    signal: AbortSignal,
    onProgress: Parameters<PhaseReportExporter['export']>[2]['onProgress']
  ) {
    await this.initialize()
    const loaded = await AcApDocManager.instance.pluginManager.loadByTrigger(
      'cpdf'
    )
    if (!loaded) throw new Error('PDF export plugin is not available')

    this.captureLoadedPhaseState()
    const workspace = this.phaseStore.snapshot()
    const manifest = this.reportStore.freeze()
    const view = AcApDocManager.instance.curView
    const originalViewBox = new AcGeBox2d()
      .expandByPoint(view.screenToWorld({ x: 0, y: 0 }))
      .expandByPoint(view.screenToWorld({ x: view.width, y: view.height }))
    const issues = this.reportStore.preflight(workspace)
    if (issues.some(issue => issue.severity === 'error')) {
      throw new Error('Report preflight failed')
    }

    const { AcApPdfConvertor, AcApPdfReportComposer } = await import(
      '@mlightcad/cad-pdf-plugin'
    )
    const convertor = new AcApPdfConvertor()
    const composer = new AcApPdfReportComposer()
    const exporter = new PhaseReportExporter({
      activate: location =>
        this.activateWorkspacePhase(
          location.processId,
          location.sequenceId,
          location.phaseId,
          false
        ),
      renderPage: () =>
        convertor.renderPdfBytes(AcApDocManager.instance.context, {
          backgroundColor: 0xffffff,
          bounds: flowConnectionPidBounds ?? undefined,
          excludedLayers: PDF_EXCLUDED_LAYERS,
          includeBackground: false,
          entityStyleOverrides: this.getPdfEntityStyleOverrides()
        }),
      compose: pages => composer.compose(pages.map(bytes => ({ bytes }))),
      restore: async location => {
        try {
          if (location) {
            await this.activateWorkspacePhase(
              location.processId,
              location.sequenceId,
              location.phaseId,
              false
            )
          }
        } finally {
          AcApDocManager.instance.curView.zoomTo(originalViewBox, 1)
        }
      }
    })
    const handleResult = async (
      result: PhaseReportExportResult
    ): Promise<PhaseReportExportResult> => {
      if (signal.aborted) return { status: 'canceled' }
      if (result.status === 'completed') {
        this.downloadReportFile(result.fileName, result.bytes)
      } else if (result.status === 'failed') {
        const retry = result.retry
        return {
          ...result,
          retry: async options => handleResult(await retry(options))
        }
      }
      return result
    }
    const result = await exporter.export(workspace, manifest, {
      mode,
      signal,
      onProgress
    })
    return handleResult(result)
  }

  private downloadReportFile(fileName: string, bytes: Uint8Array) {
    const type = fileName.endsWith('.zip')
      ? 'application/zip'
      : 'application/pdf'
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    const blob = new Blob([buffer], { type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    queueMicrotask(() => URL.revokeObjectURL(url))
  }

  private setDrawingBackground(enabled: boolean) {
    const view = AcApDocManager.instance.curView as AcTrView2d
    const doc = AcApDocManager.instance.curDocument
    const color = new AcCmColor(AcCmColorMethod.ByColor)
    color.setRGB(enabled ? 255 : 0, enabled ? 255 : 0, enabled ? 255 : 0)

    if (doc) {
      const variableName = layoutBackgroundSysVar(
        view.activeLayoutBtrId === view.modelSpaceBtrId
      )
      AcDbSysVarManager.instance().setVar(variableName, color, doc.database)
    } else {
      view.backgroundColor = enabled ? 0xffffff : 0x000000
    }
  }

  private setupDockMenu() {
    this.dockButton.addEventListener('click', event => {
      event.stopPropagation()
      void this.toggleDockMenu()
    })

    this.dockOpenToggle.addEventListener('click', event => {
      event.stopPropagation()
      void this.toggleDockPanelOpen()
    })

    this.dockAddTabButton.addEventListener('click', event => {
      event.stopPropagation()
      void this.addDemoDockTab()
    })

    this.dockSizeInput.addEventListener('change', () => {
      void this.applyDockPanelSize()
    })

    document.addEventListener('pointerdown', event => {
      if (!this.dockMenuOpen) return
      if (!(event.target instanceof Node)) return
      if (
        this.dockMenu.contains(event.target) ||
        this.dockButton.contains(event.target)
      ) {
        return
      }
      this.closeDockMenu()
    })
  }

  private async toggleDockMenu() {
    if (this.dockMenuOpen) {
      this.closeDockMenu()
      return
    }
    this.closeViewerToolbarMenu()
    await this.initialize()
    if (!this.isDevToolbarEnabled()) return
    this.openDockMenu()
  }

  private openDockMenu() {
    this.syncDockMenuState()
    this.dockMenu.hidden = false
    this.positionToolbarMenu(this.dockButton, this.dockMenu)
    this.dockMenuOpen = true
    this.dockButton.setAttribute('aria-expanded', 'true')
  }

  private closeDockMenu() {
    this.dockMenu.hidden = true
    this.dockMenuOpen = false
    this.dockButton.setAttribute('aria-expanded', 'false')
  }

  private isDockSizeVertical(side: AcExDockPanelSide | undefined): boolean {
    return side === 'top' || side === 'bottom'
  }

  private async toggleDockPanelOpen() {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    const nextOpen = !plugin.isDockPanelOpen()
    if (nextOpen) {
      if (!plugin.setDockPanelOpen(true)) {
        this.showMessage('Dock panel is not available', 'error')
        return
      }
    } else if (!plugin.setDockPanelOpen(false)) {
      this.showMessage('Dock panel is not available', 'error')
      return
    }

    this.syncDockMenuState()
    this.showMessage(
      nextOpen ? 'Dock panel opened' : 'Dock panel closed',
      'success'
    )
  }

  private async addDemoDockTab() {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    this.demoDockTabCount += 1
    const tabNumber = this.demoDockTabCount
    const tabId = `demo-${tabNumber}`

    const added = plugin.addDockPanelTab({
      id: tabId,
      label: `Demo ${tabNumber}`,
      content: createDemoDockTabPanel(tabNumber, () => this.appLocale)
    })

    if (!added) {
      this.demoDockTabCount -= 1
      this.showMessage('Failed to add dock tab', 'error')
      return
    }

    this.syncDockMenuState()
    this.showMessage(`Added dock tab: Demo ${tabNumber}`, 'success')
  }

  private async applyDockPanelSize() {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    const size = Number.parseInt(this.dockSizeInput.value, 10)
    if (!Number.isFinite(size) || size < 120) {
      this.syncDockMenuState()
      this.showMessage('Dock size must be at least 120px', 'error')
      return
    }

    if (!plugin.setDockPanelSize(size)) {
      this.showMessage('Dock panel is not available', 'error')
      return
    }

    this.syncDockMenuState()
    const side = plugin.getDockPanelSide()
    const dimension = this.isDockSizeVertical(side) ? 'height' : 'width'
    this.showMessage(`Dock ${dimension}: ${size}px`, 'success')
  }

  private syncDockMenuState() {
    const plugin = this.getSimpleUiPlugin()
    const enabled = this.isDevToolbarEnabled() && Boolean(plugin)
    const isOpen = plugin?.isDockPanelOpen() ?? false
    const side = plugin?.getDockPanelSide()
    const size =
      plugin?.getDockPanelSize() ?? (this.isDockSizeVertical(side) ? 240 : 280)

    this.dockButton.disabled = !enabled
    this.dockOpenToggle.disabled = !enabled
    this.dockAddTabButton.disabled = !enabled
    this.dockOpenToggle.textContent = isOpen ? 'Close Dock' : 'Open Dock'
    this.dockSizeInput.disabled = !enabled
    this.dockSizeInput.value = String(size)
    this.dockSizeLabel.textContent = this.isDockSizeVertical(side)
      ? 'Height (px)'
      : 'Width (px)'
    this.dockButton.textContent = 'Dock'
  }

  private setupViewerToolbarMenu() {
    this.toolbarLayoutSelect.innerHTML = ''
    for (const layout of getDemoToolbarLayouts(this.appLocale)) {
      const option = document.createElement('option')
      option.value = layout.id
      option.textContent = layout.label
      this.toolbarLayoutSelect.appendChild(option)
    }

    this.toolbarLayoutSelect.addEventListener('click', event => {
      event.stopPropagation()
    })
    this.toolbarLayoutSelect.addEventListener('change', event => {
      event.stopPropagation()
      void this.applyToolbarLayout(this.toolbarLayoutSelect.value)
    })

    this.viewerToolbarButton.addEventListener('click', event => {
      event.stopPropagation()
      void this.toggleViewerToolbarMenu()
    })

    this.viewerToolbarPlacementButtons.forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation()
        const placement = button.dataset.viewerToolbarPlacement as
          | AcExToolbarPlacement
          | undefined
        if (!placement) return
        void this.applyViewerToolbarPlacement(placement)
      })
    })

    this.viewerToolbarVisibilityToggle.addEventListener('click', event => {
      event.stopPropagation()
      void this.toggleViewerToolbarVisibility()
    })

    this.viewerToolbarCollapseToggle.addEventListener('click', event => {
      event.stopPropagation()
      void this.toggleViewerToolbarCollapsed()
    })

    this.viewerToolbarEdgeOffsetInput.addEventListener('change', () => {
      void this.applyViewerToolbarEdgeOffset()
    })

    document.addEventListener('pointerdown', event => {
      if (!this.viewerToolbarMenuOpen) return
      if (!(event.target instanceof Node)) return
      if (
        this.viewerToolbarMenu.contains(event.target) ||
        this.viewerToolbarButton.contains(event.target)
      ) {
        return
      }
      this.closeViewerToolbarMenu()
    })
  }

  private async toggleViewerToolbarMenu() {
    if (this.viewerToolbarMenuOpen) {
      this.closeViewerToolbarMenu()
      return
    }
    this.closeDockMenu()
    await this.initialize()
    if (!this.isDevToolbarEnabled()) return
    this.openViewerToolbarMenu()
  }

  private openViewerToolbarMenu() {
    this.syncViewerToolbarMenuState()
    this.viewerToolbarMenu.hidden = false
    this.positionToolbarMenu(this.viewerToolbarButton, this.viewerToolbarMenu)
    this.viewerToolbarMenuOpen = true
    this.viewerToolbarButton.setAttribute('aria-expanded', 'true')
  }

  private closeViewerToolbarMenu() {
    this.viewerToolbarMenu.hidden = true
    this.viewerToolbarMenuOpen = false
    this.viewerToolbarButton.setAttribute('aria-expanded', 'false')
  }

  private async applyViewerToolbarPlacement(placement: AcExToolbarPlacement) {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    if (!plugin.setToolbarPlacement(placement)) {
      this.showMessage('Viewer toolbar is not available', 'error')
      return
    }

    this.syncViewerToolbarMenuState()
    this.showMessage(`Viewer toolbar position: ${placement}`, 'success')
  }

  private async toggleViewerToolbarVisibility() {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    const nextVisible = !plugin.isToolbarVisible()
    if (!plugin.setToolbarVisible(nextVisible)) {
      this.showMessage('Viewer toolbar is not available', 'error')
      return
    }

    this.syncViewerToolbarMenuState()
    this.showMessage(
      nextVisible ? 'Viewer toolbar shown' : 'Viewer toolbar hidden',
      'success'
    )
  }

  private async toggleViewerToolbarCollapsed() {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    const nextCollapsed = !plugin.isToolbarCollapsed()
    if (!plugin.setToolbarCollapsed(nextCollapsed)) {
      this.showMessage('Viewer toolbar collapse is not available', 'error')
      return
    }

    this.syncViewerToolbarMenuState()
    this.showMessage(
      nextCollapsed ? 'Viewer toolbar collapsed' : 'Viewer toolbar expanded',
      'success'
    )
  }

  private async applyViewerToolbarEdgeOffset() {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    const offset = Number.parseInt(this.viewerToolbarEdgeOffsetInput.value, 10)
    if (!Number.isFinite(offset) || offset < 0) {
      this.syncViewerToolbarMenuState()
      this.showMessage('Edge inset must be a non-negative number', 'error')
      return
    }

    if (!plugin.setToolbarEdgeOffset(offset)) {
      this.showMessage('Viewer toolbar is not available', 'error')
      return
    }

    this.syncViewerToolbarMenuState()
    this.showMessage(`Toolbar edge inset: ${offset}px`, 'success')
  }

  private syncViewerToolbarMenuState() {
    const plugin = this.getSimpleUiPlugin()
    const enabled = this.isDevToolbarEnabled() && Boolean(plugin)
    const placement = plugin?.getToolbarPlacement() ?? 'right'
    const visible = plugin?.isToolbarVisible() ?? true
    const collapsed = plugin?.isToolbarCollapsed() ?? false
    const edgeOffset = plugin?.getToolbarEdgeOffset() ?? 8

    this.viewerToolbarPlacementButtons.forEach(button => {
      const isSelected = button.dataset.viewerToolbarPlacement === placement
      button.classList.toggle('is-selected', enabled && isSelected)
      button.disabled = !enabled
    })

    this.viewerToolbarVisibilityToggle.disabled = !enabled
    this.viewerToolbarVisibilityToggle.textContent = visible
      ? 'Hide Toolbar'
      : 'Show Toolbar'

    this.viewerToolbarCollapseToggle.disabled = !enabled
    this.viewerToolbarCollapseToggle.textContent = collapsed
      ? 'Expand Toolbar'
      : 'Collapse Toolbar'

    this.viewerToolbarEdgeOffsetInput.disabled = !enabled
    this.viewerToolbarEdgeOffsetInput.value = String(edgeOffset)

    this.toolbarLayoutSelect.disabled = !enabled
    if (enabled) {
      this.toolbarLayoutSelect.value = getCurrentDemoToolbarLayoutId()
    }

    this.viewerToolbarButton.textContent = 'Toolbar'
  }

  private openFilePicker() {
    this.fileInput.click()
  }

  private async applyToolbarLayout(presetId: string) {
    await this.initialize()

    const plugin = this.getSimpleUiPlugin()
    if (!plugin) {
      this.showMessage('Simple UI plugin is not loaded', 'error')
      return
    }

    applyDemoToolbarLayout(plugin, presetId, this.appLocale)
    this.syncViewerToolbarMenuState()

    const label =
      getDemoToolbarLayouts(this.appLocale).find(layout => layout.id === presetId)?.label ??
      presetId
    this.showMessage(`Toolbar layout: ${label}`, 'success')
  }

  private updateDevToolbarLabels() {
    const enabled = this.isDevToolbarEnabled()

    this.viewerToolbarButton.disabled = !enabled
    if (!enabled) {
      this.closeViewerToolbarMenu()
      this.closeDockMenu()
    }

    this.devToolbar.classList.toggle('is-disabled', !enabled)
    this.syncViewerToolbarMenuState()
    this.syncDockMenuState()
  }

  private positionToolbarMenu(button: HTMLElement, menu: HTMLElement) {
    if (menu.parentElement !== document.body) {
      document.body.append(menu)
    }
    const buttonRect = button.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const viewportPadding = 8
    const left = Math.min(
      buttonRect.left,
      window.innerWidth - menuRect.width - viewportPadding
    )
    menu.style.top = `${buttonRect.bottom + 4}px`
    menu.style.left = `${Math.max(viewportPadding, left)}px`
    menu.style.maxHeight = `${Math.max(
      120,
      window.innerHeight - buttonRect.bottom - viewportPadding * 2
    )}px`
  }

  private getSimpleUiPlugin(): AcApSimpleUiPlugin | undefined {
    if (!this.isInitialized) return undefined
    return AcApDocManager.instance.pluginManager.getPlugin(
      SIMPLE_UI_PLUGIN_NAME
    ) as AcApSimpleUiPlugin | undefined
  }

  private isDevToolbarEnabled(): boolean {
    return this.hasOpenedFile
  }

  private async initialize() {
    if (this.isInitialized) return

    try {
      applyUiTheme('light', this.viewerPane)

      AcApDocManager.createInstance({
        container: this.container,
        busyIndicatorHost: this.container,
        autoResize: true,
        baseUrl: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/',
        commandAliases: EXAMPLE_COMMAND_ALIASES,
        openDocumentDefaults: {
          minimumChunkSize: 1000,
          progressiveRendering: true,
          mode: AcEdOpenMode.Write,
          openViewMode: AcApOpenViewMode.Extents,
          sysVars: {
            lwdisplay: false
          }
        },
        webworkerFileUrls: {
          mtextRender: './workers/mtext-renderer-worker.js',
          dxfParser: './workers/dxf-parser-worker.js',
          dwgParser: './workers/libredwg-parser-worker.js'
        },
        htmlViewerRuntimeUrl: './viewer-runtime.iife.js'
      })

      registerLazyPlugins()

      await registerSimpleUiPlugin(AcApDocManager.instance.pluginManager, {
        host: this.viewerPane,
        dockPanel: {
          defaultOpen: false,
          defaultHeight: 240,
          defaultWidth: 280
        },
        toolbar: {
          placement: 'right',
          items: 'default',
          appendItems: [
            {
              id: 'brush-highlight',
              label: 'toolbar.brush',
              requiresDocument: true,
              icon: () => {
                const icon = document.createElement('span')
                icon.append(createPhaseIcon(Brush))
                return icon
              },
              action: () => this.brushHighlightFeature?.activate('paint')
            },
            {
              id: 'brush-erase',
              label: 'toolbar.eraser',
              requiresDocument: true,
              icon: () => {
                const icon = document.createElement('span')
                icon.append(createPhaseIcon(Eraser))
                return icon
              },
              action: () => this.brushHighlightFeature?.activate('erase')
            },
            createAgentToolbarItem(this.appLocale)
          ],
          appendItemsAfter: 'layer',
          collapsible: true
        }
      })

      const plugin = AcApDocManager.instance.pluginManager.getPlugin(
        SIMPLE_UI_PLUGIN_NAME
      ) as AcApSimpleUiPlugin
      injectUiReferenceThemeStyles()
      setupAgentIntegration(plugin)
      await this.loadProcessAssistantWorkspace()
      this.setupPhaseWorkspace()
      this.setupValveDebugFeature()
      this.setupBrushHighlightFeature()

      AcApDocManager.instance.events.documentActivated.addEventListener(
        args => {
          document.title = args.doc.docTitle
          this.onFileOpened()
          this.syncAppToolbarContext()
          if (!this.applyPendingPhaseState()) {
            this.invalidateLoadedPhaseBinding()
          }
          this.finishLoadingState()
          this.updateDevToolbarLabels()
        }
      )

      AcApDocManager.instance.events.documentToBeOpened.addEventListener(() => {
        this.setLoadingState(true)
      })

      this.isInitialized = true
      this.updateDevToolbarLabels()
      document.body.classList.remove('app-booting')
      await this.restoreActiveWorkspacePhase()
    } catch (error) {
      log.error('Failed to initialize CAD viewer:', error)
      this.showMessage('Failed to initialize CAD viewer', 'error')
    } finally {
      document.body.classList.remove('app-booting')
    }
  }

  private async loadProcessAssistantWorkspace(): Promise<void> {
    try {
      const config = getProcessAssistantConfig()
      const projects = await this.projectRepository.list()
      const storedProjectId = Number(
        localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)
      )
      const project =
        projects.find(item => item.id === storedProjectId) ??
        projects.find(item => item.id === config.projectId) ??
        projects[0]
      if (!project) {
        this.clearProjectWorkspace()
        this.showMessage('后台没有可用的 Project', 'info')
        return
      }
      await this.loadProjectWorkspace(project)
      this.showMessage('已加载后台 Process 数据', 'success')
    } catch (error) {
      log.error('Failed to load ProcessAssistant workspace:', error)
      this.showMessage('后台 API 不可用，未加载本地测试数据', 'error')
    }
  }

  private async switchProject(project: ProjectRecord): Promise<void> {
    if (project.id === this.activeProjectId) {
      const shouldReloadActiveWorkspace =
        this.phaseRepository !== undefined &&
        (!this.activeProject ||
          this.activeProject.name !== project.name ||
          this.activeProject.description !== project.description ||
          !areEqualNumberSets(this.activeProject.fileIds, project.fileIds))
      if (shouldReloadActiveWorkspace) {
        await this.loadProjectWorkspace(project, true)
        this.syncAppToolbarContext()
        return
      }
      this.activeProject = project
      this.projectManagementButton.title = project.name
      this.phasePanel?.render()
      this.syncAppToolbarContext()
      return
    }
    try {
      await this.loadProjectWorkspace(project, true)
      this.showMessage(`已切换到 Project：${project.name}`, 'success')
    } catch (error) {
      log.error('Failed to switch Project:', error)
      this.showMessage('切换 Project 失败', 'error')
    }
  }

  private async loadProjectWorkspace(
    project: ProjectRecord,
    restorePhase = false
  ): Promise<void> {
    const token = ++this.projectLoadToken
    this.cancelAllBackendPhaseSaves()
    this.invalidateLoadedPhaseBinding()
    const config = getProcessAssistantConfig()
    const repository = new PhaseWorkspaceRepository({
      baseUrl: config.baseUrl,
      projectId: project.id,
      files: this.processAssistantFileApi,
      procedures: this.processAssistantProcedureApi,
      operations: this.processAssistantOperationApi,
      phases: this.processAssistantPhaseApi
    })
    const workspace = await repository.load()
    if (token !== this.projectLoadToken) return
    this.phaseRepository = repository
    this.phaseStore = new PhaseWorkspaceStore(workspace)
    this.activeProject = project
    this.activeProjectId = project.id
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, String(project.id))
    this.projectManagementButton.title = project.name
    this.phasePanel?.render()
    this.syncPhaseContextBar()
    if (restorePhase && this.isInitialized) {
      await this.restoreActiveWorkspacePhase()
    }
  }

  private async handleDeletedProject(projectId: number): Promise<void> {
    if (projectId !== this.activeProjectId) return
    const replacement = (await this.projectRepository.list())[0]
    if (replacement) {
      await this.loadProjectWorkspace(replacement, true)
      return
    }
    this.clearProjectWorkspace()
  }

  private clearProjectWorkspace(): void {
    this.projectLoadToken++
    this.cancelAllBackendPhaseSaves()
    this.invalidateLoadedPhaseBinding()
    this.phaseRepository = undefined
    this.phaseStore = new PhaseWorkspaceStore()
    this.activeProject = undefined
    this.activeProjectId = undefined
    localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY)
    this.projectManagementButton.removeAttribute('title')
    this.phasePanel?.render()
    this.syncPhaseContextBar()
  }

  private cancelAllBackendPhaseSaves(): void {
    for (const timer of this.backendPhaseSaveTimers.values()) {
      window.clearTimeout(timer)
    }
    this.backendPhaseSaveTimers.clear()
  }

  private setupPhaseWorkspace() {
    injectPhaseWorkspaceStyles()
    this.phasePanel = new PhaseWorkspacePanel(
      () => this.phaseStore.snapshot(),
      {
        createProcess: name => {
          void this.createBackendProcess(name)
        },
        deleteProcess: processId => this.deleteWorkspaceProcess(processId),
        createSequence: request => {
          void this.createWorkspaceSequence(request)
        },
        copySequence: request => {
          void this.copyWorkspaceSequence(request)
        },
        renameSequence: (processId, sequenceId, name) => {
          if (this.phaseRepository) {
            void this.renameBackendSequence(processId, sequenceId, name)
            return
          }
          this.phaseStore.renameSequence(processId, sequenceId, name)
          this.phaseStore.persist()
          this.phasePanel?.render()
          this.syncPhaseContextBar()
        },
        deleteSequence: (processId, sequenceId) =>
          this.deleteWorkspaceSequence(processId, sequenceId),
        reorderSequence: (processId, sequenceId, targetIndex) => {
          if (this.phaseRepository) {
            void this.reorderBackendSequence(processId, sequenceId, targetIndex)
            return
          }
          this.phaseStore.reorderSequence(processId, sequenceId, targetIndex)
          this.phaseStore.persist()
          this.phasePanel?.render()
          this.syncPhaseContextBar()
        },
        activateSequence: (processId, sequenceId) =>
          this.activateWorkspaceSequence(processId, sequenceId),
        createPhase: request => this.createWorkspacePhase(request),
        copyPhase: request => this.copyWorkspacePhase(request),
        associateDrawing: request => this.associateWorkspaceDrawing(request),
        activateProcess: processId => this.activateWorkspaceProcess(processId),
        activatePhase: (processId, sequenceId, phaseId) =>
          this.activateWorkspacePhase(processId, sequenceId, phaseId, false),
        reorderPhase: (processId, sequenceId, phaseId, targetIndex) => {
          if (this.phaseRepository) {
            void this.reorderBackendPhase(
              processId,
              sequenceId,
              phaseId,
              targetIndex
            )
            return
          }
          this.phaseStore.reorderPhase(
            processId,
            sequenceId,
            phaseId,
            targetIndex
          )
          this.phaseStore.persist()
          this.syncPhaseContextBar()
        },
        renamePhase: (processId, sequenceId, phaseId, name) => {
          if (this.phaseRepository) {
            void this.renameBackendPhase(processId, sequenceId, phaseId, name)
            return
          }
          this.phaseStore.renamePhase(processId, sequenceId, phaseId, name)
          this.phaseStore.persist()
          this.phasePanel?.render()
          this.syncPhaseContextBar()
          const isLoaded =
            this.loadedPhase?.processId === processId &&
            this.loadedPhase.sequenceId === sequenceId &&
            this.loadedPhase.phaseId === phaseId
          if (isLoaded) {
            const phase = this.phaseStore
              .snapshot()
              .processes.find(process => process.id === processId)
              ?.sequences.find(item => item.id === sequenceId)
              ?.phases.find(item => item.id === phaseId)
            if (phase) {
              document.title = `${phase.drawing.kind === 'assigned'
                ? phase.drawing.displayName
                : '未关联图纸'
                } · ${phase.name}`
            }
          }
        },
        deletePhase: (processId, sequenceId, phaseId) =>
          this.deleteWorkspacePhase(processId, sequenceId, phaseId),
        renameDrawing: (processId, sequenceId, phaseId, name) => {
          if (this.phaseRepository) {
            void this.renameBackendDrawing(processId, sequenceId, phaseId, name)
            return
          }
          this.phaseStore.renameDrawing(processId, sequenceId, phaseId, name)
          this.phaseStore.persist()
          const isLoaded =
            this.loadedPhase?.processId === processId &&
            this.loadedPhase.sequenceId === sequenceId &&
            this.loadedPhase.phaseId === phaseId
          if (isLoaded) document.title = name
        }
      },
      () => this.appLocale,
      () => this.activeProject?.fileIds ?? []
    )
    const mount = document.getElementById('phaseWorkspaceMount')
    if (!mount) throw new Error('Phase workspace mount was not found')
    mount.replaceChildren(this.phasePanel.element)
    const styleButton = document.getElementById(
      'phaseHighlightStyleButton'
    ) as HTMLButtonElement | null
    if (!styleButton) throw new Error('Highlight style button was not found')
    styleButton.replaceChildren(createPhaseIcon(Palette))
    styleButton.addEventListener('click', () => {
      const state = this.phaseStore.snapshot()
      const process = state.processes.find(
        item => item.id === state.activeProcessId
      )
      if (process) this.openHighlightStyleDialog(process.id)
    })
    const sidebar = document.querySelector<HTMLElement>('.phase-sidebar')
    const resizeHandle = document.getElementById('phaseSidebarResizeHandle')
    const compactToggle = document.getElementById(
      'phaseSidebarToggleButton'
    ) as HTMLButtonElement | null
    const compactScrim = document.getElementById('phaseSidebarScrim')
    if (!sidebar || !resizeHandle || !compactToggle || !compactScrim) {
      throw new Error('Phase sidebar resize controls were not found')
    }
    setupPhaseSidebarResize(sidebar, resizeHandle)
    setupCompactPhaseSidebar(
      sidebar,
      compactToggle,
      compactScrim,
      ML_UI_COMPACT_MAX_WIDTH
    )
    this.setupPhaseContextBar()
    this.syncPhaseContextBar()
  }

  private setupValveDebugFeature() {
    const panelHost = document.querySelector<HTMLElement>('.app-shell')
    if (!panelHost) throw new Error('App shell was not found')

    this.valveDebugFeature = createValveDebugFeature({
      panelHost,
      graphDocument: flowConnectionDocument,
      getView: () => {
        const view = AcApDocManager.instance.curView
        return view ? (view as unknown as ValveDebugView) : undefined
      },
      resolveObjectId: handleKey => this.resolveObjectIdByHandleKey(handleKey),
      resolveHandleKeys: objectId => handleKeysFromObjectId(objectId),
      createOverlay: (objectIds, kind) =>
        this.createValveDebugOverlay(objectIds, kind),
      zoomToObject: objectId => this.zoomToValveDebugObject(objectId),
      getLabels: locale => defaultValveDebugLabels(locale),
      getLocale: () => this.appLocale as ValveDebugLocale
    })
    this.valveDebugFeature.attach()
  }

  private setupBrushHighlightFeature() {
    this.brushHighlightFeature = new BrushHighlightFeature({
      getView: () => AcApDocManager.instance.curView,
      getHighlightStyle: objectId =>
        this.resolveBrushHighlightStyle(objectId),
      createOverlay: (objectIds, style) =>
        this.createBrushHighlightOverlay(objectIds, style),
      setOperationCursor: (view, operation) => {
        view.canvas.style.cursor = this.createBrushCursor(operation)
      }
    })
    this.brushHighlightFeature.attach()
  }

  private createBrushCursor(operation: BrushOperation) {
    const icon = createPhaseIcon(operation === 'paint' ? Brush : Eraser)
    icon.setAttribute('width', '24')
    icon.setAttribute('height', '24')
    icon.setAttribute('stroke', '#17262b')
    const svg = icon.outerHTML.replace(/currentColor/g, '#17262b')
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`
  }

  private resolveBrushHighlightStyle(objectId: AcDbObjectId) {
    return this.resolvePresentationForObjectId(objectId, undefined, {
      id: `brush-${String(objectId)}`,
      name: 'Brush',
      handleKeys: handleKeysFromObjectId(objectId),
      styleOverride: { ...CONNECTED_FLOW_STYLE }
    })
  }

  private createBrushHighlightOverlay(
    objectIds: readonly AcDbObjectId[],
    style: ResolvedEntityPresentation
  ): BrushHighlightOverlay | null {
    const view = AcApDocManager.instance.curView
    const layout = view?.cadScene.activeLayout
    if (!view || !layout || objectIds.length === 0) return null

    const root = layout.createEntityPreviewRoot([...new Set(objectIds)], {
      missingEntity: 'skip'
    }) as PreviewRoot | null
    if (!root) return null

    root.name = 'BrushHighlight'
    upgradePreviewWideLines(root, style, view.width, view.height)
    this.phasePresentationController.apply(
      root as unknown as Parameters<PhasePresentationController['apply']>[0],
      style
    )
      ; (layout.internalObject as LayoutObjectHost).add(root)
    view.isDirty = true

    return {
      dispose: () => {
        root.removeFromParent()
        this.disposePreviewRoot(root)
        view.isDirty = true
      }
    }
  }

  private createValveDebugOverlay(
    objectIds: readonly AcDbObjectId[],
    kind: 'path' | 'locator'
  ): ValveDebugOverlay | null {
    const view = AcApDocManager.instance.curView
    const layout = view?.cadScene.activeLayout
    if (!view || !layout || objectIds.length === 0) return null

    const root = layout.createEntityPreviewRoot([...new Set(objectIds)], {
      missingEntity: 'skip'
    }) as PreviewRoot | null
    if (!root) return null

    // Adjacent P&ID segments often share an endpoint and the same layer name
    // (for example, several entries named `0`). The locator line alone can
    // therefore look like one continuous line at the current zoom. Add a
    // short-lived cyan bounds frame for a locator so the selected entity is
    // unambiguous without changing the CAD camera.
    if (kind === 'locator' && objectIds.length === 1) {
      const bounds = layout.computeEntityPreviewBounds2d([...objectIds], 1)
      if (
        bounds &&
        Number.isFinite(bounds.min.x) &&
        Number.isFinite(bounds.min.y) &&
        Number.isFinite(bounds.max.x) &&
        Number.isFinite(bounds.max.y)
      ) {
        const width = Math.abs(bounds.max.x - bounds.min.x)
        const height = Math.abs(bounds.max.y - bounds.min.y)
        const padding = Math.max(Math.max(width, height) * 0.06, 1)
        const minX = bounds.min.x - padding
        const minY = bounds.min.y - padding
        const maxX = bounds.max.x + padding
        const maxY = bounds.max.y + padding
        const frameGeometry = new LineSegmentsGeometry()
        frameGeometry.setPositions([
          minX, minY, 0,
          maxX, minY, 0,
          maxX, minY, 0,
          maxX, maxY, 0,
          maxX, maxY, 0,
          minX, maxY, 0,
          minX, maxY, 0,
          minX, minY, 0
        ])
        const frameMaterial = new LineMaterial({
          color: 0x00bcd4,
          linewidth: 5,
          transparent: true,
          opacity: 1,
          depthTest: false,
          depthWrite: false
        })
        frameMaterial.resolution.set(Math.max(1, view.width), Math.max(1, view.height))
        const frame = new LineSegments2(frameGeometry, frameMaterial)
        frame.name = 'ValveDebugLocatorBounds'
        frame.userData.disposeGeometryOnRemove = true
          ; (root as unknown as THREE.Object3D).add(frame)
      }
    }

    const style: ResolvedEntityPresentation =
      kind === 'path'
        ? {
          key: 'valve-debug-path',
          color: CONNECTED_FLOW_STYLE.color,
          lineWidthPx: CONNECTED_FLOW_STYLE.lineWidthPx,
          opacity: CONNECTED_FLOW_STYLE.opacity,
          visible: true,
          source: 'flow'
        }
        : {
          key: 'valve-debug-locator',
          color: 0x00bcd4,
          lineWidthPx: 5,
          opacity: 1,
          visible: true,
          source: 'flow'
        }

    root.name = kind === 'path' ? 'ValveDebugPathHighlight' : 'ValveDebugLocator'
    upgradePreviewWideLines(root, style, view.width, view.height)
    this.phasePresentationController.apply(
      root as unknown as Parameters<PhasePresentationController['apply']>[0],
      style
    )
      ; (layout.internalObject as LayoutObjectHost).add(root)
    view.isDirty = true

    return {
      dispose: () => {
        root.removeFromParent()
        this.disposePreviewRoot(root)
        view.isDirty = true
      },
      setVisible: visible => {
        root.visible = visible
        view.isDirty = true
      }
    }
  }

  private zoomToValveDebugObject(objectId: AcDbObjectId) {
    const view = AcApDocManager.instance.curView
    const box = view?.cadScene.computeEntityPreviewBounds2d([objectId], 1.6)
    if (!view || !box) return false
    view.zoomTo(box, 1)
    view.isDirty = true
    return true
  }

  private async createBackendProcess(name: string): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) {
      this.showMessage('后台 API 尚未初始化，无法创建 Process', 'error')
      return
    }
    try {
      const processId = await repository.createProcess(name)
      const workspace = await repository.load()
      this.phaseStore = new PhaseWorkspaceStore(workspace)
      this.phaseStore.activate(String(processId))
      this.phasePanel?.render()
      this.syncPhaseContextBar()
      this.showMessage('Process 已保存到后台', 'success')
    } catch (error) {
      log.error('Failed to create backend Process:', error)
      this.showMessage('Process 保存失败', 'error')
    }
  }

  private setupPhaseContextBar() {
    const processSelect = document.getElementById(
      'phaseContextProcess'
    ) as HTMLSelectElement | null
    const sequenceSelect = document.getElementById(
      'phaseContextSequence'
    ) as HTMLSelectElement | null
    const phaseSelect = document.getElementById(
      'phaseContextPhase'
    ) as HTMLSelectElement | null
    const saveButton = document.getElementById(
      'phaseContextSave'
    ) as HTMLButtonElement | null
    if (!processSelect || !sequenceSelect || !phaseSelect || !saveButton) {
      throw new Error('Phase context controls were not found')
    }
    saveButton.prepend(createPhaseIcon(Save))
    saveButton.addEventListener('click', () => {
      this.captureLoadedPhaseState()
      this.showMessage(translate(this.appLocale, 'phaseSaved'), 'success')
    })
    processSelect.addEventListener('change', () => {
      if (processSelect.value) {
        void this.activateWorkspaceProcess(processSelect.value)
      }
    })
    sequenceSelect.addEventListener('change', () => {
      const state = this.phaseStore.snapshot()
      const process = state.processes.find(
        item => item.id === state.activeProcessId
      )
      if (process && sequenceSelect.value) {
        void this.activateWorkspaceSequence(process.id, sequenceSelect.value)
      }
    })
    phaseSelect.addEventListener('change', () => {
      const state = this.phaseStore.snapshot()
      const process = state.processes.find(
        item => item.id === state.activeProcessId
      )
      if (process?.activeSequenceId && phaseSelect.value) {
        void this.activateWorkspacePhase(
          process.id,
          process.activeSequenceId,
          phaseSelect.value
        )
      }
    })
  }

  private syncPhaseContextBar() {
    const processSelect = document.getElementById(
      'phaseContextProcess'
    ) as HTMLSelectElement | null
    const sequenceSelect = document.getElementById(
      'phaseContextSequence'
    ) as HTMLSelectElement | null
    const phaseSelect = document.getElementById(
      'phaseContextPhase'
    ) as HTMLSelectElement | null
    const summary = document.getElementById('phaseContextSummary')
    const status = document.querySelector('#phaseContextStatus span')
    const saveButton = document.getElementById(
      'phaseContextSave'
    ) as HTMLButtonElement | null
    const styleButton = document.getElementById(
      'phaseHighlightStyleButton'
    ) as HTMLButtonElement | null
    if (!processSelect || !sequenceSelect || !phaseSelect || !summary || !status) return

    const state = this.phaseStore.snapshot()
    const process = state.processes.find(
      item => item.id === state.activeProcessId
    )
    const sequence = process?.sequences.find(
      item => item.id === process.activeSequenceId
    )
    processSelect.replaceChildren(
      ...state.processes.map(item => new Option(item.name, item.id))
    )
    processSelect.disabled = state.processes.length === 0
    processSelect.value = process?.id ?? ''
    sequenceSelect.replaceChildren(
      ...(process?.sequences.map(
        item =>
          new Option(
            `${this.appLocale === 'zh' ? '序列' : 'Sequence'} ${String(
              item.number
            ).padStart(2, '0')} · ${item.name}`,
            item.id
          )
      ) ?? [])
    )
    sequenceSelect.disabled = !process || process.sequences.length === 0
    sequenceSelect.value = sequence?.id ?? ''
    phaseSelect.replaceChildren(
      ...(sequence?.phases.map(
        phase =>
          new Option(
            `Phase ${String(phase.number).padStart(2, '0')} · ${phase.name}`,
            phase.id
          )
      ) ?? [])
    )
    phaseSelect.disabled = !sequence || sequence.phases.length === 0
    phaseSelect.value = sequence?.activePhaseId ?? ''
    if (saveButton) saveButton.disabled = !sequence?.activePhaseId
    if (styleButton) {
      styleButton.disabled = !process
      styleButton.setAttribute('aria-haspopup', 'dialog')
    }
    summary.textContent = sequence
      ? `${sequence.phases.length} ${translate(this.appLocale, 'phaseCount')}`
      : translate(this.appLocale, 'noProcess')
    status.textContent = sequence?.activePhaseId
      ? translate(this.appLocale, 'phaseSaved')
      : process
        ? translate(this.appLocale, 'noPhase')
        : translate(this.appLocale, 'waitingProcess')
    this.syncAppToolbarContext()
  }

  private syncAppToolbarContext() {
    const projectValue = document.getElementById('appToolbarProjectValue')
    const drawingValue = document.getElementById('appToolbarDrawingValue')
    if (!projectValue || !drawingValue) return
    projectValue.textContent =
      this.activeProject?.name ?? translate(this.appLocale, 'noProjectSelected')

    const state = this.phaseStore.snapshot()
    const process = state.processes.find(
      item => item.id === state.activeProcessId
    )
    const sequence = process?.sequences.find(
      item => item.id === process.activeSequenceId
    )
    const phase = sequence?.phases.find(
      item => item.id === sequence.activePhaseId
    )
    drawingValue.textContent =
      phase?.drawing.kind === 'assigned'
        ? phase.drawing.displayName
        : this.hasOpenedFile
          ? document.title.split(' · ')[0]
          : translate(this.appLocale, 'noDrawingOpen')
  }

  private async activateWorkspaceProcess(processId: string) {
    this.captureLoadedPhaseState()
    const process = this.phaseStore
      .snapshot()
      .processes.find(item => item.id === processId)
    if (!process) return
    const sequence = process.sequences.find(
      item => item.id === process.activeSequenceId
    )
    this.phaseStore.activate(processId, sequence?.id, sequence?.activePhaseId)
    this.phaseStore.persist()
    this.phasePanel?.render()
    this.syncPhaseContextBar()
    if (sequence?.activePhaseId) {
      await this.activateWorkspacePhase(
        processId,
        sequence.id,
        sequence.activePhaseId
      )
    }
  }

  private async deleteWorkspaceProcess(processId: string) {
    this.captureLoadedPhaseState()
    if (this.phaseRepository) {
      await this.deleteBackendProcess(processId)
      return
    }
    const stateBeforeDelete = this.phaseStore.snapshot()
    const process = stateBeforeDelete.processes.find(item => item.id === processId)
    if (!process) throw new Error('Process was not found')
    const wasActive = stateBeforeDelete.activeProcessId === processId
    const wasLoaded = this.loadedPhase?.processId === processId
    const deleted = this.phaseStore.deleteProcess(processId)
    const stateAfterDelete = this.phaseStore.snapshot()
    this.phaseStore.persist()
    this.reportStore.reconcile(stateAfterDelete)
    this.reportStore.persist()

    await Promise.all(
      deleted.sequences.flatMap(sequence =>
        sequence.phases.map(async phase => {
          if (phase.drawing.kind !== 'assigned') return
          const drawing = stateBeforeDelete.drawingAssets[phase.drawing.assetId]
          if (
            drawing?.kind === 'local' &&
            !stateAfterDelete.drawingAssets[phase.drawing.assetId]
          ) {
            await this.drawingAssetStore.delete(phase.drawing.assetId)
          }
        })
      )
    )

    if (wasLoaded) this.invalidateLoadedPhaseBinding()
    this.phasePanel?.render()
    this.syncPhaseContextBar()
    if (!wasActive) return

    const nextProcess = stateAfterDelete.processes.find(
      item => item.id === stateAfterDelete.activeProcessId
    )
    const nextSequence = nextProcess?.sequences.find(
      item => item.id === nextProcess.activeSequenceId
    )
    if (nextProcess && nextSequence?.activePhaseId) {
      await this.activateWorkspaceProcess(nextProcess.id)
      return
    }

    this.invalidateLoadedPhaseBinding()
    const command = new AcApQNewCmd()
    await command.execute(AcApDocManager.instance.context)
    document.title = 'CAD Viewer'
  }

  private async deleteBackendProcess(processId: string): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    try {
      const wasLoaded = this.loadedPhase?.processId === processId
      await repository.deleteProcess(processId)
      const workspace = await repository.load()
      this.phaseStore = new PhaseWorkspaceStore(workspace)
      this.phaseStore.persist()
      this.reportStore.reconcile(workspace)
      this.reportStore.persist()
      if (wasLoaded) this.invalidateLoadedPhaseBinding()
      this.phasePanel?.render()
      this.syncPhaseContextBar()
      this.showMessage('Process 已从后台删除', 'success')
    } catch (error) {
      log.error('Failed to delete backend Process:', error)
      this.showMessage('Process 删除失败', 'error')
      throw error
    }
  }

  private async createWorkspaceSequence(request: NewSequenceRequest) {
    this.captureLoadedPhaseState()
    if (this.phaseRepository) {
      try {
        const sequenceId = await this.phaseRepository.createSequence(request)
        const workspace = await this.phaseRepository.load()
        this.phaseStore = new PhaseWorkspaceStore(workspace)
        this.phaseStore.activate(request.processId, String(sequenceId))
        this.phaseStore.persist()
        this.phasePanel?.render()
        this.syncPhaseContextBar()
        this.showMessage('Sequence 已保存到后台', 'success')
      } catch (error) {
        log.error('Failed to create backend Sequence:', error)
        this.showMessage('Sequence 保存失败', 'error')
      }
      return
    }
    const sequence = this.phaseStore.createSequence(
      request.processId,
      request.number,
      request.name
    )
    this.phaseStore.persist()
    await this.activateWorkspaceSequence(request.processId, sequence.id)
  }

  private async renameBackendSequence(
    processId: string,
    sequenceId: string,
    name: string
  ): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    try {
      const process = this.phaseStore
        .snapshot()
        .processes.find(item => item.id === processId)
      const sequenceIndex = process?.sequences.findIndex(
        item => item.id === sequenceId
      )
      const sequence =
        sequenceIndex !== undefined && sequenceIndex >= 0
          ? process?.sequences[sequenceIndex]
          : undefined
      if (!sequence) throw new Error('Sequence was not found')
      await repository.updateSequence(
        processId,
        { ...sequence, name },
        sequenceIndex! + 1
      )
      await this.reloadBackendWorkspace(processId, sequenceId)
      this.showMessage('Sequence 已更新', 'success')
    } catch (error) {
      log.error('Failed to rename backend Sequence:', error)
      this.showMessage('Sequence 更新失败', 'error')
    }
  }

  private async reorderBackendSequence(
    processId: string,
    sequenceId: string,
    targetIndex: number
  ): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    try {
      const process = this.phaseStore
        .snapshot()
        .processes.find(item => item.id === processId)
      if (!process) throw new Error('Process was not found')
      const sequences = [...process.sequences]
      const currentIndex = sequences.findIndex(item => item.id === sequenceId)
      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= sequences.length
      ) {
        throw new Error('Sequence target index is out of range')
      }
      const [sequence] = sequences.splice(currentIndex, 1)
      sequences.splice(targetIndex, 0, sequence)
      await Promise.all(
        sequences.map((item, index) =>
          repository.updateSequence(processId, item, index + 1)
        )
      )
      await this.reloadBackendWorkspace(processId, sequenceId)
      this.showMessage('Sequence 顺序已更新', 'success')
    } catch (error) {
      log.error('Failed to reorder backend Sequence:', error)
      this.showMessage('Sequence 排序失败', 'error')
    }
  }

  private async reloadBackendWorkspace(
    processId?: string,
    sequenceId?: string,
    phaseId?: string
  ): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    const workspace = await repository.load()
    this.phaseStore = new PhaseWorkspaceStore(workspace)
    if (processId) this.phaseStore.activate(processId, sequenceId, phaseId)
    this.phaseStore.persist()
    this.phasePanel?.render()
    this.syncPhaseContextBar()
  }

  private async copyWorkspaceSequence(request: CopySequenceRequest) {
    if (this.phaseRepository) {
      try {
        this.captureLoadedPhaseState()
        const process = this.phaseStore
          .snapshot()
          .processes.find(item => item.id === request.processId)
        const source = process?.sequences.find(
          item => item.id === request.sequenceId
        )
        if (!source) throw new Error('Sequence was not found')
        const sequenceId = await this.phaseRepository.createSequence(request)
        for (const [index, phase] of source.phases.entries()) {
          await this.phaseRepository.createPhase({
            sequenceId: String(sequenceId),
            number: phase.number,
            name: phase.name,
            orderIndex: index + 1,
            data: this.phaseRepository.createPhaseData(phase)
          })
        }
        await this.reloadBackendWorkspace(request.processId, String(sequenceId))
        this.showMessage('Sequence 已复制到后台', 'success')
      } catch (error) {
        log.error('Failed to copy backend Sequence:', error)
        this.showMessage('Sequence 复制失败', 'error')
      }
      return
    }
    this.captureLoadedPhaseState()
    const sequence = this.phaseStore.copySequence(
      request.processId,
      request.sequenceId,
      request.number,
      request.name
    )
    this.phaseStore.persist()
    await this.activateWorkspaceSequence(request.processId, sequence.id)
  }

  private async copyWorkspacePhase(request: CopyPhaseRequest) {
    try {
      this.captureLoadedPhaseState()
      if (this.phaseRepository) {
        const source = this.phaseStore
          .snapshot()
          .processes.find(process => process.id === request.processId)
          ?.sequences.find(item => item.id === request.sourceSequenceId)
          ?.phases.find(item => item.id === request.sourcePhaseId)
        if (!source) throw new Error('Source phase was not found')
        const phaseId = await this.phaseRepository.createPhase({
          sequenceId: request.targetSequenceId,
          number: request.number,
          name: request.name,
          data: this.phaseRepository.createPhaseData(source)
        })
        await this.reloadBackendWorkspace(
          request.processId,
          request.targetSequenceId,
          String(phaseId)
        )
        this.showMessage('Phase 已复制到后台', 'success')
        return
      }
      const phase = this.phaseStore.copyPhase(
        request.processId,
        request.sourceSequenceId,
        request.sourcePhaseId,
        request.targetSequenceId,
        request.number,
        request.name
      )
      this.phaseStore.persist()
      this.syncPhaseContextBar()
      await this.activateWorkspacePhase(
        request.processId,
        request.targetSequenceId,
        phase.id
      )
      this.showMessage(`Phase ${phase.number} copied`, 'success')
    } catch (error) {
      log.error('Failed to copy phase:', error)
      this.showMessage(String(error), 'error')
      throw error
    }
  }

  private async activateWorkspaceSequence(
    processId: string,
    sequenceId: string
  ) {
    const process = this.phaseStore
      .snapshot()
      .processes.find(item => item.id === processId)
    const sequence = process?.sequences.find(item => item.id === sequenceId)
    if (!sequence) throw new Error('Sequence was not found')
    if (sequence.activePhaseId) {
      await this.activateWorkspacePhase(
        processId,
        sequenceId,
        sequence.activePhaseId
      )
      return
    }
    this.captureLoadedPhaseState()
    this.phaseStore.activate(processId, sequenceId, sequence.activePhaseId)
    this.phaseStore.persist()
    this.phasePanel?.render()
    this.syncPhaseContextBar()
    this.invalidateLoadedPhaseBinding()
    const command = new AcApQNewCmd()
    await command.execute(AcApDocManager.instance.context)
    document.title = 'CAD Viewer'
  }

  private async deleteWorkspaceSequence(
    processId: string,
    sequenceId: string
  ) {
    this.captureLoadedPhaseState()
    if (this.phaseRepository) {
      try {
        const wasLoaded =
          this.loadedPhase?.processId === processId &&
          this.loadedPhase.sequenceId === sequenceId
        await this.phaseRepository.deleteSequence(sequenceId)
        await this.reloadBackendWorkspace(processId)
        if (wasLoaded) this.invalidateLoadedPhaseBinding()
        this.showMessage('Sequence 已从后台删除', 'success')
      } catch (error) {
        log.error('Failed to delete backend Sequence:', error)
        this.showMessage('Sequence 删除失败', 'error')
        throw error
      }
      return
    }
    const stateBeforeDelete = this.phaseStore.snapshot()
    const sequence = stateBeforeDelete.processes
      .find(process => process.id === processId)
      ?.sequences.find(item => item.id === sequenceId)
    if (!sequence) throw new Error('Sequence was not found')
    const wasActive =
      stateBeforeDelete.activeProcessId === processId &&
      stateBeforeDelete.processes.find(process => process.id === processId)
        ?.activeSequenceId === sequenceId
    const wasLoaded =
      this.loadedPhase?.processId === processId &&
      this.loadedPhase.sequenceId === sequenceId
    const deleted = this.phaseStore.deleteSequence(processId, sequenceId)
    const stateAfterDelete = this.phaseStore.snapshot()
    this.phaseStore.persist()
    await Promise.all(
      deleted.phases.map(async phase => {
        if (phase.drawing.kind !== 'assigned') return
        const drawing = stateBeforeDelete.drawingAssets[phase.drawing.assetId]
        if (drawing?.kind === 'local' && !stateAfterDelete.drawingAssets[phase.drawing.assetId]) {
          await this.drawingAssetStore.delete(phase.drawing.assetId)
        }
      })
    )
    if (wasLoaded) {
      this.invalidateLoadedPhaseBinding()
    }
    this.phasePanel?.render()
    this.syncPhaseContextBar()
    const process = stateAfterDelete.processes.find(item => item.id === processId)
    const nextSequence = process?.sequences.find(
      item => item.id === process.activeSequenceId
    )
    if (wasActive && nextSequence) {
      await this.activateWorkspaceSequence(processId, nextSequence.id)
    } else if (wasActive) {
      const command = new AcApQNewCmd()
      await command.execute(AcApDocManager.instance.context)
      document.title = 'CAD Viewer'
    }
  }

  private async restoreActiveWorkspacePhase() {
    const state = this.phaseStore.snapshot()
    const process = state.processes.find(
      item => item.id === state.activeProcessId
    )
    const sequence = process?.sequences.find(
      item => item.id === process.activeSequenceId
    )
    if (!process || !sequence?.activePhaseId) return
    try {
      await this.activateWorkspacePhase(
        process.id,
        sequence.id,
        sequence.activePhaseId
      )
    } catch (error) {
      log.warn('Unable to restore the active phase drawing:', error)
      this.showMessage('阶段图纸不可用，请重新关联图纸', 'error')
    }
  }

  private async createWorkspacePhase(request: NewPhaseRequest) {
    try {
      if (this.phaseRepository) {
        await this.createBackendPhase(request)
        return
      }
      let source: Parameters<PhaseWorkspaceStore['createPhase']>[0]['source']
      if (request.sourceKind === 'previous') {
        source = {
          kind: 'previous',
          displayName: request.drawingDisplayName
        }
      } else if (request.sourceKind === 'history') {
        if (!request.sourcePhaseId) throw new Error('请选择历史阶段')
        source = {
          kind: 'history',
          phaseId: request.sourcePhaseId,
          displayName: request.drawingDisplayName
        }
      } else if (request.sourceKind === 'unassigned') {
        source = { kind: 'unassigned' }
      } else if (request.sourceKind === 'project') {
        throw new Error('Project PID requires a backend Project')
      } else {
        const drawing = await this.createDrawingAsset(request)
        source = {
          kind: 'new',
          drawing,
          displayName: request.drawingDisplayName
        }
      }
      const phase = this.phaseStore.createPhase({
        processId: request.processId,
        sequenceId: request.sequenceId,
        number: request.number,
        name: request.name,
        source
      })
      this.phaseStore.persist()
      this.syncPhaseContextBar()
      await this.activateWorkspacePhase(
        request.processId,
        request.sequenceId,
        phase.id
      )
      this.showMessage(`Phase ${phase.number} created`, 'success')
    } catch (error) {
      log.error('Failed to create phase:', error)
      this.showMessage(String(error), 'error')
      throw error
    }
  }

  private async createBackendPhase(request: NewPhaseRequest): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    const state = this.phaseStore.snapshot()
    const sequence = state.processes
      .find(process => process.id === request.processId)
      ?.sequences.find(item => item.id === request.sequenceId)
    if (!sequence) throw new Error('Sequence was not found')

    let sourcePhase: (typeof sequence.phases)[number] | undefined
    if (request.sourceKind === 'previous') {
      sourcePhase = sequence.phases[sequence.phases.length - 1]
      if (!sourcePhase) throw new Error('上一 Phase 不存在')
    } else if (request.sourceKind === 'history') {
      sourcePhase = sequence.phases.find(
        phase => phase.id === request.sourcePhaseId
      )
      if (!sourcePhase) throw new Error('历史 Phase 不存在')
    }

    let drawing: { fileId: number; displayName: string } | undefined
    if (request.sourceKind === 'local') {
      if (!request.file) throw new Error('请选择 DWG 文件')
      drawing = await repository.uploadDrawing(request.file)
      if (request.drawingDisplayName.trim()) {
        drawing.displayName = request.drawingDisplayName.trim()
      }
    } else if (request.sourceKind === 'project') {
      if (!Number.isInteger(request.fileId) || (request.fileId ?? 0) < 1) {
        throw new Error('请选择 Project PID')
      }
      const projectFileIds = new Set(this.activeProject?.fileIds ?? [])
      if (!projectFileIds.has(request.fileId!)) {
        throw new Error('所选图纸不属于当前 Project')
      }
      const projectDrawing = state.drawingAssets[`file:${request.fileId}`]
      if (!projectDrawing) throw new Error('所选 Project PID 不存在')
      drawing = {
        fileId: request.fileId!,
        displayName:
          request.drawingDisplayName.trim() || projectDrawing.sourceName
      }
    } else if (request.sourceKind === 'url' || request.sourceKind === 'blank') {
      throw new Error('实际后台仅支持上传文件，暂不支持 URL 或空白图纸')
    }

    const phaseId = await repository.createPhase({
      sequenceId: request.sequenceId,
      number: request.number,
      name: request.name,
      data: repository.createPhaseData(sourcePhase, drawing)
    })
    await this.reloadBackendWorkspace(
      request.processId,
      request.sequenceId,
      String(phaseId)
    )
    await this.activateWorkspacePhase(
      request.processId,
      request.sequenceId,
      String(phaseId),
      false
    )
    this.showMessage(`Phase ${request.number} 已保存到后台`, 'success')
  }

  private async deleteWorkspacePhase(
    processId: string,
    sequenceId: string,
    phaseId: string
  ) {
    try {
      if (this.phaseRepository) {
        this.cancelBackendPhaseSave(phaseId)
        const wasLoaded =
          this.loadedPhase?.processId === processId &&
          this.loadedPhase.sequenceId === sequenceId &&
          this.loadedPhase.phaseId === phaseId
        await this.phaseRepository.deletePhase(phaseId)
        const workspace = await this.phaseRepository.load()
        this.phaseStore = new PhaseWorkspaceStore(workspace)
        const nextPhase = workspace.processes
          .find(process => process.id === processId)
          ?.sequences.find(sequence => sequence.id === sequenceId)?.phases[0]
        this.phaseStore.activate(processId, sequenceId, nextPhase?.id)
        this.phaseStore.persist()
        if (wasLoaded) this.invalidateLoadedPhaseBinding()
        this.phasePanel?.render()
        this.syncPhaseContextBar()
        if (wasLoaded && nextPhase) {
          await this.activateWorkspacePhase(processId, sequenceId, nextPhase.id)
        }
        this.showMessage('Phase 已从后台删除', 'success')
        return
      }
      const stateBeforeDelete = this.phaseStore.snapshot()
      const phase = stateBeforeDelete.processes
        .find(process => process.id === processId)
        ?.sequences.find(item => item.id === sequenceId)
        ?.phases.find(item => item.id === phaseId)
      if (!phase) throw new Error('Phase was not found')
      const drawing =
        phase.drawing.kind === 'assigned'
          ? stateBeforeDelete.drawingAssets[phase.drawing.assetId]
          : undefined

      this.captureLoadedPhaseState()
      const wasLoaded =
        this.loadedPhase?.processId === processId &&
        this.loadedPhase.sequenceId === sequenceId &&
        this.loadedPhase.phaseId === phaseId
      this.phaseStore.deletePhase(processId, sequenceId, phaseId)
      const stateAfterDelete = this.phaseStore.snapshot()
      this.phaseStore.persist()

      if (
        drawing?.kind === 'local' &&
        phase.drawing.kind === 'assigned' &&
        !stateAfterDelete.drawingAssets[phase.drawing.assetId]
      ) {
        await this.drawingAssetStore.delete(phase.drawing.assetId)
      }
      if (wasLoaded) {
        this.invalidateLoadedPhaseBinding()
      }

      const process = stateAfterDelete.processes.find(item => item.id === processId)
      const sequence = process?.sequences.find(item => item.id === sequenceId)
      this.phasePanel?.render()
      this.syncPhaseContextBar()
      if (wasLoaded && sequence?.activePhaseId) {
        await this.activateWorkspacePhase(
          processId,
          sequenceId,
          sequence.activePhaseId
        )
      } else if (wasLoaded) {
        const command = new AcApQNewCmd()
        await command.execute(AcApDocManager.instance.context)
        document.title = 'CAD Viewer'
      }
      this.showMessage(`Phase ${phase.number} deleted`, 'success')
    } catch (error) {
      log.error('Failed to delete phase:', error)
      this.showMessage(String(error), 'error')
      throw error
    }
  }

  private async renameBackendPhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    name: string
  ): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    try {
      this.cancelBackendPhaseSave(phaseId)
      const sequence = this.phaseStore
        .snapshot()
        .processes.find(process => process.id === processId)
        ?.sequences.find(item => item.id === sequenceId)
      const phaseIndex = sequence?.phases.findIndex(item => item.id === phaseId)
      const phase =
        phaseIndex !== undefined && phaseIndex >= 0
          ? sequence?.phases[phaseIndex]
          : undefined
      if (!phase) throw new Error('Phase was not found')
      await repository.updatePhase(
        sequenceId,
        { ...phase, name },
        phaseIndex! + 1
      )
      await this.reloadBackendWorkspace(processId, sequenceId, phaseId)
      this.showMessage('Phase 已更新', 'success')
    } catch (error) {
      log.error('Failed to rename backend Phase:', error)
      this.showMessage('Phase 更新失败', 'error')
    }
  }

  private async reorderBackendPhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    targetIndex: number
  ): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    try {
      this.cancelBackendPhaseSave(phaseId)
      const sequence = this.phaseStore
        .snapshot()
        .processes.find(process => process.id === processId)
        ?.sequences.find(item => item.id === sequenceId)
      if (!sequence) throw new Error('Sequence was not found')
      const phases = [...sequence.phases]
      const currentIndex = phases.findIndex(item => item.id === phaseId)
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= phases.length) {
        throw new Error('Phase target index is out of range')
      }
      const [phase] = phases.splice(currentIndex, 1)
      phases.splice(targetIndex, 0, phase)
      await Promise.all(
        phases.map((item, index) =>
          repository.updatePhase(sequenceId, item, index + 1)
        )
      )
      await this.reloadBackendWorkspace(processId, sequenceId, phaseId)
      this.showMessage('Phase 顺序已更新', 'success')
    } catch (error) {
      log.error('Failed to reorder backend Phase:', error)
      this.showMessage('Phase 排序失败', 'error')
    }
  }

  private async createDrawingAsset(
    request: NewPhaseRequest | DrawingAssociationRequest
  ): Promise<DrawingAssetRef> {
    const id = crypto.randomUUID()
    if (request.sourceKind === 'local') {
      if (!request.file) throw new Error('请选择 DWG 或 DXF 图纸')
      const content = await this.readFile(request.file)
      await this.drawingAssetStore.put({
        id,
        fileName: request.file.name,
        content,
        updatedAt: new Date().toISOString()
      })
      return { id, kind: 'local', sourceName: request.file.name }
    }
    if (request.sourceKind === 'url') {
      const url = request.url?.trim()
      if (!url) throw new Error('请输入图纸 URL')
      return { id, kind: 'url', sourceName: this.getFileNameFromUrl(url), url }
    }
    return { id, kind: 'blank', sourceName: request.drawingDisplayName }
  }

  private async associateWorkspaceDrawing(
    request: DrawingAssociationRequest
  ) {
    try {
      this.captureLoadedPhaseState()
      if (this.phaseRepository) {
        await this.associateBackendDrawing(request)
        return
      }
      let removed: DrawingAssetRef | undefined
      if (request.sourceKind === 'marked') {
        if (
          !request.sourceProcessId ||
          !request.sourceSequenceId ||
          !request.sourcePhaseId
        ) {
          throw new Error('请选择已标记 Phase')
        }
        removed = this.phaseStore.associateMarkedPhase(
          request.processId,
          request.sequenceId,
          request.phaseId,
          request.sourceProcessId,
          request.sourceSequenceId,
          request.sourcePhaseId
        )
      } else {
        throw new Error('Project PID association requires a backend Project')
      }
      this.phaseStore.persist()
      if (removed?.kind === 'local') {
        await this.drawingAssetStore.delete(removed.id)
      }
      this.phasePanel?.render()
      this.syncPhaseContextBar()
      await this.activateWorkspacePhase(
        request.processId,
        request.sequenceId,
        request.phaseId,
        false
      )
      this.showMessage('阶段图纸已关联', 'success')
    } catch (error) {
      log.error('Failed to associate phase drawing:', error)
      this.showMessage(String(error), 'error')
      throw error
    }
  }

  private async associateBackendDrawing(
    request: DrawingAssociationRequest
  ): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    const state = this.phaseStore.snapshot()
    const sequence = state.processes
      .find(process => process.id === request.processId)
      ?.sequences.find(item => item.id === request.sequenceId)
    const phaseIndex = sequence?.phases.findIndex(
      item => item.id === request.phaseId
    )
    const phase =
      phaseIndex !== undefined && phaseIndex >= 0
        ? sequence?.phases[phaseIndex]
        : undefined
    if (!phase) throw new Error('Phase was not found')

    const projectFileIds = new Set(this.activeProject?.fileIds ?? [])
    let fileId: number
    let displayName: string
    if (request.sourceKind === 'project') {
      if (!Number.isInteger(request.fileId) || (request.fileId ?? 0) < 1) {
        throw new Error('请选择 Project PID')
      }
      fileId = request.fileId!
      const drawing = state.drawingAssets[`file:${fileId}`]
      if (!drawing) throw new Error('所选 Project PID 不存在')
      displayName = request.drawingDisplayName.trim() || drawing.sourceName
    } else if (request.sourceKind === 'marked') {
      const source = state.processes
        .find(process => process.id === request.sourceProcessId)
        ?.sequences.find(item => item.id === request.sourceSequenceId)
        ?.phases.find(item => item.id === request.sourcePhaseId)
      if (!source || source.drawing.kind !== 'assigned') {
        throw new Error('所选 Phase 未关联后台图纸')
      }
      const match = /^file:(\d+)$/.exec(source.drawing.assetId)
      if (!match) throw new Error('所选 Phase 不是后台图纸')
      fileId = Number(match[1])
      displayName =
        request.drawingDisplayName.trim() || source.drawing.displayName
    } else {
      throw new Error('不支持的图纸关联方式')
    }
    if (!projectFileIds.has(fileId)) {
      throw new Error('所选图纸不属于当前 Project')
    }

    this.cancelBackendPhaseSave(request.phaseId)
    await repository.updatePhase(
      request.sequenceId,
      {
        ...phase,
        drawing: {
          kind: 'assigned',
          assetId: `file:${fileId}`,
          displayName
        }
      },
      phaseIndex! + 1
    )
    await this.reloadBackendWorkspace(
      request.processId,
      request.sequenceId,
      request.phaseId
    )
    await this.activateWorkspacePhase(
      request.processId,
      request.sequenceId,
      request.phaseId,
      false
    )
    this.showMessage('阶段图纸已保存到后台', 'success')
  }

  private async renameBackendDrawing(
    processId: string,
    sequenceId: string,
    phaseId: string,
    name: string
  ): Promise<void> {
    const repository = this.phaseRepository
    if (!repository) return
    try {
      const sequence = this.phaseStore
        .snapshot()
        .processes.find(process => process.id === processId)
        ?.sequences.find(item => item.id === sequenceId)
      const phaseIndex = sequence?.phases.findIndex(item => item.id === phaseId)
      const phase =
        phaseIndex !== undefined && phaseIndex >= 0
          ? sequence?.phases[phaseIndex]
          : undefined
      if (!phase || phase.drawing.kind !== 'assigned') {
        throw new Error('Phase drawing was not found')
      }
      const displayName = name.trim()
      if (!displayName) throw new Error('Drawing display name is required')
      this.cancelBackendPhaseSave(phaseId)
      await repository.updatePhase(
        sequenceId,
        {
          ...phase,
          drawing: { ...phase.drawing, displayName }
        },
        phaseIndex! + 1
      )
      await this.reloadBackendWorkspace(processId, sequenceId, phaseId)
      if (this.loadedPhase?.phaseId === phaseId) document.title = displayName
      this.showMessage('图纸显示名已更新', 'success')
    } catch (error) {
      log.error('Failed to rename backend drawing:', error)
      this.showMessage('图纸显示名更新失败', 'error')
    }
  }

  private async activateWorkspacePhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    captureCurrentState = true
  ) {
    if (captureCurrentState) this.captureLoadedPhaseState()
    const state = this.phaseStore.snapshot()
    const process = state.processes.find(item => item.id === processId)
    const sequence = process?.sequences.find(item => item.id === sequenceId)
    const phase = sequence?.phases.find(item => item.id === phaseId)
    if (!phase) throw new Error('Phase was not found')
    const targetAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    const hotSwitch = shouldHotSwitchPhase({
      loadedAssetId: this.loadedDrawingAssetId,
      targetAssetId,
      isLoading: this.isLoadingFile,
      hasPendingActivation: Boolean(this.pendingPhase)
    })
    this.phaseStore.activate(processId, sequenceId, phaseId)
    this.phaseStore.persist()
    this.phasePanel?.render()
    this.syncPhaseContextBar()
    if (hotSwitch) {
      this.phaseActivationToken++
      this.pendingPhase = undefined
      this.resetPhaseRuntimeState(true)
      if (!this.applyPhaseSnapshot(processId, sequenceId, phaseId)) {
        this.invalidateLoadedPhaseBinding()
        throw new Error('Unable to apply Phase state')
      }
      return
    }
    const token = ++this.phaseActivationToken
    this.pendingPhase = { processId, sequenceId, phaseId, token }
    if (phase.drawing.kind === 'unassigned') {
      const command = new AcApQNewCmd()
      await command.execute(AcApDocManager.instance.context)
      return
    }
    const drawing = state.drawingAssets[phase.drawing.assetId]
    if (!drawing) {
      this.invalidateLoadedPhaseBinding()
      throw new Error('Drawing asset was not found')
    }
    const success = await this.openPhaseDrawing(drawing)
    if (!success && this.pendingPhase?.token === token) {
      this.invalidateLoadedPhaseBinding()
      throw new Error(`Unable to open ${phase.drawing.displayName}`)
    }
  }

  private async openPhaseDrawing(drawing: DrawingAssetRef) {
    await this.initialize()
    const options: AcApOpenDatabaseOptions = {
      minimumChunkSize: 1000,
      progressiveRendering: false,
      mode: AcEdOpenMode.Write,
      openViewMode: AcApOpenViewMode.Extents,
      sysVars: { lwdisplay: false }
    }
    if (drawing.kind === 'url') {
      const backendFileMatch = /^file:(\d+)$/.exec(drawing.id)
      if (backendFileMatch) {
        try {
          const content = await this.drawingLibraryRepository.getContent(
            backendFileMatch[1]
          )
          return AcApDocManager.instance.openDocument(
            drawing.sourceName,
            content,
            options
          )
        } catch (error) {
          log.warn(
            `Failed to open backend drawing ${drawing.id} as binary content:`,
            error
          )
        }
      }
      return drawing.url
        ? AcApDocManager.instance.openUrl(drawing.url, options)
        : false
    }
    if (drawing.kind === 'local') {
      const stored = await this.drawingAssetStore.get(drawing.id)
      return stored
        ? AcApDocManager.instance.openDocument(
          stored.fileName,
          stored.content,
          options
        )
        : false
    }
    const cmd = new AcApQNewCmd()
    await cmd.execute(AcApDocManager.instance.context)
    return true
  }

  private setupFileHandling() {
    this.fileInput.addEventListener('change', event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        void this.loadLocalFile(file)
      }
      this.fileInput.value = ''
    })

    this.centerOpenButton.addEventListener('click', () => {
      this.openFilePicker()
    })
  }

  private getOpenHighlightObjectIds(
    objectId: AcDbObjectId,
    connectedHandles: Set<number> = new Set()
  ) {
    const objectIds = new Set<AcDbObjectId>([objectId])
    connectedHandles.forEach(handleId => {
      handleKeysFromNumber(handleId).forEach(handleKey => {
        const connectedObjectId = this.resolveObjectIdByHandleKey(handleKey)
        if (connectedObjectId) objectIds.add(connectedObjectId)
      })
    })
    return objectIds
  }

  private getFlowConnectionTraversal(objectId: AcDbObjectId) {
    const connectedHandles = new Set<number>()
    const traversalEdges: FlowConnectionLogEdge[] = []
    const traversalEdgeKeys = new Set<string>()
    const visitedHandleKeys = new Set<string>()
    const pendingHandleKeys = handleKeysFromObjectId(objectId)
    const traversableBoundaryKeys = new Set(pendingHandleKeys)

    while (pendingHandleKeys.length > 0) {
      const handleKey = pendingHandleKeys.shift()
      if (!handleKey || visitedHandleKeys.has(handleKey)) continue

      visitedHandleKeys.add(handleKey)

      const traversedToHandles = new Set<number>()
      flowConnectionIndex.get(handleKey)?.forEach(handleId => {
        if (this.isClosedFlowBoundary(handleId, traversableBoundaryKeys)) {
          handleKeysFromNumber(handleId).forEach(boundaryKey => {
            visitedHandleKeys.add(boundaryKey)
          })
          return
        }

        if (
          handleKeysFromNumber(handleId).some(nextKey =>
            flowEdgeHandleKeys.has(nextKey)
          )
        ) {
          connectedHandles.add(handleId)
        }
        traversedToHandles.add(handleId)
        handleKeysFromNumber(handleId).forEach(nextKey => {
          if (!visitedHandleKeys.has(nextKey)) {
            pendingHandleKeys.push(nextKey)
          }
        })
      })

      if (traversedToHandles.size > 0) {
        flowConnectionLogIndex.get(handleKey)?.forEach(edge => {
          const to = edge.to.filter(handleId => traversedToHandles.has(handleId))
          if (to.length === 0) return

          const edgeKey = `${edge.from}:${to.join(',')}`
          if (traversalEdgeKeys.has(edgeKey)) return

          traversalEdgeKeys.add(edgeKey)
          traversalEdges.push({
            from: edge.from,
            to
          })
        })
      }
    }

    return {
      connectedHandles,
      traversalEdges
    }
  }

  private isClosedFlowBoundary(
    handleId: number,
    traversableBoundaryKeys: Set<string>
  ) {
    const handleKeys = handleKeysFromNumber(handleId)
    const isBoundary =
      handleKeys.some(handleKey => flowBoundaryHandleKeys.has(handleKey)) ||
      this.isRuntimeFlowBoundary(handleId)
    if (!isBoundary) return false

    return !handleKeys.some(handleKey => traversableBoundaryKeys.has(handleKey))
  }

  private isRuntimeFlowBoundary(handleId: number) {
    const db = AcApDocManager.instance.curDocument?.database
    if (!db) return false

    for (const handleKey of handleKeysFromNumber(handleId)) {
      const entity = db.tables.blockTable.getEntityById(handleKey) as
        | LayerNamedEntity
        | undefined
      const layerName = entity?.layer ?? entity?.layerName
      if (isFlowBoundaryLayerName(layerName)) return true
    }

    return false
  }

  private isFlowBoundaryObject(objectId: AcDbObjectId) {
    const handleKeys = handleKeysFromObjectId(objectId)
    if (handleKeys.some(handleKey => flowBoundaryHandleKeys.has(handleKey))) {
      return true
    }

    const db = AcApDocManager.instance.curDocument?.database
    const entity = db?.tables.blockTable.getEntityById(objectId) as
      | LayerNamedEntity
      | undefined
    const layerName = entity?.layer ?? entity?.layerName
    return isFlowBoundaryLayerName(layerName)
  }

  private resolveObjectIdByHandleKey(handleKey: string) {
    const db = AcApDocManager.instance.curDocument?.database
    if (!db) return undefined
    const entity = db.tables.blockTable.getEntityById(handleKey)
    return entity?.objectId
  }

  private recomputeOpenHighlightGroups() {
    ;[...this.openHighlightGroups.keys()].forEach(ownerId => {
      this.openHighlightGroups.set(
        ownerId,
        this.getOpenHighlightObjectIds(
          ownerId,
          this.openHighlightConnections.get(ownerId)
        )
      )
    })
    this.syncOpenHighlightRoots()
  }

  private syncOpenHighlightRoots() {
    const view = AcApDocManager.instance.curView
    const layout = view.cadScene.activeLayout
    if (!layout) return

    const desiredIds = this.getReferencedOpenHighlightIds()
    const idsToRemove = [...this.openHighlightRoots.keys()].filter(
      id => !desiredIds.has(id)
    )
    let changedHighlight = false

    idsToRemove.forEach(id => {
      const root = this.openHighlightRoots.get(id)
      if (!root) return

      root.removeFromParent()
      this.disposePreviewRoot(root)
      this.openHighlightRoots.delete(id)
      changedHighlight = true
    })

    desiredIds.forEach(id => {
      if (this.openHighlightRoots.has(id)) return

      const root = layout.createEntityPreviewRoot([id], {
        missingEntity: 'skip'
      }) as PreviewRoot | null
      if (!root) return

      root.name = 'SelectionOpenHighlight'
      this.applyOpenHighlightStyle(root, id)
        ; (layout.internalObject as LayoutObjectHost).add(root)
      this.openHighlightRoots.set(id, root)
      changedHighlight = true
    })

    if (changedHighlight) {
      view.isDirty = true
    }
  }

  private getReferencedOpenHighlightIds() {
    const ids = new Set<AcDbObjectId>()
    this.openHighlightGroups.forEach(group => {
      group.forEach(id => ids.add(id))
    })
    return ids
  }

  private getPdfEntityStyleOverrides() {
    const draft = this.getLoadedHighlightStyleDraft()
    const flowState = this.getLoadedFlowState()
    if (!draft || !flowState) return []
    const groups = new Map<
      string,
      { entityIds: Set<string>; style: ResolvedEntityPresentation }
    >()
    for (const flowPath of flowState.flowPaths) {
      flowPath.handleKeys.forEach(handleKey => {
        const ownerId = this.resolveObjectIdByHandleKey(handleKey)
        if (!ownerId) return
        const style = resolveEntityPresentation(draft.presentationProfile, {
          flowPath
        })
        if (!style.visible) return
        const group = groups.get(style.key) ?? { entityIds: new Set(), style }
        const highlightedIds =
          this.openHighlightGroups.get(ownerId) ??
          this.getOpenHighlightObjectIds(ownerId)
        highlightedIds.forEach(id => group.entityIds.add(String(id)))
        groups.set(style.key, group)

      })
    }
    return [...groups.values()].map(({ entityIds, style }) => ({
      entityIds,
      strokeColor: style.color,
      strokeWidthPx: style.lineWidthPx,
      opacity: style.opacity
    }))
  }

  private getHighlightStyleDraft(processId: string): HighlightStyleDraft | undefined {
    const process = this.phaseStore
      .snapshot()
      .processes.find(item => item.id === processId)
    return process
      ? { presentationProfile: process.presentationProfile }
      : undefined
  }

  private getLoadedHighlightStyleDraft() {
    return this.loadedPhase
      ? this.getHighlightStyleDraft(this.loadedPhase.processId)
      : undefined
  }

  private getLoadedFlowState(): FlowStateSnapshot | undefined {
    if (!this.loadedPhase) return undefined
    const loaded = this.loadedPhase
    return this.phaseStore
      .snapshot()
      .processes.find(process => process.id === loaded.processId)
      ?.sequences.find(sequence => sequence.id === loaded.sequenceId)
      ?.phases.find(phase => phase.id === loaded.phaseId)?.flowState
  }

  private openHighlightStyleDialog(processId: string) {
    const value = this.getHighlightStyleDraft(processId)
    if (!value) return
    document.querySelector('.highlight-style-modal')?.remove()
    const dialog = new HighlightStyleDialog({
      value,
      getLocale: () => this.appLocale,
      onClose: () => undefined
    })
    dialog.open()
  }

  private captureFlowPaths(): FlowStateSnapshot['flowPaths'] {
    if (!this.loadedPhase) return []
    return [...this.openHighlightConnections.keys()].map(ownerId => ({
      id: `flow-${this.loadedPhase!.phaseId}-${String(ownerId)}`,
      name: '默认流路',
      handleKeys: handleKeysFromObjectId(ownerId),
      styleOverride: { ...CONNECTED_FLOW_STYLE }
    }))
  }

  private resolvePresentationForObjectId(
    objectId: AcDbObjectId,
    draft = this.getLoadedHighlightStyleDraft(),
    flowPath?: FlowPathStatus
  ): ResolvedEntityPresentation {
    const profile =
      draft?.presentationProfile ??
      {
        defaultFlowStyle: { color: 0x00c853, lineWidthPx: 3, opacity: 1, visible: true },
        unknownDeviceStyle: { color: 0x546e7a, lineWidthPx: 2, opacity: 1, visible: true },
        dimmedBaseStyle: { color: 0x9e9e9e, opacity: 0.35 },
        deviceStyles: {
          valve: {
            open: { color: 0x00c853, lineWidthPx: 3, opacity: 1, visible: true },
            closed: { color: 0xd32f2f, lineWidthPx: 3, opacity: 1, visible: true },
            pulse: { color: 0xf9a825, lineWidthPx: 3, opacity: 1, visible: true }
          },
          motor: {
            start: { color: 0x00796b, lineWidthPx: 3, opacity: 1, visible: true },
            stop: { color: 0x616161, lineWidthPx: 2, opacity: 1, visible: true }
          },
          processEquipment: {
            active: { color: 0x00c853, lineWidthPx: 3, opacity: 1, visible: true }
          }
        },
        deviceStylesInitialized: true,
        utilities: []
      }

    for (const [ownerId, group] of this.openHighlightGroups) {
      if (!group.has(objectId)) continue
      const ownerHandleKeys = handleKeysFromObjectId(ownerId)
      const flowPath = {
        id: `flow-runtime-${String(ownerId)}`,
        name: '默认流路',
        handleKeys: ownerHandleKeys,
        styleOverride: { ...CONNECTED_FLOW_STYLE }
      }
      return resolveEntityPresentation(profile, { flowPath })
    }
    return resolveEntityPresentation(profile, flowPath ? { flowPath } : undefined)
  }

  private removeOpenHighlight(ids?: AcDbObjectId[]) {
    const idsToRemove = ids ?? [...this.openHighlightRoots.keys()]
    let removedHighlight = false

    if (!ids) {
      this.openHighlightGroups.clear()
      this.openHighlightConnections.clear()
    }

    idsToRemove.forEach(id => {
      const root = this.openHighlightRoots.get(id)
      if (!root) return

      root.removeFromParent()
      this.disposePreviewRoot(root)
      this.openHighlightRoots.delete(id)
      removedHighlight = true
    })

    if (removedHighlight) {
      AcApDocManager.instance.curView.isDirty = true
    }
  }

  private captureLoadedPhaseState() {
    if (!this.loadedPhase) return
    const currentPhase = this.phaseStore
      .snapshot()
      .processes.find(process => process.id === this.loadedPhase?.processId)
      ?.sequences.find(
        sequence => sequence.id === this.loadedPhase?.sequenceId
      )
      ?.phases.find(phase => phase.id === this.loadedPhase?.phaseId)
    if (!currentPhase) return
    const nextState = {
      flowState: {
        flowPaths: this.captureFlowPaths()
      }
    }
    const stateChanged =
      JSON.stringify(currentPhase.flowState) !==
      JSON.stringify(nextState.flowState)
    if (!stateChanged) return
    this.phaseStore.updatePhaseState(
      this.loadedPhase.processId,
      this.loadedPhase.sequenceId,
      this.loadedPhase.phaseId,
      nextState
    )
    this.phaseStore.persist()
    this.scheduleBackendPhaseSave(
      this.loadedPhase.processId,
      this.loadedPhase.sequenceId,
      this.loadedPhase.phaseId
    )
    this.phasePanel?.render()
    this.syncPhaseContextBar()
  }

  private scheduleBackendPhaseSave(
    processId: string,
    sequenceId: string,
    phaseId: string
  ): void {
    const repository = this.phaseRepository
    if (!repository) return
    this.cancelBackendPhaseSave(phaseId)
    const timer = window.setTimeout(async () => {
      this.backendPhaseSaveTimers.delete(phaseId)
      try {
        const sequence = this.phaseStore
          .snapshot()
          .processes.find(process => process.id === processId)
          ?.sequences.find(item => item.id === sequenceId)
        const phaseIndex = sequence?.phases.findIndex(item => item.id === phaseId)
        const phase =
          phaseIndex !== undefined && phaseIndex >= 0
            ? sequence?.phases[phaseIndex]
            : undefined
        if (!phase) return
        await repository.updatePhase(sequenceId, phase, phaseIndex! + 1)
      } catch (error) {
        log.error('Failed to save backend Phase state:', error)
        this.showMessage('Phase 状态保存失败', 'error')
      }
    }, 300)
    this.backendPhaseSaveTimers.set(phaseId, timer)
  }

  private cancelBackendPhaseSave(phaseId: string): void {
    const timer = this.backendPhaseSaveTimers.get(phaseId)
    if (timer === undefined) return
    window.clearTimeout(timer)
    this.backendPhaseSaveTimers.delete(phaseId)
  }

  private applyPendingPhaseState(): boolean {
    const pending = this.pendingPhase
    if (!pending || pending.token !== this.phaseActivationToken) return false
    const applied = this.applyPhaseSnapshot(
      pending.processId,
      pending.sequenceId,
      pending.phaseId
    )
    if (applied) this.pendingPhase = undefined
    return applied
  }

  private applyPhaseSnapshot(
    processId: string,
    sequenceId: string,
    phaseId: string
  ): boolean {
    const state = this.phaseStore.snapshot()
    const process = state.processes.find(item => item.id === processId)
    const sequence = process?.sequences.find(
      item => item.id === sequenceId
    )
    const phase = sequence?.phases.find(item => item.id === phaseId)
    if (!phase) return false

    phase.flowState.flowPaths.flatMap(flowPath => flowPath.handleKeys).forEach(handleKey => {
      const ownerId = this.resolveObjectIdByHandleKey(handleKey)
      if (ownerId) {
        const traversal = this.isFlowBoundaryObject(ownerId)
          ? this.getFlowConnectionTraversal(ownerId)
          : { connectedHandles: new Set<number>(), traversalEdges: [] }
        this.openHighlightConnections.set(ownerId, traversal.connectedHandles)
        this.openHighlightGroups.set(
          ownerId,
          this.getOpenHighlightObjectIds(ownerId, traversal.connectedHandles)
        )
      } else {
        log.warn(`Unable to restore phase highlight handle: ${handleKey}`)
      }
    })
    this.recomputeOpenHighlightGroups()
    this.loadedPhase = {
      processId,
      sequenceId,
      phaseId
    }
    this.loadedDrawingAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    document.title = `${phase.drawing.kind === 'assigned'
      ? phase.drawing.displayName
      : '未关联图纸'
      } · ${phase.name}`
    this.phasePanel?.render()
    this.syncPhaseContextBar()
    return true
  }

  private applyOpenHighlightStyle(root: PreviewRoot, objectId: AcDbObjectId) {
    const view = AcApDocManager.instance.curView
    upgradePreviewWideLines(
      root,
      this.resolvePresentationForObjectId(objectId),
      view.width,
      view.height
    )
    this.phasePresentationController.apply(
      root as unknown as Parameters<PhasePresentationController['apply']>[0],
      this.resolvePresentationForObjectId(objectId)
    )
  }

  private disposePreviewRoot(root: PreviewRoot) {
    this.phasePresentationController.forget(
      root as unknown as Parameters<PhasePresentationController['forget']>[0]
    )
    root.traverse(object => {
      if (this.hasObjectMaterial(object)) {
        const material = object.material
        if (Array.isArray(material)) {
          material.forEach(item => item.dispose())
        } else {
          material.dispose()
        }
      }
      if (this.hasDisposablePreviewGeometry(object)) {
        object.geometry.dispose()
      }
    })
    root.clear()
  }

  private hasObjectMaterial(
    object: PreviewObject
  ): object is PreviewObject & {
    material: PreviewMaterial | PreviewMaterial[]
  } {
    return object.material != null
  }

  private hasDisposablePreviewGeometry(
    object: PreviewObject
  ): object is PreviewObject & { geometry: PreviewGeometry } {
    return (
      object.geometry != null &&
      object.userData.disposeGeometryOnRemove === true
    )
  }

  private setupPredefinedFileActions() {
    this.predefinedButtons.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.dataset.fileUrl
        if (!url) return
        this.predefinedButtons.forEach(item => item.classList.remove('active'))
        button.classList.add('active')
        this.updateFileSidebarSubtitle(button.textContent?.trim() || '')
        this.setFileSidebarExpanded(false)
        void this.loadPredefinedFile(url)
      })
    })
  }

  private setupMobileSidebar() {
    const fileSidebar = this.fileSidebar
    const fileSidebarBody = this.fileSidebarBody
    const fileSidebarToggle = this.fileSidebarToggle

    if (!fileSidebar || !fileSidebarBody || !fileSidebarToggle) {
      return
    }

    fileSidebarToggle.addEventListener('click', () => {
      this.setFileSidebarExpanded(!this.isFileSidebarOpen())
    })

    document.addEventListener('pointerdown', event => {
      if (!this.isMobileLayout() || !this.isFileSidebarOpen()) {
        return
      }

      const target = event.target
      if (!(target instanceof Node)) return
      if (
        fileSidebarToggle.contains(target) ||
        fileSidebarBody.contains(target)
      ) {
        return
      }
      this.setFileSidebarExpanded(false)
    })

    window.addEventListener('resize', () => {
      const view = AcApDocManager.instance.curView
      if (view) {
        this.phasePresentationController.resize(view.width, view.height)
        view.isDirty = true
      }
      this.valveDebugFeature?.resize()
      if (!this.isMobileLayout()) {
        this.setFileSidebarExpanded(false)
        return
      }
      if (this.isFileSidebarOpen()) {
        this.positionMobileFilePopover()
      }
    })
  }

  private isMobileLayout() {
    return isCompactUiLayout()
  }

  private isFileSidebarOpen(): boolean {
    if (!this.fileSidebar || !this.fileSidebarBody) return false

    return this.isMobileLayout()
      ? this.fileSidebarBody.classList.contains('file-sidebar-popover')
      : this.fileSidebar.classList.contains('expanded')
  }

  private setFileSidebarExpanded(expanded: boolean) {
    if (!this.fileSidebar || !this.fileSidebarBody || !this.fileSidebarToggle) {
      return
    }

    if (this.isMobileLayout()) {
      this.fileSidebar.classList.toggle('expanded', expanded)
      this.fileSidebarToggle.setAttribute('aria-expanded', String(expanded))
      this.fileSidebarBody.classList.toggle('file-sidebar-popover', expanded)
      if (expanded) {
        this.positionMobileFilePopover()
      } else {
        this.fileSidebarBody.style.top = ''
        this.fileSidebarBody.style.maxHeight = ''
      }
      return
    }

    this.fileSidebar.classList.toggle('expanded', expanded)
    this.fileSidebarToggle.setAttribute('aria-expanded', String(expanded))
  }

  private positionMobileFilePopover() {
    if (!this.fileSidebarBody || !this.fileSidebarToggle) return

    const rect = this.fileSidebarToggle.getBoundingClientRect()
    const gap = 4
    const viewportInset = 8
    const top = rect.bottom + gap
    const maxHeight = Math.max(
      120,
      Math.min(
        window.innerHeight * 0.5,
        360,
        window.innerHeight - top - viewportInset
      )
    )

    this.fileSidebarBody.style.top = `${top}px`
    this.fileSidebarBody.style.maxHeight = `${maxHeight}px`
  }

  private updateFileSidebarSubtitle(label: string) {
    if (!this.fileSidebarSubtitle) return

    this.fileSidebarSubtitle.textContent = label || 'Tap to browse sample files'
  }

  private async loadLocalFile(file: File) {
    await this.initialize()

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.dxf') && !fileName.endsWith('.dwg')) {
      this.showMessage('Please select a DXF or DWG file', 'error')
      return
    }

    this.clearMessages()
    this.captureLoadedPhaseState()
    this.invalidateLoadedPhaseBinding()

    try {
      const fileContent = await this.readFile(file)
      const options: AcApOpenDatabaseOptions = {
        minimumChunkSize: 1000,
        progressiveRendering: true,
        mode: AcEdOpenMode.Write,
        openViewMode: AcApOpenViewMode.Extents,
        sysVars: {
          lwdisplay: false
        }
      }

      const success = await AcApDocManager.instance.openDocument(
        file.name,
        fileContent,
        options
      )

      if (success) {
        this.predefinedButtons.forEach(item => item.classList.remove('active'))
        this.updateFileSidebarSubtitle('Tap to browse sample files')
        this.showMessage(`Successfully loaded: ${file.name}`, 'success')
      } else {
        this.showMessage(`Failed to load: ${file.name}`, 'error')
      }
    } catch (error) {
      log.error('Error loading file:', error)
      this.showMessage(`Error loading file: ${error}`, 'error')
    } finally {
      this.finishLoadingState()
    }
  }

  private async loadPredefinedFile(url: string) {
    await this.initialize()
    this.clearMessages()
    this.captureLoadedPhaseState()
    this.invalidateLoadedPhaseBinding()

    try {
      const options: AcApOpenDatabaseOptions = {
        minimumChunkSize: 1000,
        progressiveRendering: true,
        mode: AcEdOpenMode.Write,
        openViewMode: AcApOpenViewMode.Extents
      }

      const success = await AcApDocManager.instance.openUrl(url, options)

      if (success) {
        const fileName = this.getFileNameFromUrl(url)
        this.showMessage(`Successfully loaded: ${fileName}`, 'success')
      } else {
        this.showMessage(
          `Failed to load: ${this.getFileNameFromUrl(url)}`,
          'error'
        )
      }
    } catch (error) {
      log.error('Error loading predefined file:', error)
      this.showMessage(`Error loading file: ${error}`, 'error')
    } finally {
      this.finishLoadingState()
    }
  }

  private onFileOpened() {
    this.hasOpenedFile = true
    this.resetPhaseRuntimeState()
    this.hideDisplayRasterLayer()
    this.valveDebugFeature?.attach()
    this.brushHighlightFeature?.attach()
    this.setDrawingBackground(true)
    this.updateEmptyStateVisibility()
    this.updateDevToolbarLabels()
  }

  private hideDisplayRasterLayer() {
    const document = AcApDocManager.instance.curDocument
    const layer = document?.database.tables.layerTable.getAt(
      PHI_RASTER_LAYER_NAME
    )
    if (!document || !layer || layer.isOff) return
    document.layerStore.setLayerOn(PHI_RASTER_LAYER_NAME, false)
  }

  private resetPhaseRuntimeState(preserveHighlightRoots = false) {
    this.valveDebugFeature?.reset()
    this.brushHighlightFeature?.reset()
    if (preserveHighlightRoots) {
      this.openHighlightGroups.clear()
      this.openHighlightConnections.clear()
    } else {
      this.removeOpenHighlight()
    }
  }

  private invalidateLoadedPhaseBinding() {
    this.loadedPhase = undefined
    this.loadedDrawingAssetId = undefined
    this.pendingPhase = undefined
    this.phaseActivationToken++
  }

  private setLoadingState(loading: boolean) {
    this.isLoadingFile = loading
    this.updateEmptyStateVisibility()
  }

  private finishLoadingState() {
    this.isLoadingFile = false
    this.updateEmptyStateVisibility()
  }

  private updateEmptyStateVisibility() {
    this.emptyState.classList.toggle(
      'hidden',
      this.hasOpenedFile || this.isLoadingFile
    )
  }

  private getFileNameFromUrl(url: string) {
    const paths = url.split('/')
    return paths[paths.length - 1] || url
  }

  private readFile(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
  }

  private showMessage(
    message: string,
    type: ToastTone = 'info'
  ) {
    this.toast.show(translateUiText(this.appLocale, message), type)
  }

  private clearMessages() {
    this.toast.clear()
  }
}

async function bootstrap(): Promise<void> {
  injectAppShellResponsiveStyles()
  injectConfirmationModalStyles()
  injectToastStyles()
  injectParsingDetailsStyles()
  injectUiReferenceThemeStyles()
  injectPhaseWorkspaceStyles()
  new CadViewerApp()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap())
} else {
  void bootstrap()
}
