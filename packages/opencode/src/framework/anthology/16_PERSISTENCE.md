# Anthology: Persistence

> **Subject:** Persistence - saving, loading, and syncing application state
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Persistence Mastery

### 16.1 State Serialization

```rust
pub trait Serializable: serde::Serialize + serde::de::DeserializeOwned {}

impl Serializable for AppState {}

pub struct StateSerializer {
    format: SerializationFormat,
    pretty_print: bool,
}

pub enum SerializationFormat {
    JSON,
    MessagePack,
    CBOR,
    Protobuf,
    CustomBinary,
}

impl StateSerializer {
    pub fn save<T: Serializable>(&self, state: &T, path: &Path) -> Result<(), Error> {
        let data = match self.format {
            SerializationFormat::JSON => {
                if self.pretty_print {
                    serde_json::to_string_pretty(state)?
                } else {
                    serde_json::to_string(state)?
                }
            }
            SerializationFormat::MessagePack => {
                let buf = rmp_serde::to_vec(state)?;
                String::from_utf8(buf)?
            }
            SerializationFormat::CBOR => {
                let buf = serde_cbor::to_vec(state)?;
                String::from_utf8(buf)?
            }
            _ => unimplemented!()
        };

        std::fs::write(path, data)?;
        Ok(())
    }

    pub fn load<T: Serializable>(&self, path: &Path) -> Result<T, Error> {
        let data = std::fs::read_to_string(path)?;
        Ok(match self.format {
            SerializationFormat::JSON => serde_json::from_str(&data)?,
            SerializationFormat::MessagePack => {
                let buf = data.into_bytes();
                rmp_serde::from_slice(&buf)?
            }
            _ => unimplemented!()
        })
    }
}
```

### 16.2 Migration Strategies

```rust
pub struct StateMigrator {
    migrations: Vec<Box<dyn Migration>>,
    current_version: u64,
}

pub trait Migration {
    fn version(&self) -> u64;
    fn migrate(&self, old: &mut dyn Any) -> Result<(), Error>;
}

impl StateMigrator {
    pub fn add_migration(&mut self, migration: Box<dyn Migration>) {
        self.migrations.push(migration);
        self.migrations.sort_by_key(|m| m.version());
    }

    pub fn migrate(&self, mut state: Box<dyn Any>) -> Result<Box<dyn Any>, Error> {
        for migration in &self.migrations {
            if migration.version() > self.current_version {
                migration.migrate(state.as_mut())?;
                self.current_version = migration.version();
            }
        }
        Ok(state)
    }
}
```

### 16.3 Cache Strategies

```rust
pub struct LRUCache<K, V> {
    pub capacity: usize,
    pub cache: HashMap<K, (V, Instant)>,
    pub order: VecDeque<K>,
}

impl<K: Clone + Eq + Hash, V: Clone> LRUCache<K, V> {
    pub fn get(&mut self, key: &K) -> Option<&V> {
        if self.cache.contains_key(key) {
            // Move to front
            self.order.retain(|k| k != key);
            self.order.push_front(key.clone());
            self.cache.get(key).map(|(v, _)| v)
        } else {
            None
        }
    }

    pub fn put(&mut self, key: K, value: V) {
        if self.cache.contains_key(&key) {
            self.cache.insert(key.clone(), (value, Instant::now()));
            self.order.retain(|k| k != &key);
            self.order.push_front(key);
        } else {
            if self.cache.len() >= self.capacity {
                // Evict oldest
                if let Some(oldest) = self.order.pop_back() {
                    self.cache.remove(&oldest);
                }
            }
            self.cache.insert(key, (value, Instant::now()));
            self.order.push_front(key);
        }
    }
}
```

### 16.4 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| No versioning | Old saves break new app | Add migration layer |
| Saving on every change | Slow performance | Batch/periodic saves |
| No corruption handling | Data loss on crash | Use atomic writes |
| Cache invalidation bugs | Stale data | Use TTL or explicit invalidation |

---

# PART 2: NOVEL CONCEPTS REPORT

## Persistence: Untapped Opportunities

