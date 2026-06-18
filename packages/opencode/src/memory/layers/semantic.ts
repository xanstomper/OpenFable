import { Database } from "@/storage"

export interface Symbol {
  id: string
  name: string
  kind: "function" | "class" | "type" | "interface" | "variable" | "module"
  filePath: string
  startLine: number
  endLine: number
  signature: string
  summary: string
  hash: string
  lastIndexed: number
}

export interface Dependency {
  from: string
  to: string
  kind: "imports" | "calls" | "extends" | "implements" | "uses"
}

export class SemanticMemory {
  private db: ReturnType<typeof Database.Client>

  constructor() {
    this.db = Database.Client()
    this.ensureSchema()
  }

  private ensureSchema(): void {
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS semantic_symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        signature TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        hash TEXT NOT NULL,
        last_indexed INTEGER NOT NULL
      )
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS idx_symbol_name ON semantic_symbols(name)
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS idx_symbol_file ON semantic_symbols(file_path)
    `)
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS semantic_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        FOREIGN KEY (from_id) REFERENCES semantic_symbols(id),
        FOREIGN KEY (to_id) REFERENCES semantic_symbols(id)
      )
    `)
  }

  indexSymbol(symbol: Omit<Symbol, "id" | "lastIndexed">): Symbol {
    const id = `sym_${symbol.kind}_${symbol.name}_${symbol.filePath.replace(/[^a-zA-Z0-9]/g, "_")}`
    const now = Date.now()
    const full: Symbol = { ...symbol, id, lastIndexed: now }

    this.db.$client.run(
      `INSERT OR REPLACE INTO semantic_symbols (id, name, kind, file_path, start_line, end_line, signature, summary, hash, last_indexed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [full.id, full.name, full.kind, full.filePath, full.startLine, full.endLine, full.signature, full.summary, full.hash, full.lastIndexed],
    )

    return full
  }

  indexDependency(dep: Dependency): void {
    this.db.$client.run(
      `INSERT INTO semantic_dependencies (from_id, to_id, kind) VALUES (?, ?, ?)`,
      [dep.from, dep.to, dep.kind],
    )
  }

  getSymbol(id: string): Symbol | undefined {
    const row = this.db.$client.query(`SELECT * FROM semantic_symbols WHERE id = ?`).get(id) as any
    if (!row) return undefined
    return this.rowToSymbol(row)
  }

  searchByName(name: string, limit: number = 10): Symbol[] {
    const rows = this.db.$client
      .query(`SELECT * FROM semantic_symbols WHERE name LIKE ? ORDER BY name LIMIT ?`)
      .all(`%${name}%`, limit) as any[]
    return rows.map((r) => this.rowToSymbol(r))
  }

  getByFile(filePath: string): Symbol[] {
    const rows = this.db.$client
      .query(`SELECT * FROM semantic_symbols WHERE file_path = ? ORDER BY start_line`)
      .all(filePath) as any[]
    return rows.map((r) => this.rowToSymbol(r))
  }

  getDependencies(symbolId: string): Symbol[] {
    const rows = this.db.$client
      .query(
        `SELECT s.* FROM semantic_symbols s
         JOIN semantic_dependencies d ON s.id = d.to_id
         WHERE d.from_id = ?`,
      )
      .all(symbolId) as any[]
    return rows.map((r) => this.rowToSymbol(r))
  }

  getDependents(symbolId: string): Symbol[] {
    const rows = this.db.$client
      .query(
        `SELECT s.* FROM semantic_symbols s
         JOIN semantic_dependencies d ON s.id = d.from_id
         WHERE d.to_id = ?`,
      )
      .all(symbolId) as any[]
    return rows.map((r) => this.rowToSymbol(r))
  }

  invalidateByHash(filePath: string, currentHash: string): number {
    const rows = this.db.$client
      .query(`SELECT id, hash FROM semantic_symbols WHERE file_path = ?`)
      .all(filePath) as any[]

    let invalidated = 0
    for (const row of rows) {
      if (row.hash !== currentHash) {
        this.db.$client.run(`DELETE FROM semantic_symbols WHERE id = ?`, [row.id])
        this.db.$client.run(`DELETE FROM semantic_dependencies WHERE from_id = ? OR to_id = ?`, [row.id, row.id])
        invalidated++
      }
    }
    return invalidated
  }

  clear(): void {
    this.db.$client.run(`DELETE FROM semantic_symbols`)
    this.db.$client.run(`DELETE FROM semantic_dependencies`)
  }

  private rowToSymbol(row: any): Symbol {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      filePath: row.file_path,
      startLine: row.start_line,
      endLine: row.end_line,
      signature: row.signature,
      summary: row.summary,
      hash: row.hash,
      lastIndexed: row.last_indexed,
    }
  }
}
