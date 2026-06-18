import { Effect, Context, Layer } from "effect"
import { Database } from "../../storage"
import { Global } from "../../global"
import path from "path"
import { Log } from "../../util"

export interface DOXEntry {
  id: string
  path: string
  purpose: string
  ownership: string
  hierarchyLevel: number
  parentID: string | null
  childIndex: string[]
  created_at: number
  updated_at: number
}

export interface DOXContract {
  entryID: string
  constraints: string[]
  scope: string[]
  permissions: string[]
  updatedAt: number
}

export interface Interface {
  readonly load: (filePath: string) => Effect.Effect<DOXEntry | null>
  readonly loadChain: (targetPath: string) => Effect.Effect<DOXEntry[]>
  readonly update: (entry: DOXEntry) => Effect.Effect<void>
  readonly getContract: (targetPath: string) => Effect.Effect<DOXContract>
  readonly createEntry: (input: {
    path: string
    purpose: string
    ownership: string
    childIndex?: string[]
    parentID?: string
  }) => Effect.Effect<DOXEntry>
  readonly syncToProject: (projectDir: string) => Effect.Effect<number>
}

export class Service extends Context.Service<Service, Interface>()("@openfable/MythosDOX") {}

const log = Log.create({ service: "mythos-dox" })

function walkChain(targetPath: string): string[] {
  const normalized = path.resolve(targetPath)
  const parts = normalized.split(path.sep).filter(Boolean)
  const chain: string[] = []
  let current = ""
  for (const part of parts) {
    current = current ? `${current}${path.sep}${part}` : `/${part}`
    chain.push(path.join(current, "AGENTS.md"))
  }
  return chain
}

export const layer: Layer.Layer<Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const load = Effect.fn("MythosDOX.load")(function* (filePath: string) {
      const db = Database.Client()
      const normalized = path.resolve(filePath)
      const row = db.$client.query(
        "SELECT * FROM dox_entries WHERE path = ?",
      ).get(normalized) as Record<string, any> | undefined
      if (!row) return null
      return {
        id: row.id,
        path: row.path,
        purpose: row.purpose,
        ownership: row.ownership,
        hierarchyLevel: row.hierarchy_level,
        parentID: row.parent_id ?? null,
        childIndex: row.child_index ? JSON.parse(row.child_index) : [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      } satisfies DOXEntry
    })

    const loadChain = Effect.fn("MythosDOX.loadChain")(function* (targetPath: string) {
      const db = Database.Client()
      const chainPaths = walkChain(targetPath)
      const entries: DOXEntry[] = []
      for (const cp of chainPaths) {
        const row = db.$client.query(
          "SELECT * FROM dox_entries WHERE path = ?",
        ).get(cp) as Record<string, any> | undefined
        if (row) {
          entries.push({
            id: row.id,
            path: row.path,
            purpose: row.purpose,
            ownership: row.ownership,
            hierarchyLevel: row.hierarchy_level,
            parentID: row.parent_id ?? null,
            childIndex: row.child_index ? JSON.parse(row.child_index) : [],
            created_at: row.created_at,
            updated_at: row.updated_at,
          })
        }
      }
      return entries
    })

    const update = Effect.fn("MythosDOX.update")(function* (entry: DOXEntry) {
      const db = Database.Client()
      db.$client.run(
        `UPDATE dox_entries SET purpose = ?, ownership = ?, hierarchy_level = ?, parent_id = ?, child_index = ?, updated_at = ? WHERE id = ?`,
        [
          entry.purpose,
          entry.ownership,
          entry.hierarchyLevel,
          entry.parentID,
          JSON.stringify(entry.childIndex),
          Date.now(),
          entry.id,
        ],
      )
    })

    const getContract = Effect.fn("MythosDOX.getContract")(function* (targetPath: string) {
      const chain = yield* loadChain(targetPath)
      const constraints: string[] = []
      const scope: string[] = []
      const permissions: string[] = []
      for (const entry of chain) {
        if (entry.purpose) constraints.push(entry.purpose)
        if (entry.ownership) permissions.push(entry.ownership)
      }
      return {
        entryID: chain[chain.length - 1]?.id ?? "root",
        constraints,
        scope,
        permissions,
        updatedAt: Date.now(),
      } satisfies DOXContract
    })

    const createEntry = Effect.fn("MythosDOX.createEntry")(function* (input: {
      path: string
      purpose: string
      ownership: string
      childIndex?: string[]
      parentID?: string
    }) {
      const id = crypto.randomUUID()
      const normalized = path.resolve(input.path)
      const db = Database.Client()
      db.$client.run(
        `INSERT INTO dox_entries (id, path, purpose, ownership, hierarchy_level, parent_id, child_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          normalized,
          input.purpose,
          input.ownership,
          input.parentID ? 2 : 1,
          input.parentID ?? null,
          JSON.stringify(input.childIndex ?? []),
          Date.now(),
          Date.now(),
        ],
      )
      log.info("dox entry created", { id, path: normalized })
      return {
        id,
        path: normalized,
        purpose: input.purpose,
        ownership: input.ownership,
        hierarchyLevel: input.parentID ? 2 : 1,
        parentID: input.parentID ?? null,
        childIndex: input.childIndex ?? [],
        created_at: Date.now(),
        updated_at: Date.now(),
      } satisfies DOXEntry
    })

    const syncToProject = Effect.fn("MythosDOX.syncToProject")(function* (projectDir: string) {
      const db = Database.Client()
      const agentsFiles = yield* Effect.promise(async () => {
        const { Glob } = await import("@openfable/shared/util/glob")
        return Glob.scan("**/AGENTS.md", { cwd: projectDir, absolute: true })
      })
      let count = 0
      for (const file of agentsFiles) {
        const existing = db.$client.query("SELECT id FROM dox_entries WHERE path = ?").get(file) as Record<string, any> | undefined
        if (!existing) {
          const id = crypto.randomUUID()
          const relative = path.relative(projectDir, file)
          const depth = relative.split(path.sep).length
          db.$client.run(
            `INSERT INTO dox_entries (id, path, purpose, ownership, hierarchy_level, child_index, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, file, `AGENTS.md at ${relative}`, "synced from filesystem", depth, "[]", Date.now(), Date.now()],
          )
          count++
        }
      }
      log.info("dox sync complete", { projectDir, entries: count })
      return count
    })

    return Service.of({ load, loadChain, update, getContract, createEntry, syncToProject })
  }),
)

export const defaultLayer: Layer.Layer<Service> = layer
