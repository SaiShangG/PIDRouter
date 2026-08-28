export enum TextAttachmentPoint {
  TopLeft = 1,
  TopCenter = 2,
  TopRight = 3,
  MiddleLeft = 4,
  MiddleCenter = 5,
  MiddleRight = 6,
  BottomLeft = 7,
  BottomCenter = 8,
  BottomRight = 9
}

export interface PhasePidOverlayDrawing {
  fileId: number
  displayName: string
}

export interface PhasePidOverlayFlowPath {
  handleKey: string
  highlightStyleRefId: string
}

export interface PhasePidOverlayDeviceState {
  handleKey: string
  stateKey: string
  highlightStyleRefId: string
  deviceType?: string
}

export interface PhasePidOverlayTextLocation {
  x: number
  y: number
  z: number
}

export interface PhasePidOverlayTextNote {
  id: string
  contents: string
  location: PhasePidOverlayTextLocation
  width: number
  height?: number
  rotation?: number
  attachmentPoint: TextAttachmentPoint
  lineSpacingFactor?: number
  textHeight?: number
  textStyleRefId?: string
  linkedObjectHandleKey?: string
  visible: boolean
  createdAt: string
  updatedAt: string
}

export interface PhasePidOverlay {
  Index: number
  OrderId: number
  Name: string
  Comment: string | null
  drawing?: PhasePidOverlayDrawing
  flowPaths: PhasePidOverlayFlowPath[]
  deviceStates: PhasePidOverlayDeviceState[]
  textNotes: PhasePidOverlayTextNote[]
}

export type PhasePidOverlayWarningCode =
  | 'invalid-drawing'
  | 'invalid-flow-path'
  | 'duplicate-flow-path'
  | 'invalid-device-state'
  | 'duplicate-device-state'
  | 'invalid-text-note'
  | 'duplicate-text-note-id'

export interface PhasePidOverlayWarning {
  code: PhasePidOverlayWarningCode
  path: string
}

export type PhasePidOverlayParseResult =
  | {
    status: 'valid'
    overlay: PhasePidOverlay
    warnings: PhasePidOverlayWarning[]
  }
  | {
    status: 'invalid'
    reason: 'invalid-json' | 'invalid-root'
    warnings: []
  }

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isOptionalPositiveFiniteNumber = (value: unknown): value is number | undefined =>
  value === undefined || isPositiveFiniteNumber(value)

const isOptionalFiniteNumber = (value: unknown): value is number | undefined =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value))

const isUtcIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  !Number.isNaN(Date.parse(value))

const isTextAttachmentPoint = (value: unknown): value is TextAttachmentPoint =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 9

const normalizeHandleKey = (value: unknown): string | undefined => {
  if (!isNonEmptyString(value)) return undefined
  const handleKey = value.trim()
  return /^[0-9]+$/.test(handleKey) ? BigInt(handleKey).toString(10) : undefined
}

const readDrawing = (value: unknown): PhasePidOverlayDrawing | undefined => {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.fileId) ||
    Number(value.fileId) < 1 ||
    !isNonEmptyString(value.displayName)
  ) {
    return undefined
  }
  return {
    fileId: Number(value.fileId),
    displayName: value.displayName.trim()
  }
}

const readFlowPath = (value: unknown): PhasePidOverlayFlowPath | undefined => {
  if (!isRecord(value) || !isNonEmptyString(value.highlightStyleRefId)) {
    return undefined
  }
  const handleKey = normalizeHandleKey(value.handleKey)
  return handleKey
    ? { handleKey, highlightStyleRefId: value.highlightStyleRefId.trim() }
    : undefined
}

const readDeviceState = (
  value: unknown
): PhasePidOverlayDeviceState | undefined => {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.stateKey) ||
    !isNonEmptyString(value.highlightStyleRefId) ||
    (value.deviceType !== undefined && !isNonEmptyString(value.deviceType))
  ) {
    return undefined
  }
  const handleKey = normalizeHandleKey(value.handleKey)
  return handleKey
    ? {
      handleKey,
      stateKey: value.stateKey.trim(),
      highlightStyleRefId: value.highlightStyleRefId.trim(),
      ...(isNonEmptyString(value.deviceType)
        ? { deviceType: value.deviceType.trim() }
        : {})
    }
    : undefined
}