### Concept 1: TimeMachine State Snapshots

**Idea:** Automatic **time-travel snapshots** that allow rewinding to any previous state.

```rust
pub struct TimeMachine {
    snapshots: Vec<StateSnapshot>,
    compression: Compression,
}

pub struct StateSnapshot {
    pub timestamp: u64,
    pub delta: StateDelta,
    pub checksum: u64,
}

impl TimeMachine {
    pub fn snapshot(&mut self, state: &AppState) {
        let last = self.snapshots.last();
        let delta = match last {
            Some(prev) => compute_delta(&prev.snapshot, state),
            None => StateDelta::Full(state.clone()),
        };

        self.snapshots.push(StateSnapshot {
            timestamp: current_time_ms(),
            delta,
            checksum: compute_checksum(state),
        });
    }

    pub fn rewind(&self, target_timestamp: u64) -> AppState {
        let mut state = AppState::default();
        for snap in &self.snapshots {
            if snap.timestamp <= target_timestamp {
                state.apply_delta(&snap.delta);
            } else {
                break;
            }
        }
        state
    }
}
```

**Novel because:** TUIs overwrite state. TimeMachine = automatic undo.

**Complexity:** Medium
**Value:** High (debugging, user confidence)

---

**End of Persistence Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 The Persistence Contract

Cross-repository analysis reveals a universal persistence contract that every TUI framework must satisfy:

```
┌─────────────────────────────────────────────────────────────┐
│                    PERSISTENCE CONTRACT                      │
├─────────────────────────────────────────────────────────────┤
│ 1. State must be serializable                              │
│    JSON by default, msgpack/bincode/CBOR for binary        │
│ 2. Migration must be explicit and versioned                │
│    {"version": 3, "data": {...}}                          │
│ 3. Session state ≠ undo history                            │
│    Session = durable, Undo = ephemeral                     │
│ 4. Prefer bounded logs (ring buffer)                       │
│ 5. Config must be hot-reloadable                           │
│ 6. Sensitive data → encrypted / keyring / out-of-band      │
│ 7. Atomic writes (write-to-temp, then rename)              │
│ 8. Terminal state must be restored on exit                 │
│ 9. Split persistence: transient UI ≠ structured data       │
│10. Offline-first: local-first with optional sync           │
└─────────────────────────────────────────────────────────────┘
```

Every primitive below maps to one or more of these contract requirements.

---

## 3.2 Split-Persistence Strategy (Canopy → General Pattern)

**Source:** CANOPY_PRIMITIVES.md §17

The most important architectural insight: use *two different persistence layers* for two different kinds of data, never one层 for everything.

```
┌──────────────────┐     ┌──────────────────┐
│   FAST PATH      │     │   STRUCTURED     │
│  localStorage /  │     │   SQLite /       │
│  flat JSON file  │     │   embedded DB    │
│                  │     │                  │
│  - Tab arrays    │     │  - Tasks         │
│  - UI state      │     │  - Project info  │
│  - Scroll pos    │     │  - Settings      │
│  - Session list  │     │  - Relations     │
│                  │     │                  │
│  Sync: immediate │     │  Sync: batched   │
│  Cost: <1ms      │     │  Cost: ~5-20ms   │
│  Size: <50KB     │     │  Size: unlimited │
└──────────────────┘     └──────────────────┘
```

**Why this matters:** Putting transient UI state in SQLite adds latency and complexity for no gain. localStorage (or equivalent synchronous key-value store) is fast, small, and sufficient. Structured data needs a real database.

**Generalized pattern for any TUI:**
```rust
// Split-persistence trait contract
trait PersistenceLayer {
    fn save_transient(&self, key: &str, value: &str) -> Result<()>;
    fn load_transient(&self, key: &str) -> Result<Option<String>>;
    fn save_structured(&self, table: &str, record: &dyn Serialize) -> Result<()>;
    fn load_structured(&self, table: &str, id: &str) -> Result<Option<Value>>;
    fn migrate(&self, from_version: u64) -> Result<()>;
}
```

---

## 3.3 Session Restoration (Canopy + Bubbletea → General Pattern)

