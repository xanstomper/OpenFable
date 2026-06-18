import type { WorkflowState, WorkflowContext, VerifyResult, WorkflowEvent } from "./state"
import { nextState, computeRisk, contextSufficient, createInitialContext } from "./machine"
import { Log } from "@/util"

const log = Log.create({ service: "cognitive-workflow" })

export interface OrchestratorConfig {
  maxAttempts: number
  enableCritic: boolean
  enableNavigator: boolean
}

const defaultConfig: OrchestratorConfig = {
  maxAttempts: 3,
  enableCritic: true,
  enableNavigator: true,
}

export class CognitiveOrchestrator {
  private state: WorkflowState = "triage"
  private ctx: WorkflowContext
  private config: OrchestratorConfig
  private listeners: Array<(event: WorkflowEvent) => void> = []

  constructor(task: string, config?: Partial<OrchestratorConfig>) {
    this.config = { ...defaultConfig, ...config }
    this.ctx = createInitialContext(task, this.config.maxAttempts)
  }

  getState(): WorkflowState {
    return this.state
  }

  getContext(): Readonly<WorkflowContext> {
    return this.ctx
  }

  onEvent(listener: (event: WorkflowEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: WorkflowEvent): void {
    this.ctx.history.push(event)
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  addContextItems(items: Array<{ file: string; lines?: [number, number]; summary: string; relevant: boolean }>): void {
    this.ctx.contextItems.push(...items)
    this.emit({
      type: "context_added",
      items,
      timestamp: Date.now(),
    })
  }

  setPatch(patch: string): void {
    this.ctx.patch = patch
    this.emit({
      type: "patch_applied",
      patch,
      timestamp: Date.now(),
    })
  }

  setVerifyResult(result: VerifyResult): void {
    this.ctx.lastVerify = result
    this.ctx.attempts++
    this.emit({
      type: "verify",
      result,
      timestamp: Date.now(),
    })
    this.ctx.risk = computeRisk(
      this.countFilesChanged(result),
      this.countLinesChanged(result),
      this.estimateTestCoverage(result),
    )
  }

  transition(): WorkflowState {
    const prev = this.state
    const shouldSkipNavigator = !this.config.enableNavigator && this.state === "triage"
    const shouldSkipCritic = !this.config.enableCritic && this.state === "verify" && this.ctx.lastVerify?.green

    if (shouldSkipNavigator && contextSufficient(this.ctx)) {
      this.state = "edit"
    } else if (shouldSkipCritic) {
      this.state = "done"
    } else {
      this.state = nextState(this.state, this.ctx)
    }

    if (prev !== this.state) {
      this.emit({
        type: "state_change",
        from: prev,
        to: this.state,
        timestamp: Date.now(),
      })
    }

    if (this.state === "escalate") {
      this.emit({
        type: "escalated",
        reason: `Max attempts (${this.config.maxAttempts}) exhausted without verification`,
        timestamp: Date.now(),
      })
    }

    if (this.state === "done") {
      this.emit({
        type: "completed",
        success: this.ctx.lastVerify?.green ?? false,
        timestamp: Date.now(),
      })
    }

    return this.state
  }

  isComplete(): boolean {
    return this.state === "done" || this.state === "escalate"
  }

  getSummary(): string {
    const lines = [
      `Task: ${this.ctx.task}`,
      `State: ${this.state}`,
      `Attempts: ${this.ctx.attempts}/${this.config.maxAttempts}`,
      `Risk: ${this.ctx.risk}`,
      `Context items: ${this.ctx.contextItems.length}`,
    ]
    if (this.ctx.lastVerify) {
      lines.push(`Last verify: ${this.ctx.lastVerify.green ? "GREEN" : "RED"}`)
      if (!this.ctx.lastVerify.green) {
        for (const d of this.ctx.lastVerify.diagnostics) {
          lines.push(`  ${d.kind}: ${d.file}:${d.line} — ${d.message}`)
        }
      }
    }
    return lines.join("\n")
  }

  private countFilesChanged(result: VerifyResult): number {
    const files = new Set(result.diagnostics.map((d) => d.file))
    return files.size
  }

  private countLinesChanged(result: VerifyResult): number {
    return result.diagnostics.length
  }

  private estimateTestCoverage(result: VerifyResult): number {
    if (result.testPass) return 0.8
    if (result.diagnostics.some((d) => d.kind === "test")) return 0.3
    return 0.5
  }
}
