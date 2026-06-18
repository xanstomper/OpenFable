export interface WorkingMemoryEntry {
  id: string
  key: string
  value: string
  timestamp: number
  ttl: number
  accessCount: number
}

export type EditOp =
  | { op: "set"; key: string; value: string; ttl?: number }
  | { op: "delete"; key: string }
  | { op: "clear" }
  | { op: "reorder"; keys: string[] }

export class WorkingMemory {
  private entries: Map<string, WorkingMemoryEntry> = new Map()
  private order: string[] = []
  private maxSize: number
  private defaultTTL: number
  private editLog: Array<{ op: EditOp; timestamp: number }> = []

  constructor(maxSize: number = 100, defaultTTL: number = 300_000) {
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  set(key: string, value: string, ttl?: number): void {
    if (this.entries.size >= this.maxSize) {
      this.evictLeastUsed()
    }

    this.entries.set(key, {
      id: `wm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
      accessCount: 0,
    })

    if (!this.order.includes(key)) {
      this.order.push(key)
    }

    this.editLog.push({ op: { op: "set", key, value, ttl }, timestamp: Date.now() })
  }

  get(key: string): string | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.entries.delete(key)
      this.order = this.order.filter((k) => k !== key)
      return undefined
    }

    entry.accessCount++
    return entry.value
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): void {
    this.entries.delete(key)
    this.order = this.order.filter((k) => k !== key)
    this.editLog.push({ op: { op: "delete", key }, timestamp: Date.now() })
  }

  clear(): void {
    this.entries.clear()
    this.order = []
    this.editLog.push({ op: { op: "clear" }, timestamp: Date.now() })
  }

  getAll(): WorkingMemoryEntry[] {
    return this.order
      .map((key) => this.entries.get(key))
      .filter((e): e is WorkingMemoryEntry => e !== undefined && Date.now() - e.timestamp <= e.ttl)
  }

  getRecent(count: number): WorkingMemoryEntry[] {
    return this.getAll()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count)
  }

  applyEdit(edit: EditOp): boolean {
    switch (edit.op) {
      case "set":
        this.set(edit.key, edit.value, edit.ttl)
        return true
      case "delete":
        if (!this.entries.has(edit.key)) return false
        this.delete(edit.key)
        return true
      case "clear":
        this.clear()
        return true
      case "reorder":
        this.reorder(edit.keys)
        return true
      default:
        return false
    }
  }

  reorder(keys: string[]): void {
    const valid = keys.filter((k) => this.entries.has(k))
    const remaining = this.order.filter((k) => !valid.includes(k))
    this.order = [...valid, ...remaining]
    this.editLog.push({ op: { op: "reorder", keys }, timestamp: Date.now() })
  }

  getEditLog(): Array<{ op: EditOp; timestamp: number }> {
    return [...this.editLog]
  }

  getContextString(maxTokens: number = 4000): string {
    const entries = this.getAll()
      .sort((a, b) => b.timestamp - a.timestamp)

    const parts: string[] = []
    let tokenCount = 0
    for (const entry of entries) {
      const entryTokens = Math.ceil(entry.value.length / 4) + Math.ceil(entry.key.length / 4)
      if (tokenCount + entryTokens > maxTokens) break
      parts.push(`[${entry.key}] ${entry.value}`)
      tokenCount += entryTokens
    }
    return parts.join("\n")
  }

  private evictLeastUsed(): void {
    let leastUsed: WorkingMemoryEntry | null = null
    for (const entry of this.entries.values()) {
      if (!leastUsed || entry.accessCount < leastUsed.accessCount) {
        leastUsed = entry
      }
    }
    if (leastUsed) {
      this.entries.delete(leastUsed.key)
      this.order = this.order.filter((k) => k !== leastUsed!.key)
    }
  }
}
