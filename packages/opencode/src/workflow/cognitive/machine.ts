import type { WorkflowState, WorkflowContext, RiskLevel } from "./state"

export function nextState(current: WorkflowState, ctx: WorkflowContext): WorkflowState {
  switch (current) {
    case "triage":
      if (ctx.contextItems.length > 0) return "edit"
      return "navigate"

    case "navigate":
      return "edit"

    case "edit":
      return "verify"

    case "verify": {
      if (!ctx.lastVerify) return "escalate"
      if (ctx.lastVerify.green && ctx.risk === "high") return "critic"
      if (ctx.lastVerify.green) return "done"
      if (ctx.attempts < ctx.maxAttempts) return "edit"
      return "escalate"
    }

    case "critic":
      return "done"

    case "done":
    case "escalate":
      return current
  }
}

export function computeRisk(
  filesChanged: number,
  linesChanged: number,
  testCoverage: number,
): RiskLevel {
  let score = 0
  if (filesChanged > 5) score += 2
  else if (filesChanged > 2) score += 1

  if (linesChanged > 200) score += 2
  else if (linesChanged > 50) score += 1

  if (testCoverage < 0.5) score += 1

  if (score >= 3) return "high"
  if (score >= 1) return "medium"
  return "low"
}

export function contextSufficient(ctx: WorkflowContext): boolean {
  if (ctx.contextItems.length === 0) return false
  const allRelevant = ctx.contextItems.every((item) => item.relevant)
  return allRelevant && ctx.contextItems.length >= 1
}

export function createInitialContext(
  task: string,
  maxAttempts: number = 3,
): WorkflowContext {
  return {
    task,
    attempts: 0,
    maxAttempts,
    risk: "low",
    contextItems: [],
    history: [],
  }
}