**Sources:** CANOPY_PRIMITIVES.md §5, bubbletea-primitives.md §7.3

Two distinct session restore paths exist in the wild:

### 3.3a Cold-Start Tab Restoration (Canopy)

Serialize the workspace (tabs, paths, types) on change; reconstruct on launch:

```typescript
// Save — triggered on every tab mutation
const saveSessions = (tabs: TerminalTab[]) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(
    tabs.map(t => ({
      id: t.id, label: t.label,
      isClaudeSession: t.isClaudeSession,
      projectPath: t.projectPath,
      // ~12 fields total, <2KB per tab
    }))
  ));
};

// Restore — called once on mount
const loadSavedSessions = (): TerminalTab[] => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return [createHomeTab()];
  const parsed = JSON.parse(raw);
  return parsed.map(t => ({
    ...t,
    status: t.isProjectOverview ? 'idle' : 'done-success',
    // PTY handles are NOT restored — they're relaunched
  }));
};
```

Key insight: **PTY handles are ephemeral**. Session restore reconstructs the *blueprint*, not the live process. The PTY is relaunched during hydration.

### 3.3b Terminal Suspend/Resume (Bubbletea)

Bubbletea exposes `ResumeMsg` for reinitializing after `Ctrl+Z` / SIGCONT:

```go
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg.(type) {
    case tea.ResumeMsg:
        // Re-query terminal size, reinitialize raw mode
        return m, tea.Batch(
            queryTerminalSize(),
            reinitRenderer(),
        )
    }
}
```

### 3.3c Focus/Blur State Persistence

```go
// Enable focus tracking in view
view.ReportFocus = true

// In update — save state on blur, restore on focus
case tea.FocusMsg:
    m.saveCheckpoint()  // Persist volatile state
case tea.BlurMsg:
    m.flushToDisk()     // Ensure everything durable is written
```

---

## 3.4 Terminal State Save/Restore (x/term → General Pattern)

**Source:** x-term-primitives.md §2

Every TUI *must* restore terminal state on exit. This is non-negotiable. Without it, the user's shell is left broken.

```go
// The canonical save/restore pattern
oldState, err := term.MakeRaw(fd)
if err != nil { log.Fatal(err) }
defer term.Restore(fd, oldState)  // ALWAYS defer restore

// Extended: save full terminal state, not just raw mode
type TerminalState struct {
    raw      *term.State    // termios/termcap state
    altScreen bool          // was alternate screen active?
    cursor   bool           // was cursor visible?
    title    string         // previous window title
}

func SaveState(fd uintptr) (*TerminalState, error) { /* ... */ }
func RestoreState(fd uintptr, state *TerminalState) error {
    // Restore in reverse order of capture
    restoreTitle(state.title)
    if state.cursor { showCursor() }
    if state.altScreen { exitAlternateScreen() }
    return term.Restore(fd, state.raw)
}
```

**Generalized for any language:**
1. Capture complete terminal state on entry (not just raw mode)
2. Enter alternate screen buffer (full `CSI ? 1049 h`, not just raw)
3. Set desired terminal modes (mouse, bracketed paste, kitty keys)
4. **On exit (defer/signal handler/finally):** reverse everything in order
5. Handle SIGINT, SIGTERM, SIGKILL (where possible) with signal handlers that restore state

---

## 3.5 Embedded KV + Cloud Sync Persistence (Charm → General Pattern)

**Source:** charm-primitives.md §1–3

Charm's persistence stack provides an offline-first, encrypted, sync-capable model:

```
┌─────────────────────────────────────────────────────────────┐
│                    CHARM PERSISTENCE STACK                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Application Layer                                          │
│    │                                                        │
│    ├── Charm KV: key-value (binary-safe, encrypted)         │
│    │     db.Set(key, value) / db.Get(key) / db.Sync()       │
│    │                                                        │
│    ├── Charm FS: virtual filesystem (cloud-backed)          │
│    │     fs.WriteFile/ReadFile/Remove                       │
│    │                                                        │
│    └── Charm Crypt: E2E encryption (SSH-key derived)       │
│          crypt.Encrypt(data) / crypt.Decrypt(data)          │
│                                                             │
│  Storage Layer                                              │
│    ├── BadgerDB (embedded LSM tree, local-first)            │
│    │     - High write throughput                            │
│    │     - ACID transactions                                │
│    │     - TTL support                                      │
│    └── Cloud Sync (optional, encrypted before transit)      │
│          - Multi-machine                                    │
│          - Offline-first: always writable locally           │
└─────────────────────────────────────────────────────────────┘
```

