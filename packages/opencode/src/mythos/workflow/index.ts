import { Effect, Context, Layer } from "effect"
import { Database } from "../../storage"
import { Log } from "../../util"

export interface WorkflowState {
  workflowID: string
  sessionID: string
  phase: "prelude" | "recurrent" | "coda" | "complete"
  loopCount: number
  maxLoops: number
  startedAt: number
  completedAt?: number
  status: "running" | "completed" | "failed" | "cancelled"
  context: Record<string, unknown>
}

export interface Interface {
  readonly create: (input: { sessionID: string; maxLoops?: number }) => Effect.Effect<WorkflowState>
  readonly step: (workflowID: string) => Effect.Effect<WorkflowState>
  readonly complete: (workflowID: string) => Effect.Effect<void>
  readonly fail: (workflowID: string, error: string) => Effect.Effect<void>
  readonly get: (workflowID: string) => Effect.Effect<WorkflowState | null>
}

export class Service extends Context.Service<Service, Interface>()("@openfable/MythosWorkflow") {}

const log = Log.create({ service: "mythos-workflow" })

export const layer: Layer.Layer<Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const create = Effect.fn("MythosWorkflow.create")(function* (input: {
      sessionID: string
      maxLoops?: number
    }) {
      const id = crypto.randomUUID()
      const state: WorkflowState = {
        workflowID: id,
        sessionID: input.sessionID,
        phase: "prelude",
        loopCount: 0,
        maxLoops: input.maxLoops ?? 4,
        startedAt: Date.now(),
        status: "running",
        context: {},
      }
      const db = Database.Client()
      db.$client.run(
        `INSERT INTO mythos_workflow (workflow_id, session_id, phase, loop_count, max_loops, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, input.sessionID, state.phase, state.loopCount, state.maxLoops, state.status, state.startedAt],
      )
      log.info("workflow created", { id, sessionID: input.sessionID })
      return state
    })

    const step = Effect.fn("MythosWorkflow.step")(function* (workflowID: string) {
      const db = Database.Client()
      const row = db.$client.query(
        "SELECT * FROM mythos_workflow WHERE workflow_id = ?",
      ).get(workflowID) as Record<string, any> | undefined
      if (!row) throw new Error(`workflow not found: ${workflowID}`)

      const state: WorkflowState = {
        workflowID: row.workflow_id,
        sessionID: row.session_id,
        phase: row.phase,
        loopCount: row.loop_count,
        maxLoops: row.max_loops,
        startedAt: row.started_at,
        completedAt: row.completed_at ?? undefined,
        status: row.status,
        context: row.context ? JSON.parse(row.context) : {},
      }

      if (state.status !== "running") return state

      if (state.phase === "prelude") {
        state.phase = "recurrent"
        state.loopCount = 0
      } else if (state.phase === "recurrent") {
        state.loopCount++
        if (state.loopCount >= state.maxLoops) {
          state.phase = "coda"
        }
      } else if (state.phase === "coda") {
        state.phase = "complete"
        state.status = "completed"
        state.completedAt = Date.now()
      }

      db.$client.run(
        `UPDATE mythos_workflow SET phase = ?, loop_count = ?, status = ?, completed_at = ? WHERE workflow_id = ?`,
        [state.phase, state.loopCount, state.status, state.completedAt ?? null, workflowID],
      )
      return state
    })

    const complete = Effect.fn("MythosWorkflow.complete")(function* (workflowID: string) {
      const db = Database.Client()
      db.$client.run(
        `UPDATE mythos_workflow SET status = 'completed', phase = 'complete', completed_at = ? WHERE workflow_id = ?`,
        [Date.now(), workflowID],
      )
    })

    const fail = Effect.fn("MythosWorkflow.fail")(function* (workflowID: string, error: string) {
      const db = Database.Client()
      db.$client.run(
        `UPDATE mythos_workflow SET status = 'failed', phase = 'coda', completed_at = ?, error = ? WHERE workflow_id = ?`,
        [Date.now(), error, workflowID],
      )
    })

    const get = Effect.fn("MythosWorkflow.get")(function* (workflowID: string) {
      const db = Database.Client()
      const row = db.$client.query(
        "SELECT * FROM mythos_workflow WHERE workflow_id = ?",
      ).get(workflowID) as Record<string, any> | undefined
      if (!row) return null
      return {
        workflowID: row.workflow_id,
        sessionID: row.session_id,
        phase: row.phase,
        loopCount: row.loop_count,
        maxLoops: row.max_loops,
        startedAt: row.started_at,
        completedAt: row.completed_at ?? undefined,
        status: row.status,
        context: row.context ? JSON.parse(row.context) : {},
      } satisfies WorkflowState
    })

    return Service.of({ create, step, complete, fail, get })
  }),
)

export const defaultLayer: Layer.Layer<Service> = layer
