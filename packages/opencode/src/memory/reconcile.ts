import * as fs from "fs/promises"
import path from "path"
import { Database, eq } from "../storage"
import { Log } from "../util"
import { MemoryFtsTable } from "./fts.sql"
import { parsePath, parseCcPath, parseCcFrontmatterType, type MemoryLocator } from "./paths"
import { fingerprint } from "./dedup"
import { EntityStore, extractEntities } from "./entity-store"

const log = Log.create({ service: "memory.reconcile" })

export async function walkMemoryDir(root: string): Promise<string[]> {
  const out: string[] = []
  async function recurse(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return [] as import("fs").Dirent[]
      throw e
    })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await recurse(full)
      else if (entry.isFile() && full.endsWith(".md")) out.push(full)
    }
  }
  await recurse(root)
  return out
}

// Walk <base>/<slug>/memory/**/*.md across every slug under <base>.
// ENOENT on <base> returns []; missing memory subdirs are silently skipped.
export async function walkCcRoot(base: string): Promise<string[]> {
  const slugs = await fs.readdir(base, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [] as import("fs").Dirent[]
    throw e
  })
  const out: string[] = []
  for (const entry of slugs) {
    if (!entry.isDirectory()) continue
    const memoryDir = path.join(base, entry.name, "memory")
    const exists = await fs.stat(memoryDir).then(() => true).catch(() => false)
    if (!exists) continue
    const files = await walkMemoryDir(memoryDir)
    for (const f of files) out.push(f)
  }
  return out
}

export async function indexFromDisk(
  absPath: string,
  loc: MemoryLocator,
  bodyType: "openfable" | "cc",
  oldFingerprint?: string,
  entityStore?: EntityStore,
): Promise<"hit" | "updated" | "skipped"> {
  const stat = await fs.stat(absPath).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null
    throw e
  })
  if (!stat) return "skipped"
  const fp = fingerprint(stat.size, stat.mtimeMs)
  if (oldFingerprint === fp) return "hit"

  const body = await Bun.file(absPath).text()

  const finalType =
    bodyType === "cc" ? (parseCcFrontmatterType(body) ?? "free") : loc.type

  Database.use((db) =>
    db
      .insert(MemoryFtsTable)
      .values({
        path: absPath,
        scope: loc.scope,
        scope_id: loc.scope_id,
        type: finalType,
        body,
        fingerprint: fp,
        last_indexed_at: Date.now(),
      })
      .onConflictDoUpdate({
        target: MemoryFtsTable.path,
        set: {
          scope: loc.scope,
          scope_id: loc.scope_id,
          type: finalType,
          body,
          fingerprint: fp,
          last_indexed_at: Date.now(),
        },
      })
      .run(),
  )

  if (entityStore) {
    const entities = extractEntities(body)
    entityStore.indexEntities(absPath, entities)
  }

  return "updated"
}

export async function reconcileMemory(
  roots: { openfable: string; cc?: string },
  opts?: { entityStore?: EntityStore },
): Promise<{ indexed: number; pruned: number }> {
  const fableFiles = new Set(await walkMemoryDir(roots.openfable))
  const ccFiles = roots.cc ? new Set(await walkCcRoot(roots.cc)) : new Set<string>()
  const diskPaths = new Set<string>([...fableFiles, ...ccFiles])

  const indexed = new Map<string, string>(
    Database.use((db) =>
      db
        .select({ path: MemoryFtsTable.path, fingerprint: MemoryFtsTable.fingerprint })
        .from(MemoryFtsTable)
        .all(),
    ).map((r) => [r.path, r.fingerprint]),
  )

  let pruned = 0
  for (const p of indexed.keys()) {
    if (!diskPaths.has(p)) {
      Database.use((db) => db.delete(MemoryFtsTable).where(eq(MemoryFtsTable.path, p)).run())
      opts?.entityStore?.removeByPath(p)
      pruned++
    }
  }

  let indexedCount = 0
  for (const p of fableFiles) {
    const loc = parsePath(p)
    if (!loc) {
      log.warn("path outside memory layout, skipping", { path: p })
      continue
    }
    const result = await indexFromDisk(p, loc, "openfable", indexed.get(p), opts?.entityStore)
    if (result === "updated") indexedCount++
  }
  for (const p of ccFiles) {
    const loc = parseCcPath(p)
    if (!loc) {
      log.warn("CC path failed to parse, skipping", { path: p })
      continue
    }
    const result = await indexFromDisk(p, loc, "cc", indexed.get(p), opts?.entityStore)
    if (result === "updated") indexedCount++
  }

  return { indexed: indexedCount, pruned }
}