**Generalized persistence stack for TUIs:**
```rust
// Offline-first embedded store with optional sync
trait EmbeddedStore {
    fn open(name: &str) -> Result<Self> where Self: Sized;
    fn get(&self, key: &[u8]) -> Result<Option<Vec<u8>>>;
    fn set(&mut self, key: &[u8], value: &[u8]) -> Result<()>;
    fn delete(&mut self, key: &[u8]) -> Result<()>;
    fn sync(&self) -> Result<()>;  // Flush to sync target
    fn subscribe(&self, key: &[u8]) -> Result<WatchStream>; // Change notifications
}

// Example: sled (Rust embedded KV) implements this sled pattern
// Example: BadgerDB (Go) implements this charm pattern
```

**Critical patterns:**
- **Transactions**: Batch multiple writes atomically
- **TTL**: Expire cached data automatically (Urwid's canvas expiration model)
- **Change subscriptions**: React to external changes (multi-process/file watcher)

---

## 3.6 Secure Credential Persistence (Canopy → General Pattern)

**Source:** CANOPY_PRIMITIVES.md §16, §19–20

Sensitive data (API keys, tokens) must never be stored in plaintext session files or localStorage. Canopy uses a keyring allowlist pattern:

```
┌──────────────────────────────────────────────────┐
│              CREDENTIAL PERSISTENCE               │
├──────────────────────────────────────────────────┤
│                                                  │
│  Allowlist-Guarded Keyring Storage               │
│  ┌─────────────────────────────────┐             │
│  │ ALLOWED_KEYRING_KEYS = [        │             │
│  │   "aws_access_key_id",          │             │
│  │   "aws_secret_access_key",      │             │
│  │   "aws_session_token",          │             │
│  │ ]                               │             │
│  └─────────────────────────────────┘             │
│                                                  │
│  All other keys → session JSON (unencrypted)     │
│  Credential keys → OS keyring (Keychain/LibreSSL)│
│                                                  │
│  Enforcement: validate_keyring_key()             │
│    → Err("not in allowlist")                     │
│    → Prevents exfiltration via arbitrary keys    │
└──────────────────────────────────────────────────┘
```

**Generalized pattern:**
1. Separate configuration (JSON, versioned, migratable) from credentials (keyring, allowlisted, auditable)
2. Validate credential key names against an explicit allowlist at the API boundary
3. Never log credential values
4. Scrub credential env vars from child processes (Canopy strips `CLAUDECODE*` and `CLAUDE_CODE*` prefixes)

---

## 3.7 Scroll State Persistence (Scrolling Systems → General Pattern)

**Source:** 07_SCROLLING_SYSTEMS.md

Scroll position is the #1 most-forgotten persistence primitive. Every TUI loses scroll position on restart.

```
┌─────────────────────────────────────────────────────────────┐
│              SCROLL PERSISTENCE SPECTRUM                     │
├──────────────┬──────────────────────────────────────────────┤
│ Hard Scroll  │ Discard content on scroll (fast, loses       │
│              │ history). Used by: cmatrix, x/cellbuf        │
│              │ HardScroll                                   │
├──────────────┼──────────────────────────────────────────────┤
│ Soft Scroll  │ Preserve scroll history in circular buffer  │
│              │ (costs memory). Used by: x/cellbuf Screen +  │
│              │ SoftBuffer, Urwid                            │
├──────────────┼──────────────────────────────────────────────┤
│ Per-Session  │ Save scroll pos to session store on scroll,  │
│ Scroll Pos   │ restore on focus return. Not implemented     │
│              │ anywhere (opportunity).                       │
└──────────────┴──────────────────────────────────────────────┘
```

```rust
// Scroll state persistence
struct ScrollPersistence {
    positions: HashMap<ViewId, ScrollPos>,  // per-view scroll cache
    max_history: usize,                       // bounded history (ring buffer)
}

impl ScrollPersistence {
    fn save(&mut self, view_id: &str, pos: ScrollPos) {
        self.positions.insert(view_id.into(), pos);
    }

    fn restore(&self, view_id: &str) -> Option<ScrollPos> {
        self.positions.get(view_id).copied()
    }

    fn persist_to_disk(&self, store: &dyn EmbeddedStore) {
        let encoded = serde_json::to_vec(&self.positions).unwrap();
        store.set(b"scroll_positions", &encoded).unwrap();
    }
}
```

**Ring buffer for bounded scroll history:**
```rust
struct RingBuffer<T> {
    buffer: Vec<T>,
    head: usize,
    capacity: usize,
}

impl<T: Clone> RingBuffer<T> {
    fn push(&mut self, item: T) {
        if self.buffer.len() < self.capacity {
            self.buffer.push(item);
        } else {
            self.buffer[self.head] = item;
        }
        self.head = (self.head + 1) % self.capacity.max(1);
    }

    fn get(&self, index: usize) -> Option<&T> {
        if index >= self.buffer.len() { return None; }
        let idx = if self.buffer.len() < self.capacity {
            index
        } else {
            (self.head + index) % self.buffer.len()
        };
        self.buffer.get(idx)
    }
}
```

---

## 3.8 Pause-Resume Buffers & Attention Detection (Canopy → General Pattern)

**Source:** CANOPY_PRIMITIVES.md §11, §20

When scanning terminal output for patterns (attention detection, command output), the output buffer must be managed across state transitions:

```
┌──────────────────────────────────────────────────────────────┐
│           OUTPUT BUFFER LIFECYCLE                             │
│                                                              │
│  Running ──→ Waiting:  reset buffer (clear scan state)       │
│  Waiting ──→ Running:  reset buffer (user responded)         │
│  Any state ──→ Data In: reset buffer (fresh context)         │
│                                                              │
│  Buffer cap: last 500 chars (rolling window)                 │
│  Cooldown: 5000ms between attention events                   │
└──────────────────────────────────────────────────────────────┘
```

This is a persistence-like pattern: the buffer is ephemeral but its *reset behavior* affects persistence of downstream state.

---

## 3.9 UI State Machine Persistence (Canopy + Summary → General Pattern)

**Sources:** CANOPY_PRIMITIVES.md §4, SUMMARY.md §288

Tab lifecycle states must be persisted as a finite state machine:

```
                    ┌──────────┐
                    │ STARTING │
                    └────┬─────┘
                         │ PTY spawned
                         ▼
                    ┌──────────┐
            ┌──────│ RUNNING  │──────┐
            │      └──────────┘      │ user responds    output pattern match
            │                        ▼
            │      ┌──────────┐  ┌──────────┐
            └──────│   IDLE   │◄─│ WAITING  │
                   └──────────┘  └──────────┘
                         │
                         │ process exits
                         ▼
                ┌────────┴────────┐
                ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │ DONE-SUCCESS │  │  DONE-ERROR  │
        └──────────────┘  └──────────────┘
```

Persistence rules:
- Save state transitions immediately (sync, not deferred)
- `WAITING` → `RUNNING` resets attention buffer
- `DONE-*` states are terminal — persist for session restore but PTY is NOT rehydrated
- The FSM prevents zombie PTY processes (cleanup is conditional on state)

---

## 3.10 Canvas Content Expiration (Urwid → General Pattern)

**Source:** 03_urwid_primitives.md §1

Urwid's Canvas system has a content validation/expiration mechanism — not persistence in the traditional sense, but a *cache invalidation* pattern critical to persistence design:

```python
# Urwid Canvas: content expires when the widget state changes
class CachedCanvas:
    def __init__(self):
        self._invalidated = True
        self._cache = None

    def _invalidate(self):
        """Called when the widget's state changes."""
        self._invalidated = True

    def render(self, size, focus=False):
        if self._invalidated:
            self._cache = self._render_impl(size, focus)
            self._invalidated = False
        return self._cache
```

**Generalized as cache-TTL pattern:**
```rust
struct Cached<T> {
    value: Option<T>,
    expires_at: Instant,
    ttl: Duration,
}

impl<T: Clone> Cached<T> {
    fn get(&self) -> Option<T> {
        if self.expires_at > Instant::now() {
            self.value.clone()
        } else {
            None  // Expired
        }
    }

    fn set(&mut self, value: T) {
        self.value = Some(value);
        self.expires_at = Instant::now() + self.ttl;
    }
}

// Used for: scroll positions, cursor positions, rendered views
```

---

## 3.11 No-Persistence Anti-Patterns

Across the codebase, these are the explicitly called-out situations where persistence is **missing** (opportunities, not solutions):

| Anti-Pattern | Where Found | Impact |
|---|---|---|
| Lose state on restart | fterm-primitives.md | Full workspace re-creation every launch |
| No persistent widget state | imgui-primitives.md | Immediate-mode everything, zero recall |
| Long-running ops freeze UI | SUMMARY.md | Blocks event loop, state never saved mid-operation |
| No scroll position persistence | 07_SCROLLING_SYSTEMS.md | Scroll context lost on tab switch/restart |
| No atomic writes | REPORT_MACHINE_READABLE.md | Partial write = corrupted session file |
| No terminal state restore | x-term-primitives.md (as requirement) | Broken shell after TUI crash |

**The fix is always: persist incrementally, atomically, on every mutation, not just on exit.**

---

## 3.12 Collective Persistence Architecture

Synthesizing all primitives into a unified persistence architecture for any TUI:

```
┌─────────────────────────────────────────────────────────────────┐
│                UNIFIED TUI PERSISTENCE ARCHITECTURE             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 1: Terminal State (x/term pattern)                       │
│  ├── Save complete terminal state on entry                      │
│  ├── Handle SIGINT/SIGTERM with signal-safe restore             │
│  └── Restore in reverse order on exit                           │
│                                                                 │
│  LAYER 2: Session State (Canopy split-persistence pattern)      │
│  ├── Transient UI → localStorage/JSON (<50KB, sync)             │
│  │   ├── Tab/pane layout                                        │
│  │   ├── Scroll positions                                       │
│  │   ├── Viewport state                                         │
│  │   └── Undo/redo stacks (bounded, ring buffer)                │
│  └── Structured data → embedded KV/SQLite (async, batched)      │
│      ├── Tasks, project info                                    │
│      ├── Settings, preferences                                  │
│      └── Audit logs (bounded, ring buffer)                      │
│                                                                 │
│  LAYER 3: Credential State (Canopy keyring pattern)             │
│  ├── API keys/tokens → OS keychain (allowlist-gated)            │
│  ├── Child processes get env scrub (credential stripping)       │
│  └── Never log or serialize credential values                   │
│                                                                 │
│  LAYER 4: Offline-First Sync (Charm pattern)                    │
│  ├── Local write always succeeds (BadgerDB/sled)                │
│  ├── Cloud sync is optional + encrypted                         │
│  ├── TTL-based cache expiration (Urwid canvas pattern)          │
│  └── Multi-machine: merge conflicts resolved last-write-wins    │
│                                                                 │
│  LAYER 5: Serialization (Machine-readable spec)                 │
│  ├── Formats: JSON (debug), MessagePack, CBOR (production)      │
│  ├── Version field in every persisted struct                    │
│  ├── Explicit migration functions (version N → N+1)             │
│  └── Atomic writes (write-to-temp → rename)                     │
│                                                                 │
│  CONCERN: UI freeze prevention                                  │
│  ├── Blocking I/O must be async/off-main-thread                 │
│  ├── Autosave interval: 30s (not on every keystroke)            │
│  └── Focus/blur events trigger checkpoint saves                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

This architecture satisfies all 10 contract requirements from §3.1 and incorporates patterns from 6+ source repositories.