const readTextNote = (value: unknown): PhasePidOverlayTextNote | undefined => {
  if (
    !isRecord(value) ||
    !isRecord(value.location) ||
    !isNonEmptyString(value.id) ||
    typeof value.contents !== 'string' ||
    typeof value.location.x !== 'number' ||
    !Number.isFinite(value.location.x) ||
    typeof value.location.y !== 'number' ||
    !Number.isFinite(value.location.y) ||
    typeof value.location.z !== 'number' ||
    !Number.isFinite(value.location.z) ||
    !isPositiveFiniteNumber(value.width) ||
    !isOptionalPositiveFiniteNumber(value.height) ||
    !isOptionalFiniteNumber(value.rotation) ||
    !isTextAttachmentPoint(value.attachmentPoint) ||
    !isOptionalPositiveFiniteNumber(value.lineSpacingFactor) ||
    !isOptionalPositiveFiniteNumber(value.textHeight) ||
    (value.textStyleRefId !== undefined && !isNonEmptyString(value.textStyleRefId)) ||
    typeof value.visible !== 'boolean' ||
    !isUtcIsoTimestamp(value.createdAt) ||
    !isUtcIsoTimestamp(value.updatedAt)
  ) {
    return undefined
  }
  const linkedObjectHandleKey = value.linkedObjectHandleKey === undefined
    ? undefined
    : normalizeHandleKey(value.linkedObjectHandleKey)
  if (value.linkedObjectHandleKey !== undefined && !linkedObjectHandleKey) {
    return undefined
  }
  return {
    id: value.id.trim(),
    contents: value.contents,
    location: {
      x: value.location.x,
      y: value.location.y,
      z: value.location.z
    },
    width: value.width,
    height: value.height,
    rotation: value.rotation,
    attachmentPoint: value.attachmentPoint,
    lineSpacingFactor: value.lineSpacingFactor,
    textHeight: value.textHeight,
    textStyleRefId: value.textStyleRefId?.trim(),
    linkedObjectHandleKey,
    visible: value.visible,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  }
}

export const parsePhasePidOverlay = (
  input: unknown
): PhasePidOverlayParseResult => {
  let value = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown
    } catch {
      return { status: 'invalid', reason: 'invalid-json', warnings: [] }
    }
  }
  if (!isRecord(value)) {
    return { status: 'invalid', reason: 'invalid-root', warnings: [] }
  }
  if (
    !Number.isInteger(value.Index) ||
    !Number.isInteger(value.OrderId) ||
    !isNonEmptyString(value.Name) ||
    (value.Comment !== null && typeof value.Comment !== 'string') ||
    (value.flowPaths !== null && !Array.isArray(value.flowPaths)) ||
    (value.deviceStates !== null && !Array.isArray(value.deviceStates)) ||
    !Array.isArray(value.textNotes)
  ) {
    return { status: 'invalid', reason: 'invalid-root', warnings: [] }
  }

  const warnings: PhasePidOverlayWarning[] = []
  const drawing = value.drawing === undefined ? undefined : readDrawing(value.drawing)
  if (value.drawing !== undefined && !drawing) {
    warnings.push({ code: 'invalid-drawing', path: 'drawing' })
  }

  const flowPaths: PhasePidOverlayFlowPath[] = []
  const flowPathKeys = new Set<string>()
  const flowPathValues = Array.isArray(value.flowPaths) ? value.flowPaths : []
  flowPathValues.forEach((candidate, index) => {
    const flowPath = readFlowPath(candidate)
    if (!flowPath) {
      warnings.push({
        code: 'invalid-flow-path',
        path: `flowPaths[${index}]`
      })
      return
    }
    const key = flowPath.handleKey
    if (flowPathKeys.has(key)) {
      warnings.push({
        code: 'duplicate-flow-path',
        path: `flowPaths[${index}]`
      })
      return
    }
    flowPathKeys.add(key)
    flowPaths.push(flowPath)
  })

  const deviceStates: PhasePidOverlayDeviceState[] = []
  const deviceStateHandles = new Set<string>()
  const deviceStateValues = Array.isArray(value.deviceStates)
    ? value.deviceStates
    : []
  deviceStateValues.forEach((candidate, index) => {
    const deviceState = readDeviceState(candidate)
    if (!deviceState) {
      warnings.push({
        code: 'invalid-device-state',
        path: `deviceStates[${index}]`
      })
      return
    }
    if (deviceStateHandles.has(deviceState.handleKey)) {
      warnings.push({
        code: 'duplicate-device-state',
        path: `deviceStates[${index}]`
      })
      return
    }
    deviceStateHandles.add(deviceState.handleKey)
    deviceStates.push(deviceState)
  })

  const textNotes: PhasePidOverlayTextNote[] = []
  const textNoteIds = new Set<string>()
  value.textNotes.forEach((candidate, index) => {
    const textNote = readTextNote(candidate)
    if (!textNote) {
      warnings.push({ code: 'invalid-text-note', path: `textNotes[${index}]` })
      return
    }
    if (textNoteIds.has(textNote.id)) {
      warnings.push({
        code: 'duplicate-text-note-id',
        path: `textNotes[${index}]`
      })
      return
    }
    textNoteIds.add(textNote.id)
    textNotes.push(textNote)
  })

  return {
    status: 'valid',
    overlay: {
      Index: Number(value.Index),
      OrderId: Number(value.OrderId),
      Name: value.Name.trim(),
      Comment: typeof value.Comment === 'string' ? value.Comment : null,
      ...(drawing ? { drawing } : {}),
      flowPaths,
      deviceStates,
      textNotes
    },
    warnings
  }
}