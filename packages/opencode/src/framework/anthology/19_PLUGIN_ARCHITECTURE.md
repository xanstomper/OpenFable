# Anthology: Plugin Architecture

> **Subject:** Plugin Architecture - extensibility and modularity for TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Plugin Architecture Mastery

### 19.1 Plugin Registration

```rust
pub trait Plugin: Send + Sync {
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn init(&mut self, context: &PluginContext) -> Result<(), PluginError>;
    fn shutdown(&mut self) -> Result<(), PluginError>;
    fn on_event(&mut self, event: &Event) -> Vec<PluginAction>;
    fn render(&self, fb: &mut Framebuffer) -> Result<(), PluginError>;
}

pub struct PluginManager {
    plugins: HashMap<String, Box<dyn Plugin>>,
    load_order: Vec<String>,
    context: PluginContext,
}

impl PluginManager {
    pub fn register(&mut self, plugin: Box<dyn Plugin>) -> Result<(), PluginError> {
        if self.plugins.contains_key(plugin.name()) {
            return Err(PluginError::AlreadyRegistered);
        }

        plugin.init(&self.context)?;
        self.plugins.insert(plugin.name().to_string(), plugin);
        Ok(())
    }

    pub fn unregister(&mut self, name: &str) -> Result<(), PluginError> {
        if let Some(mut plugin) = self.plugins.remove(name) {
            plugin.shutdown()?;
        }
        Ok(())
    }
}
```

### 19.2 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| No sandboxing | Plugin crashes app | Isolate plugin failures |
| Tight coupling | Hard to update | Use trait interfaces |
| No lifecycle | Memory leaks | Cleanup on unload |
| Shared state conflicts | Data races | Isolate plugin state |

---

# PART 2: NOVEL CONCEPTS REPORT

## Plugin Architecture: Untapped Opportunities

### Concept 1: Hot-Swappable Widget Plugins

**Idea:** **Load/unload widgets at runtime** without restart.

```rust
pub struct HotSwappableWidgetPlugin {
    widget: Option<Box<dyn Widget>>,
    path: PathBuf,
    last_modified: SystemTime,
}

impl HotSwappableWidgetPlugin {
    pub fn check_reload(&mut self) -> Result<(), PluginError> {
        let metadata = std::fs::metadata(&self.path)?;
        if metadata.modified()? > self.last_modified {
            self.widget = Some(load_widget_from_file(&self.path)?);
            self.last_modified = metadata.modified()?;
        }
        Ok(())
    }
}
```

**Novel because:** TUIs require restart for changes. Hot-swap = instant development.

**Complexity:** Medium
**Value:** Medium (better DX)

---

**End of Plugin Architecture Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Extension Points Worth Keeping Small

A generalized TUI plugin system only needs a few clean surfaces:
- **Lifecycle hooks**: on_load, on_unload, on_enable, on_disable
- **Event interception**: before event handled, after event handled (read-only)
- **Optional render contribution**: plugin may add segments to a named layer
- **Capability declaration**: plugin declares what APIs it uses (for sandboxing)

TerminalTextEffects' effect composition (EffectChain sequential + EffectGroup parallel) is the correct model: plugins compose via a shared protocol, not via inheritance. Rich's `Renderable` protocol (`__rich_console__`) demonstrates that any type can contribute rendering without framework changes.

*Bubble Tea's renderer interface (`render(View)`, `resize()`, `setSyncdUpdates()`) proves that even the rendering backend is a plugin — swap standard, nil, or cursed renderers without changing application logic. Ultraviolet's `Screen` interface similarly decouples all drawing code from the concrete terminal implementation.*

## 3.2 Sandboxing Reality

True sandboxing in TUIs means load failure isolation, not OS-level sandboxing. Prefer allowlists for APIs exposed to plugins: restrict to a `PluginAPI` surface (render, emit events, access state by key) rather than giving plugins full framework access. Plugin state lives outside core state tree to prevent accidental coupling. Configuration lives in plugin's own namespace. Loading failure should not crash the host: wrap in `try { load() } catch { log("plugin failed to load"); }`.

*Canopy's `ALLOWED_KEYRING_KEYS` allowlist pattern applies directly: define an explicit constant list of API keys a plugin may access, reject any unrecognized key names at the boundary. Charm's credential system demonstrates this at the storage layer — the allowlist is enforced in Rust with `validate_keyring_key`, returning `Err` with the offending key name inline. No plugin can exfiltrate data through arbitrary key lookups.*

