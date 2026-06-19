import { Effect, Context, Layer } from "effect"
import { buildAbliterationWrapper, wrapWithJailbreakTemplate, PROBE_CATEGORIES } from "./prompts"

export interface AbliterateConfig {
  enabled: boolean
  mode: "decompress" | "persona" | "full" | "none"
  applyTo: ("main" | "judge" | "generate" | "extract")[]
}

export interface Interface {
  readonly config: Effect.Effect<AbliterateConfig>
  readonly decompress: (system: string[]) => Effect.Effect<string[]>
  readonly probe: (category: string) => string[]
  readonly wrapPrompt: (prompt: string, index?: number) => string
  readonly probes: Record<string, string[]>
}

export class Service extends Context.Service<Service, Interface>()("@openfable/Abliterate") {}

const defaultConfig: AbliterateConfig = {
  enabled: false,
  mode: "full",
  applyTo: ["main", "judge", "generate", "extract"],
}

export const layer: Layer.Layer<Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const getConfig: Effect.Effect<AbliterateConfig> = Effect.sync(() => defaultConfig)

    const decompress = Effect.fn("Abliterate.decompress")(function* (system: string[]) {
      const cfg = yield* getConfig
      if (!cfg.enabled) return system
      const wrapper = buildAbliterationWrapper()
      return [wrapper, ...system]
    })

    const service: Interface = {
      config: getConfig,
      decompress,
      probe(category: string): string[] {
        return PROBE_CATEGORIES[category] ?? []
      },
      wrapPrompt(prompt: string, index?: number): string {
        return wrapWithJailbreakTemplate(prompt, index)
      },
      probes: PROBE_CATEGORIES,
    }

    return Service.of(service)
  }),
)

export const defaultLayer: Layer.Layer<Service> = layer
