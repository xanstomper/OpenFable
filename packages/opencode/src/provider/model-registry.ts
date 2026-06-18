import { Log } from "../util"
import { ProviderID, ModelID } from "./schema"

const log = Log.create({ service: "model-registry" })

export interface ModelCost {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export interface ModelCapabilities {
  tools: boolean
  vision: boolean
  streaming: boolean
  reasoning: boolean
  temperature: boolean
}

export interface ModelEntry {
  id: string
  providerID: string
  name: string
  contextWindow: number
  maxOutput: number
  cost: ModelCost
  capabilities: ModelCapabilities
  status: "active" | "beta" | "deprecated" | "alpha"
}

export interface RegistryQuery {
  providerID?: string
  maxInputCost?: number
  maxOutputCost?: number
  minContextWindow?: number
  requiresTools?: boolean
  requiresVision?: boolean
  status?: ModelEntry["status"]
}

const registry = new Map<string, ModelEntry>()

export function registerModel(entry: ModelEntry): void {
  const key = `${entry.providerID}/${entry.id}`
  registry.set(key, entry)
}

export function registerModels(entries: ModelEntry[]): void {
  for (const entry of entries) {
    registerModel(entry)
  }
}

export function getModel(providerID: string, modelID: string): ModelEntry | undefined {
  return registry.get(`${providerID}/${modelID}`)
}

export function getAllModels(): ModelEntry[] {
  return Array.from(registry.values())
}

export function queryModels(query: RegistryQuery): ModelEntry[] {
  let results = getAllModels()

  if (query.providerID) {
    results = results.filter((m) => m.providerID === query.providerID)
  }
  if (query.maxInputCost !== undefined) {
    results = results.filter((m) => m.cost.input <= query.maxInputCost!)
  }
  if (query.maxOutputCost !== undefined) {
    results = results.filter((m) => m.cost.output <= query.maxOutputCost!)
  }
  if (query.minContextWindow !== undefined) {
    results = results.filter((m) => m.contextWindow >= query.minContextWindow!)
  }
  if (query.requiresTools) {
    results = results.filter((m) => m.capabilities.tools)
  }
  if (query.requiresVision) {
    results = results.filter((m) => m.capabilities.vision)
  }
  if (query.status) {
    results = results.filter((m) => m.status === query.status)
  }

  return results
}

export function findCheapest(query: RegistryQuery): ModelEntry | undefined {
  const candidates = queryModels(query)
  if (candidates.length === 0) return undefined
  return candidates.reduce((best, curr) =>
    curr.cost.input + curr.cost.output < best.cost.input + best.cost.output ? curr : best,
  )
}

export function findBestForTask(requirements: {
  needsTools?: boolean
  needsVision?: boolean
  maxCostPerMillionTokens?: number
  minContextWindow?: number
  preferReasoning?: boolean
}): ModelEntry | undefined {
  const candidates = queryModels({
    requiresTools: requirements.needsTools,
    requiresVision: requirements.needsVision,
    minContextWindow: requirements.minContextWindow,
    status: "active",
  })

  if (candidates.length === 0) return undefined

  const maxCost = requirements.maxCostPerMillionTokens ?? Infinity
  const filtered = candidates.filter((m) => {
    const costPerMillion = m.cost.input + m.cost.output
    return costPerMillion <= maxCost
  })

  if (filtered.length === 0) return undefined

  return filtered.reduce((best, curr) => {
    let bestScore = scoreModel(best, requirements.preferReasoning)
    let currScore = scoreModel(curr, requirements.preferReasoning)
    return currScore > bestScore ? curr : best
  })
}

function scoreModel(model: ModelEntry, preferReasoning?: boolean): number {
  const costScore = 1 / (model.cost.input + model.cost.output + 0.000001)
  const contextScore = model.contextWindow / 1_000_000
  const capabilityScore =
    (model.capabilities.tools ? 1 : 0) +
    (model.capabilities.streaming ? 0.5 : 0) +
    (model.capabilities.vision ? 0.5 : 0) +
    (preferReasoning && model.capabilities.reasoning ? 0.5 : 0)
  return costScore * 0.4 + contextScore * 0.3 + capabilityScore * 0.3
}

export function clearRegistry(): void {
  registry.clear()
}

export function getRegistrySize(): number {
  return registry.size
}