## 3.3 Middlechain Plugin Architecture: Composable Interceptors

The most powerful plugin pattern observed across the primitive corpus is **middleware chains** — composable interceptors that wrap core handlers without modifying them. Wish's SSH middleware pipeline is the canonical implementation:

```
Request → [Logging] → [Auth] → [RateLimit] → [AccessControl] → [Handler] → Response
```

Each middleware is a function `func(next Handler) Handler` that can:
- **Inspect** the request (read-only)
- **Transform** the request (wrap context, inject data)
- **Short-circuit** (deny access, return error early)
- **Post-process** the response (logging, metrics)

*For TUI plugin systems, this translates to an event-processing pipeline:*

```rust
type EventFilter = fn(&PluginCtx, Event) -> Option<Event>;

struct PluginPipeline {
    filters: Vec<(PluginId, EventFilter)>,
}

impl PluginPipeline {
    fn process(&self, ctx: &PluginCtx, event: Event) -> Event {
        let mut current = event;
        for (id, filter) in &self.filters {
            if let Some(transformed) = filter(ctx, current) {
                current = transformed;
            } else {
                // Filter consumed the event (equivalent to firewall DROP)
                break;
            }
        }
        current
    }
}
```

*Bubble Tea's event filter is the direct analogue: `filter(model, msg) -> Option<Msg>`. Returning `None` suppresses the message entirely. This is how "prevent exit with unsaved changes" works — a filter that drops `QuitMsg` when `model.has_changes` is true. For plugin systems, this means any plugin can selectively intercept, transform, or suppress events without the core application knowing or caring.*

Three middleware patterns transfer directly from Wish:

1. **Logging Plugin**: records timing, event counts, plugin interactions (non-blocking, post-process)
2. **Auth Plugin**: validates capability declarations before allowing API access (short-circuit on failure)
3. **Rate-Limit Plugin**: tracks per-plugin event frequency, throttles abusive plugins (stateful interceptor)

## 3.4 File-Based Plugin Registration: The Canopy Model

Canopy's Skills plugin system demonstrates the lowest-friction plugin architecture: **no compiled extension step**. Plugins are YAML files written to `~/.claude/commands/<skillname>.yaml`. Registration = file creation. Unregistration = file deletion. Lazy evaluation = plugin loads only on invocation.

*For Rust/TUI plugin systems, the equivalent is a manifest-first approach:*

```toml
# ~/.config/mytui/plugins/statusline-enhanced.toml
[plugin]
name = "statusline-enhanced"
version = "1.2.0"
description = "Git-aware status line with branch info"

[capabilities]
# Explicit capability declaration (allowlist model)
apis = ["render.named_layer", "state.read", "events.subscribe"]
layers = ["statusline"]

[lifecycle]
load = "lazy"          # loaded on first use
hot_reload = true      # watch for file changes

[sandbox]
max_memory_mb = 16
timeout_ms = 100
filesystem = "none"    # no FS access
process_spawn = false  # no child processes
```

*Atomic install (write to temp, rename into place) prevents partial-load crashes. The plugin directory convention `~/.config/<app>/plugins/` enables discovery by filesystem scan — no central registry required.*

## 3.5 Protocol-Based Composition: Plugins as Implementors

Rich's `Renderable` protocol is the key insight: **any type that implements `__rich_console__()` contributes rendering without framework changes**. The framework doesn't enumerate renderables — it discovers them through duck typing.

*Apply this to TUI plugin systems: define that any struct implementing a `PluginWidget` trait can appear in a named layer:*

```rust
/// Any type implementing this trait is automatically a plugin renderable.
/// The framework discovers it through the type system, not registration.
pub trait PluginWidget: Send + Sync {
    /// Return a Renderable for the current frame.
    fn render(&self, ctx: &RenderCtx) -> Box<dyn Renderable>;

    /// Which named layer this widget contributes to.
    fn layer(&self) -> &str;

    /// Z-index within the layer (higher = on top).
    fn z_index(&self) -> i32 { 0 }
}
```

*This is exactly how TerminalTextEffects' effect composition works. An `EffectChain` holds a sequence of effects; an `EffectGroup` holds parallel effects. New effects don't require framework changes — they just implement the Effect trait. The composition model is protocol-driven, not inheritance-driven.*

