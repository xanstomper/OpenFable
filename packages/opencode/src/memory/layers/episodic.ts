import { Database } from "@/storage"

export interface Episode {
  id: string
  sessionID: string
  title: string
  summary: string
  whatHappened: string
  resolution: string
  filesTouched: string[]
  tags: string[]
  links: string[]
  hash: string
  createdAt: number
  updatedAt: number
}

export class EpisodicMemory {
  private db: ReturnType<typeof Database.Client>

  constructor() {
    this.db = Database.Client()
    this.ensureSchema()
  }

  private ensureSchema(): void {
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS episodic_memory (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        what_happened TEXT NOT NULL,
        resolution TEXT NOT NULL DEFAULT '',
        files_touched TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        links TEXT NOT NULL DEFAULT '[]',
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS idx_episodic_session ON episodic_memory(session_id)
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS idx_episodic_tags ON episodic_memory(tags)
    `)
  }

  record(episode: Omit<Episode, "id" | "createdAt" | "updatedAt">): Episode {
    const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    const full: Episode = {
      ...episode,
      id,
      createdAt: now,
      updatedAt: now,
    }

    this.db.$client.run(
      `INSERT INTO episodic_memory (id, session_id, title, summary, what_happened, resolution, files_touched, tags, links, hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full.id,
        full.sessionID,
        full.title,
        full.summary,
        full.whatHappened,
        full.resolution,
        JSON.stringify(full.filesTouched),
        JSON.stringify(full.tags),
        full.hash,
        full.createdAt,
        full.updatedAt,
      ],
    )

    return full
  }

  get(id: string): Episode | undefined {
    const row = this.db.$client.query(`SELECT * FROM episodic_memory WHERE id = ?`).get(id) as any
    if (!row) return undefined
    return this.rowToEpisode(row)
  }

  getBySession(sessionID: string): Episode[] {
    const rows = this.db.$client
      .query(`SELECT * FROM episodic_memory WHERE session_id = ? ORDER BY created_at DESC`)
      .all(sessionID) as any[]
    return rows.map((r) => this.rowToEpisode(r))
  }

  getByTag(tag: string): Episode[] {
    const rows = this.db.$client
      .query(`SELECT * FROM episodic_memory WHERE tags LIKE ? ORDER BY created_at DESC`)
      .all(`%${tag}%`) as any[]
    return rows.map((r) => this.rowToEpisode(r))
  }

  search(query: string, limit: number = 10): Episode[] {
    const rows = this.db.$client
      .query(
        `SELECT * FROM episodic_memory
         WHERE title LIKE ? OR summary LIKE ? OR what_happened LIKE ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as any[]
    return rows.map((r) => this.rowToEpisode(r))
  }

  update(id: string, updates: Partial<Pick<Episode, "resolution" | "summary" | "tags" | "links" | "hash">>): void {
    const existing = this.get(id)
    if (!existing) return

    const merged = { ...existing, ...updates, updatedAt: Date.now() }
    this.db.$client.run(
      `UPDATE episodic_memory SET resolution = ?, summary = ?, tags = ?, links = ?, hash = ?, updated_at = ?
       WHERE id = ?`,
      [merged.resolution, merged.summary, JSON.stringify(merged.tags), JSON.stringify(merged.links), merged.hash, merged.updatedAt, id],
    )
  }

  delete(id: string): void {
    this.db.$client.run(`DELETE FROM episodic_memory WHERE id = ?`, [id])
  }

  getRecent(count: number): Episode[] {
    const rows = this.db.$client
      .query(`SELECT * FROM episodic_memory ORDER BY created_at DESC LIMIT ?`)
      .all(count) as any[]
    return rows.map((r) => this.rowToEpisode(r))
  }

  private rowToEpisode(row: any): Episode {
    return {
      id: row.id,
      sessionID: row.session_id,
      title: row.title,
      summary: row.summary,
      whatHappened: row.what_happened,
      resolution: row.resolution,
      filesTouched: JSON.parse(row.files_touched || "[]"),
      tags: JSON.parse(row.tags || "[]"),
      links: JSON.parse(row.links || "[]"),
      hash: row.hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
