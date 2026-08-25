import type {
  DocumentAreaInput,
  DocumentControlModule,
  DocumentControlModuleInput,
  FlowConnectionDocumentInput,
  FlowGraphEdge,
  FlowGraphIndex,
  FlowGraphNode,
  FlowGraphNodeKind
} from './types'

const normalizeLabel = (value: string | undefined) => value?.trim() || undefined

/** Returns the canonical handle key used by the flow graph and CAD adapter. */
export const normalizeFlowHandle = (
  value: number | string | null | undefined
): string | undefined => {
  if (value == null) return undefined
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return undefined
    return Math.trunc(value).toString(16).toUpperCase()
  }

  const raw = value.trim().replace(/^0x/i, '')
  if (!raw || !/^[0-9a-f]+$/i.test(raw)) return undefined
  return raw.replace(/^0+/, '').toUpperCase() || '0'
}

const moduleInfo = (module: DocumentControlModuleInput, name: string) =>
  module.Infos?.find(info => info.Name?.trim().toUpperCase() === name)?.Value?.trim()

const classifyControlModule = (
  module: DocumentControlModuleInput
): DocumentControlModule['deviceType'] => {
  const tokens = [module.Name, moduleInfo(module, 'YQJ_CODE')]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(value => value.trim().toUpperCase())
  if (tokens.some(value => value === 'VALVE' || value.includes('VALVE'))) return 'valve'
  if (tokens.some(value => value === 'PUMP' || value.includes('PUMP'))) return 'pump'
  return 'equipment'
}

const collectControlModules = (document: FlowConnectionDocumentInput) => {
  const modules = new Map<string, DocumentControlModule>()
  document.Areas?.forEach(area => {
    area.ControlModules?.forEach(module => {
      const key = normalizeFlowHandle(module.CadHandle)
      if (!key || module.CadHandle == null || modules.has(key)) return
      modules.set(key, {
        ...module,
        CadHandle: module.CadHandle,
        areaId: normalizeLabel(area.Id),
        deviceType: classifyControlModule(module)
      })
    })
  })
  return modules
}

const createNode = (
  key: string,
  module: DocumentControlModule | undefined,
  existsInDocument: boolean
): FlowGraphNode => {
  const handle = Number.parseInt(key, 16)
  const kind: FlowGraphNodeKind = module?.deviceType ?? 'line'

  return {
    key,
    handle,
    kind,
    label: handle.toString(10),
    componentId: normalizeLabel(module?.Id),
    componentName: normalizeLabel(module?.Name),
    missingEntity: !existsInDocument
  }
}

const addNeighbor = (
  adjacency: Map<string, string[]>,
  from: string,
  to: string
) => {
  const neighbors = adjacency.get(from) ?? []
  if (!neighbors.includes(to)) neighbors.push(to)
  adjacency.set(from, neighbors)
}

const linkType = (typeName: string | undefined) =>
  typeName?.split(',')[0]?.split('.').pop()

const inferContainedModuleOwners = (
  areas: readonly DocumentAreaInput[],
  modules: ReadonlyMap<string, DocumentControlModule>,
  adjacency: ReadonlyMap<string, readonly string[]>
) => {
  const owners = new Map<string, DocumentControlModule>()

  areas.forEach(area => {
    const allowed = new Set(
      area.ContainCadEntityHandles
        ?.map(normalizeFlowHandle)
        .filter((key): key is string => key != null) ?? []
    )
    const areaModules = [...modules.entries()].filter(([, module]) => module.areaId === area.Id)
    const distances = new Map<string, number>()
    const candidates = new Map<string, Set<string>>()
    const queue: string[] = []

    areaModules.forEach(([key]) => {
      if (!allowed.has(key)) return
      distances.set(key, 0)
      candidates.set(key, new Set([key]))
      queue.push(key)
    })

    while (queue.length > 0) {
      const current = queue.shift()!
      const nextDistance = (distances.get(current) ?? 0) + 1
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!allowed.has(neighbor)) continue
        const knownDistance = distances.get(neighbor)
        if (knownDistance == null || nextDistance < knownDistance) {
          distances.set(neighbor, nextDistance)
          candidates.set(neighbor, new Set(candidates.get(current)))
          queue.push(neighbor)
        } else if (nextDistance === knownDistance) {
          const ownersAtDistance = candidates.get(neighbor) ?? new Set<string>()
          const previousSize = ownersAtDistance.size
          candidates.get(current)?.forEach(owner => ownersAtDistance.add(owner))
          candidates.set(neighbor, ownersAtDistance)
          if (ownersAtDistance.size !== previousSize) queue.push(neighbor)
        }
      }
    }

    candidates.forEach((candidateKeys, handleKey) => {
      if (candidateKeys.size !== 1) return
      const primaryKey = candidateKeys.values().next().value as string
      const module = modules.get(primaryKey)
      if (module) owners.set(handleKey, module)
    })
  })

  return owners
}

/** Builds stable device indexes and an undirected graph from Document.json. */
export const buildFlowGraphIndex = (
  document: FlowConnectionDocumentInput
): FlowGraphIndex => {
  const modules = collectControlModules(document)
  const nodes = new Map<string, FlowGraphNode>()
  const adjacency = new Map<string, string[]>()
  const edges: FlowGraphEdge[] = []
  const vertices = new Set(
    document.Map?.Graph?.Vertices
      ?.map(normalizeFlowHandle)
      .filter((key): key is string => key != null) ?? []
  )

  const ensureNode = (key: string) => {
    const module = modules.get(key)
    if (!nodes.has(key)) nodes.set(key, createNode(key, module, Boolean(module) || vertices.has(key)))
    if (!adjacency.has(key)) adjacency.set(key, [])
  }

  vertices.forEach(ensureNode)
  modules.forEach((_, key) => ensureNode(key))

  document.Map?.Graph?.Edges?.forEach(edge => {
    const source = normalizeFlowHandle(edge.Source)
    const target = normalizeFlowHandle(edge.Target)
    if (!source || !target) return
    vertices.add(source)
    vertices.add(target)
    ensureNode(source)
    ensureNode(target)
    addNeighbor(adjacency, source, target)
    addNeighbor(adjacency, target, source)
    edges.push({
      source,
      target,
      linkTypeName: edge.LinkTypeName,
      linkType: linkType(edge.LinkTypeName),
      linkJson: edge.LinkJson
    })
  })

  const containedOwners = inferContainedModuleOwners(document.Areas ?? [], modules, adjacency)
  const primaryHandleByCadHandle = new Map<string, string>()
  modules.forEach((_, key) => primaryHandleByCadHandle.set(key, key))
  containedOwners.forEach((module, key) => {
    const primaryKey = normalizeFlowHandle(module.CadHandle)
    if (primaryKey) primaryHandleByCadHandle.set(key, primaryKey)
  })

  const deviceKeysByType = new Map<Exclude<FlowGraphNodeKind, 'line'>, Set<string>>([
    ['valve', new Set()],
    ['pump', new Set()],
    ['equipment', new Set()]
  ])
  modules.forEach((module, key) => deviceKeysByType.get(module.deviceType)?.add(key))
  const valveKeys = deviceKeysByType.get('valve') ?? new Set<string>()
  const pumpKeys = deviceKeysByType.get('pump') ?? new Set<string>()

  return {
    nodes,
    adjacency,
    edges,
    controlModuleByPrimaryHandle: modules,
    controlModuleByContainedHandle: containedOwners,
    primaryHandleByCadHandle,
    deviceKeysByType,
    valveKeys,
    pumpKeys
  }
}
