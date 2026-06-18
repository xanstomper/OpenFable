import { Log } from "@/util"
import { getDialectForProvider, type ToolCallDialect, type ToolSpec, type ToolCall } from "./tool-dialects"

const log = Log.create({ service: "unified-provider" })

export type ProviderKind = "openai" | "anthropic" | "google" | "ollama" | "local" | "custom"

export interface UnifiedModel {
  id: string
  name: string
  provider: ProviderKind
  contextWindow: number
  maxOutput: number
  supportsTools: boolean
  supportsStreaming: boolean
  supportsVision: boolean
  inputCostPerToken: number
  outputCostPerToken: number
  latencyMs: number
}

export interface UnifiedRequest {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; toolCallId?: string }>
  tools?: Array<{ name: string; description: string; parameters: any }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface UnifiedResponse {
  id: string
  model: string
  content: string
  toolCalls?: Array<{ id: string; name: string; arguments: any }>
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  latencyMs: number
  cached: boolean
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  organization?: string
  temperature?: number
  maxTokens?: number
}

export class UnifiedProvider {
  private configs: Map<ProviderKind, ProviderConfig> = new Map()
  private models: Map<string, UnifiedModel> = new Map()
  private cache: Map<string, UnifiedResponse> = new Map()
  private cacheTTL: number = 300_000

  constructor() {
    this.registerBuiltinModels()
  }

  registerProvider(kind: ProviderKind, config: ProviderConfig): void {
    this.configs.set(kind, config)
  }

  registerModel(model: UnifiedModel): void {
    this.models.set(model.id, model)
  }

  getModel(modelId: string): UnifiedModel | undefined {
    return this.models.get(modelId)
  }

  listModels(): UnifiedModel[] {
    return Array.from(this.models.values())
  }

  listByCapability(capability: keyof Pick<UnifiedModel, "supportsTools" | "supportsStreaming" | "supportsVision">): UnifiedModel[] {
    return this.listModels().filter((m) => m[capability])
  }

  listByCost(): UnifiedModel[] {
    return this.listModels().sort((a, b) => a.inputCostPerToken - b.inputCostPerToken)
  }

  listByLatency(): UnifiedModel[] {
    return this.listModels().sort((a, b) => a.latencyMs - b.latencyMs)
  }

  selectOptimal(requirements: {
    needsTools?: boolean
    needsVision?: boolean
    maxCost?: number
    maxLatency?: number
    minContextWindow?: number
  }): UnifiedModel | null {
    let candidates = this.listModels()

    if (requirements.needsTools) candidates = candidates.filter((m) => m.supportsTools)
    if (requirements.needsVision) candidates = candidates.filter((m) => m.supportsVision)
    if (requirements.maxCost) candidates = candidates.filter((m) => m.inputCostPerToken <= requirements.maxCost!)
    if (requirements.maxLatency) candidates = candidates.filter((m) => m.latencyMs <= requirements.maxLatency!)
    if (requirements.minContextWindow) candidates = candidates.filter((m) => m.contextWindow >= requirements.minContextWindow!)

    if (candidates.length === 0) return null

    return candidates.reduce((best, curr) => {
      const bestScore = this.scoreModel(best)
      const currScore = this.scoreModel(curr)
      return currScore > bestScore ? curr : best
    })
  }

  private scoreModel(model: UnifiedModel): number {
    const costScore = 1 / (model.inputCostPerToken + 0.000001)
    const latencyScore = 1 / (model.latencyMs + 1)
    const contextScore = model.contextWindow / 1_000_000
    const capabilityScore = (model.supportsTools ? 1 : 0) + (model.supportsStreaming ? 0.5 : 0) + (model.supportsVision ? 0.5 : 0)
    return costScore * 0.4 + latencyScore * 0.3 + contextScore * 0.2 + capabilityScore * 0.1
  }

  getDialectForProvider(provider: ProviderKind): ToolCallDialect {
    return getDialectForProvider(provider)
  }

  encodeToolsForProvider(provider: ProviderKind, tools: ToolSpec[]): any {
    const dialect = this.getDialectForProvider(provider)
    return dialect.encodeTools(tools)
  }

  parseResponseWithDialect(provider: ProviderKind, raw: string): { thought: string; calls: ToolCall[]; final?: string } {
    const dialect = this.getDialectForProvider(provider)
    return dialect.parseResponse(raw)
  }

  formatToolResultForProvider(provider: ProviderKind, callId: string, result: string): any {
    const dialect = this.getDialectForProvider(provider)
    return dialect.formatToolResult(callId, result)
  }

  async complete(request: UnifiedRequest): Promise<UnifiedResponse> {
    const cacheKey = this.cacheKey(request)
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.latencyMs < this.cacheTTL) {
      return { ...cached, cached: true }
    }

    const model = this.models.get(request.model)
    if (!model) throw new Error(`Unknown model: ${request.model}`)

