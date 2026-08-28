import type { FlowPathStatus } from './types'

export const collectHighlightHandleKeys = <Id>(
  objectIds: Iterable<Id>,
  resolveHandleKeys: (objectId: Id) => readonly string[]
): string[] => {
  const handleKeys = new Set<string>()
  for (const objectId of objectIds) {
    const handleKey = resolveHandleKeys(objectId)
      .map(candidate => candidate.trim().toUpperCase())
      .find(candidate => /^[0-9A-F]+$/.test(candidate))
    if (handleKey) handleKeys.add(handleKey)
  }
  return [...handleKeys]
}

export const findStaleHighlightRootIds = <Id>(
  rootIds: Iterable<Id>,
  referencedIds: ReadonlySet<Id>
): Id[] => [...rootIds].filter(id => !referencedIds.has(id))

export const retainUnresolvedFlowPaths = (
  flowPaths: readonly FlowPathStatus[],
  canResolveHandle: (handleKey: string) => boolean
): FlowPathStatus[] =>
  flowPaths
    .map(flowPath => ({
      ...flowPath,
      handleKeys: flowPath.handleKeys.filter(handleKey =>
        !canResolveHandle(handleKey)
      )
    }))
    .filter(flowPath => flowPath.handleKeys.length > 0)

export const selectFlowPathRestoreHandleKeys = (
  flowPathHandleKeys: readonly string[],
  boundaryHandleKeys: readonly string[],
  conductingBoundaryHandleKeys: readonly string[],
  relatedOpenBoundaryHandleKeys: readonly string[]
): string[] => {
  if (conductingBoundaryHandleKeys.length > 0) {
    return [...new Set(conductingBoundaryHandleKeys)]
  }
  if (relatedOpenBoundaryHandleKeys.length > 0) {
    return [...new Set(relatedOpenBoundaryHandleKeys)]
  }
  return boundaryHandleKeys.length > 0 ? [] : [...new Set(flowPathHandleKeys)]
}