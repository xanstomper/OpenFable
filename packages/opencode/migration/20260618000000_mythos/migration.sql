CREATE TABLE IF NOT EXISTS mythos_state (
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  PRIMARY KEY (session_id, project_id)
);

CREATE TABLE IF NOT EXISTS mythos_workflow (
  workflow_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'prelude',
  loop_count INTEGER NOT NULL DEFAULT 0,
  max_loops INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'running',
  context TEXT DEFAULT '{}',
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mythos_workflow_session ON mythos_workflow(session_id);
CREATE INDEX IF NOT EXISTS idx_mythos_workflow_status ON mythos_workflow(status);

CREATE TABLE IF NOT EXISTS dox_entries (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT '',
  ownership TEXT NOT NULL DEFAULT '',
  hierarchy_level INTEGER NOT NULL DEFAULT 1,
  parent_id TEXT,
  child_index TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES dox_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_dox_entries_path ON dox_entries(path);
CREATE INDEX IF NOT EXISTS idx_dox_entries_parent ON dox_entries(parent_id);

CREATE TABLE IF NOT EXISTS dox_contracts (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  constraints TEXT NOT NULL DEFAULT '[]',
  scope TEXT NOT NULL DEFAULT '[]',
  permissions TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES dox_entries(id)
);

CREATE TABLE IF NOT EXISTS cognitive_checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  facts TEXT NOT NULL DEFAULT '[]',
  assumptions TEXT NOT NULL DEFAULT '[]',
  decisions TEXT NOT NULL DEFAULT '[]',
  rejected TEXT NOT NULL DEFAULT '[]',
  blocked TEXT NOT NULL DEFAULT '[]',
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cognitive_checkpoints_session ON cognitive_checkpoints(session_id);

CREATE TABLE IF NOT EXISTS cognitive_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  statement TEXT NOT NULL,
  classification TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT,
  session_id TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cognitive_claims_class ON cognitive_claims(classification);

CREATE TABLE IF NOT EXISTS mythos_model_cache (
  model_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  reasoning_depth INTEGER NOT NULL DEFAULT 1,
  context_window INTEGER,
  supports_tools INTEGER NOT NULL DEFAULT 0,
  supports_vision INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0
);
