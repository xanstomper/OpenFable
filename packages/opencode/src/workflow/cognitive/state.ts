export type WorkflowState =
  | "triage"
  | "navigate"
  | "edit"
  | "verify"
  | "critic"
  | "done"
  | "escalate"

export type RiskLevel = "low" | "medium" | "high"

export interface WorkflowContext {
  task: string
  attempts: number
  maxAttempts: number
  risk: RiskLevel
  contextItems: ContextItem[]
  lastVerify?: VerifyResult
  patch?: string
  history: WorkflowEvent[]
}

export interface ContextItem {
  file: string
  lines?: [number, number]
  summary: string
  relevant: boolean
}

export interface VerifyResult {
  green: boolean
  diagnostics: Diagnostic[]
  buildPass: boolean
  typePass: boolean
  lintPass: boolean
  testPass: boolean
}

export interface Diagnostic {
  file: string
  line: number
  message: string
  kind: "build" | "test" | "type" | "lint"
}

export type WorkflowEvent =
  | { type: "state_change"; from: WorkflowState; to: WorkflowState; timestamp: number }
  | { type: "attempt"; attempt: number; timestamp: number }
  | { type: "verify"; result: VerifyResult; timestamp: number }
  | { type: "context_added"; items: ContextItem[]; timestamp: number }
  | { type: "patch_applied"; patch: string; timestamp: number }
  | { type: "escalated"; reason: string; timestamp: number }
  | { type: "completed"; success: boolean; timestamp: number }
