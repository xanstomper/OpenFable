import { Context, Effect, Layer } from "effect"
import path from "path"
import os from "os"
import { Global } from "../global"
import { Database } from "../storage"
import { Config } from "../config"
import { reconcileMemory } from "./reconcile"
import { buildFtsQuery } from "./fts-query"
import { EntityStore } from "./entity-store"
import { hybridSearch, type ScoredResult } from "./hybrid-scorer"
import { extractFacts, type ExtractedFact } from "./extract"
import { contentHash } from "./dedup"
import type { LanguageModelV3 } from "@ai-sdk/provider"

type SearchRow = {
  path: string
  scope: string
  scope_id: string
  type: string
  snippet: string
  score: number
}

export interface Interface {
  readonly root: () => Effect.Effect<string>
  readonly reconcile: () => Effect.Effect<{ indexed: number; pruned: number }>
  readonly search: (input: {
    query: string
    scope?: string
    scope_id?: string
    type?: string
    limit?: number
  }) => Effect.Effect<
    Array<{ path: string; snippet: string; score: number; scope: string; scope_id: string; type: string }>
  >
  readonly hybridSearch: (input: {
    query: string
    scope?: string
    scope_id?: string
    type?: string
    limit?: number
  }) => Effect.Effect<ScoredResult[]>
  readonly entityStore: () => EntityStore
  readonly extractFacts: (
    messages: Array<{ role: string; content: string }>,
    model: LanguageModelV3,
  ) => Effect.Effect<ExtractedFact[]>
  readonly isDuplicate: (body: string) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Memory") {}

export const layer: Layer.Layer<Service, never, Config.Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const root = path.join(Global.Path.data, "memory")
    const ccBase = path.join(os.homedir(), ".claude", "projects")

    const entityStore = new EntityStore()

    const rootEff = Effect.fn("Memory.root")(function* () {
      return root
    })

    const reconcile = Effect.fn("Memory.reconcile")(function* () {
      const cfg = yield* config.get()
      const cc = cfg.memory?.cc_index ? ccBase : undefined
      return yield* Effect.promise(() => reconcileMemory({ openfable: root, cc }, { entityStore }))
    })

    const search = Effect.fn("Memory.search")(function* (input: {
      query: string
      scope?: string
      scope_id?: string
      type?: string
      limit?: number
    }) {
      const cfg = yield* config.get()
      if (cfg.checkpoint?.memory_reconcile_on_search ?? true) {
        const cc = cfg.memory?.cc_index ? ccBase : undefined
        yield* Effect.promise(() => reconcileMemory({ openfable: root, cc }, { entityStore }))
      }

      const limit = input.limit ?? 10
      const ftsQuery = buildFtsQuery(input.query)
      if (!ftsQuery) return []

      const floorRatio = cfg.checkpoint?.memory_search_score_floor ?? 0.15

      const conditions: string[] = []
      const params: string[] = []
      if (input.scope) {
        conditions.push("memory_fts.scope = ?")
        params.push(input.scope)
      }
      if (input.scope_id) {
        conditions.push("memory_fts.scope_id = ?")
        params.push(input.scope_id)
      }
      if (input.type) {
        conditions.push("memory_fts.type = ?")
        params.push(input.type)
      }
      const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : ""

      const sql = `
        SELECT memory_fts.path, memory_fts.scope, memory_fts.scope_id, memory_fts.type,
               snippet(memory_fts_idx, 0, '<<', '>>', '...', 32) AS snippet,
               bm25(memory_fts_idx) AS score
        FROM memory_fts_idx
        JOIN memory_fts ON memory_fts.id = memory_fts_idx.rowid
        WHERE memory_fts_idx MATCH ?
        ${whereClause}
        ORDER BY score
        LIMIT ?
      `

      const fetchLimit = Math.min(limit * 3, 50)
      const rows = Database.Client().$client.query(sql).all(ftsQuery, ...params, fetchLimit) as SearchRow[]

      const mapped = rows.map((r) => ({
        path: r.path,
        snippet: r.snippet,
        score: -r.score,
        scope: r.scope,
        scope_id: r.scope_id,
        type: r.type,
      }))
      if (mapped.length === 0) return []
      const topScore = mapped[0].score
      const cutoff = floorRatio > 0 ? topScore * floorRatio : -Infinity
      return mapped.filter((r, i) => i === 0 || r.score >= cutoff).slice(0, limit)
    })

    const hybridSearchFn = Effect.fn("Memory.hybridSearch")(function* (input: {
      query: string
      scope?: string
      scope_id?: string
      type?: string
      limit?: number
    }) {
      const cfg = yield* config.get()
      if (cfg.checkpoint?.memory_reconcile_on_search ?? true) {
        const cc = cfg.memory?.cc_index ? ccBase : undefined
        yield* Effect.promise(() => reconcileMemory({ openfable: root, cc }, { entityStore }))
      }
      return hybridSearch(input, entityStore)
    })

    const extractFactsFn = Effect.fn("Memory.extractFacts")(function* (
      messages: Array<{ role: string; content: string }>,
      model: LanguageModelV3,
    ) {
      return yield* Effect.promise(() => extractFacts(messages, model))
    })

    const isDuplicateFn = Effect.fn("Memory.isDuplicate")(function* (body: string) {
      const hash = contentHash(body)
      const rows = Database.Client().$client.query("SELECT 1 FROM memory_fts WHERE body = ? LIMIT 1").all(body)
      return rows.length > 0
    })

    return Service.of({
      root: rootEff,
      reconcile,
      search,
      hybridSearch: hybridSearchFn,
      entityStore: () => entityStore,
      extractFacts: extractFactsFn,
      isDuplicate: isDuplicateFn,
    })
  }),
)

export const defaultLayer = Layer.suspend(() => layer.pipe(Layer.provide(Config.defaultLayer)))
