import { Effect, Context, Layer } from "effect"
import { Config } from "../../config"
import { Log } from "../../util"

export interface RouterCapability {
  modelID: string
  providerID: string
  tier: number
  reasoningDepth: number
  contextWindow: number
  supportsTools: boolean
  supportsVision: boolean
}

export interface RouterDecision {
  modelID: string
  providerID: string
  reason: string
  confidence: number
}

export interface Interface {
  readonly rankModels: (available: RouterCapability[]) => Effect.Effect<RouterCapability[]>
  readonly selectForTask: (task: string, available: RouterCapability[]) => Effect.Effect<RouterDecision>
  readonly isMythosCapable: (cap: RouterCapability) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@openfable/MythosRouter") {}

const log = Log.create({ service: "mythos-router" })

export const layer: Layer.Layer<Service, never, Config.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const rankModels = Effect.fn("MythosRouter.rankModels")(function* (available: RouterCapability[]) {
      return [...available].sort((a, b) => {
        const aScore = a.tier * 10 + a.reasoningDepth * 2 + (a.supportsTools ? 5 : 0) + (a.supportsVision ? 3 : 0)
        const bScore = b.tier * 10 + b.reasoningDepth * 2 + (b.supportsTools ? 5 : 0) + (b.supportsVision ? 3 : 0)
        return bScore - aScore
      })
    })

    const selectForTask = Effect.fn("MythosRouter.selectForTask")(function* (
      task: string,
      available: RouterCapability[],
    ) {
      const ranked = [...available].sort((a, b) => {
        const aScore = a.tier * 10 + a.reasoningDepth * 2 + (a.supportsTools ? 5 : 0)
        const bScore = b.tier * 10 + b.reasoningDepth * 2 + (b.supportsTools ? 5 : 0)
        return bScore - aScore
      })

      if (ranked.length === 0) {
        return { modelID: "unknown", providerID: "unknown", reason: "no models available", confidence: 0 }
      }

      const selected = ranked[0]
      return {
        modelID: selected.modelID,
        providerID: selected.providerID,
        reason: `ranked highest: tier=${selected.tier} depth=${selected.reasoningDepth}`,
        confidence: 0.8,
      }
    })

    const isMythosCapable = Effect.fn("MythosRouter.isMythosCapable")(function* (cap: RouterCapability) {
      return cap.tier >= 3 && cap.reasoningDepth >= 2 && cap.supportsTools
    })

    return Service.of({ rankModels, selectForTask, isMythosCapable })
  }),
)

export const defaultLayer: Layer.Layer<Service, never, Config.Service> = layer.pipe(
  Layer.provide(Config.defaultLayer),
)
