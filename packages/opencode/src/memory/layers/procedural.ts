import { Database } from "@/storage"

export interface Procedure {
  id: string
  rule: string
  context: string
  source: "user_correction" | "pattern_detected" | "explicit_config" | "inferred"
  confidence: number
  createdAt: number
  lastUsed: number
  useCount: number
}

export class ProceduralMemory {
  private db: ReturnType<typeof Database.Client>

  constructor() {
    this.db = Database.Client()
    this.ensureSchema()
  }

  private ensureSchema(): void {
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS procedural_memory (
        id TEXT PRIMARY KEY,
        rule TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.8,
        created_at INTEGER NOT NULL,
        last_used INTEGER NOT NULL,
        use_count INTEGER NOT NULL DEFAULT 0
      )
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS idx_procedural_source ON procedural_memory(source)
    `)
  }

  add(rule: string, context: string, source: Procedure["source"]): Procedure {
    const id = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    const procedure: Procedure = {
      id,
      rule,
      context,
      source,
      confidence: source === "explicit_config" ? 1.0 : source === "user_correction" ? 0.9 : 0.7,
      createdAt: now,
      lastUsed: now,
      useCount: 0,
    }

    this.db.$client.run(
      `INSERT INTO procedural_memory (id, rule, context, source, confidence, created_at, last_used, use_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [procedure.id, procedure.rule, procedure.context, procedure.source, procedure.confidence, procedure.createdAt, procedure.lastUsed, procedure.useCount],
    )

    return procedure
  }

  get(id: string): Procedure | undefined {
    const row = this.db.$client.query(`SELECT * FROM procedural_memory WHERE id = ?`).get(id) as any
    if (!row) return undefined
    return this.rowToProcedure(row)
  }

  getAll(): Procedure[] {
    const rows = this.db.$client.query(`SELECT * FROM procedural_memory ORDER BY confidence DESC`).all() as any[]
    return rows.map((r) => this.rowToProcedure(r))
  }

  getBySource(source: Procedure["source"]): Procedure[] {
    const rows = this.db.$client
      .query(`SELECT * FROM procedural_memory WHERE source = ? ORDER BY confidence DESC`)
      .all(source) as any[]
    return rows.map((r) => this.rowToProcedure(r))
  }

  search(query: string): Procedure[] {
    const rows = this.db.$client
      .query(`SELECT * FROM procedural_memory WHERE rule LIKE ? OR context LIKE ? ORDER BY confidence DESC`)
      .all(`%${query}%`, `%${query}%`) as any[]
    return rows.map((r) => this.rowToProcedure(r))
  }

  markUsed(id: string): void {
    this.db.$client.run(
      `UPDATE procedural_memory SET last_used = ?, use_count = use_count + 1 WHERE id = ?`,
      [Date.now(), id],
    )
  }

  updateConfidence(id: string, confidence: number): void {
    this.db.$client.run(
      `UPDATE procedural_memory SET confidence = ? WHERE id = ?`,
      [Math.max(0, Math.min(1, confidence)), id],
    )
  }

  delete(id: string): void {
    this.db.$client.run(`DELETE FROM procedural_memory WHERE id = ?`, [id])
  }

  getActiveRules(): Procedure[] {
    return this.getAll().filter((p) => p.confidence >= 0.5)
  }

  private rowToProcedure(row: any): Procedure {
    return {
      id: row.id,
      rule: row.rule,
      context: row.context,
      source: row.source,
      confidence: row.confidence,
      createdAt: row.created_at,
      lastUsed: row.last_used,
      useCount: row.use_count,
    }
  }
}