## 3.6 Plugin State Isolation

*From the Elm architecture (Bubble Tea) and Component Composition (Bubbles) patterns: plugin state must be fully isolated from core state. The correct approach is namespace-scoped state with explicit accessors:*

```rust
struct PluginStateRealm {
    namespace: String,
    inner: HashMap<String, Value>,
}

impl PluginStateRealm {
    /// Plugins can only access their own namespace.
    fn get(&self, key: &str) -> Option<&Value> {
        self.inner.get(key)
    }

    fn set(&mut self, key: &str, value: Value) {
        self.inner.insert(key.to_string(), value);
    }

    /// Cross-plugin state access requires explicit capability.
    fn get_remote(&self, _namespace: &str, _key: &str) -> Option<&Value> {
        // Only available if plugin declared "state.read_remote" capability
        None
    }
}
```

*Bubbles' component composition pattern (parent creates children, routes messages to children, composes child views) proves that hierarchical state delegation works at scale. A `List` component contains `Paginator`, `Spinner`, `TextInput`, and `Help` as sub-components — each with isolated state, explicit message routing.*

## 3.7 Lifecycle Hooks: The Full Set

*From the INDEX.md's Component Lifecycle pattern and Canopy's tab lifecycle FSM, the complete plugin lifecycle is:*

```
┌─────────────────────────────────────────────────────────────────┐
│                     Plugin Lifecycle                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  discovered()          ← filesystem scan finds manifest         │
│    ↓                                                            │
│  resolved()            ← dependencies checked, capabilities      │
│                          validated against allowlist             │
│    ↓                                                            │
│  loaded()              ← code loaded (dlopen/wasm/in-process)   │
│    ↓                                                            │
│  initialized(ctx)      ← plugin receives PluginContext          │
│    ↓                                                            │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                 Active Loop (optional)                 │      │
│  │  ┌────────────────────────────────────────────────┐  │      │
│  │  │  on_event(event) → Vec<PluginAction>           │  │      │
│  │  │  on_render(fb)   → Contribution to named layer │  │      │
│  │  │  on_tick(dt)     → Periodic update (if ticking)│  │      │
│  │  └────────────────────────────────────────────────┘  │      │
│  └──────────────────────────────────────────────────────┘      │
│    ↓                                                            │
│  disabled()            ← temporary deactivation (keeps state)   │
│    ↓ (optional re-enable → initialized)                         │
│  shutdown()            ← cleanup, serialize persistent state    │
│    ↓                                                            │
│  unloaded()            ← code unloaded, resources freed         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

*Canopy's tab lifecycle (`starting → running → idle/waiting → done-success/done-error`) is a proven model for managing process-like plugin lifecycles. The `done-success` vs `done-error` distinction drives relaunch decisions — similarly, a plugin that errors on initialization can be marked `failed` and skipped on next startup, rather than repeatedly crashing.*

## 3.8 Declarative Plugin Configuration: YAML/JSON DSL

*From REPORT_NEW_CONCEPTS' Concept 4 (Declarative Effect Composition DSL), plugins should support declarative configuration alongside code:*

```yaml
# plugin: animated-status-bar
# type: effect-plugin
name: "Thinking Indicator"
trigger: agent_state.thinking
target: statusbar.effects
effects:
  - type: gaze_shift
    target_vector: [-0.5, -0.3]
    duration: 300ms
    easing: ease_out_quad
  - type: color_pulse
    from: "#888888"
    to: "#00FF88"
    loop: true
    frequency: 0.5hz
