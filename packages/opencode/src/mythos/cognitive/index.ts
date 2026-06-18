import { Effect, Context, Layer } from "effect"
import { Log } from "../../util"

export type EpistemicClass = "Verified" | "Observed" | "Inferred" | "Speculative" | "Unknown"

export interface Claim {
  statement: string
  classification: EpistemicClass
  confidence: number
  source?: string
  timestamp: number
}

export interface OWLSignal {
  principle: string
  finding: string
  implication: string
  weight: number
}

export interface StateCheckpoint {
  id: string
  turn: number
  facts: Claim[]
  assumptions: Claim[]
  decisions: string[]
  rejected: string[]
  blocked: string[]
  timestamp: number
}

export interface Interface {
  readonly classify: (claim: string, evidence?: string) => Effect.Effect<EpistemicClass>
  readonly addClaim: (claim: string, classification: EpistemicClass, confidence?: number) => Effect.Effect<void>
  readonly getClaims: (classFilter?: EpistemicClass) => Effect.Effect<Claim[]>
  readonly createCheckpoint: () => Effect.Effect<StateCheckpoint>
  readonly recoverToCheckpoint: (id: string) => Effect.Effect<Claim[][] | null>
  readonly emitSignal: (signal: OWLSignal) => Effect.Effect<void>
  readonly getSignals: (minWeight?: number) => Effect.Effect<OWLSignal[]>
  readonly surfaceThresholdMet: () => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@openfable/MythosCognitive") {}

const log = Log.create({ service: "mythos-cognitive" })

const SURFACE_THRESHOLD = 1.5

export const layer: Layer.Layer<Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    let claims: Claim[] = []
    let signals: OWLSignal[] = []
    let checkpoints: StateCheckpoint[] = []
    let turnCounter = 0

    const classify = Effect.fn("MythosCognitive.classify")(function* (claim: string, evidence?: string) {
      if (!claim) return "Unknown" as EpistemicClass
      if (evidence) return "Verified" as EpistemicClass
      if (claim.toLowerCase().includes("assum")) return "Assumption" as EpistemicClass
      if (claim.includes("probably") || claim.includes("likely")) return "Inferred" as EpistemicClass
      if (claim.includes("maybe") || claim.includes("perhaps")) return "Speculative" as EpistemicClass
      if (claim.startsWith("I think") || claim.startsWith("i think")) return "Inferred" as EpistemicClass
      return "Observed" as EpistemicClass
    })

    const addClaim = Effect.fn("MythosCognitive.addClaim")(function* (
      claim: string,
      classification: EpistemicClass,
      confidence?: number,
    ) {
      claims.push({
        statement: claim,
        classification,
        confidence: confidence ?? (classification === "Verified" ? 1.0 : 0.5),
        timestamp: Date.now(),
      })
    })

    const getClaims = Effect.fn("MythosCognitive.getClaims")(function* (classFilter?: EpistemicClass) {
      if (!classFilter) return [...claims]
      return claims.filter((c) => c.classification === classFilter)
    })

    const createCheckpoint = Effect.fn("MythosCognitive.createCheckpoint")(function* () {
      turnCounter++
      const id = `cp-${turnCounter}-${Date.now()}`
      const checkpoint: StateCheckpoint = {
        id,
        turn: turnCounter,
        facts: claims.filter((c) => c.classification === "Verified" || c.classification === "Observed"),
        assumptions: claims.filter((c) => c.classification === "Inferred" || c.classification === "Speculative" || c.classification === "Unknown"),
        decisions: [],
        rejected: [],
        blocked: [],
        timestamp: Date.now(),
      }
      checkpoints.push(checkpoint)
      log.info("cognitive checkpoint created", { id, turn: turnCounter })
      return checkpoint
    })

    const recoverToCheckpoint = Effect.fn("MythosCognitive.recoverToCheckpoint")(function* (id: string) {
      const idx = checkpoints.findIndex((c) => c.id === id)
      if (idx === -1) return null
      claims = [...checkpoints[idx].facts, ...checkpoints[idx].assumptions]
      checkpoints = checkpoints.slice(0, idx + 1)
      return [checkpoints[idx].facts, checkpoints[idx].assumptions]
    })

    const emitSignal = Effect.fn("MythosCognitive.emitSignal")(function* (signal: OWLSignal) {
      signals.push(signal)
    })

    const getSignals = Effect.fn("MythosCognitive.getSignals")(function* (minWeight?: number) {
      if (minWeight === undefined) return [...signals]
      return signals.filter((s) => s.weight >= minWeight)
    })

    const surfaceThresholdMet = Effect.fn("MythosCognitive.surfaceThresholdMet")(function* () {
      const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0)
      return totalWeight >= SURFACE_THRESHOLD
    })

    return Service.of({
      classify,
      addClaim,
      getClaims,
      createCheckpoint,
      recoverToCheckpoint,
      emitSignal,
      getSignals,
      surfaceThresholdMet,
    })
  }),
)

export const defaultLayer: Layer.Layer<Service> = layer
