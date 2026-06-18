# Anthology: Production Runtime Architecture

> **Subject:** Production Runtime Architecture - deploying and operating TUIs in production
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Production Runtime Architecture Mastery

### 20.1 Application Lifecycle

```rust
pub struct Application {
    state: Arc<Mutex<AppState>>,
    config: AppConfig,
    event_loop: EventLoop,
    renderer: Box<dyn Renderer>,
    plugins: PluginManager,
}

impl Application {
    pub fn run(mut self) -> Result<(), Error> {
        // 1. Initialize
        self.init()?;
        
        // 2. Run main loop
        self.event_loop.run(&mut self)?;
        
        // 3. Cleanup
        self.shutdown()?;
        
        Ok(())
    }

    fn init(&mut self) -> Result<(), Error> {
        // Load config
        self.config = AppConfig::load()?;
        
        // Initialize subsystems
        self.renderer.init()?;
        self.plugins.init_all()?;
        
        // Setup signal handlers
        self.setup_signals()?;
        
        Ok(())
    }

    fn shutdown(&mut self) -> Result<(), Error> {
        self.plugins.shutdown_all()?;
        self.renderer.shutdown()?;
        self.config.save()?;
        Ok(())
    }
}
```

### 20.2 Health Monitoring

```rust
pub struct HealthMonitor {
    pub status: HealthStatus,
    pub uptime: Duration,
    pub frame_times: VecDeque<Duration>,
    pub memory_usage: usize,
    pub error_rate: f32,
}

pub enum HealthStatus {
    Healthy,
    Degraded { reason: String },
    Failing { reason: String },
}

impl HealthMonitor {
    pub fn check(&self) -> HealthStatus {
        // Check frame rate
        let avg_frame = self.frame_times.iter().sum::<Duration>() / self.frame_times.len() as u32;
        if avg_frame > Duration::from_millis(20) {
            return HealthStatus::Degraded {
                reason: format!("Low FPS: {:.1}", 1000.0 / avg_frame.as_millis() as f64)
            };
        }

        // Check memory
        if self.memory_usage > 500 * 1024 * 1024 {
            return HealthStatus::Degraded {
                reason: format!("High memory: {} MB", self.memory_usage / 1024 / 1024)
            };
        }

        HealthStatus::Healthy
    }
}
```

### 20.3 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| No signal handling | Zombie processes | Handle SIGTERM/SIGINT |
| No health checks | Silent failures | Add health endpoint |
| No metrics | Blind to issues | Expose Prometheus |
| No graceful shutdown | Data loss | Flush on exit |

---

# PART 2: NOVEL CONCEPTS REPORT

## Production Runtime Architecture: Untapped Opportunities

### Concept 1: Self-Healing Runtime

**Idea:** Automatically **detect and recover** from failures.

```rust
pub struct SelfHealingRuntime {
    supervisor: Supervisor,
    children: HashMap<ComponentId, Component>,
    max_retries: HashMap<ComponentId, u32>,
}

impl SelfHealingRuntime {
    pub fn on_component_failure(&mut self, id: ComponentId) {
        let retries = self.max_retries.entry(id).or_insert(0);
        *retries += 1;
        
        if *retries < 5 {
            // Restart component
            self.restart_component(id);
        } else {
            // Give up, escalate
            self.escalate_failure(id);
        }
    }
}
```

**Novel because:** TUIs crash or hang. Self-healing = uninterrupted operation.

**Complexity:** High
**Value:** High (reliability)

---

**End of Production Runtime Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Terminal Lifecycle Pipeline

Every production TUI must execute a precise sequence to claim the terminal, run, and release without corrupting the host shell. Four frameworks converge on the same pipeline with varying granularity:

**Lifecycle Sequence (all sources):**

```
1. DETECT    → IsTerminal() + query capabilities
2. SAVE      → Record current terminal state (termios/ConsoleMode)
3. RAW       → Disable echo, canonical mode, signal generation
4. ALT-SCR   → Enter alternate screen buffer (\x1b[?1049h)
5. HIDE-CSR  → Hide cursor (\x1b[?25l) [optional]
6. RENDER    → Main loop: input → update → view → flush
7. RESTORE   → Show cursor, exit alt-screen, restore termios
8. LOG       → Write exit status, persist state
```

