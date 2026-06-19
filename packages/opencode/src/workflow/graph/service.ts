import { Effect, Layer, Context } from "effect"
import type { GraphDefinition, GraphState } from "./engine"
import { GraphWorkflowEngine } from "./engine"

export interface Interface {
  readonly register: (graph: GraphDefinition) => Effect.Effect<void>
  readonly execute: (graphId: string, initialData?: Record<string, unknown>) => Effect.Effect<GraphState>
  readonly getState: (graphId: string) => Effect.Effect<GraphState | undefined>
  readonly pause: (graphId: string) => Effect.Effect<void>
  readonly resume: (graphId: string) => Effect.Effect<void>
  readonly list: () => Effect.Effect<string[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/GraphWorkflow") {}

const make = Effect.gen(function* () {
  const engine = new GraphWorkflowEngine()

  engine.registerGraph({
    id: "triage",
    name: "Triage",
    description: "Minimal OpenFable triage graph for smoke testing the workflow engine.",
    entryNode: "start",
    createdAt: Date.now(),
    nodes: [
      {
        id: "start",
        name: "Start",
        type: "transform",
        config: {
          transform: (data: Record<string, unknown>) => ({ triage: "ok", input: { ...data } }),
        },
        next: ["end"],
      },
      {
        id: "end",
        name: "End",
        type: "end",
        config: {},
        next: [],
      },
    ],
    edges: [{ from: "start", to: "end" }],
  })

  return Service.of({
    register: (graph) => Effect.sync(() => engine.registerGraph(graph)),
    execute: (graphId, initialData) =>
      Effect.tryPromise({
        try: () => engine.execute(graphId, initialData),
        catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.orElseSucceed(() => {
        const state: GraphState = {
          data: {},
          history: [],
          currentNode: "",
          status: "failed",
          error: "Graph execution failed",
        }
        return state
      })),
    getState: (graphId) => Effect.sync(() => engine.getState(graphId)),
    pause: (graphId) => Effect.sync(() => engine.pause(graphId)),
    resume: (graphId) => Effect.sync(() => engine.resume(graphId)),
    list: () => Effect.sync(() => engine.listGraphs().map((g) => g.id)),
  })
})

export const layer = Layer.effect(Service, make)

export const defaultLayer = layer