    const config = this.configs.get(model.provider)
    if (!config) throw new Error(`No config for provider: ${model.provider}`)

    const start = Date.now()
    const response = await this.callProvider(model.provider, request, config)
    const latencyMs = Date.now() - start

    const result: UnifiedResponse = {
      ...response,
      latencyMs,
      cached: false,
    }

    this.cache.set(cacheKey, result)
    return result
  }

  async completeWithFallback(request: UnifiedRequest, fallbackModels: string[]): Promise<UnifiedResponse> {
    const errors: Error[] = []

    for (const modelId of [request.model, ...fallbackModels]) {
      try {
        return await this.complete({ ...request, model: modelId })
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
        log.warn(`Model ${modelId} failed: ${error}`)
      }
    }

    throw new Error(`All models failed: ${errors.map((e) => e.message).join(", ")}`)
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.models.get(modelId)
    if (!model) return 0
    return inputTokens * model.inputCostPerToken + outputTokens * model.outputCostPerToken
  }

  private async callProvider(
    kind: ProviderKind,
    request: UnifiedRequest,
    config: ProviderConfig,
  ): Promise<Omit<UnifiedResponse, "latencyMs" | "cached">> {
    switch (kind) {
      case "openai":
        return this.callOpenAI(request, config)
      case "anthropic":
        return this.callAnthropic(request, config)
      case "ollama":
        return this.callOllama(request, config)
      default:
        throw new Error(`Provider ${kind} not implemented`)
    }
  }

  private async callOpenAI(
    request: UnifiedRequest,
    config: ProviderConfig,
  ): Promise<Omit<UnifiedResponse, "latencyMs" | "cached">> {
    const url = `${config.baseUrl || "https://api.openai.com/v1"}/chat/completions`
    const body = {
      model: request.model,
      messages: request.messages,
      tools: request.tools?.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`)
    const data = await res.json() as any

    return {
      id: data.id,
      model: data.model,
      content: data.choices[0]?.message?.content ?? "",
      toolCalls: data.choices[0]?.message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    }
  }

  private async callAnthropic(
    request: UnifiedRequest,
    config: ProviderConfig,
  ): Promise<Omit<UnifiedResponse, "latencyMs" | "cached">> {
    const url = `${config.baseUrl || "https://api.anthropic.com/v1"}/messages`
    const systemMsg = request.messages.find((m) => m.role === "system")
    const otherMsgs = request.messages.filter((m) => m.role !== "system")

    const body = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      system: systemMsg?.content,
      messages: otherMsgs.map((m) => ({ role: m.role, content: m.content })),
      tools: request.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`)
    const data = await res.json() as any

    const content = data.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("")

    const toolCalls = data.content
      .filter((c: any) => c.type === "tool_use")
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        arguments: c.input,
      }))

    return {
      id: data.id,
      model: data.model,
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
    }
  }

  private async callOllama(
    request: UnifiedRequest,
    config: ProviderConfig,
  ): Promise<Omit<UnifiedResponse, "latencyMs" | "cached">> {
    const url = `${config.baseUrl || "http://localhost:11434"}/api/chat`
    const body = {
      model: request.model,
      messages: request.messages,
      tools: request.tools,
      stream: false,
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`)
    const data = await res.json() as any

    return {
      id: `ollama_${Date.now()}`,
      model: request.model,
      content: data.message?.content ?? "",
      toolCalls: data.message?.tool_calls?.map((tc: any) => ({
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    }
  }

  private cacheKey(request: UnifiedRequest): string {
    return `${request.model}:${JSON.stringify(request.messages)}:${request.temperature}`
  }

  private registerBuiltinModels(): void {
    const builtinModels: UnifiedModel[] = [
      { id: "claude-opus-4", name: "Claude Opus 4", provider: "anthropic", contextWindow: 200_000, maxOutput: 32_000, supportsTools: true, supportsStreaming: true, supportsVision: true, inputCostPerToken: 0.000015, outputCostPerToken: 0.000075, latencyMs: 2000 },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic", contextWindow: 200_000, maxOutput: 16_000, supportsTools: true, supportsStreaming: true, supportsVision: true, inputCostPerToken: 0.000003, outputCostPerToken: 0.000015, latencyMs: 1000 },
      { id: "gpt-4o", name: "GPT-4o", provider: "openai", contextWindow: 128_000, maxOutput: 16_000, supportsTools: true, supportsStreaming: true, supportsVision: true, inputCostPerToken: 0.0000025, outputCostPerToken: 0.00001, latencyMs: 1500 },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", contextWindow: 128_000, maxOutput: 16_000, supportsTools: true, supportsStreaming: true, supportsVision: true, inputCostPerToken: 0.00000015, outputCostPerToken: 0.0000006, latencyMs: 800 },
    ]

    for (const model of builtinModels) {
      this.models.set(model.id, model)
    }
  }
}