**Urwid** implements this via `Display.start()` which calls the underlying display module (curses/raw/escape) to set raw mode and program `MainLoop.stop()` to restore. The `MainLoop.run()` wraps the entire sequence in a try/finally, ensuring `stop()` fires even on unhandled exceptions.

**Textual** wraps it in `App.run()` as an async context manager. Entering calls `_driver.start()` (sets raw mode + alt-screen + calls `on_mount`). Exiting calls `_driver.stop()` (restores terminal + calls `on_unmount`). The context manager guarantees `stop()` runs even if the event loop throws.

**Blessed** uses `program.enterAlternateScreen()` / `program.leaveAlternateScreen()` as explicit paired calls with manual `program.flush()`. No RAII guard — the caller must ensure `leaveAlternateScreen()` runs. This is the error-prone approach; Blessed's higher-level `Screen` widget wraps it but doesn't enforce cleanup on panic.

**Bubble Tea** provides the strongest guarantee: `term.MakeRaw(fd)` returns a `*State` that must be explicitly passed to `term.Restore(fd, oldState)`. The `Program` type calls `defer term.Restore(...)` immediately after entering raw mode. For alt-screen, it writes `ansi.EnterAlternateScreen` and defers `ansi.ExitAlternateScreen`. Bubble Tea also supports `Nil Renderer` (daemon mode — skip terminal acquisition entirely) andSuspend/Resume via `SIGTSTP`/`SIGCONT` on Unix, which re-runs the raw-mode toggle sequence on resume.

**Production rule:** Always use defer/RAII/try-finally at the outermost scope. Never rely on the application to manually call shutdown steps.

## 3.2 Signal Handling & Graceful Degradation

**Bubble Tea** handles `SIGINT` and `SIGTERM` via a dedicated signal handler goroutine that posts `QuitMsg` to the message channel. This lets the model intercept the quit (e.g., "save changes?" dialog via event filter returning `nil` to suppress). For `SIGTSTP` (Ctrl+Z), Bubble Tea sends `SuspendMsg`, restores the terminal, backgrounds the process, then on `SIGCONT` re-enters raw mode and posts `ResumeMsg`. Windows suspend is unsupported.

**Urwid** delegates to the pluggable event loop. `AsyncioEventLoop` integrates with Python's `asyncio` signal handling. `GLibEventLoop` uses GTK's signal system. Urwid itself does not install signal handlers — this is the application's responsibility. The framework only guarantees `MainLoop.stop()` is called.

**Blessed** has no built-in signal handling. The Node/EventEmitter pattern means you register `process.on('SIGTERM', ...)` manually. Blessed's `Program` object exposes no signal API.

**Kitty protocol** terminals can report focus via `CSI I` / `CSI O`. Bubble Tea uses this via `View.ReportFocus = true`, emitting `FocusMsg`/`BlurMsg`. This lets the TUI pause animations or save state when the terminal loses focus (user switched tabs). Most TUIs ignore this — it's free production robustness.

**Cross-platform signal matrix:**

| Signal | Bubble Tea | Urwid | Blessed | x/term |
|--------|-----------|-------|---------|--------|
| SIGINT | QuitMsg | App handles | Manual | Raw mode makes Ctrl+C readable byte |
| SIGTERM | QuitMsg | App handles | Manual | Same |
| SIGTSTP | SuspendMsg | N/A | N/A | Manual |
| SIGCONT | ResumeMsg | N/A | N/A | Manual |
| SIGWINCH | WindowSizeMsg | N/A | N/A | Manual poll or ioctl |

## 3.3 Capability Detection & Runtime Adaptation

Production TUIs must adapt to the terminal they're running in, not the one they were designed for. Three sources provide the detection toolkit:

**x/term** provides the foundation: `IsTerminal(fd)` (isatty on Unix, GetConsoleMode on Windows) gates every other decision. `MakeRaw(fd)` can fail on non-TTY stdout — the application must handle this before touching the terminal.

**Lip Gloss** builds color adaptation on top of capability detection. The `ColorProfile` enum (ASCII → 4-bit → 256 → TrueColor) is determined by checking `COLORTERM`, `TERM`, and `NO_COLOR` environment variables. The `Complete(profile)` function lets you specify three fallback colors per use-site, selected at runtime. Detection pattern:

