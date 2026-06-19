import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"

const Parameters = z.object({
  task: z.string().describe("The task description in imperative form (e.g., 'Fix authentication bug')"),
  status: z.enum(["pending", "in_progress", "completed", "deleted"]).describe("The task status"),
  activeForm: z.string().optional().describe("Present continuous form shown during execution (e.g., 'Fixing authentication bug')"),
  id: z.string().optional().describe("Task ID for updating existing tasks"),
})

export const TodoWriteTool = Tool.define(
  "todo_write",
  Effect.gen(function* () {
    return {
      description: "Create and manage a structured task list. Track progress on complex multi-step work.",
      parameters: Parameters,
      execute: (params: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const { task, status, activeForm, id } = params
          const taskId = id ?? `todo-${Date.now()}`
          const active = activeForm ?? task

          let output = ""
          if (status === "completed") {
            output = `✓ Task completed: ${task}`
          } else if (status === "deleted") {
            output = `✗ Task deleted: ${task}`
          } else if (status === "in_progress") {
            output = `→ Working on: ${active}`
          } else {
            output = `○ Task created: ${task}`
          }

          return {
            title: `Todo: ${task}`,
            metadata: { taskId, status },
            output,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
