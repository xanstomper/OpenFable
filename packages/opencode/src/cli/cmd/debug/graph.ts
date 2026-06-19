import { AppRuntime } from "@/effect/app-runtime"
import { GraphWorkflow } from "@/workflow/graph"
import { Effect } from "effect"
import { cmd } from "../cmd"

export const GraphCommand = cmd({
  command: "graph",
  describe: "graph workflow engine",
  builder: (yargs: any) =>
    yargs
      .command({
        command: "run <graphId>",
        describe: "execute a graph workflow",
        builder: (yargs: any) =>
          yargs
            .positional("graphId", { type: "string", describe: "graph ID to execute" })
            .option("data", { type: "string", describe: "initial data as JSON", default: "{}" }),
        async handler(argv: { graphId: string; data: string }) {
          await AppRuntime.runPromise(
            Effect.gen(function* () {
              const workflow = yield* GraphWorkflow.Service
              const initialData = JSON.parse(argv.data)
              const state = yield* workflow.execute(argv.graphId, initialData)
              console.log(JSON.stringify(state, null, 2))
            })
          )
        },
      })
      .command({
        command: "list",
        describe: "list registered graphs",
        async handler() {
          await AppRuntime.runPromise(
            Effect.gen(function* () {
              const workflow = yield* GraphWorkflow.Service
              const graphs = yield* workflow.list()
              if (graphs.length === 0) {
                console.log("No graphs registered")
              } else {
                for (const id of graphs) console.log(id)
              }
            })
          )
        },
      })
      .demandCommand(),
  async handler() {},
})