```python
# Lip Gloss detection hierarchy
if COLORTERM == "truecolor" or "24bit" in COLORTERM:
    profile = TRUE_COLOR
elif "256color" in TERM:
    profile = ANSI_256
elif TERM in ("xterm", "screen", "vt100"):
    profile = ANSI_4BIT
else:
    profile = ASCII  # Strip all ANSI
```

**Bubble Tea** queries at startup: `RequestMode(ansi.ModeSynchronizedOutput)` (mode 2026), `RequestMode(ansi.ModeUnicodeCore)`, `RequestTermcap("RGB")`. The renderer adapts: synchronized output eliminates flicker on supported terminals; unicode core width affects layout; RGB detection drives color output. The renderer also supports `setWidthMethod()` (wcwidth vs. unicode) and `setColorProfile()` (forced override for CI/piped output).

**Blessed** has the deepest detection: full terminfo/termcap parsing via `tput.js`. It compiles termcap entries at startup to discover what escape sequences the target terminal supports. This is the most compatible approach but also the heaviest — parsing terminfo at every startup.

**Textual** assumes modern terminal features (true color, Unicode) and provides `ColorSystem` enum (`truecolor`, `standard`, `eight_bit`, `monochrome`) that the app can force. Textual does not auto-detect as aggressively as Blessed or Lip Gloss; the developer configures it.

**Kitty protocol** graphics require explicit query: send `ESC[>0q` and parse response for version and capabilities. Never assume. The same applies to Sixel, iTerm2 inline images, and the Kitty keyboard protocol.

**Critical production pattern:** Detect → enable features → always maintain a fallback code path. A TUI that hard-codes true-color escapes will produce garbage on 256-color terminals.

## 3.4 Error Recovery & Resilience Patterns

Production TUIs fail in specific ways. The primitives corpus provides four resilience patterns:

**Fallback display chain (Urwid):**
`urwid/display/` ships 14 modules. The framework tries backends in order: `raw.py` (direct terminal, most features) → `curses.py` (most compatible) → `escape.py` (minimal). If raw mode fails on a non-TTY, curses may still work. If curses isn't compiled, escape sequences are the last resort. Build your own chain.

**Double-buffer damage tracking (Blessed, notcurses, termflix):**
Blessed maintains front + back buffers. `screen.render()` diffs them and outputs only changed cells via minimal escape sequences. Notcurses does the same at the per-plane level (`dirty` bool per cell). Termflix adds frame-loss detection: if the terminal can't keep up, drop frames rather than building an ever-growing backpressure queue. **Production rule:** When output is slower than frame generation, skip — never buffer.

**Panic recovery (Bubble Tea, Go convention):**
Bubble Tea's `Program` runs the model's `Update` and `View` behind a `recover()` catch. A panic in update doesn't kill the terminal; the error is logged and the program exits gracefully (restoring terminal state via the deferred calls). In Rust, `catch_unwind` at the same boundary achieves the same. Python frameworks get this "for free" from the interpreter.

**Context cancellation (Bubble Tea):**
Bubble Tea uses `context.WithCancel` to propagate shutdown to all goroutines. `cancel()` signals every spawned task. `<-handlers.shutdown()` blocks until all tasks have returned. In Rust, `tokio::sync::broadcast` channel serves the same role. In Python, `asyncio.Event` or `trio.CancelScope`.

**Resize handling:** `SIGWINCH` on Unix, `WindowSizeMsg` in Bubble Tea, `on_resize` hook in Textual, poll `term.GetSize(fd)` on each frame. The terminal can resize at any event-loop iteration. Never cache dimensions across frames.

## 3.5 Production Runtime Architecture Taxonomy

| Concern | Urwid | Textual | Blessed | Bubble Tea | x/term |
|---------|-------|---------|---------|------------|--------|
| Alternate screen | Display.start/stop | App context manager | enter/exit pairs | Enter/Exit ANSI | Manual |
| Raw mode | Display backend | Driver | tput API | MakeRaw/Restore | MakeRaw/Restore |
| Signal handling | Pluggable event loop | App handles | Manual | Built-in | None |
| Capability detection | Display module probe | Config override | terminfo parse | Mode queries | IsTerminal |
| Color depth | Via display | ColorSystem enum | 16/256/true | ColorProfile adapter | None |
| Fallback chain | 14 display backends | None | None | Nil renderer | None |
| Panic recovery | Python exceptions | Python exceptions | None explicit | recover() | N/A |
| Alt-screen cleanup | MainLoop.stop | Context manager | Manual | defer | Manual |
| Frame rate cap | MainLoop event tick | Render loop | screen.render() timer | Ticker [1,120] fps | N/A |
| Mouse support | Display module | Built-in | widget bind | MouseMode enum | Off only |
| Focus/blur events | Display module | Built-in | Not native | ReportFocus CSI | None |
| Terminal emulator | VTerm widget | Not applicable | Widget embeds | Pty via x/term | Password read |

