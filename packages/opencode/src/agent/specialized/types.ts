import { z } from "zod"
import { ORCHESTRATOR_PROMPT, NAVIGATOR_PROMPT, EDITOR_PROMPT, VERIFIER_PROMPT, CRITIC_PROMPT } from "./prompts"

export const AgentRole = z.enum([
  "orchestrator",
  "navigator",
  "editor",
  "verifier",
  "critic",
])
export type AgentRole = z.infer<typeof AgentRole>

export const ToolCall = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.string(), z.any()),
})
export type ToolCall = z.infer<typeof ToolCall>

export const Step = z.object({
  thought: z.string(),
  calls: z.array(ToolCall),
  final: z.string().optional(),
})
export type Step = z.infer<typeof Step>

export const TaskRequest = z.object({
  task: z.string(),
  context: z.array(z.string()).optional(),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  previousAttempts: z.number().int().nonnegative().optional(),
  diagnostics: z.array(z.string()).optional(),
})
export type TaskRequest = z.infer<typeof TaskRequest>

export const TaskResult = z.object({
  success: z.boolean(),
  output: z.string(),
  patch: z.string().optional(),
  diagnostics: z.array(z.string()).optional(),
  tokensUsed: z.number().int().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
})
export type TaskResult = z.infer<typeof TaskResult>

export interface AgentConfig {
  role: AgentRole
  systemPrompt: string
  maxTurns: number
  tools: string[]
  modelTier: "cheap" | "flagship"
  color: string
}

export const AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  orchestrator: {
    role: "orchestrator",
    systemPrompt: ORCHESTRATOR_PROMPT,
    maxTurns: 1,
    tools: [],
    modelTier: "cheap",
    color: "#4287F5",
  },
  navigator: {
    role: "navigator",
    systemPrompt: NAVIGATOR_PROMPT,
    maxTurns: 3,
    tools: ["read", "glob", "grep", "codesearch", "websearch", "repo-map"],
    modelTier: "cheap",
    color: "#50C878",
  },
  editor: {
    role: "editor",
    systemPrompt: EDITOR_PROMPT,
    maxTurns: 5,
    tools: ["read", "edit", "write", "apply_patch", "bash"],
    modelTier: "flagship",
    color: "#FF6B6B",
  },
  verifier: {
    role: "verifier",
    systemPrompt: VERIFIER_PROMPT,
    maxTurns: 1,
    tools: ["bash", "read"],
    modelTier: "cheap",
    color: "#FFD93D",
  },
  critic: {
    role: "critic",
    systemPrompt: CRITIC_PROMPT,
    maxTurns: 1,
    tools: ["read", "glob", "grep"],
    modelTier: "flagship",
    color: "#C084FC",
  },
}
