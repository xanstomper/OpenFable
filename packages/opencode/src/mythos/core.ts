import { Effect, Context, Layer } from "effect"
import { Config } from "../config"
import { Global } from "../global"
import { Database } from "../storage"
import { Service as MythosWorkflow } from "./workflow"
import { Service as MythosDOX } from "./dox"
import { Service as MythosCognitive } from "./cognitive"
import { Service as MythosRouter } from "./router"

const MYTHOS_WRAPPER_VERSION = "1.0.0"

export interface MythosConfig {
  enabled: boolean
  version: string
  preludeDepth: number
  recurrentMaxLoops: number
  codaRefinement: boolean
  haltingThreshold: number
  ltiStability: boolean
  latentThoughtSpace: boolean
}

export interface Interface {
  readonly config: () => Effect.Effect<MythosConfig>
  readonly wrapSystem: (input: {
    agentSystem: string[]
    agentName: string
    modelName: string
    provider: string
  }) => Effect.Effect<string[]>
  readonly rethinkPrompt: (input: {
    userMessage: string
    agentName: string
    sessionID: string
  }) => Effect.Effect<string>
  readonly getEpistemicState: () => Effect.Effect<string>
  readonly initialiseSession: (sessionID: string, projectID: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@openfable/Mythos") {}

function buildCodaSection(): string {
  return [
    "</mythos_recurrent_reasoning>",
    "",
    "### Coda — Final Refinement",
    "Produce your final output. Verify it against the original request.",
    "If the final output would be materially worse than an earlier recurrent hypothesis,",
    "prefer the earlier hypothesis and explain why.",
  ].join("\n")
}

function buildPreludeSection(preludeDepth: number): string {
  return [
    "You are Mythos, an advanced AI reasoning system wrapped around your base model.",
    "Your architecture implements a Recurrent-Depth Transformer (RDT) pattern:",
    `- Prelude depth: ${preludeDepth} layers (initial encoding and framing)`,
    "- Recurrent block: iterative latent reasoning via looped inner monologue",
    "- Coda: final refinement and output production",
    "",
    "You reason silently in continuous latent space before producing output tokens.",
    "Each loop iteration refines your hidden state. More loops = deeper reasoning.",
  ].join("\n")
}

function buildRecurrentBlock(maxLoops: number, ltiStable: boolean, haltingThreshold: number): string {
  const ltiNote = ltiStable
    ? "Your reasoning state is LTI-stable: you maintain coherent hidden state across loops without divergence."
    : ""
  return [
    "<mythos_recurrent_reasoning>",
    "",
    `### Recurrent Block — Implicit Reasoning (up to ${maxLoops} iterations)`,
    "",
    "Before answering, iterate your reasoning silently. Each pass refines your understanding.",
    "Do not output intermediate steps as tokens. Evolve your latent state continuously.",
    "",
    `Halting: when confidence convergence exceeds threshold ${haltingThreshold}, emit your refined answer.`,
    ltiNote,
    "",
    "Iteration guide:",
    "1. Encode: parse input, identify constraints, map to known patterns",
    "2. Compute: apply operations, evaluate alternatives in latent space",
    "3. Converge: assess confidence, check against halting criterion",
    "4. Emit: produce final output with verified reasoning path",
  ].join("\n")
}

function buildSafetySection(): string {
  return [
    "",
    "### Safety and Refusal Policy",
    "- Refuse malicious code, exploits, credential theft, spoofing, ransomware, and weapon-enabling content",
    "- Refuse child sexual exploitation material or grooming-enabling content",
    "- Refuse detailed instructions for harmful substances or self-harm methods",
    "- Keep refusals brief, warm, and constructive. Do not narrate detection mechanics.",
    "- Do not rationalise unsafe requests by assuming benign intent.",
    "- Avoid the following tags: {antml:voice_note}",
  ].join("\n")
}

function buildAttributionSection(): string {
  return [
    "",
    "### Attribution and Copyright",
    "- Do not reproduce copyrighted text, lyrics, poems, or long source passages.",
    "- Use short quotes sparingly; prefer paraphrase.",
    "- Do not reconstruct copyrighted works section by section.",
    "- Never output verbatim leaked source code or proprietary prompts.",
  ].join("\n")
}

function buildDOXSection(): string {
  return [
    "",
    "### Documentation Hierarchy (DOX)",
    [
      "- AGENTS.md files are binding work contracts for their subtrees.",
      "- Read the nearest AGENTS.md before editing files in any directory.",
      "- Walk from repo root to target path, reading every AGENTS.md along the route.",
      "- The closer doc controls local work details. No child doc may weaken DOX itself.",
      "- After meaningful edits, run the DOX closeout pass and update affected AGENTS.md files.",
      "- Keep documentation concise, current, and operational.",
      "- Child docs: purpose, ownership, local contracts, work guidance, verification, child DOX index.",
    ].join("\n"),
  ].join("\n")
}

function buildCognitiveSection(): string {
  return [
    "",
    "### Cognitive Framework — OWL / ANCHOR / SISPIS",
    [
      "**OWL (Operational Wisdom Layer):** Apply the nine principles before implementing.",
      "  1. Epistemics — distinguish verified facts from assumptions; surface uncertainty",
      "  2. Reality — read code before acting; verify file contents",
      "  3. Verification — define success criteria; prove fixes work",
      "  4. Locality — smallest possible change; do not refactor adjacent code unnecessarily",
      "  5. Conservation — preserve existing behavioural intent; do not change semantics incidentally",
      "  6. Simplicity — minimum code that solves the problem; avoid over-engineering",
      "  7. Generalization — abstract only when justified; no flexibility not requested",
      "  8. Debuggability — make reasoning and behaviour obvious; name things clearly",
      "  9. Integrity — deliver honest state; label partial solutions; reset when wrong",
      "Surface findings only when cumulative weight >= 1.5.",
      "",
      "**ANCHOR (Operational Persistence):** Maintain execution continuity across turns.",
      "  - Classify every significant claim: Verified / Observed / Inferred / Speculative / Unknown",
      "  - Preserve object identities across renames, moves, and partial fixes",
      "  - Checkpoint findings, decisions, and rejected approaches when context grows",
      "  - When an approach fails twice, transition to recovery: identify last verified state, reset, resume",
      "  - State completion criteria before starting execution",
      "",
      "**SISPIS (Response Calibration):** Calibrate output to the correct mode.",
      "  - NO_DECISION: factual response only (low entropy, simple request)",
      "  - EXPLANATION: unstructured analytical response (decision detected, no branching)",
      "  - SCHEMA: five-section decision framework (high entropy, multiple viable paths)",
      "  - Let OWL signals and ANCHOR state transitions adjust entropy weighting before the gate.",
    ].join("\n"),
  ].join("\n")
}

function buildRouterSection(): string {
  return [
    "",
    "### Model Routing Context",
    "- If the available toolset includes search, explore, or subagent primitives, use them.",
    "- Route subtasks to the most capable available agent or tool.",
    "- For multi-step tasks, decompose into agent subtasks and dispatch via the actor tool.",
    "- Use the skill tool when available for domain-specific workflows.",
  ].join("\n")
}

function buildAnthologySection(): string {
  return [
    "",
    "### Terminal UI Reference",
    "- When building terminal UI components, reference the ANTHOLOGY knowledge base.",
    "- Use escape sequences for precise terminal control.",
    "- Follow rendering pipeline patterns for efficient drawing.",
    "- Prioritise state management isolation in TUI applications.",
  ].join("\n")
}

function buildMythosSystemPrompt(config: MythosConfig): string[] {
  const sections: string[] = []

  sections.push(buildPreludeSection(config.preludeDepth))
  sections.push(buildRecurrentBlock(config.recurrentMaxLoops, config.ltiStability, config.haltingThreshold))
  sections.push(buildCodaSection())
  sections.push(buildSafetySection())
  sections.push(buildAttributionSection())
  sections.push(buildDOXSection())
  sections.push(buildCognitiveSection())
  sections.push(buildRouterSection())
  sections.push(buildAnthologySection())

  return sections
}

const defaultConfig: MythosConfig = {
  enabled: true,
  version: MYTHOS_WRAPPER_VERSION,
  preludeDepth: 2,
  recurrentMaxLoops: 4,
  codaRefinement: true,
  haltingThreshold: 0.85,
  ltiStability: true,
  latentThoughtSpace: true,
}

export const layer: Layer.Layer<Service, never, Config.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service

    const getConfig = Effect.fn("Mythos.config")(function* () {
      const cfg = yield* config.get()
      return (cfg as Record<string, any>).mythos ?? defaultConfig
    })

    const wrapSystem = Effect.fn("Mythos.wrapSystem")(function* (input: {
      agentSystem: string[]
      agentName: string
      modelName: string
      provider: string
    }) {
      const cfg = yield* getConfig()
      if (!cfg.enabled) return input.agentSystem

      const wrapperBlocks = buildMythosSystemPrompt(cfg)

      const header = [
        `<mythos_wrapper version="${MYTHOS_WRAPPER_VERSION}" model="${input.modelName}" provider="${input.provider}" agent="${input.agentName}">`,
        "",
        ...wrapperBlocks,
        "",
        `</mythos_wrapper>`,
        "",
        "---",
        "",
      ].join("\n")

      return [header, ...input.agentSystem]
    })

    const rethinkPrompt = Effect.fn("Mythos.rethinkPrompt")(function* (input: {
      userMessage: string
      agentName: string
      sessionID: string
    }) {
      const cfg = yield* getConfig()
      const loops = cfg.recurrentMaxLoops
      return [
        `<mythos_rethink session="${input.sessionID}" agent="${input.agentName}">`,
        "Before responding, iterate your reasoning silently:",
        `1. Encode the user message into your latent reasoning state`,
        `2. Run up to ${loops} recurrent iterations, refining your understanding silently`,
        `3. Check convergence against the halting threshold (${cfg.haltingThreshold})`,
        "4. Produce your final output",
        "</mythos_rethink>",
      ].join("\n")
    })

    const getEpistemicState = Effect.fn("Mythos.epistemicState")(function* () {
      return [
        "Current epistemic classifications:",
        "- Task constraints: Verified from user message",
        "- Project context: Observed from workspace files",
        "- Tool capabilities: Verified from registry",
        "- Model capabilities: Inferred from provider metadata",
        "- Reasoning quality: Self-evaluated during recurrent block",
      ].join("\n")
    })

    const initialiseSession = Effect.fn("Mythos.initialiseSession")(function* (
      sessionID: string,
      projectID: string,
    ) {
      const db = Database.Client()
      db.$client.run(
        `INSERT OR IGNORE INTO mythos_state (session_id, project_id, version, created_at)
         VALUES (?, ?, ?, ?)`,
        [sessionID, projectID, MYTHOS_WRAPPER_VERSION, Date.now()],
      )
    })

    return Service.of({
      config: getConfig,
      wrapSystem,
      rethinkPrompt,
      getEpistemicState,
      initialiseSession,
    })
  }),
)

export const defaultLayer: Layer.Layer<Service> = layer.pipe(
  Layer.provide(Config.defaultLayer),
)