## 3.6 Production Implementation Checklist

Synthesized from all six sources. Framework-agnostic, ordered from outermost to innermost:

**Pre-loop (startup):**
1. `IsTerminal(fd)` — bail or degrade to log-only mode if piped
2. `GetSize(fd)` — initial dimensions; handle failure (default 80×24)
3. Query color capabilities → set `ColorProfile` or equivalent
4. Query keyboard protocol support ( Kitty, modifyOtherKeys)
5. `MakeRaw(fd)` / save old state — handle error (not a TTY)
6. Enter alternate screen — `ESC[?1049h` or equivalent
7. Enable synchronized output if supported — `ESC[?2026h`
8. Hide cursor if your UI doesn't use it — `ESC[?25l`
9. Install signal handlers: SIGINT, SIGTERM, SIGTSTP (Unix)
10. Load persisted state with version check + migration
11. Initialize plugins behind fail-safe isolation (one bad plugin must not crash the app)
12. Start command pool / async worker tasks
13. Create cancel context for graceful worker shutdown
14. First render (don't wait for first input event — show something immediately)

**Per-frame (main loop):**
1. Poll input with timeout (don't block — you need timer ticks)
2. Handle resize events before rendering stale dimensions
3. Process all pending messages (don't starve the channel)
4. Run `Update` → get new state + commands
5. Execute commands (batch or sequence; cap concurrency)
6. Run `View` → get frame buffer
7. Diff against previous frame; output minimal delta
8. Flush output in single write call
9. Sleep remaining frame time to maintain target FPS

**Post-loop (shutdown):**
1. Cancel all worker contexts (with timeout — don't wait forever)
2. Show cursor — `ESC[?25h`
3. Exit synchronized output — `ESC[?2026l`
4. Exit alternate screen — `ESC[?1049l`
5. Restore terminal state (termios/ConsoleMode)
6. Flush any pending output
7. Persist session state with version tag
8. Close file handles and network connections
9. Log exit status (reason + exit code)

**Invariant:** Steps 2-9 of shutdown must run even if the main loop panics. Use defer/RAII/try/finally at the outermost call frame. Test this by injecting a panic mid-loop and verifying your shell prompt is restored correctly.


---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Canopy's Application Lifecycle Primitives

**Window-destroy hook ensuring PTY cleanup:**
```rust
.on_window_event(|window, event| {
  if let tauri::WindowEvent::Destroyed = event {
    if let Some(state) = window.try_state::<AppState>() {
      if let Ok(mut terminals) = state.terminals.lock() {
        for (_, term) in terminals.iter_mut() {
          let _ = term.child.kill();
        }
        terminals.clear();
      }
    }
  }
})
```

**Key design choice:** The child-kill happens in `WindowEvent::Destroyed`, not via a `Drop` impl. In Tauri, `AppState` may outlive the window event; explicitly handling `Destroyed` ensures cleanup at the right time.

**Keyring credential policy:**
```rust
const ALLOWED_KEYRING_KEYS: &[&str] = &[
  "aws_access_key_id", "aws_secret_access_key", "aws_session_token",
];
fn validate_keyring_key(key: &str) -> Result<(), String> {
  if !ALLOWED_KEYRING_KEYS.contains(&key) {
    return Err(format!("Invalid keyring key: {}", key));
  }
  Ok(())
}
```

Tests enforce strict invariants:
- exactly 3 keys in allowlist
- empty string rejected
- arbitrary key like `"password"` rejected
- error message includes offending key name

**Production gaps:**
- No startup health check (no probe of PTY, CLI, or keyring on app init)
- No grace-period retry on spawn failure
- `spawn_terminal` returns `Result<String, String>` — the Rust error surfaces as a raw xterm write (`xterm.write(message)`) — no structured UI notification

---
