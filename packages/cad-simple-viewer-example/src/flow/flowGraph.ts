import type {
  FlowConnectionDocumentInput,
  FlowConnectionEntityInput,
  FlowGraphIndex,
  FlowGraphNode
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

const entityType = (entity: FlowConnectionEntityInput | undefined) =>
  entity?.$type?.split(',')[0]?.split('.').pop()?.toLowerCase() ?? ''

const isLineEntity = (entity: FlowConnectionEntityInput | undefined) =>
  entityType(entity).includes('polyline')

const collectEntities = (document: FlowConnectionDocumentInput) => {
  const entities = new Map<string, FlowConnectionEntityInput>()

  const visit = (entity: FlowConnectionEntityInput) => {
    const key = entity.Handle == null ? undefined : normalizeFlowHandle(entity.Handle)
    if (key && entity.Handle != null && entity.Handle >= 0 && !entities.has(key)) {
      entities.set(key, entity)
    }
    entity.Items?.$values?.forEach(visit)
  }

  document.Dsl?.Entities?.$values?.forEach(visit)
  return entities
}

const collectValveComponents = (document: FlowConnectionDocumentInput) => {
  const components = new Map<
    string,
    { id?: string; name?: string; areaId?: string }
  >()

  document.Org?.Areas?.$values?.forEach(area => {
    area.Components?.$values?.forEach(component => {
      if (component.Handle == null || component.Handle < 0) return
      if (component.Name?.trim().toUpperCase() !== 'VALVE') return
      const key = normalizeFlowHandle(component.Handle)
      if (!key || components.has(key)) return
      components.set(key, {
        id: normalizeLabel(component.Id),
        name: normalizeLabel(component.Name),
        areaId: normalizeLabel(area.Id)
      })
    })
  })

  return components
}

const attributeLabel = (entity: FlowConnectionEntityInput | undefined) => {
  const attributes = entity?.Attributes?.$values ?? []
  const preferredKeys = ['TAG', 'TAG_PRJ', 'PRJ_TAG_B', 'CODE', 'NAME', 'ID']
  for (const preferredKey of preferredKeys) {
    const match = attributes.find(
      attribute =>
        attribute.Key?.trim().toUpperCase() === preferredKey &&
        normalizeLabel(attribute.Value)
    )
    if (match?.Value) return match.Value.trim()
  }
  return attributes.find(attribute => normalizeLabel(attribute.Value))?.Value?.trim()
}

const createNode = (
  key: string,
  entity: FlowConnectionEntityInput | undefined,
  valve: { id?: string; name?: string; areaId?: string } | undefined
): FlowGraphNode => {
  const handle = Number.parseInt(key, 16)
  const line = isLineEntity(entity)
  const kind = valve ? 'valve' : line ? 'line' : 'equipment'
  const label =
    valve?.id ??
    attributeLabel(entity) ??
    normalizeLabel(entity?.BlockName) ??
    normalizeLabel(entity?.LayerName) ??
    (valve?.name ? `${valve.name}${valve.areaId ? ` · ${valve.areaId}` : ''}` : undefined) ??
    key

  return {
    key,
    handle,
    kind,
    label,
    layerName: normalizeLabel(entity?.LayerName),
    blockName: normalizeLabel(entity?.BlockName),
    componentId: valve?.id,
    componentName: valve?.name,
    missingEntity: !entity
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

/** Builds a stable, directed graph from a connection artifact. */
export const buildFlowGraphIndex = (
  document: FlowConnectionDocumentInput
): FlowGraphIndex => {
  const entities = collectEntities(document)
  const valves = collectValveComponents(document)
  const nodes = new Map<string, FlowGraphNode>()
  const adjacency = new Map<string, string[]>()

  const ensureNode = (key: string) => {
    if (!nodes.has(key)) nodes.set(key, createNode(key, entities.get(key), valves.get(key)))
    if (!adjacency.has(key)) adjacency.set(key, [])
  }

  valves.forEach((_, key) => ensureNode(key))

  document.Map?.Maps?.$values?.forEach(map => {
    map.Graph?.Edges?.$values?.forEach(edge => {
      const from = edge.From == null ? undefined : normalizeFlowHandle(edge.From)
      if (!from) return
      ensureNode(from)

      edge.To?.$values?.forEach(rawTo => {
        const to = normalizeFlowHandle(rawTo)
        if (!to) return
        ensureNode(to)
        addNeighbor(adjacency, from, to)
      })
    })
  })

  return {
    nodes,
    adjacency,
    valveKeys: new Set(valves.keys())
  }
}
