# Canopy-Terminal Primitives Analysis

## Overview

Canopy (/home/bamn/TUIs/canopy) is a Tauri v2 desktop application that manages Claude Code CLI sessions. It acts as a workspace manager and terminal multiplexer: users add project folders, launch Claude Code sessions or shell terminals, and navigate sessions via an in-memory tab system. Everything runs locally with no external APIs. The codebase is ~3K LOC of Rust backend (Tauri cmds + portable-pty + tauri-plugin-sql) and ~15K LOC of React/TypeScript frontend (xterm.js v6, hooks, components).

These are TUI-specific primitives extracted from Canopy that can be applied to the creation of TUIs. The primitives focus on the patterns that are reusable across frameworks and languages, not the Canopy-specific glue.

---

## Application Shell & Layout Primitives

### 1. TitleBar + Sidebar + ActivityBar Shell

Canopy splits the shell into three regions: a TitleBar at top, a Sidebar at left, and an ActivityBar at far left. The shell is stateless at the layout level; the main content area fills the remaining space.

**Primitive:** Defines app chrome (TitleBar, Sidebar, ActivityBar, Main) as composable sections.

**Application:**
- The TitleBar provides a persistent top-level context (logo, navigation, project context).
- The Sidebar is the primary list (projects, sessions, search results) that slides in/out.
- The ActivityBar is a vertical icon rail docked to the far left edge, acting as a one-touch switch between major panes (Resources, Settings, Skills, etc.).
- The Main area is always a single ReactNode, injected by whichever active view/tab owns the primary focus.

**Why it matters:** This three-pane chrome pattern is common for IDEs and agent dashboards. Locking the chrome dimensions independently (TitleBar height, ActivityBar width) from the main content avoids repeated layout recalculations.

**Implementation note:** Uses Tailwind-style arbitrary class names for layout. The AppLayout has `className="app-layout"`, `app-content` (flex row), `app-sidebar` (`aside`), `app-main` (`main`), and `ActivityBar` with props for openSkillsBrowse, onRunSkill, etc.

### 2. Adaptive Split-Layout Mode

Canopy supports a toggleable split-mode where terminal tabs display in a grid. The grid adjusts columns dynamically (1, 2, or 3+ columns) based on how many tabs are in split mode.

**Primitive:** A switchable layout mode that groups children into responsive columns/rows.

**Application:**
- Single mode: 1 column, all terminals stacked.
- Pair mode: 2 columns of equal width.
- Triple+ mode: 3 columns, maintaining equal share.
- Automagically adjusts to tab count without manual resizing.

**Implementation note:** The `splitMode` state lives in the `useTerminal` hook. Each view (TerminalView) listens to `splitMode` to re-fit. The CSS uses `flex` or grid. When the user closes/reopens, the mode persists across tabs.

**Why it matters:** Libraries often use a fixed 1:1 split, but a production app adapts to the number of panes. This is useful for test runners, parallel agent runs, or diff viewers.

### 3. Layout Debounce & Visibility Gate

Terminal views are rendered with `display: none` when not active. The TerminalView initializes xterm.js only when `isVisible` flips to true, and the ResizeObserver refits when dimensions change.

**Primitive:** Defer xterm.js creation until visible, gate resize logic behind dimension checks, refit with `requestAnimationFrame`.

**Application:**
- On mount: if not `isVisible`, skip xterm init entirely, keeping `spawnedRef` false.
- `ResizeObserver` only fires fit when width and height are both non-zero, skipping zero-dimension layout events.
- `doFit` uses `requestAnimationFrame` plus a polling fallback (`setTimeout(doFit, 50)`) for layout that hasn't settled after switching to split mode.

**Implementation note:** The `isVisible` prop plus `spawnedRef` and `RO` disconnection in cleanup ensure no stale lifecycle.

**Why it matters:** xterm.js is expensive to instantiate. Skipping creation for off-screen tabs cuts initialization from O(tabs) to O(visible).

---

## Tab & Terminal Lifecycle Primitives

### 4. Tab Lifecycle State Machine

Each tab progresses through a defined lifecycle: `starting` -> `running` -> (`idle` / `waiting`) -> (`done-success` / `done-error`). This state drives both UI (tab icon, notification dot) and behavior (whether to auto-relaunch).

**Primitive:** A finite state machine for tab lifecycle states.

**Implementation note:** Status is stored per tab and propagated to `TerminalTabBar` for color-coded icons. The `closeTerminal` path is separate from tab removal — the Rust backend tracks a `TerminalInstance` keyed by `terminal_id`, and removal closes the PTY process.

**Why it matters:** A clean FSM prevents zombie PTY processes (no-op cleanup) and incorrect UI feedback. The `done-success` vs `done-error` distinction affects the relaunch prompt.

