import {
  type CreatePhaseInput,
  type DeviceMode,
  type DeviceState,
  type DeviceStateStyleDefinition,
  type DeviceStyleDefinition,
  type DrawingAssetRef,
  type FlowBehavior,
  type FlowPathStatus,
  type HighlightStyle,
  PHASE_WORKSPACE_SCHEMA_VERSION,
  type PhaseDrawingAssociation,
  type PhaseSnapshot,
  type PhaseWorkspaceState,
  type PresentationProfile,
  type ProcessDefinition,
  type SequenceDefinition
} from './types'

export const PHASE_WORKSPACE_STORAGE_KEY =
  'cad-simple-viewer-example-phase-workspace'

const DEFAULT_SEQUENCE_NAME = '默认序列'
const DEFAULT_FLOW_PATH_NAME = '默认流路'

const createHighlightStyle = (
  color: number,
  lineWidthPx: number
): HighlightStyle => ({ color, lineWidthPx, opacity: 1, visible: true })

export const createDefaultPresentationProfile = (): PresentationProfile => ({
  defaultFlowStyle: createHighlightStyle(0x00c853, 3),
  unknownDeviceStyle: null,
  dimmedBaseStyle: { color: 0x9e9e9e, opacity: 0.35 },
  deviceStyles: {
    valve: {
      open: null,
      closed: null,
      pulse: null
    },
    motor: {
      start: null,
      stop: null
    },
    processEquipment: { active: null }
  },
  deviceStylesInitialized: true,
  devices: [],
  utilities: []
})

const cloneHighlightStyle = (style: HighlightStyle): HighlightStyle => ({
  ...style
})

const cloneNullableStyle = (style: HighlightStyle | null) =>
  style ? cloneHighlightStyle(style) : null

export const clonePresentationProfile = (
  profile: PresentationProfile
): PresentationProfile => ({
  defaultFlowStyle: cloneHighlightStyle(profile.defaultFlowStyle),
  unknownDeviceStyle: cloneNullableStyle(profile.unknownDeviceStyle),
  dimmedBaseStyle: { ...profile.dimmedBaseStyle },
  deviceStyles: {
    valve: {
      open: cloneNullableStyle(profile.deviceStyles.valve.open),
      closed: cloneNullableStyle(profile.deviceStyles.valve.closed),
      pulse: cloneNullableStyle(profile.deviceStyles.valve.pulse)
    },
    motor: {
      start: cloneNullableStyle(profile.deviceStyles.motor.start),
      stop: cloneNullableStyle(profile.deviceStyles.motor.stop)
    },
    processEquipment: {
      active: cloneNullableStyle(profile.deviceStyles.processEquipment.active)
    }
  },
  deviceStylesInitialized: profile.deviceStylesInitialized,
  devices: profile.devices.map(device => ({
    ...device,
    states: device.states.map(state => ({ ...state }))
  })),
  utilities: profile.utilities.map(utility => ({
    ...utility,
    style: cloneHighlightStyle(utility.style)
  }))
})

const cloneFlowPath = (flowPath: FlowPathStatus): FlowPathStatus => ({
  ...flowPath,
  handleKeys: [...flowPath.handleKeys],
  styleSource:
    flowPath.styleSource?.kind === 'custom'
      ? {
        kind: 'custom',
        style: cloneHighlightStyle(flowPath.styleSource.style)
      }
      : flowPath.styleSource
        ? { ...flowPath.styleSource }
        : undefined,
  styleOverride: flowPath.styleOverride
    ? { ...flowPath.styleOverride }
    : undefined
})

const cloneDeviceStates = (
  deviceStates: Record<string, DeviceState> | undefined
) =>
  deviceStates
    ? Object.fromEntries(
      Object.entries(deviceStates).map(([key, state]) => [
        key,
        { ...state }
      ])
    )
    : undefined

const cloneFlowState = (flowState: PhaseSnapshot['flowState']) => ({
  flowPaths: flowState.flowPaths.map(cloneFlowPath),
  ...(flowState.deviceStates
    ? { deviceStates: cloneDeviceStates(flowState.deviceStates) }
    : {})
})

interface LegacyPhaseSnapshot
  extends Omit<PhaseSnapshot, 'drawing' | 'flowState'> {
  drawingAssetId: string
  drawingDisplayName: string
  flowState: { openBoundaryHandleKeys: string[] }
}

interface LegacyProcessDefinition {
  id: string
  name: string
  phases: LegacyPhaseSnapshot[]
  activePhaseId?: string
  createdAt: string
  updatedAt: string
}

interface LegacyPhaseWorkspaceState {
  version: 1
  processes: LegacyProcessDefinition[]
  drawingAssets: Record<string, DrawingAssetRef>
  activeProcessId?: string
}

interface V2SequenceDefinition extends Omit<SequenceDefinition, 'phases'> {
  phases: LegacyPhaseSnapshot[]
}

interface V2ProcessDefinition
  extends Omit<ProcessDefinition, 'sequences' | 'presentationProfile'> {
  sequences: V2SequenceDefinition[]
}

interface V2PhaseWorkspaceState {
  version: 2
  processes: V2ProcessDefinition[]
  drawingAssets: Record<string, DrawingAssetRef>
  activeProcessId?: string
}

interface V3PhaseSnapshot extends Omit<PhaseSnapshot, 'flowState'> {
  flowState: { openBoundaryHandleKeys: string[] }
}

interface V3SequenceDefinition extends Omit<SequenceDefinition, 'phases'> {
  phases: V3PhaseSnapshot[]
}

interface V3ProcessDefinition
  extends Omit<ProcessDefinition, 'sequences' | 'presentationProfile'> {
  sequences: V3SequenceDefinition[]
}

