import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"

const Parameters = z.object({
  query: z.string().describe("The search query"),
  numResults: z.number().optional().describe("Number of results to return (default 5)"),
})

export const WebSearchTool = Tool.define(
  "web_search",
  Effect.gen(function* () {
    return {
      description: "Search the web for information. Returns search results with links.",
      parameters: Parameters,
      execute: (params: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const query = params.query
          const numResults = params.numResults ?? 5

          return {
            title: `Search: ${query}`,
            metadata: { query, numResults },
            output: `Web search for "${query}" (up to ${numResults} results). Use webfetch to read specific URLs from search results.`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