### 5. Saved-Session Restoration

Tabs are persisted to `localStorage` as a serialized array (`canopy-tab-sessions` key). Each saved session contains: id, label, isClaudeSession, isProjectOverview, projectPath, projectName, isWorkspaceAgent, sessionId.

**Primitive:** Lightweight session restoration that serializes tabs and restores them on cold start.

**Implementation note:** `loadSavedSessions()` parses the JSON and reconstructs a `TerminalTab[]` with `status` set to `done-success` for standard tabs and `idle` for project overview tabs. Claude sessions set an idle status with a prompt shown on initialization.

**Why it matters:** Allows users to close the app and return to a multi-tab workspace without re-launching every session.

### 6. Claude-Specific Spawn Guards

Claude sessions require special handling: system prompt injection, CLI detection, environment variable scrubbing (removing `CLAUDECODE*` and `CLAUDE_CODE*` to prevent nested sessions), and provider-specific env injection (AWS Bedrock, GCP Vertex).

**Primitive:** Defensive spawn path for AI agent CLIs.

**Implementation note:**
- `check_claude_cli()` probes PATH for the `claude` binary, with a PATH augmentation function that adds `~/.local/bin`, `~/.cargo/bin`, `/usr/local/bin`, Homebrew nvm dirs, etc.
- `ensure_full_path()` rebuilds PATH from env, appends known CLI locations, globs latest nvm node version.
- Provider settings (Direct, Bedrock, Vertex) inject `CLAUDE_CODE_USE_BEDROCK`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, etc., into the spawned CLI process.

**Why it matters:** GUI desktop apps on macOS lack a full shell PATH. Without augmentation, `claude` installed via npm, cargo, or Homebrew wouldn't be found.

### 7. Home Tab (Reserved Workspace Overview)

One tab is hardcoded as the Home tab (`HOME_TAB_ID = "home"`). It cannot be closed and renders a dashboard of overview widgets (DailyPlanner, WorkspaceOverview, ProjectSummary, GitHubDashboard).

**Primitive:** A persistent, non-closable special tab type used for dashboard/navigation.

**Application:** Splitting the agent workspace into "navigation" vs "terminal" concerns. The Home tab shows Projects, Tags, Daily Plan, Notification Settings, Skills Store, GitHub activity, Resource usage. Clicking a project in Home opens a `ProjectSummary` tab tied to that project path.

**Why it matters:** Separates workspace context from terminal execution, reducing cognitive load for multi-project users.

---

## Terminal Rendering Primitives

### 8. Xterm.js Theme Object (Sub-Process Isolation)

Canopy defines a monolithic `xterm.Terminal` theme object with 17 declared color keys across 8 categories: background, foreground, cursor, cursorAccent, selectionBackground, 8 ANSI colors, and 8 bright variants.

**Primitive:** A single, canonical theme object defining every xterm color key with a custom color scheme.

**Implementation note:** The cursor uses a vibrant orange (`#FF6B00`), selection uses transparent orange with alpha (`#FF6B0040`), and the foreground is a soft gray (`#E0E0E0`).

**Why it matters:** Setting only some keys leaves xterm with default colors; the full object ensures consistent appearance across terminals. The cursorAccent field is an xterm-specific primitive that inverts the cursor color for legibility.

### 9. Xterm.js Plugins Stack (Fit, WebLinks, Search)

Canopy loads the three most commonly needed xterm addons at creation: `FitAddon`, `WebLinksAddon`, and `SearchAddon`.

**Primitive:** Canonical plugin stack for xterm.js integrations.

**Implementation note:** `FitAddon` is loaded first so the terminal dimensions are calculated. `WebLinksAddon` hooks into the system open command via `@tauri-apps/plugin-shell`. `SearchAddon` is exposed via a custom React search bar with forward/back navigation and incremental find.

**Why it matters:** Different apps skip one or more of these, leading to feature gaps (e.g., no link support in curl output, no Ctrl+F in development UIs).

### 10. Dynamic Font Zoom (Cmd+Plus/Minus/0)

Canopy maps Cmd+/-/0 to xterm.js `fontSize` updates, followed by immediate re-fit and PTY resize propagation to the backend.

**Primitive:** Font size adjustment that propagates to PTY dimensions through the Rust backend.

**Implementation note:**
- Size clamped between 8 and 24, default 13.
- After `xtermRef.current.options.fontSize = next`, `fitAddon.fit()` runs.
- `resizeTerminal()` is called to notify the PTY master of the new rows/cols (so tools like `less`, `vim`, etc., redraw correctly).

**Why it matters:** Some apps only change the frontend font size and skip the PTY resize, leaving subprocesses with stale dimensions.