interface V3PhaseWorkspaceState {
  version: 3
  processes: V3ProcessDefinition[]
  drawingAssets: Record<string, DrawingAssetRef>
  activeProcessId?: string
}

const createEmptyState = (): PhaseWorkspaceState => ({
  version: PHASE_WORKSPACE_SCHEMA_VERSION,
  presentationProfile: createDefaultPresentationProfile(),
  processes: [],
  drawingAssets: {}
})

const clonePhase = (phase: PhaseSnapshot): PhaseSnapshot => ({
  id: phase.id,
  number: phase.number,
  name: phase.name,
  drawing: { ...phase.drawing },
  sourcePhaseId: phase.sourcePhaseId,
  flowState: cloneFlowState(phase.flowState),
  textNotes: phase.textNotes?.map(note => ({
    ...note,
    location: { ...note.location }
  })),
  pidOverlayPersistence: phase.pidOverlayPersistence
    ? { ...phase.pidOverlayPersistence }
    : undefined,
  createdAt: phase.createdAt,
  updatedAt: phase.updatedAt
})

const cloneSequence = (sequence: SequenceDefinition): SequenceDefinition => ({
  ...sequence,
  phases: sequence.phases.map(clonePhase)
})

const cloneState = (state: PhaseWorkspaceState): PhaseWorkspaceState => ({
  ...state,
  presentationProfile: clonePresentationProfile(
    state.presentationProfile ?? state.processes[0]?.presentationProfile ?? createDefaultPresentationProfile()
  ),
  drawingAssets: Object.fromEntries(
    Object.entries(state.drawingAssets).map(([key, asset]) => [key, { ...asset }])
  ),
  processes: state.processes.map(process => ({
    ...process,
    presentationProfile: clonePresentationProfile(process.presentationProfile),
    sequences: process.sequences.map(cloneSequence)
  }))
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const isWorkspaceState = (value: unknown): value is PhaseWorkspaceState => {
  if (!isRecord(value)) return false
  return (
    value.version === PHASE_WORKSPACE_SCHEMA_VERSION &&
    (value.presentationProfile === undefined || isRecord(value.presentationProfile)) &&
    Array.isArray(value.processes) &&
    value.processes.every(
      process => isRecord(process) && Array.isArray(process.sequences)
    ) &&
    isRecord(value.drawingAssets)
  )
}

const isLegacyWorkspaceState = (
  value: unknown
): value is LegacyPhaseWorkspaceState => {
  if (!isRecord(value)) return false
  return (
    value.version === 1 &&
    Array.isArray(value.processes) &&
    value.processes.every(
      process => isRecord(process) && Array.isArray(process.phases)
    ) &&
    isRecord(value.drawingAssets)
  )
}

const isV2WorkspaceState = (value: unknown): value is V2PhaseWorkspaceState => {
  if (!isRecord(value)) return false
  return (
    value.version === 2 &&
    Array.isArray(value.processes) &&
    value.processes.every(
      process => isRecord(process) && Array.isArray(process.sequences)
    ) &&
    isRecord(value.drawingAssets)
  )
}

const isV3WorkspaceState = (value: unknown): value is V3PhaseWorkspaceState => {
  if (!isRecord(value)) return false
  return (
    value.version === 3 &&
    Array.isArray(value.processes) &&
    value.processes.every(
      process => isRecord(process) && Array.isArray(process.sequences)
    ) &&
    isRecord(value.drawingAssets)
  )
}

const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

const normalizeColor = (value: unknown, fallback: number) => {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
    return Number.parseInt(value.slice(1), 16)
  }
  return Math.round(clamp(value, fallback, 0, 0xffffff))
}

const firstDefined = (...values: unknown[]) =>
  values.find(value => value !== undefined && value !== null)

const normalizeStyle = (
  value: unknown,
  fallback: HighlightStyle
): HighlightStyle => {
  const style = isRecord(value) ? value : {}
  return {
    color: normalizeColor(style.color, fallback.color),
    lineWidthPx: clamp(style.lineWidthPx, fallback.lineWidthPx, 1, 12),
    opacity: clamp(style.opacity, fallback.opacity, 0, 1),
    visible:
      typeof style.visible === 'boolean' ? style.visible : fallback.visible
  }
}

const uniqueId = (candidate: unknown, fallback: string, seen: Set<string>) => {
  const base =
    typeof candidate === 'string' && candidate.trim()
      ? candidate.trim()
      : fallback
  let id = base
  let suffix = 2
  while (seen.has(id)) id = `${base}-${suffix++}`
  seen.add(id)
  return id
}

const legacyFlowRules = (key: string): {
  autoHighlightFlow: boolean
  flowBehavior: FlowBehavior
} => {
  if (key === 'closed') {
    return { autoHighlightFlow: false, flowBehavior: 'blocking' }
  }
  if (key === 'open' || key === 'pulse' || key === 'start' || key === 'active') {
    return { autoHighlightFlow: true, flowBehavior: 'conducting' }
  }
  return { autoHighlightFlow: false, flowBehavior: 'neutral' }
}

const normalizeDeviceState = (
  value: unknown,
  index: number,
  seenIds: Set<string>,
  fallbackKey = `state-${index + 1}`
): DeviceStateStyleDefinition | undefined => {
  if (!isRecord(value)) return undefined
  const key =
    typeof value.key === 'string' && value.key.trim()
      ? value.key.trim()
      : fallbackKey
  const legacyRules = legacyFlowRules(key)
  const flowBehavior = value.flowBehavior
  return {
    id: uniqueId(
      value.id,
      typeof value.id === 'number' ? `state-${value.id}` : key,
      seenIds
    ),
    key,
    displayName:
      typeof value.displayName === 'string' && value.displayName.trim()
        ? value.displayName.trim()
        : key,
    color: normalizeColor(
      firstDefined(value.color, value.FillColorString),
      0x00c853
    ),
    lineWidthPx: clamp(value.lineWidthPx, 3, 1, 12),
    opacity: clamp(firstDefined(value.opacity, value.FillOpacity), 1, 0, 1),
    enabled: true,
    autoHighlightFlow:
      typeof value.autoHighlightFlow === 'boolean'
        ? value.autoHighlightFlow
        : legacyRules.autoHighlightFlow,
    flowBehavior:
      flowBehavior === 'conducting' ||
        flowBehavior === 'blocking' ||
        flowBehavior === 'neutral'
        ? flowBehavior
        : legacyRules.flowBehavior,
    order: clamp(value.order, index, 0, Number.MAX_SAFE_INTEGER)
  }
}

const normalizeDevices = (value: unknown): DeviceStyleDefinition[] => {
  if (!Array.isArray(value)) return []
  const seenDeviceIds = new Set<string>()
  const devices = new Map<string, DeviceStyleDefinition>()
  value.forEach((candidate, index) => {
    if (!isRecord(candidate)) return []
    const deviceType =
      typeof candidate.deviceType === 'string' && candidate.deviceType.trim()
        ? candidate.deviceType.trim()
        : undefined
    if (deviceType) {
      const existing = devices.get(deviceType)
      const device = existing ?? {
        id: uniqueId(deviceType, `device-${index + 1}`, seenDeviceIds),
        name: deviceType,
        states: [],
        order: devices.size
      }
      const state = normalizeDeviceState({
        ...candidate,
        id: candidate.id,
        key: candidate.deviceState ?? candidate.key
      }, device.states.length, new Set(device.states.map(item => item.id)))
      if (state) device.states.push(state)
      devices.set(deviceType, device)
      return
    }
    const id = uniqueId(
      typeof candidate.id === 'string' ? candidate.id : undefined,
      typeof candidate.id === 'number'
        ? `device-${candidate.id}`
        : `device-${index + 1}`,
      seenDeviceIds
    )
    const seenStateIds = new Set<string>()
    const states = Array.isArray(candidate.states)
      ? candidate.states.flatMap((state, stateIndex) => {
        const normalized = normalizeDeviceState(state, stateIndex, seenStateIds)
        return normalized ? [normalized] : []
      })
      : []
    const device = {
      id,
      name:
        typeof candidate.name === 'string' && candidate.name.trim()
          ? candidate.name.trim()
          : id,
      states,
      order: clamp(candidate.order, index, 0, Number.MAX_SAFE_INTEGER)
    }
    devices.set(id, device)
  })
  return [...devices.values()]
}

const migrateLegacyDevices = (value: Record<string, unknown>) => {
  const legacyStyle = (candidate: unknown, fallback: HighlightStyle) =>
    candidate == null ? null : normalizeStyle(candidate, fallback)
  const deviceStates: Array<[string, string, string, HighlightStyle | null]> = [
    ['valve', '阀门', 'open', isRecord(value.deviceStyles) && isRecord(value.deviceStyles.valve) ? legacyStyle(value.deviceStyles.valve.open, createHighlightStyle(0x00c853, 3)) : null],
    ['valve', '阀门', 'closed', isRecord(value.deviceStyles) && isRecord(value.deviceStyles.valve) ? legacyStyle(value.deviceStyles.valve.closed, createHighlightStyle(0xd32f2f, 3)) : null],
    ['valve', '阀门', 'pulse', isRecord(value.deviceStyles) && isRecord(value.deviceStyles.valve) ? legacyStyle(value.deviceStyles.valve.pulse, createHighlightStyle(0xf9a825, 3)) : null],
    ['motor', '泵/电机', 'start', isRecord(value.deviceStyles) && isRecord(value.deviceStyles.motor) ? legacyStyle(value.deviceStyles.motor.start, createHighlightStyle(0x00796b, 3)) : null],
    ['motor', '泵/电机', 'stop', isRecord(value.deviceStyles) && isRecord(value.deviceStyles.motor) ? legacyStyle(value.deviceStyles.motor.stop, createHighlightStyle(0x616161, 2)) : null]
  ]
  const devices = new Map<string, DeviceStyleDefinition>()
  deviceStates.forEach(([id, name, key, style], index) => {
    if (!style || !isRecord(value.deviceStyles)) return
    const device = devices.get(id) ?? { id, name, states: [], order: devices.size }
    device.states.push({
      id: `${id}-${key}`,
      key,
      displayName: key.toUpperCase(),
      ...style,
      enabled: true,
      ...legacyFlowRules(key),
      order: index
    })
    devices.set(id, device)
  })
  return [...devices.values()]
}

const normalizeProfile = (value: unknown): PresentationProfile => {
  const defaults = createDefaultPresentationProfile()
  if (!isRecord(value)) return defaults
  const persistedDevices = Array.isArray(value.deviceStyles)
    ? value.deviceStyles
    : undefined
  const deviceStyles = isRecord(value.deviceStyles) ? value.deviceStyles : {}
  const valve = isRecord(deviceStyles.valve) ? deviceStyles.valve : {}
  const motor = isRecord(deviceStyles.motor) ? deviceStyles.motor : {}
  const processEquipment = isRecord(deviceStyles.processEquipment)
    ? deviceStyles.processEquipment
    : {}
  const preserveDeviceStyles = value.deviceStylesInitialized === true
  const normalizeDeviceStyle = (candidate: unknown, color: number, width: number) =>
    preserveDeviceStyles && candidate != null
      ? normalizeStyle(candidate, createHighlightStyle(color, width))
      : null
  const seenUtilityIds = new Set<string>()
  const utilities = Array.isArray(value.utilities)
    ? value.utilities.flatMap((candidate, index) => {
      if (!isRecord(candidate)) return []
      const baseId =
        typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id.trim()
          : typeof candidate.id === 'number'
            ? `utility-${candidate.id}`
            : `utility-${index + 1}`
      let id = baseId
      let suffix = 2
      while (seenUtilityIds.has(id)) id = `${baseId}-${suffix++}`
      seenUtilityIds.add(id)
      const nestedStyle = isRecord(candidate.style) ? candidate.style : {}
      return [
        {
          id,
          name:
            typeof candidate.name === 'string' && candidate.name.trim()
              ? candidate.name.trim()
              : id,
          style: normalizeStyle({
            ...candidate,
            ...nestedStyle,
            color: firstDefined(
              nestedStyle.color,
              candidate.color,
              candidate.FillColorString
            ),
            opacity: firstDefined(
              nestedStyle.opacity,
              candidate.opacity,
              candidate.FillOpacity
            )
          }, defaults.defaultFlowStyle),
          enabled: true,
          order: clamp(candidate.order, index, 0, Number.MAX_SAFE_INTEGER)
        }
      ]
    })
    : []
  const dimmedBaseStyle = isRecord(value.dimmedBaseStyle)
    ? value.dimmedBaseStyle
    : {}
  const devices = normalizeDevices(persistedDevices ?? value.devices)
  return {
    defaultFlowStyle: normalizeStyle(
      value.defaultFlowStyle,
      defaults.defaultFlowStyle
    ),
    unknownDeviceStyle: normalizeDeviceStyle(value.unknownDeviceStyle, 0x546e7a, 2),
    dimmedBaseStyle: {
      color: Math.round(
        clamp(dimmedBaseStyle.color, defaults.dimmedBaseStyle.color, 0, 0xffffff)
      ),
      opacity: clamp(
        dimmedBaseStyle.opacity,
        defaults.dimmedBaseStyle.opacity,
        0,
        1
      )
    },
    deviceStyles: {
      valve: {
        open: normalizeDeviceStyle(valve.open, 0x00c853, 3),
        closed: normalizeDeviceStyle(valve.closed, 0xd32f2f, 3),
        pulse: normalizeDeviceStyle(valve.pulse, 0xf9a825, 3)
      },
      motor: {
        start: normalizeDeviceStyle(motor.start, 0x00796b, 3),
        stop: normalizeDeviceStyle(motor.stop, 0x616161, 2)
      },
      processEquipment: {
        active: normalizeDeviceStyle(processEquipment.active, 0x00c853, 3)
      }
    },
    deviceStylesInitialized: true,
    devices: devices.length
      ? devices
      : preserveDeviceStyles
        ? migrateLegacyDevices(value)
        : [],
    utilities
  }
}

const normalizeFlowPaths = (
  value: unknown,
  phaseId: string,
  profile: PresentationProfile
): FlowPathStatus[] => {
  if (!Array.isArray(value)) return []
  const utilityIds = new Set(profile.utilities.map(utility => utility.id))
  return value.flatMap((candidate, index) => {
    if (!isRecord(candidate)) return []
    const utilityId =
      typeof candidate.utilityId === 'string' && utilityIds.has(candidate.utilityId)
        ? candidate.utilityId
        : undefined
    const styleOverride = isRecord(candidate.styleOverride)
      ? normalizeStyle(candidate.styleOverride, profile.defaultFlowStyle)
      : undefined
    const source = isRecord(candidate.styleSource) ? candidate.styleSource : {}
    const styleSource =
      source.kind === 'custom'
        ? {
          kind: 'custom' as const,
          style: normalizeStyle(source.style, profile.defaultFlowStyle)
        }
        : source.kind === 'utility'
          ? {
            kind: 'utility' as const,
            utilityId:
              typeof source.utilityId === 'string' &&
                utilityIds.has(source.utilityId)
                ? source.utilityId
                : undefined
          }
          : undefined
    return [{
      id:
        typeof candidate.id === 'string' && candidate.id
          ? candidate.id
          : `flow-${phaseId}-${index + 1}`,
      name:
        typeof candidate.name === 'string' && candidate.name.trim()
          ? candidate.name.trim()
          : `${DEFAULT_FLOW_PATH_NAME} ${index + 1}`,
      handleKeys: Array.isArray(candidate.handleKeys)
        ? candidate.handleKeys.filter(
          (handle): handle is string => typeof handle === 'string'
        )
        : [],
      ...(typeof candidate.priority === 'number' &&
        Number.isFinite(candidate.priority)
        ? { priority: candidate.priority }
        : {}),
      styleSource,
      utilityId,
      styleOverride
    }]
  })
}

const DEVICE_MODES = new Set<DeviceMode>([
  'open',
  'closed',
  'pulse',
  'start',
  'stop',
  'active',
  'unknown'
])

const normalizeDeviceStates = (
  value: unknown
): Record<string, DeviceState> | undefined => {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value).flatMap(([recordKey, candidate]) => {
    if (!isRecord(candidate) || !DEVICE_MODES.has(candidate.mode as DeviceMode)) {
      return []
    }
    const key =
      typeof candidate.key === 'string' && candidate.key.trim()
        ? candidate.key.trim()
        : recordKey.trim()
    if (!key) return []
    return [[
      key,
      {
        key,
        label:
          typeof candidate.label === 'string' && candidate.label.trim()
            ? candidate.label.trim()
            : key,
        mode: candidate.mode as DeviceMode,
        ...(typeof candidate.stateKey === 'string' && candidate.stateKey.trim()
          ? { stateKey: candidate.stateKey.trim() }
          : {}),
        ...(typeof candidate.deviceDefinitionId === 'string' &&
          candidate.deviceDefinitionId.trim()
          ? { deviceDefinitionId: candidate.deviceDefinitionId.trim() }
          : {}),
        ...(typeof candidate.highlightStyleRefId === 'string' &&
          candidate.highlightStyleRefId.trim()
          ? { highlightStyleRefId: candidate.highlightStyleRefId.trim() }
          : {})
      }
    ] as const]
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const migrateDrawing = (
  phase: LegacyPhaseSnapshot,
  drawingAssets: Record<string, DrawingAssetRef>
): PhaseDrawingAssociation =>
  drawingAssets[phase.drawingAssetId]
    ? {
      kind: 'assigned',
      assetId: phase.drawingAssetId,
      displayName: phase.drawingDisplayName
    }
    : { kind: 'unassigned' }

const migratePhase = (
  phase: LegacyPhaseSnapshot,
  drawingAssets: Record<string, DrawingAssetRef>
): PhaseSnapshot => ({
  id: phase.id,
  number: phase.number,
  name: phase.name,
  drawing: migrateDrawing(phase, drawingAssets),
  sourcePhaseId: phase.sourcePhaseId,
  flowState: {
    flowPaths: phase.flowState.openBoundaryHandleKeys.length
      ? [
        {
          id: `flow-default-${phase.id}`,
          name: DEFAULT_FLOW_PATH_NAME,
          handleKeys: [...phase.flowState.openBoundaryHandleKeys]
        }
      ]
      : []
  },
  createdAt: phase.createdAt,
  updatedAt: phase.updatedAt
})

const migrateLegacyState = (
  legacy: LegacyPhaseWorkspaceState
): PhaseWorkspaceState => ({
  version: PHASE_WORKSPACE_SCHEMA_VERSION,
  presentationProfile: createDefaultPresentationProfile(),
  activeProcessId: legacy.activeProcessId,
  drawingAssets: Object.fromEntries(
    Object.entries(legacy.drawingAssets).map(([key, asset]) => [key, { ...asset }])
  ),
  processes: legacy.processes.map(process => {
    const sequenceId = `sequence-default-${process.id}`
    const activePhaseId = process.phases.some(
      phase => phase.id === process.activePhaseId
    )
      ? process.activePhaseId
      : undefined
    return {
      id: process.id,
      name: process.name,
      presentationProfile: createDefaultPresentationProfile(),
      sequences: [
        {
          id: sequenceId,
          number: 1,
          name: DEFAULT_SEQUENCE_NAME,
          phases: process.phases.map(phase =>
            migratePhase(phase, legacy.drawingAssets)
          ),
          activePhaseId,
          createdAt: process.createdAt,
          updatedAt: process.updatedAt
        }
      ],
      activeSequenceId: sequenceId,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt
    }
  })
})

const migrateV2State = (legacy: V2PhaseWorkspaceState): PhaseWorkspaceState => ({
  version: PHASE_WORKSPACE_SCHEMA_VERSION,
  presentationProfile: createDefaultPresentationProfile(),
  activeProcessId: legacy.activeProcessId,
  drawingAssets: Object.fromEntries(
    Object.entries(legacy.drawingAssets).map(([key, asset]) => [key, { ...asset }])
  ),
  processes: legacy.processes.map(process => ({
    ...process,
    presentationProfile: createDefaultPresentationProfile(),
    sequences: process.sequences.map(sequence => ({
      ...sequence,
      phases: sequence.phases.map(phase =>
        migratePhase(phase, legacy.drawingAssets)
      )
    }))
  }))
})

const migrateV3State = (legacy: V3PhaseWorkspaceState): PhaseWorkspaceState => ({
  version: PHASE_WORKSPACE_SCHEMA_VERSION,
  presentationProfile: createDefaultPresentationProfile(),
  activeProcessId: legacy.activeProcessId,
  drawingAssets: Object.fromEntries(
    Object.entries(legacy.drawingAssets).map(([key, asset]) => [key, { ...asset }])
  ),
  processes: legacy.processes.map(process => ({
    ...process,
    presentationProfile: createDefaultPresentationProfile(),
    sequences: process.sequences.map(sequence => ({
      ...sequence,
      phases: sequence.phases.map(phase => ({
        id: phase.id,
        number: phase.number,
        name: phase.name,
        drawing: { ...phase.drawing },
        sourcePhaseId: phase.sourcePhaseId,
        flowState: {
          flowPaths: phase.flowState.openBoundaryHandleKeys.length
            ? [
              {
                id: `flow-default-${phase.id}`,
                name: DEFAULT_FLOW_PATH_NAME,
                handleKeys: [...phase.flowState.openBoundaryHandleKeys]
              }
            ]
            : []
        },
        createdAt: phase.createdAt,
        updatedAt: phase.updatedAt
      }))
    }))
  }))
})

const normalizeState = (state: PhaseWorkspaceState): PhaseWorkspaceState => {
  const presentationProfile = normalizeProfile(
    state.presentationProfile ?? state.processes[0]?.presentationProfile
  )
  return {
    ...state,
    version: PHASE_WORKSPACE_SCHEMA_VERSION,
    presentationProfile,
    processes: state.processes.map(process => {
      const processPresentationProfile = normalizeProfile(
        process.presentationProfile
      )
    return {
      ...process,
      presentationProfile: processPresentationProfile,
      sequences: process.sequences.map(sequence => ({
        ...sequence,
        phases: sequence.phases.map(phase => ({
          id: phase.id,
          number: phase.number,
          name: phase.name,
          flowState: {
            flowPaths: normalizeFlowPaths(
              phase.flowState.flowPaths,
              phase.id,
              presentationProfile
            ),
            ...(normalizeDeviceStates(phase.flowState.deviceStates)
              ? {
                deviceStates: normalizeDeviceStates(
                  phase.flowState.deviceStates
                )
              }
              : {})
          },
          drawing: { ...phase.drawing },
          sourcePhaseId: phase.sourcePhaseId,
          textNotes: phase.textNotes?.map(note => ({
            ...note,
            location: { ...note.location }
          })),
          pidOverlayPersistence: phase.pidOverlayPersistence
            ? { ...phase.pidOverlayPersistence }
            : undefined,
          createdAt: phase.createdAt,
          updatedAt: phase.updatedAt
        }))
      }))
    }
    })
  }
}

export class PhaseWorkspaceStore {
  private state: PhaseWorkspaceState

  constructor(
    initialState: PhaseWorkspaceState = createEmptyState(),
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString()
  ) {
    this.state = cloneState(normalizeState(initialState))
  }

  static load(storage: Pick<Storage, 'getItem'> = localStorage) {
    try {
      const raw = storage.getItem(PHASE_WORKSPACE_STORAGE_KEY)
      if (!raw) return new PhaseWorkspaceStore()
      const parsed: unknown = JSON.parse(raw)
      if (isWorkspaceState(parsed)) return new PhaseWorkspaceStore(parsed)
      if (isV3WorkspaceState(parsed)) {
        return new PhaseWorkspaceStore(migrateV3State(parsed))
      }
      if (isV2WorkspaceState(parsed)) {
        return new PhaseWorkspaceStore(migrateV2State(parsed))
      }
      if (isLegacyWorkspaceState(parsed)) {
        return new PhaseWorkspaceStore(migrateLegacyState(parsed))
      }
      return new PhaseWorkspaceStore()
    } catch {
      return new PhaseWorkspaceStore()
    }
  }

  snapshot(): PhaseWorkspaceState {
    return cloneState(this.state)
  }

  persist(storage: Pick<Storage, 'setItem'> = localStorage): boolean {
    try {
      storage.setItem(PHASE_WORKSPACE_STORAGE_KEY, JSON.stringify(this.state))
      return true
    } catch {
      return false
    }
  }

  createProcess(name: string): ProcessDefinition {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Process name is required')
    const timestamp = this.now()
    const sequence: SequenceDefinition = {
      id: this.createId(),
      number: 1,
      name: DEFAULT_SEQUENCE_NAME,
      phases: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const process: ProcessDefinition = {
      id: this.createId(),
      name: normalizedName,
      presentationProfile: createDefaultPresentationProfile(),
      sequences: [sequence],
      activeSequenceId: sequence.id,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    this.state.processes.push(process)
    this.state.activeProcessId = process.id
    return { ...process, sequences: [cloneSequence(sequence)] }
  }

  deleteProcess(processId: string) {
    const index = this.state.processes.findIndex(process => process.id === processId)
    if (index < 0) throw new Error('Process was not found')
    const [deleted] = this.state.processes.splice(index, 1)
    if (this.state.activeProcessId === processId) {
      this.state.activeProcessId =
        this.state.processes[Math.min(index, this.state.processes.length - 1)]?.id
    }
    this.removeUnusedDrawings(
      deleted.sequences.flatMap(sequence =>
        sequence.phases.flatMap(phase =>
          phase.drawing.kind === 'assigned' ? [phase.drawing.assetId] : []
        )
      )
    )
    return {
      ...deleted,
      sequences: deleted.sequences.map(cloneSequence)
    }
  }

  createSequence(
    processId: string,
    number: number,
    name: string
  ): SequenceDefinition {
    const process = this.requireProcess(processId)
    const normalizedName = name.trim()
    if (!Number.isInteger(number) || number < 1) {
      throw new Error('Sequence number must be a positive integer')
    }
    if (!normalizedName) throw new Error('Sequence name is required')
    if (process.sequences.some(sequence => sequence.number === number)) {
      throw new Error(`Sequence ${number} already exists`)
    }
    const timestamp = this.now()
    const sequence: SequenceDefinition = {
      id: this.createId(),
      number,
      name: normalizedName,
      phases: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }
    process.sequences.push(sequence)
    process.activeSequenceId = sequence.id
    process.updatedAt = timestamp
    return cloneSequence(sequence)
  }

  copySequence(
    processId: string,
    sequenceId: string,
    number: number,
    name: string
  ): SequenceDefinition {
    const source = this.requireSequence(processId, sequenceId)
    const copy = this.createSequence(processId, number, name)
    const target = this.requireSequence(processId, copy.id)
    const phaseIds = new Map(source.phases.map(phase => [phase.id, this.createId()]))
    const timestamp = this.now()
    target.phases = source.phases.map(phase => ({
      ...clonePhase(phase),
      id: phaseIds.get(phase.id)!,
      sourcePhaseId: phase.sourcePhaseId
        ? phaseIds.get(phase.sourcePhaseId)
        : undefined,
      createdAt: timestamp,
      updatedAt: timestamp
    }))
    target.activePhaseId = source.activePhaseId
      ? phaseIds.get(source.activePhaseId)
      : undefined
    target.updatedAt = timestamp
    return cloneSequence(target)
  }

  renameSequence(processId: string, sequenceId: string, name: string) {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Sequence name is required')
    const sequence = this.requireSequence(processId, sequenceId)
    sequence.name = normalizedName
    sequence.updatedAt = this.now()
  }

  deleteSequence(processId: string, sequenceId: string) {
    const process = this.requireProcess(processId)
    const index = process.sequences.findIndex(item => item.id === sequenceId)
    if (index < 0) throw new Error('Sequence was not found')
    const [deleted] = process.sequences.splice(index, 1)
    if (process.activeSequenceId === sequenceId) {
      process.activeSequenceId =
        process.sequences[Math.min(index, process.sequences.length - 1)]?.id
    }
    this.removeUnusedDrawings(
      deleted.phases.flatMap(phase =>
        phase.drawing.kind === 'assigned' ? [phase.drawing.assetId] : []
      )
    )
    process.updatedAt = this.now()
    return cloneSequence(deleted)
  }

  reorderSequence(processId: string, sequenceId: string, targetIndex: number) {
    const process = this.requireProcess(processId)
    const currentIndex = process.sequences.findIndex(item => item.id === sequenceId)
    if (currentIndex < 0) throw new Error('Sequence was not found')
    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= process.sequences.length
    ) {
      throw new Error('Sequence target index is out of range')
    }
    if (currentIndex === targetIndex) return
    const [sequence] = process.sequences.splice(currentIndex, 1)
    process.sequences.splice(targetIndex, 0, sequence)
    process.updatedAt = this.now()
  }

  createPhase(input: CreatePhaseInput): PhaseSnapshot {
    const process = this.requireProcess(input.processId)
    const sequence = this.requireSequence(input.processId, input.sequenceId)
    const normalizedName = input.name.trim()
    if (!Number.isInteger(input.number) || input.number < 1) {
      throw new Error('Phase number must be a positive integer')
    }
    if (!normalizedName) throw new Error('Phase name is required')
    if (sequence.phases.some(phase => phase.number === input.number)) {
      throw new Error(`Phase ${input.number} already exists`)
    }

    let sourcePhase: PhaseSnapshot | undefined
    let phaseDrawing: PhaseDrawingAssociation
    if (input.source.kind === 'new') {
      const drawing = { ...input.source.drawing }
      const displayName = input.source.displayName.trim()
      if (!displayName) throw new Error('Drawing display name is required')
      this.state.drawingAssets[drawing.id] = drawing
      phaseDrawing = { kind: 'assigned', assetId: drawing.id, displayName }
    } else if (input.source.kind === 'unassigned') {
      phaseDrawing = { kind: 'unassigned' }
    } else {
      if (input.source.kind === 'previous') {
        sourcePhase = sequence.phases[sequence.phases.length - 1]
      } else {
        const sourcePhaseId = input.source.phaseId
        sourcePhase = sequence.phases.find(
          phase => phase.id === sourcePhaseId
        )
      }
      if (!sourcePhase) throw new Error('Source phase was not found')
      if (sourcePhase.drawing.kind === 'assigned') {
        this.requireDrawing(sourcePhase.drawing.assetId)
        phaseDrawing = {
          ...sourcePhase.drawing,
          displayName:
            input.source.displayName?.trim() || sourcePhase.drawing.displayName
        }
      } else {
        phaseDrawing = { kind: 'unassigned' }
      }
    }

    const timestamp = this.now()
    const phase: PhaseSnapshot = {
      id: this.createId(),
      number: input.number,
      name: normalizedName,
      drawing: phaseDrawing,
      sourcePhaseId: sourcePhase?.id,
      flowState: sourcePhase
        ? cloneFlowState(sourcePhase.flowState)
        : { flowPaths: [] },
      createdAt: timestamp,
      updatedAt: timestamp
    }
    sequence.phases.push(phase)
    sequence.activePhaseId = phase.id
    sequence.updatedAt = timestamp
    process.activeSequenceId = sequence.id
    process.updatedAt = timestamp
    return clonePhase(phase)
  }

  copyPhase(
    processId: string,
    sourceSequenceId: string,
    sourcePhaseId: string,
    targetSequenceId: string,
    number: number,
    name: string
  ): PhaseSnapshot {
    const process = this.requireProcess(processId)
    const source = this.requirePhase(processId, sourceSequenceId, sourcePhaseId)
    const target = this.requireSequence(processId, targetSequenceId)
    const normalizedName = name.trim()
    if (!Number.isInteger(number) || number < 1) {
      throw new Error('Phase number must be a positive integer')
    }
    if (!normalizedName) throw new Error('Phase name is required')
    if (target.phases.some(phase => phase.number === number)) {
      throw new Error(`Phase ${number} already exists`)
    }
    if (source.drawing.kind === 'assigned') {
      this.requireDrawing(source.drawing.assetId)
    }

    const timestamp = this.now()
    const phase: PhaseSnapshot = {
      ...clonePhase(source),
      id: this.createId(),
      number,
      name: normalizedName,
      sourcePhaseId: source.id,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    target.phases.push(phase)
    target.activePhaseId = phase.id
    target.updatedAt = timestamp
    process.activeSequenceId = target.id
    process.updatedAt = timestamp
    return clonePhase(phase)
  }

  updatePhaseState(
    processId: string,
    sequenceId: string,
    phaseId: string,
    state: Pick<PhaseSnapshot, 'flowState'>
  ) {
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    phase.flowState = cloneFlowState(state.flowState)
    phase.updatedAt = this.now()
  }

  updatePresentationProfile(
    presentationProfileOrProcessId: PresentationProfile | string,
    legacyPresentationProfile?: PresentationProfile
  ) {
    const presentationProfile =
      typeof presentationProfileOrProcessId === 'string'
        ? legacyPresentationProfile
        : presentationProfileOrProcessId
    if (!presentationProfile) return
    const normalized = normalizeProfile(presentationProfile)
    this.state.presentationProfile = normalized
  }

  renameDrawing(
    processId: string,
    sequenceId: string,
    phaseId: string,
    displayName: string
  ) {
    const normalizedName = displayName.trim()
    if (!normalizedName) throw new Error('Drawing display name is required')
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    if (phase.drawing.kind !== 'assigned') {
      throw new Error('Phase has no drawing association')
    }
    phase.drawing.displayName = normalizedName
    phase.updatedAt = this.now()
  }

  associateDrawing(
    processId: string,
    sequenceId: string,
    phaseId: string,
    drawing: DrawingAssetRef,
    displayName: string
  ): DrawingAssetRef | undefined {
    const normalizedName = displayName.trim()
    if (!normalizedName) throw new Error('Drawing display name is required')
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    const previousAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    this.state.drawingAssets[drawing.id] = { ...drawing }
    phase.drawing = {
      kind: 'assigned',
      assetId: drawing.id,
      displayName: normalizedName
    }
    phase.updatedAt = this.now()
    return previousAssetId
      ? this.removeUnusedDrawing(previousAssetId)
      : undefined
  }

  associateMarkedPhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    sourceProcessId: string,
    sourceSequenceId: string,
    sourcePhaseId: string
  ): DrawingAssetRef | undefined {
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    const sourcePhase = this.requirePhase(
      sourceProcessId,
      sourceSequenceId,
      sourcePhaseId
    )
    if (sourcePhase.drawing.kind !== 'assigned') {
      throw new Error('Source phase has no drawing association')
    }
    this.requireDrawing(sourcePhase.drawing.assetId)
    const previousAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    phase.drawing = { ...sourcePhase.drawing }
    phase.sourcePhaseId = sourcePhase.id
    phase.flowState = cloneFlowState(sourcePhase.flowState)
    phase.updatedAt = this.now()
    return previousAssetId
      ? this.removeUnusedDrawing(previousAssetId)
      : undefined
  }

  clearDrawingAssociation(
    processId: string,
    sequenceId: string,
    phaseId: string
  ): DrawingAssetRef | undefined {
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    const previousAssetId =
      phase.drawing.kind === 'assigned' ? phase.drawing.assetId : undefined
    phase.drawing = { kind: 'unassigned' }
    phase.updatedAt = this.now()
    return previousAssetId
      ? this.removeUnusedDrawing(previousAssetId)
      : undefined
  }

  renamePhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    name: string
  ) {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Phase name is required')
    const phase = this.requirePhase(processId, sequenceId, phaseId)
    phase.name = normalizedName
    phase.updatedAt = this.now()
  }

  deletePhase(processId: string, sequenceId: string, phaseId: string) {
    const sequence = this.requireSequence(processId, sequenceId)
    const phaseIndex = sequence.phases.findIndex(phase => phase.id === phaseId)
    if (phaseIndex < 0) throw new Error('Phase was not found')
    const [deletedPhase] = sequence.phases.splice(phaseIndex, 1)
    if (sequence.activePhaseId === phaseId) {
      sequence.activePhaseId =
        sequence.phases[Math.min(phaseIndex, sequence.phases.length - 1)]?.id
    }
    if (deletedPhase.drawing.kind === 'assigned') {
      this.removeUnusedDrawings([deletedPhase.drawing.assetId])
    }
    sequence.updatedAt = this.now()
    return clonePhase(deletedPhase)
  }

  reorderPhase(
    processId: string,
    sequenceId: string,
    phaseId: string,
    targetIndex: number
  ) {
    const sequence = this.requireSequence(processId, sequenceId)
    const currentIndex = sequence.phases.findIndex(phase => phase.id === phaseId)
    if (currentIndex < 0) throw new Error('Phase was not found')
    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= sequence.phases.length
    ) {
      throw new Error('Phase target index is out of range')
    }
    if (currentIndex === targetIndex) return
    const [phase] = sequence.phases.splice(currentIndex, 1)
    sequence.phases.splice(targetIndex, 0, phase)
    sequence.updatedAt = this.now()
  }

  activate(processId: string, sequenceId?: string, phaseId?: string) {
    const process = this.requireProcess(processId)
    const sequence = sequenceId
      ? this.requireSequence(processId, sequenceId)
      : undefined
    if (phaseId) {
      if (!sequence) throw new Error('Sequence is required to activate a phase')
      this.requirePhase(processId, sequence.id, phaseId)
    }
    this.state.activeProcessId = processId
    process.activeSequenceId = sequence?.id
    if (sequence) sequence.activePhaseId = phaseId
  }

  private removeUnusedDrawings(assetIds: string[]) {
    for (const assetId of new Set(assetIds)) {
      this.removeUnusedDrawing(assetId)
    }
  }

  private removeUnusedDrawing(assetId: string): DrawingAssetRef | undefined {
    const drawingStillUsed = this.state.processes.some(process =>
      process.sequences.some(sequence =>
        sequence.phases.some(
          phase =>
            phase.drawing.kind === 'assigned' &&
            phase.drawing.assetId === assetId
        )
      )
    )
    if (drawingStillUsed) return undefined
    const drawing = this.state.drawingAssets[assetId]
    delete this.state.drawingAssets[assetId]
    return drawing ? { ...drawing } : undefined
  }

  private requireProcess(processId: string) {
    const process = this.state.processes.find(item => item.id === processId)
    if (!process) throw new Error('Process was not found')
    return process
  }

  private requireSequence(processId: string, sequenceId: string) {
    const sequence = this.requireProcess(processId).sequences.find(
      item => item.id === sequenceId
    )
    if (!sequence) throw new Error('Sequence was not found')
    return sequence
  }

  private requirePhase(
    processId: string,
    sequenceId: string,
    phaseId: string
  ) {
    const phase = this.requireSequence(processId, sequenceId).phases.find(
      item => item.id === phaseId
    )
    if (!phase) throw new Error('Phase was not found')
    return phase
  }

  private requireDrawing(assetId: string) {
    const drawing = this.state.drawingAssets[assetId]
    if (!drawing) throw new Error('Drawing asset was not found')
    return drawing
  }
}
