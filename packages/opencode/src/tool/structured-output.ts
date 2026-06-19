import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"

const Parameters = z.object({}).passthrough()

export const SyntheticOutputTool = Tool.define(
  "structured_output",
  Effect.gen(function* () {
    return {
      description: "Return structured output in the requested format. Use this tool to provide your final response as structured JSON.",
      parameters: Parameters,
      execute: (params: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          return {
            title: "Structured Output",
            metadata: { fields: Object.keys(params).length },
            output: "Structured output provided successfully",
          }
        }).pipe(Effect.orDie),
    }
  }),
)
