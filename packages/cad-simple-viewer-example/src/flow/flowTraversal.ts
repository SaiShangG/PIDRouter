import type { FlowBehavior } from '../phase/types'
import type { DeviceFlowPolicy } from './deviceFlowRuntime'
import type {
  FlowDebugTreeNode,
  FlowGraphIndex,
  FlowGraphNode,
  FlowTraversalResult,
  ValveRuntimeState,
  ValveRuntimeStateInput
} from './types'

type FlowBoundaryBehaviorInput = ReadonlyMap<string, FlowBehavior>

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
  left.localeCompare(right) <= 0 ? `${left}|${right}` : `${right}|${left}`

const valveState = (
  states: ValveRuntimeStateInput,
  key: string
): ValveRuntimeState => {
  if ('get' in states) return states.get(key) ?? 'closed'
  return states.has(key) ? 'open' : 'closed'
}

const walkFlowFromDevice = (
  graph: FlowGraphIndex,
  startKey: string,
  policies: ReadonlyMap<string, DeviceFlowPolicy>,
  sourceEnabled: boolean,
  details?: {
    visit(key: string, parentKey: string): void
    edge(left: string, right: string): void
  }
) => {
  const visitedKeys = new Set([startKey])
  const highlightedKeys = new Set<string>()
  const policy = policies.get(startKey)
  const queue: string[] = []
  if (sourceEnabled && policy?.flowBehavior === 'conducting' && policy.autoHighlightFlow) {
    highlightedKeys.add(startKey)
    queue.push(startKey)
  }
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    for (const neighbor of graph.adjacency.get(current) ?? []) {
      details?.edge(current, neighbor)
      if (visitedKeys.has(neighbor)) continue
      visitedKeys.add(neighbor)
      details?.visit(neighbor, current)
      if (policies.get(neighbor)?.flowBehavior === 'blocking') continue
      highlightedKeys.add(neighbor)
      queue.push(neighbor)
    }
  }
  return { visitedKeys, highlightedKeys }
}

export const collectFlowHighlightKeys = (
  graph: FlowGraphIndex,
  startKey: string,
  policies: ReadonlyMap<string, DeviceFlowPolicy>
) => walkFlowFromDevice(
  graph, startKey, policies, policies.get(startKey)?.autoHighlightFlow ?? false
).highlightedKeys

/** Adds debug details to the same walk used by automatic highlighting. */
export const traverseFlowFromDevice = (
  graph: FlowGraphIndex,
  startKey: string,
  policies: ReadonlyMap<string, DeviceFlowPolicy>,
  sourceEnabled = policies.get(startKey)?.autoHighlightFlow ?? false
): FlowTraversalResult => {
  const start = graph.nodes.get(startKey) ?? {
    key: startKey,
    handle: Number.parseInt(startKey, 16),
    kind: 'equipment' as const,
    label: startKey,
    missingEntity: true
  }
  const diagnostics: string[] = []
  if (!graph.nodes.has(startKey)) diagnostics.push(`Missing graph node ${startKey}`)

  const startPolicy = policies.get(startKey)
  const startState = startPolicy?.flowBehavior === 'blocking' ? 'closed' : 'open'
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
    status: startPolicy?.issue ?? (
      startPolicy?.flowBehavior === 'neutral' ? 'neutral' : nodeStatus(start, startState, true)
    ),
    depth: 0,
    children: []
  }
  const visitedEdges = new Set<string>()
  const stoppedValves = new Set<string>()
  if (startState === 'closed') stoppedValves.add(startKey)
  const treeByKey = new Map([[startKey, root]])
  const result = walkFlowFromDevice(graph, startKey, policies, sourceEnabled, {
    edge: (left, right) => visitedEdges.add(edgeKey(left, right)),
    visit: (neighborKey, parentKey) => {
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
      const policy = policies.get(neighborKey)
      const state = policy
        ? policy.flowBehavior === 'blocking' ? 'closed' : 'open'
        : undefined

      const parent = treeByKey.get(parentKey)!
      const child: FlowDebugTreeNode = {
        key: neighborKey,
        node: neighbor,
        status: policy?.issue ?? (
          policy?.flowBehavior === 'neutral' ? 'neutral' :
            state ? state : nodeStatus(neighbor, state, false)
        ),
        depth: parent.depth + 1,
        children: []
      }
      parent.children.push(child)
      treeByKey.set(neighborKey, child)
      if (state === 'closed') stoppedValves.add(neighborKey)
    }
  })

  return {
    root,
    visitedKeys: result.visitedKeys,
    visitedEdges,
    highlightedKeys: result.highlightedKeys,
    stoppedValveKeys: stoppedValves,
    diagnostics
  }
}

/** Compatibility adapter for callers that supply legacy open/closed valve states. */
export const traverseFlowFromValve = (
  graph: FlowGraphIndex,
  startKey: string,
  valveStates: ValveRuntimeStateInput,
  boundaryBehaviors?: FlowBoundaryBehaviorInput
): FlowTraversalResult => {
  const policies = new Map<string, DeviceFlowPolicy>()
  graph.valveKeys.forEach(key => {
    const open = valveState(valveStates, key) === 'open'
    policies.set(key, {
      flowBehavior: open ? 'conducting' : 'blocking',
      autoHighlightFlow: open
    })
  })
  boundaryBehaviors?.forEach((flowBehavior, key) => {
    policies.set(key, {
      flowBehavior,
      autoHighlightFlow: flowBehavior !== 'blocking'
    })
  })
  return traverseFlowFromDevice(graph, startKey, policies)
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
  (['closed', 'unselected', 'missing-state'].includes(root.status) ? 1 : 0) +
  root.children.reduce((count, child) => count + countFlowTreeStops(child), 0)