### 11. Status-Triggered Attention System

Canopy detects when Claude Code asks for attention by scanning terminal output against a small regex list (`Do you want to proceed?`, `Esc to cancel`, `Allow once`, `Allow always`).

**Primitive:** Pattern-based attention detection in terminal output streams.

**Implementation note:** The last 500 characters of output are retained and scanned after each output chunk. The scan avoids re-firing using a 5-second cooldown. The idle timer is paused while the attention pattern matches, and a "waiting" state is emitted to the UI.

**Why it matters:** Claude Code does not emit a terminal bell for permission prompts. Without scanning, users have no visual cue that action is required. The cooldown prevents flickering when a session transitions back to idle.

### 12. Output Streaming with ANSI Redaction

Terminal output is passed to xterm.js via raw `Uint8Array` bytes. For pattern detection, the output is converted to text with `/\\x1b[[0-9;]*[a-zA-Z]/g` stripped.

**Primitive:** Streaming terminal output that can be fed both to a web renderer and to a pattern matcher.

**Implementation note:** The escape redaction is a simple regex. The buffer size is 4096 bytes per read from the Rust PTY.

**Why it matters:** Defensive parsing of raw bytes prevents pattern mis-matches caused by ANSI control sequences in the text.

---

## State Management Primitives

### 13. Partially Shared State via Refs

Canopy uses React `useRef` for callbacks and mutable state that must always be current, instead of stale-closure-prone `useState`. Specifically, `tabsRef`, `onTerminalSpawnedRef`, `onStatusChangeRef`, `onRegisterElementRef`, `currentStatusRef` are refs.

**Primitive:** Using mutable refs to avoid stale closures in event handlers.

**Implementation note:** Each `useEffect` updates the ref on every render (`ref.current = callback`), ensuring the handler always sees the latest props without re-binding.

**Why it matters:** xterm.js uses long-lived event listeners whose callbacks should not capture stale state. The ref pattern is used by frameworks that interact with long-lived external event sources.

### 14. Tauri IPC + Channel Event Pattern

PTY output is streamed from Rust to React via Tauri's `Channel<TerminalEvent>` where `TerminalEvent` is a tagged enum (`Output { data: Vec<u8> }` or `Exit { code: Option<i32> }`).

**Primitive:** Strongly typed, tag-dispatched channel for streaming PTY output.

**Implementation note:** The Rust side defines `TerminalEvent`, `spawn_terminal()` accepts `on_event: Channel`, spawns a thread that reads from the master PTY and sends chunks, and sends an `Exit` event when the reader loop ends. The React side processes `Output` by writing to xterm and `Exit` by setting the tab status to `done-error` or `done-success`.

**Why it matters:** Throwing raw strings over IPC loses fidelity (binary output, control sequences). Tagged unions / tagged enums keep the message typed.

### 15. Provider-Aware Environment Injection

Canopy supports three AI providers: Direct (default), Bedrock (AWS), and Vertex (GCP). Provider settings are stored in an `Arc<Mutex<Option<ProviderSettings>>>` keyed by provider and model_override.

**Primitive:** Centralized provider configuration injected into spawned CLI processes at runtime.

**Implementation note:** `update_provider_cache()` receives provider fields from the frontend; required secrets (AWS keys) are read from the platform keyring. The `spawn_terminal()` resolver reads this cache and prefixes env vars to the `CommandBuilder`.

**Why it matters:** Allows users to switch cloud providers without proxy/tunnel code. Decouples CLI launch from credential management.

### 16. Credential Scrubbing via Keyring

Sensitive keys (`aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`) are stored via `keyring::Entry`. The `save_keyring_secret`, `get_keyring_secret`, and `delete_keyring_secret` commands gate keys via an explicit allowlist (`ALLOWED_KEYRING_KEYS`).

**Primitive:** Explicit allowlist for keyring access.

**Implementation note:** Guarded by 3-element constant (`ALLOWED_KEYRING_KEYS.len()` asserts 3). The allowlist is enforced in Rust with `validate_keyring_key`, returning `Err` with the offending key name inline.

**Why it matters:** Prevents stored credential exfiltration via arbitrary key names in Tauri commands.

---

## Persistence Primitives

### 17. Lightweight Client-Side Storage

Canopy uses two distinct persistence layers:
- **localStorage** for transient UI state (tabs, sessions, dismissed list, sidebar collapsed state).
- **SQLite** (via tauri-plugin-sql) for structured project data and daily planner tasks.

**Primitive:** Split-persistence strategy with localStorage for transient UI state and SQLite for structured data.

