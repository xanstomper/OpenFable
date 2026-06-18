import { sqliteTable, text, integer, real, index, primaryKey } from "drizzle-orm/sqlite-core"

export const MythosStateTable = sqliteTable(
  "mythos_state",
  {
    session_id: text().notNull(),
    project_id: text().notNull(),
    version: text().notNull(),
    config: text().default("{}"),
    created_at: integer().notNull(),
    updated_at: integer(),
  },
  (table) => [
    primaryKey({ columns: [table.session_id, table.project_id] }),
    index("idx_mythos_state_session").on(table.session_id),
    index("idx_mythos_state_project").on(table.project_id),
  ],
)

export const MythosWorkflowTable = sqliteTable(
  "mythos_workflow",
  {
    workflow_id: text().primaryKey(),
    session_id: text().notNull(),
    phase: text().notNull().default("prelude"),
    loop_count: integer().notNull().default(0),
    max_loops: integer().notNull().default(4),
    status: text().notNull().default("running"),
    context: text().default("{}"),
    error: text(),
    started_at: integer().notNull(),
    completed_at: integer(),
  },
  (table) => [
    index("idx_mythos_workflow_session").on(table.session_id),
    index("idx_mythos_workflow_status").on(table.status),
  ],
)

export const DOXEntryTable = sqliteTable(
  "dox_entries",
  {
    id: text().primaryKey(),
    path: text().notNull().unique(),
    purpose: text().notNull().default(""),
    ownership: text().notNull().default(""),
    hierarchy_level: integer().notNull().default(1),
    parent_id: text(),
    child_index: text().notNull().default("[]"),
    created_at: integer().notNull(),
    updated_at: integer().notNull(),
  },
  (table) => [
    index("idx_dox_entries_path").on(table.path),
    index("idx_dox_entries_parent").on(table.parent_id),
  ],
)

export const DOXContractTable = sqliteTable(
  "dox_contracts",
  {
    id: text().primaryKey(),
    entry_id: text().notNull(),
    constraints: text().notNull().default("[]"),
    scope: text().notNull().default("[]"),
    permissions: text().notNull().default("[]"),
    updated_at: integer().notNull(),
  },
)

export const CognitiveCheckpointTable = sqliteTable(
  "cognitive_checkpoints",
  {
    id: text().primaryKey(),
    session_id: text().notNull(),
    turn: integer().notNull(),
    facts: text().notNull().default("[]"),
    assumptions: text().notNull().default("[]"),
    decisions: text().notNull().default("[]"),
    rejected: text().notNull().default("[]"),
    blocked: text().notNull().default("[]"),
    timestamp: integer().notNull(),
  },
  (table) => [
    index("idx_cognitive_checkpoints_session").on(table.session_id),
  ],
)

export const CognitiveClaimTable = sqliteTable(
  "cognitive_claims",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    statement: text().notNull(),
    classification: text().notNull(),
    confidence: real().notNull().default(0.5),
    source: text(),
    session_id: text(),
    timestamp: integer().notNull(),
  },
  (table) => [
    index("idx_cognitive_claims_class").on(table.classification),
  ],
)

export const MythosModelCacheTable = sqliteTable(
  "mythos_model_cache",
  {
    model_id: text().primaryKey(),
    provider_id: text().notNull(),
    tier: integer().notNull().default(1),
    reasoning_depth: integer().notNull().default(1),
    context_window: integer(),
    supports_tools: integer().notNull().default(0),
    supports_vision: integer().notNull().default(0),
    last_seen: integer().notNull(),
    call_count: integer().notNull().default(0),
  },
)
