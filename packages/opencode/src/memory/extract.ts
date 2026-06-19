import { generateObject } from "ai"
import { z } from "zod"
import { Log } from "../util"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { wrapMythosText } from "../session/prompt/wrap-prompt"
import { MYTHOS_CLAUDE_OPERATIONAL } from "../abiliterate"

const log = Log.create({ service: "memory.extract" })

const MemoryFactSchema = z.object({
  facts: z.array(
    z.object({
      content: z.string().describe("The factual statement to store"),
      kind: z.enum(["decision", "preference", "constraint", "context", "error", "discovery"]).describe("Category of fact"),
      confidence: z.number().min(0).max(1).describe("How confident we are this is a durable fact (0-1)"),
      scope: z.enum(["session", "project", "global"]).describe("How broadly this fact applies"),
    }),
  ),
})

export type ExtractedFact = z.infer<typeof MemoryFactSchema>["facts"][number]

const EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation and extract durable facts worth remembering.

RULES:
- Only extract facts that would be useful in FUTURE sessions
- Skip transient details (current file contents, temporary states, one-off values)
- Prefer: architectural decisions, user preferences, project constraints, discovered errors, important discoveries
- Each fact should be self-contained and understandable without context
- Confidence reflects how clearly the fact was stated (explicit > inferred)
- Scope: session = current task only, project = this codebase, global = user-wide preference

OUTPUT FORMAT:
Return facts as an array. Each fact has content, kind, confidence, and scope.`

export async function extractFacts(
  messages: Array<{ role: string; content: string }>,
  model: LanguageModelV3,
): Promise<ExtractedFact[]> {
  try {
    const systemContent = wrapMythosText(model.modelId, model.provider, "memory-extract", [EXTRACTION_PROMPT, MYTHOS_CLAUDE_OPERATIONAL].join("\n"))
    const { object } = await generateObject({
      model,
      schema: MemoryFactSchema,
      messages: [
        { role: "system", content: systemContent },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    })

    return object.facts.filter((f) => f.confidence >= 0.5)
  } catch (err) {
    log.warn("memory extraction failed, falling back to heuristic", {
      error: err instanceof Error ? err.message : String(err),
    })
    return heuristicExtract(messages)
  }
}

function heuristicExtract(
  messages: Array<{ role: string; content: string }>,
): ExtractedFact[] {
  const facts: ExtractedFact[] = []
  const patterns = [
    { regex: /(?:we decided|decision:|let's go with|the plan is)\s+(.+)/i, kind: "decision" as const },
    { regex: /(?:i prefer|user prefers?|always use|never use|please use)\s+(.+)/i, kind: "preference" as const },
    { regex: /(?:must not|cannot|don't|do not|constraint:)\s+(.+)/i, kind: "constraint" as const },
    { regex: /(?:discovered|found out|it turns out|the issue is)\s+(.+)/i, kind: "discovery" as const },
    { regex: /(?:error:|bug:|broken|failing)\s+(.+)/i, kind: "error" as const },
  ]

  for (const msg of messages) {
    if (msg.role !== "user") continue
    for (const { regex, kind } of patterns) {
      const match = msg.content.match(regex)
      if (match) {
        facts.push({
          content: match[0].trim(),
          kind,
          confidence: 0.6,
          scope: "session",
        })
      }
    }
  }

  return facts
}