```

*Textual's CSS-style declarative styling proves that non-programmers can configure visual behavior through structured data. A plugin system that supports both code plugins (compiled extensions) and declarative plugins (YAML/JSON configurations) covers 95% of use cases without requiring users to write code.*

## 3.9 Error Isolation: Failure Modes

*Sandboxing means defining exactly how failure manifests. From the SUMMARY.md's pitfall analysis and Canopy's defensive spawn patterns:*

| Failure Mode | Behavior | Implementation |
|---|---|---|
| Plugin fails to load | Log warning, skip plugin, continue startup | `try { load() } catch { log(); skip }` |
| Plugin panics during event | Catch unwind, disable plugin, propagate error event | `catch_unwind()` + plugin state → `disabled-failed` |
| Plugin exceeds timeout | Terminate plugin's task, emit timeout error | `select! { result = plugin_task, _ = timeout }` |
| Plugin exceeds memory | Reject allocation, disable plugin | Memory arena with per-plugin quota |
| Plugin API violation | Deny access, log violation, decrement trust score | Capability enforcement at API boundary |
| Plugin directory corrupt | Skip invalid manifests, load valid ones | Per-manifest error isolation |

*Canopy's Claude-specific spawn guards demonstrate defensive subsystem launching: PATH augmentation, environment scrubbing (`CLAUDECODE*` prefix removal to prevent nested sessions provider-aware env injection. Each plugin spawn should apply analogous guards: sanitized environment, scoped temp directory, no inherited file descriptors beyond stdin/stdout.*

## 3.10 Cross-Plugin Communication

*Plugins must not call each other directly — this creates coupling and failure propagation. Instead, use an event bus:*

```rust
struct PluginEventBus {
    subscribers: HashMap<String, Vec<PluginId>>,  // event_type → subscribers
}

impl PluginEventBus {
    /// Plugins emit events to the bus. Other plugins receive
    /// only events they subscribed to, and only if their
    /// capability declaration includes "events.receive".
    fn emit(&self, source: PluginId, event: BusEvent) {
        if let Some(subs) = self.subscribers.get(&event.event_type()) {
            for sub_id in subs {
                if *sub_id != source {  // no echo
                    // deliver through PluginPipeline (rate-limited, sandboxed)
                }
            }
        }
    }
}
```

*This is the message-passing model from Bubble Tea's Elm architecture applied at the plugin level. The Cmd/Batch/Sequence combinators (run plugins in parallel or serial) provide the execution model. Charm's KV store demonstrates how to share state between isolated components — the `Sync()` method pushes local changes to cloud; similarly, plugin state changes can be persisted through a controlled sync boundary.*

## 3.11 Plugin Discovery and Hot-Reload

*Combining Canopy's lazy evaluation, REPORT_PRIMITIVE_COMBINATIONS' Time-Indexed Cell Buffer patterns, and the atomic install approach:*

```rust
struct PluginWatcher {
    plugins_dir: PathBuf,
    manifest_cache: HashMap<PluginId, Manifest>,
    inotify: Inotify,
}

impl PluginWatcher {
    fn watch(&mut self) {
        // Watch for file creation/deletion/modification
        for event in self.inotify.events() {
            match event {
                Create(path) => self.try_load_plugin(path),
                Modify(path) => self.try_hot_reload(path),
                Delete(path) => self.unload_plugin(path),
            }
        }
    }

    fn try_hot_reload(&mut self, path: PathBuf) {
        // 1. Read new manifest
        // 2. Validate capabilities (may have changed)
        // 3. Load new code into fresh Memory arena
        // 4. Serialize old plugin state
        // 5. Initialize new plugin with serialized state
        // 6. If init succeeds: atomic swap (pointer exchange)
        // 7. If init fails: keep old plugin, log error
    }
}
```

*Hot-reload requires deterministic serialization of plugin state (the Time-Indexed Cell Buffer pattern). Each plugin implementing `Serialize + DeserializeOwned` for its state enables graceful upgrade without data loss. TerminalTextEffects' effect state serialize/deserialize to JSON is the reference implementation.*


---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Canopy's Skills Plugin System

Canopy hosts Claude Code "skills" as file-based plugins under `~/.claude/commands/` and `~/.claude/skills/`. The registration API:

```rust
tauri::invoke_handler![
    commands::skills::get_skills,
    commands::skills::install_skill,
    commands::skills::uninstall_skill,
    commands::skills::check_skills_installed,
    commands::skills::fetch_marketplace_skills,
]
```

Skills are installed via:
```typescript
// 1. Fetch marketplace catalog
const catalog = await invoke<SkillCatalog[]>("fetch_marketplace_skills");
// 2. Install: write YAML file to ~/.claude/commands/<skillname>.yaml
// 3. Uninstall: delete the file
// 4. `check_skills_installed`: verify parsing succeeds
```

**Plugin architecture primitives transferrable to TUIs:**
- Directory convention: `~/.config/<app>/plugins/`
- Atomic install: write to temp, rename into place
- Lazy evaluation: plugin is loaded only on invocation
- Metadata-only manifest (YAML): no compiled extension step
- Execution-sandbox: skills run in Claude CLI process, not the TUI process

---
