import { Database } from "../storage"

const ENTITY_PATTERNS: Array<{ regex: RegExp; kind: string }> = [
  { regex: /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, kind: "type" },
  { regex: /\b(?:function|class|interface|type|const|let|var)\s+(\w+)/g, kind: "symbol" },
  { regex: /\b\w+\.\w+(?:\.\w+)*/g, kind: "dotted" },
  { regex: /\b(?:src|lib|pkg|packages)\/[\w./-]+/g, kind: "path" },
  { regex: /\b(?:TS|JS|JSON|YAML|TOML|SQL|MD|Go|Rust|Python|TypeScript)\b/g, kind: "language" },
  { regex: /`[^`]+`/g, kind: "code" },
]

export function extractEntities(text: string): Array<{ entity: string; kind: string }> {
  const found = new Map<string, string>()
  for (const { regex, kind } of ENTITY_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      const value = match[1] ?? match[0]
      if (value.length >= 2 && value.length <= 120) {
        const existing = found.get(value)
        if (!existing || kindPriority(kind) > kindPriority(existing)) {
          found.set(value, kind)
        }
      }
    }
  }
  return Array.from(found.entries()).map(([entity, kind]) => ({ entity, kind }))
}

function kindPriority(kind: string): number {
  const priorities: Record<string, number> = {
    symbol: 5,
    type: 4,
    code: 3,
    path: 2,
    language: 1,
    dotted: 0,
    general: 0,
  }
  return priorities[kind] ?? 0
}

export class EntityStore {
  private db: ReturnType<typeof Database.Client>

  constructor() {
    this.db = Database.Client()
    this.ensureSchema()
  }

  private ensureSchema(): void {
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS memory_entity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_path TEXT NOT NULL,
        entity TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'general',
        created_at INTEGER NOT NULL
      )
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS memory_entity_path_idx ON memory_entity(memory_path)
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS memory_entity_name_idx ON memory_entity(entity)
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS memory_entity_kind_idx ON memory_entity(kind)
    `)
  }

  indexEntities(memoryPath: string, entities: Array<{ entity: string; kind: string }>): void {
    this.db.$client.run(`DELETE FROM memory_entity WHERE memory_path = ?`, [memoryPath])
    const now = Date.now()
    for (const { entity, kind } of entities) {
      this.db.$client.run(
        `INSERT INTO memory_entity (memory_path, entity, kind, created_at) VALUES (?, ?, ?, ?)`,
        [memoryPath, entity, kind, now],
      )
    }
  }

  getEntities(memoryPath: string): Array<{ entity: string; kind: string }> {
    const rows = this.db.$client
      .query(`SELECT entity, kind FROM memory_entity WHERE memory_path = ?`)
      .all(memoryPath) as Array<{ entity: string; kind: string }>
    return rows
  }

  findByEntity(entity: string): string[] {
    const rows = this.db.$client
      .query(`SELECT DISTINCT memory_path FROM memory_entity WHERE entity = ?`)
      .all(entity) as Array<{ memory_path: string }>
    return rows.map((r) => r.memory_path)
  }

  findByEntities(entities: string[]): Map<string, number> {
    const boostMap = new Map<string, number>()
    for (const entity of entities) {
      const paths = this.findByEntity(entity)
      for (const p of paths) {
        boostMap.set(p, (boostMap.get(p) ?? 0) + 1)
      }
    }
    return boostMap
  }

  removeByPath(memoryPath: string): void {
    this.db.$client.run(`DELETE FROM memory_entity WHERE memory_path = ?`, [memoryPath])
  }

  getEntityCounts(): Array<{ entity: string; count: number }> {
    const rows = this.db.$client
      .query(
        `SELECT entity, COUNT(DISTINCT memory_path) as count
         FROM memory_entity
         GROUP BY entity
         ORDER BY count DESC
         LIMIT 500`,
      )
      .all() as Array<{ entity: string; count: number }>
    return rows
  }
}
