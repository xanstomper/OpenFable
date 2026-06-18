import { buildFtsQuery } from "./fts-query"
import { EntityStore, extractEntities } from "./entity-store"
import { Database } from "../storage"

export interface ScoredResult {
  path: string
  snippet: string
  score: number
  bm25Score: number
  entityBoost: number
  keywordBoost: number
  scope: string
  scope_id: string
  type: string
}

interface HybridOptions {
  query: string
  scope?: string
  scope_id?: string
  type?: string
  limit?: number
  bm25Weight?: number
  entityWeight?: number
  keywordWeight?: number
}

const DEFAULT_WEIGHTS = {
  bm25: 1.0,
  entity: 0.3,
  keyword: 0.2,
}

export function hybridSearch(
  input: HybridOptions,
  entityStore: EntityStore,
): ScoredResult[] {
  const limit = input.limit ?? 10
  const weights = {
    bm25: input.bm25Weight ?? DEFAULT_WEIGHTS.bm25,
    entity: input.entityWeight ?? DEFAULT_WEIGHTS.entity,
    keyword: input.keywordWeight ?? DEFAULT_WEIGHTS.keyword,
  }

  const ftsQuery = buildFtsQuery(input.query)
  if (!ftsQuery) return []

  const queryEntities = extractEntities(input.query).map((e) => e.entity)
  const entityBoostMap = entityStore.findByEntities(queryEntities)

  const fetchLimit = Math.min(limit * 3, 50)

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

  const rows = Database.Client().$client.query(sql).all(ftsQuery, ...params, fetchLimit) as Array<{
    path: string
    scope: string
    scope_id: string
    type: string
    snippet: string
    score: number
  }>

  const queryKeywords = tokenize(input.query)

  const scored: ScoredResult[] = rows.map((r) => {
    const bm25 = -r.score
    const entityCount = entityBoostMap.get(r.path) ?? 0
    const entityBoost = entityCount * weights.entity

    const docBody = r.snippet.replace(/<<|>>/g, "").toLowerCase()
    let keywordHits = 0
    for (const kw of queryKeywords) {
      if (docBody.includes(kw)) keywordHits++
    }
    const keywordBoost = queryKeywords.length > 0 ? (keywordHits / queryKeywords.length) * weights.keyword : 0

    const totalScore = bm25 * weights.bm25 + entityBoost + keywordBoost

    return {
      path: r.path,
      snippet: r.snippet,
      score: totalScore,
      bm25Score: bm25,
      entityBoost,
      keywordBoost,
      scope: r.scope,
      scope_id: r.scope_id,
      type: r.type,
    }
  })

  scored.sort((a, b) => b.score - a.score)

  if (scored.length === 0) return []
  const topScore = scored[0].score
  const cutoff = topScore * 0.15
  return scored.filter((r, i) => i === 0 || r.score >= cutoff).slice(0, limit)
}

function tokenize(text: string): string[] {
  return (text.match(/[\p{L}\p{N}_]+/gu) ?? [])
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 2)
}
