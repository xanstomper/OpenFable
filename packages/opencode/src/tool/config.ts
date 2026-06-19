import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"

const Parameters = z.object({
  setting: z.string().describe("The configuration setting name"),
  value: z.string().optional().describe("The new value (omit to get current value)"),
})

export const ConfigTool = Tool.define(
  "config",
  Effect.gen(function* () {
    return {
      description: "Get or set configuration settings.",
      parameters: Parameters,
      execute: (params: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          if (params.value) {
            return {
              title: `Config: ${params.setting}`,
              metadata: { setting: params.setting, value: params.value },
              output: `Set ${params.setting} = ${params.value}`,
            }
          }
          return {
            title: `Config: ${params.setting}`,
            metadata: { setting: params.setting, value: "" },
            output: `Current value of ${params.setting}: (check config file)`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
