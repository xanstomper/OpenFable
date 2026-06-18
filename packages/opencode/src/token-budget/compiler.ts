export interface ContextItem {
  content: string
  tokens: number
  score: number
  cached: boolean
  pinned: boolean
  hash: string
  source: string
}

export interface CompileResult {
  items: ContextItem[]
  totalTokens: number
  cachedTokens: number
  freshTokens: number
  droppedCount: number
  estimatedCost: number
}

export interface CostEstimate {
  model: string
  inputCostPerToken: number
  outputCostPerToken: number
}

const DEFAULT_COSTS: Record<string, CostEstimate> = {
  "claude-opus-4": { model: "claude-opus-4", inputCostPerToken: 0.000015, outputCostPerToken: 0.000075 },
  "claude-sonnet-4": { model: "claude-sonnet-4", inputCostPerToken: 0.000003, outputCostPerToken: 0.000015 },
  "gpt-4o": { model: "gpt-4o", inputCostPerToken: 0.0000025, outputCostPerToken: 0.00001 },
  "gpt-4o-mini": { model: "gpt-4o-mini", inputCostPerToken: 0.00000015, outputCostPerToken: 0.0000006 },
  "local": { model: "local", inputCostPerToken: 0, outputCostPerToken: 0 },
}

export class TokenBudgetCompiler {
  private budget: number
  private costs: Record<string, CostEstimate>

  constructor(budget: number = 100_000, costs?: Record<string, CostEstimate>) {
    this.budget = budget
    this.costs = costs ?? DEFAULT_COSTS
  }

  compile(items: ContextItem[], model: string = "local"): CompileResult {
    const sorted = this.sortByValuePerToken(items)

    let totalTokens = 0
    let cachedTokens = 0
    let freshTokens = 0
    const selected: ContextItem[] = []
    let droppedCount = 0

    for (const item of sorted) {
      if (item.pinned || item.cached) {
        selected.push(item)
        if (!item.cached) {
          totalTokens += item.tokens
          freshTokens += item.tokens
        } else {
          cachedTokens += item.tokens
        }
        continue
      }

      if (totalTokens + item.tokens <= this.budget) {
        selected.push(item)
        totalTokens += item.tokens
        freshTokens += item.tokens
      } else {
        droppedCount++
      }
    }

    const costEstimate = this.costs[model] ?? this.costs["local"]
    const estimatedCost = freshTokens * (costEstimate?.inputCostPerToken ?? 0)

    return {
      items: selected,
      totalTokens,
      cachedTokens,
      freshTokens,
      droppedCount,
      estimatedCost,
    }
  }

  private sortByValuePerToken(items: ContextItem[]): ContextItem[] {
    return [...items].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (a.cached && !b.cached) return -1
      if (!a.cached && b.cached) return 1

      const aRatio = a.tokens > 0 ? a.score / a.tokens : 0
      const bRatio = b.tokens > 0 ? b.score / b.tokens : 0
      return bRatio - aRatio
    })
  }

  estimateSavings(items: ContextItem[], model: string = "local"): {
    withoutOptimization: number
    withOptimization: number
    savings: number
    savingsPercent: number
  } {
    const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0)
    const result = this.compile(items, model)

    return {
      withoutOptimization: totalTokens,
      withOptimization: result.freshTokens,
      savings: totalTokens - result.freshTokens,
      savingsPercent: totalTokens > 0 ? ((totalTokens - result.freshTokens) / totalTokens) * 100 : 0,
    }
  }
}