**Implementation note:** The `SESSION_STORAGE_KEY` constant (`canopy-tab-sessions`) identifies the localStorage bucket. The `saveSessions`/`loadSavedSessions` functions round-trip `TerminalTab[]` to JSON. On projects, `scan_workspace` reads directory structure, `get_project_info` reads config files, and the SQLite plugin handles CRUD for planner tasks.

**Why it matters:** Putting transient UI state in SQLite adds latency and complexity; localStorage is synchronous, fast, and sufficient for small tab arrays.

---

## Cross-Cutting Primitives

### 18. OS-Specific Tuple Enry Paths for Shells

Canopy gets the user's default shell via `std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())` on Unix and `COMSPEC` on Windows.

**Primitive:** Platform-aware default shell resolution.

**Implementation note:** The spawn command always sets `TERM=xterm-256color` via `cmd.env("TERM", "xterm-256color")`. It also clears the env and rebuilds from `std::env::vars()`, skipping `CLAUDECODE*` / `CLAUDE_CODE*` prefixed keys.

**Why it matters:** GUI desktop app bundles don't inherit a proper terminal shell; clamping the env to `xterm-256color` ensures consistent behavior.

### 19. Pty Instance Triple (master / writer / child)

Each `TerminalInstance` stores `master: Box<dyn MasterPty + Send>`, `writer: Box<dyn Write + Send>`, and `child: Box<dyn Child + Send>`.

**Primitive:** Keep master for reads, writer for writes, and child for process control separately.

**Implementation note:** The Rust-side spawn logic: reader thread clones the master reader, the writer handle is taken from the master, and the master is held by the AppState map. On close, `child.kill()` terminates the process.

**Why it matters:** Splitting gives the frontend precise control: resize (master), write data (writer), kill (child). Merging them couples lifecycle decisions.

### 20. Pause-Resume Input Buffers

Canopy resets its `outputBuffer` when it transitions to waiting state *and* when any user data is sent (`xterm.onData` writes and resets `outputBuffer`).

**Primitive:** Reset input-buffer on user interaction to avoid re-triggering false attention on the same prompt.

**Implementation note:** The rolling buffer is capped to the last 500 characters. The cooldown is 5000ms (ATTENTION_COOLDOWN). When the user responds (status transitions back to `running`), the buffer clears.

**Why it matters:** Cat-and-mouse loops: without clearing the buffer on user input, the next 500-char chunk might still contain the prompt, re-triggering attention.

### 21. Explicit "No Cleanup on Visibility Flip" Pattern

The main `useEffect` that initializes the terminal has a comment: `// NO cleanup here — xterm must survive visibility changes`. Cleanup runs only on unmount.

**Primitive:** Discipline that resource-heavy components are initialized once and only disposed on unmount.

**Implementation note:** A ref (`spawnedRef`) blocks re-init inside the effect. A separate cleanup effect handles idle timer clearing, ResizeObserver disconnection, xterm disposal, and DOM deregistration.

**Why it matters:** Disposing/recreating xterm on visibility toggles races against the PTY's input state and loses scrollback history.

### 22. Status-Icon Status Dot Pattern

Each `TerminalTab` shows four visual states: Claude Session (badge), Workspace Agent (different badge), Project Overview (different color), and a status dot derived from the `status` enum.

**Primitive:** Component props that branch UI on both identity (session, agent, project, plain) and lifecycle state (starting, idle, running, waiting, done-success, done-error).

**Implementation note:** `TerminalTabBar` passes status to each `TerminalTab` component, which renders state-appropriate icons and colors. Waiting state triggers a notification dot via the hook.

**Why it matters:** Multi-way state representation without a single unified state machine for UI forces developers to synthesize state from props. Visual distinction is essential for terminal management UIs.

---

## Integration with Prior Analysis

These Canopy primitives **complement** the chassis-level primitives found in the *Terminal Application Primitives Analysis* (bracket-lib, blessed, textual, urwid, tcell, libtcod, notcurses, etc.). Where those primitives focus on **rendering engines and widget systems**, Canopy's primitives focus on **desktop-agent orchestration patterns**: tab lifecycle, PTY management, TLS/CLI guards, attention detection, on-process spawn timing, and Rust/React IPC over Tauri channels.

For reports on **terminal fundamentals, multi-pane workspaces, concurrency, state management, and persistence**, these Canopy-specific primitives offer directly usable patterns.

For reports on **rendering architecture, text rendering, animation, scrolling, widget architecture, accessibility**, these primitives provide reactive integration points (wiring PTY events to the render loop) but do not create new rendering primitives.

For reports on **data visualization, AI agent visualization** the attention-detection pattern and the session-data model are directly transferable.

For reports on **theming systems, plugin architecture, production runtime, and performance engineering**, the Canopy primitives add practical decisions (keyring scrub policy, PTY cleanup on destroy, AB<-> RB<->, theme consistency).


