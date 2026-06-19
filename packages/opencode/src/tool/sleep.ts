import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"

const Parameters = z.object({
  duration: z.number().describe("Duration to sleep in milliseconds").optional(),
})

export const SleepTool = Tool.define(
  "sleep",
  Effect.gen(function* () {
    return {
      description: "Wait for a specified duration. The user can interrupt at any time.",
      parameters: Parameters,
      execute: (params: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const duration = params.duration ?? 1000
          yield* Effect.sleep(`${duration} millis`)
          return {
            title: "Sleep",
            metadata: { duration },
            output: `Slept for ${duration}ms`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
