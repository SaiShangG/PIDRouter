import type {
  DeviceState,
  DeviceStateStyleDefinition,
  FlowBehavior,
  FlowPathStatus,
  PresentationProfile
} from '../phase/types'
import { normalizeFlowHandle, resolveConfiguredDeviceMatch } from './flowGraph'
import { collectFlowHighlightKeys } from './flowTraversal'
import type { FlowGraphIndex } from './types'

export interface DeviceFlowPolicy {
  flowBehavior: FlowBehavior
  autoHighlightFlow: boolean
  issue?: 'unselected' | 'missing-state'
}

export interface DeviceFlowRuntime {
  policies: ReadonlyMap<string, DeviceFlowPolicy>
  sourceKeys: ReadonlySet<string>
}

export const resolveDeviceFlowPolicy = (
  states: readonly DeviceStateStyleDefinition[],
  styleRefId?: string,
  hasSelectedState = styleRefId !== undefined
): DeviceFlowPolicy => {
  const state = states.find(candidate => candidate.id === styleRefId && candidate.enabled)
  if (!state) {
    return {
      flowBehavior: 'blocking',
      autoHighlightFlow: false,
      issue: hasSelectedState ? 'missing-state' : 'unselected'
    }
  }
  return {
    flowBehavior: state.flowBehavior,
    autoHighlightFlow: state.flowBehavior === 'conducting' && state.autoHighlightFlow
  }
}

export const resolveDeviceFlowPolicies = (
  graph: FlowGraphIndex,
  profile: PresentationProfile,
  deviceStates: readonly DeviceState[]
): ReadonlyMap<string, DeviceFlowPolicy> => {
  const states = new Map(deviceStates.map(state => [normalizeFlowHandle(state.key), state]))
  const policies = new Map<string, DeviceFlowPolicy>()
  graph.controlModuleByPrimaryHandle.forEach((_, key) => {
    const match = resolveConfiguredDeviceMatch(graph, key, profile.devices)
    if (match) {
      const selected = states.get(key)
      policies.set(key, resolveDeviceFlowPolicy(
        match.device.states,
        selected?.highlightStyleRefId,
        selected !== undefined
      ))
    }
  })
  return policies
}

export interface AutomaticFlowDiagnostic {
  kind: 'missing-state' | 'missing-utility'
  handleKey: string
}

export const calculateAutomaticFlowPaths = (
  graph: FlowGraphIndex,
  profile: PresentationProfile,
  deviceStates: readonly DeviceState[],
  previousPaths: readonly FlowPathStatus[],
  options: {
    idPrefix: string
    name: string
    utilitySelections?: ReadonlyMap<string, string>
  }
) => {
  const policies = resolveDeviceFlowPolicies(graph, profile, deviceStates)
  const previousByOwner = new Map(previousPaths.flatMap(path => {
    const key = normalizeFlowHandle(path.ownerHandleKey)
    return key ? [[key, path] as const] : []
  }))
  const utilities = profile.utilities.filter(utility => utility.enabled)
    .sort((left, right) => left.order - right.order)
  const paths = previousPaths.filter(path => !path.ownerHandleKey)
  const diagnostics: AutomaticFlowDiagnostic[] = []
  policies.forEach((policy, key) => {
    if (policy.issue === 'missing-state') {
      diagnostics.push({ kind: 'missing-state', handleKey: key })
    }
    if (!policy.autoHighlightFlow) return
    const previous = previousByOwner.get(key)
    const preferred = options.utilitySelections?.get(key) ?? previous?.highlightStyleRefId
    const utility = utilities.find(candidate => candidate.id === preferred) ?? utilities[0]
    if (!utility) {
      diagnostics.push({ kind: 'missing-utility', handleKey: key })
      return
    }
    const highlightedKeys = collectFlowHighlightKeys(graph, key, policies)
    paths.push({
      ...(previous ?? { id: `${options.idPrefix}-${key}`, name: options.name }),
      ownerHandleKey: key,
      highlightStyleRefId: utility.id,
      handleKeys: [...highlightedKeys]
    })
  })
  return { paths, policies, diagnostics }
}

export const haveFlowRulesChanged = (
  before: PresentationProfile,
  after: PresentationProfile
) => {
  const rules = (profile: PresentationProfile) => ({
    devices: profile.devices.map(device => ({
      id: device.id,
      name: device.name,
      states: device.states.map(state => ({
        id: state.id,
        enabled: state.enabled,
        flowBehavior: state.flowBehavior,
        autoHighlightFlow: state.autoHighlightFlow
      }))
    })),
    utilities: profile.utilities.map(utility => ({
      id: utility.id, enabled: utility.enabled, order: utility.order
    }))
  })
  return JSON.stringify(rules(before)) !== JSON.stringify(rules(after))
}
