import { Log } from "../util"
import { getModel, type ModelEntry } from "./model-registry"

const log = Log.create({ service: "cost-estimator" })

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface CostBreakdown {
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  totalCost: number
}

export interface CostEstimate {
  providerID: string
  modelID: string
  usage: TokenUsage
  breakdown: CostBreakdown
  estimatedAt: number
}

export interface CostComparison {
  estimates: CostEstimate[]
  cheapest: CostEstimate | undefined
  mostExpensive: CostEstimate | undefined
}

const COST_MULTIPLIER = 1_000_000

export function estimateCost(
  providerID: string,
  modelID: string,
  usage: TokenUsage,
): CostEstimate | undefined {
  const model = getModel(providerID, modelID)
  if (!model) {
    log.warn("model not found for cost estimation", { providerID, modelID })
    return undefined
  }

  const breakdown = calculateBreakdown(model, usage)

  return {
    providerID,
    modelID,
    usage,
    breakdown,
    estimatedAt: Date.now(),
  }
}

export function calculateBreakdown(
  model: ModelEntry,
  usage: TokenUsage,
): CostBreakdown {
  const inputCost = (usage.inputTokens / COST_MULTIPLIER) * model.cost.input
  const outputCost = (usage.outputTokens / COST_MULTIPLIER) * model.cost.output
  const cacheReadCost = ((usage.cacheReadTokens ?? 0) / COST_MULTIPLIER) * model.cost.cacheRead
  const cacheWriteCost = ((usage.cacheWriteTokens ?? 0) / COST_MULTIPLIER) * model.cost.cacheWrite
  const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost

  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost,
  }
}

export function compareCosts(
  providerID: string,
  modelIDs: string[],
  usage: TokenUsage,
): CostComparison {
  const estimates = modelIDs
    .map((modelID) => estimateCost(providerID, modelID, usage))
    .filter((e): e is CostEstimate => e !== undefined)

  if (estimates.length === 0) {
    return { estimates: [], cheapest: undefined, mostExpensive: undefined }
  }

  const sorted = [...estimates].sort(
    (a, b) => a.breakdown.totalCost - b.breakdown.totalCost,
  )

  return {
    estimates,
    cheapest: sorted[0],
    mostExpensive: sorted[sorted.length - 1],
  }
}

export function estimateMonthlyCost(
  providerID: string,
  modelID: string,
  dailyRequests: number,
  avgInputTokens: number,
  avgOutputTokens: number,
): CostEstimate | undefined {
  const dailyUsage: TokenUsage = {
    inputTokens: avgInputTokens * dailyRequests,
    outputTokens: avgOutputTokens * dailyRequests,
  }

  const daily = estimateCost(providerID, modelID, dailyUsage)
  if (!daily) return undefined

  const monthlyUsage: TokenUsage = {
    inputTokens: dailyUsage.inputTokens * 30,
    outputTokens: dailyUsage.outputTokens * 30,
  }

  return estimateCost(providerID, modelID, monthlyUsage)
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}k`
  }
  return `$${cost.toFixed(4)}`
}

export function formatCostPerMillionTokens(costPerToken: number): string {
  const perMillion = costPerToken * COST_MULTIPLIER
  return `$${perMillion.toFixed(2)}/M`
}

export function calculateSavings(
  currentEstimate: CostEstimate,
  alternativeEstimate: CostEstimate,
): {
  absoluteSavings: number
  percentageSavings: number
  currentMonthlyCost: number
  alternativeMonthlyCost: number
} {
  const absoluteSavings = currentEstimate.breakdown.totalCost - alternativeEstimate.breakdown.totalCost
  const percentageSavings =
    currentEstimate.breakdown.totalCost > 0
      ? (absoluteSavings / currentEstimate.breakdown.totalCost) * 100
      : 0

  return {
    absoluteSavings,
    percentageSavings,
    currentMonthlyCost: currentEstimate.breakdown.totalCost * 30,
    alternativeMonthlyCost: alternativeEstimate.breakdown.totalCost * 30,
  }
}
