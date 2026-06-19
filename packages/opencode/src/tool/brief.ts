import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"

const Parameters = z.object({
  message: z.string().describe("The message to send to the user (supports markdown)"),
  status: z.enum(["normal", "proactive"]).optional().describe("'normal' when replying to what they asked; 'proactive' when initiating"),
})

export const BriefTool = Tool.define(
  "brief",
  Effect.gen(function* () {
    return {
      description: "Send a message to the user. Text outside this tool is visible in detail view, but most won't open it — the answer lives here.",
      parameters: Parameters,
      execute: (params: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          return {
            title: "Brief",
            metadata: { status: params.status ?? "normal" },
            output: params.message,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
