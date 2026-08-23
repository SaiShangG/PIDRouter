import type {
  FlowDebugTreeNode,
  FlowGraphIndex,
  FlowGraphNode,
  FlowTraversalResult,
  ValveRuntimeState,
  ValveRuntimeStateInput
} from './types'

const nodeStatus = (
  node: FlowGraphNode,
  state: ValveRuntimeState | undefined,
  isStart: boolean
): FlowDebugTreeNode['status'] => {
  if (isStart) return state === 'closed' ? 'closed' : 'start'
  if (node.missingEntity) return 'missing'
  if (node.kind === 'valve') return state === 'closed' ? 'closed' : 'open'
  if (node.kind === 'line') return 'line'
  return 'equipment'
}

const edgeKey = (left: string, right: string) =>
  `${left}|${right}`

const valveState = (
  states: ValveRuntimeStateInput,
  key: string
): ValveRuntimeState => {
  if ('get' in states) return states.get(key) ?? 'closed'
  return states.has(key) ? 'open' : 'closed'
}

/** Traverses one valve through outgoing connections and returns a debug tree. */
export const traverseFlowFromValve = (
  graph: FlowGraphIndex,
  startKey: string,
  valveStates: ValveRuntimeStateInput
): FlowTraversalResult => {
  const start = graph.nodes.get(startKey) ?? {
    key: startKey,
    handle: Number.parseInt(startKey, 16),
    kind: 'valve' as const,
    label: startKey,
    missingEntity: true
  }
  const diagnostics: string[] = []
  if (!graph.nodes.has(startKey)) diagnostics.push(`Missing graph node ${startKey}`)

  const startState = valveState(valveStates, startKey)
  const startNeighbors = graph.adjacency.get(startKey) ?? []
  const diagnosedMissing = new Set<string>()
  if (start.missingEntity) {
    diagnostics.push(`Missing entity ${startKey}`)
    diagnosedMissing.add(startKey)
  }
  if (startNeighbors.length === 0) {
    diagnostics.push(`No topology connections for ${startKey}`)
  }
  const root: FlowDebugTreeNode = {
    key: startKey,
    node: start,
    status: nodeStatus(start, startState, true),
    depth: 0,
    children: []
  }
  const visited = new Set<string>([startKey])
  const visitedEdges = new Set<string>()
  const highlighted = new Set<string>()
  const stoppedValves = new Set<string>()

  if (startState === 'open') {
    highlighted.add(startKey)
  } else {
    stoppedValves.add(startKey)
  }

  const queue: Array<{ key: string; tree: FlowDebugTreeNode }> = []
  if (startState === 'open') queue.push({ key: startKey, tree: root })

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = graph.adjacency.get(current.key) ?? []

    for (const neighborKey of neighbors) {
      visitedEdges.add(edgeKey(current.key, neighborKey))
      const neighbor = graph.nodes.get(neighborKey) ?? {
        key: neighborKey,
        handle: Number.parseInt(neighborKey, 16),
        kind: 'equipment' as const,
        label: neighborKey,
        missingEntity: true
      }
      if (neighbor.missingEntity && !diagnosedMissing.has(neighborKey)) {
        diagnostics.push(`Missing entity ${neighborKey}`)
        diagnosedMissing.add(neighborKey)
      }
      const state = neighbor.kind === 'valve'
        ? valveState(valveStates, neighborKey)
        : undefined

      // Keep cycle/convergence detection internally, but do not add duplicate
      // references to the debug tree. Each handle is listed only on first visit.
      if (visited.has(neighborKey)) continue

      visited.add(neighborKey)
      const child: FlowDebugTreeNode = {
        key: neighborKey,
        node: neighbor,
        status: nodeStatus(neighbor, state, false),
        depth: current.tree.depth + 1,
        children: []
      }
      current.tree.children.push(child)

      if (neighbor.kind === 'valve' && state === 'closed') {
        stoppedValves.add(neighborKey)
        continue
      }

      if (neighbor.kind === 'line') highlighted.add(neighborKey)
      queue.push({ key: neighborKey, tree: child })
    }
  }

  return {
    root,
    visitedKeys: visited,
    visitedEdges,
    highlightedKeys: highlighted,
    stoppedValveKeys: stoppedValves,
    diagnostics
  }
}

export const mergeFlowHighlightKeys = (
  results: Iterable<FlowTraversalResult>
) => {
  const keys = new Set<string>()
  for (const result of results) result.highlightedKeys.forEach(key => keys.add(key))
  return keys
}

export const countFlowTreeNodes = (root: FlowDebugTreeNode): number =>
  1 + root.children.reduce((count, child) => count + countFlowTreeNodes(child), 0)

export const countFlowTreeStops = (root: FlowDebugTreeNode): number =>
  (root.status === 'closed' ? 1 : 0) +
  root.children.reduce((count, child) => count + countFlowTreeStops(child), 0)
