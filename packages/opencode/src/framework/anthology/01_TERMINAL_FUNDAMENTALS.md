# Anthology: Terminal Fundamentals

> **Subject:** Terminal Fundamentals - the foundation upon which all TUIs are built
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Terminal Fundamentals Mastery

### 1.1 Understanding the Terminal Stack

```
┌─────────────────────────────────────────┐
│           Your TUI Application          │
├─────────────────────────────────────────┤
│        Terminal Escape Sequences        │
├─────────────────────────────────────────┤
│         Terminal Emulator (kitty)       │
├─────────────────────────────────────────┤
│      Pseudo-Terminal (PTY / pts/0)      │
├─────────────────────────────────────────┤
│            Shell (bash, zsh)            │
└─────────────────────────────────────────┘
```

### 1.2 Essential Escape Sequences

#### Cursor Control
```rust
// Move cursor to row 10, column 20
print!("\x1b[10;20H");

// Move cursor up 2 lines
print!("\x1b[2A");

// Hide cursor
print!("\x1b[?25l");

// Show cursor
print!("\x1b[?25h");
```

#### Color Control
```rust
// 16 ANSI colors
print!("\x1b[31mRed text\x1b[0m");

// 256 colors
print!("\x1b[38;5;196mBright red\x1b[0m");

// Truecolor (24-bit)
print!("\x1b[38;2;255;128;64mOrange\x1b[0m");
```

#### Screen Control
```rust
// Clear screen
print!("\x1b[2J");

// Clear to end of line
print!("\x1b[K");

// Save cursor position
print!("\x1b[s");

// Restore cursor position
print!("\x1b[u");
```

### 1.3 Terminal Capability Detection

```rust
use std::env;

struct TerminalCapabilities {
    truecolor: bool,
    unicode: bool,
    kitty_protocol: bool,
    sixel: bool,
    cols: usize,
    rows: usize,
}

impl TerminalCapabilities {
    pub fn detect() -> Self {
        let term = env::var("TERM").unwrap_or_default();
        let colorterm = env::var("COLORTERM").unwrap_or_default();
        
        // Detect terminal size via ioctl
        let (cols, rows) = Self::get_terminal_size();
        
        TerminalCapabilities {
            truecolor: colorterm == "truecolor" 
                || colorterm == "24bit"
                || term.contains("24bit"),
            unicode: Self::check_unicode_support(),
            kitty_protocol: term == "xterm-kitty",
            sixel: Self::probe_sixel(),
            cols,
            rows,
        }
    }
    
    fn get_terminal_size() -> (usize, usize) {
        // Use ioctl TIOCGWINSZ on Unix
        // Or Parse $COLUMNS and $LINES
        (80, 24)  // Fallback
    }
    
    fn check_unicode_support() -> bool {
        // Try printing Unicode, measure cursor movement
        print!("\x1b[1000Ā");  // Move right, print wide char
        // If cursor moves 2 cells, Unicode wide chars supported
        true
    }
    
    fn probe_sixel() -> bool {
        // Send sixel query \e[0q
        // Wait for Device Control String response
        false  // Simplified
    }
}
```

### 1.4 The PTY Layer

**Critical insight:** Your TUI doesn't talk to the terminal directly—it talks through a **pseudo-terminal (PTY)**.

```
Your App → PTY Master → Kernel → PTY Slave → Terminal Emulator
```

**Implications:**
1. **Buffering:** Output is buffered by the PTY (typically 4KB)
2. **Flow control:** XON/XOFF (^S/^Q) can freeze your app
3. **Signal handling:** SIGWINCH for resize, SIGINT for Ctrl+C

**Best practice:**
```rust
// Disable canonical mode for raw input
// Disable echo so your app controls all output
// Handle SIGWINCH to detect resize
signal_hook::flag::register(signal_hook::SIGWINCH, ...);
```

### 1.5 Unicode and Cell Width

**Problem:** Not all characters are 1 cell wide.

| Character | Type | Cell Width |
|-----------|------|------------|
| `A` | Latin | 1 |
| `中` | CJK | 2 (wide) |
| `́` (combining accent) | Combining | 0 |
| `🎉` (emoji) | Emoji | 2 (wide) |
| `⡇` (Braille) | Symbol | 1 |

**Solution:** Use `unicode-width` crate:

```rust
use unicode_width::UnicodeWidthChar;

fn cell_width(c: char) -> usize {
    c.width().unwrap_or(0)
}

fn string_cell_width(s: &str) -> usize {
    s.chars().map(|c| cell_width(c)).sum()
}

// Usage
let text = "Hello 世界";
let width = string_cell_width(text);  // 5 + 2 + 2 = 9 cells
```

### 1.6 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Not handling SIGWINCH | App breaks on resize | Register signal handler |
| Assuming 80x24 | Layout breaks on large terminals | Query actual size |
| Not restoring terminal | Terminal broken after exit | Use `terminally_guard()` RAII |
| hardcoding ANSI codes | Breaks on unknown terminals | Use terminfo/capability detection |
| Ignoring wide chars | Text misaligned | Use `unicode-width` |

---

# PART 2: NOVEL CONCEPTS REPORT

## Terminal Fundamentals: Untapped Opportunities

### Concept 1: Terminal Fingerprinting for Adaptive Rendering

**Idea:** Build a **probabilistic terminal fingerprint** based on behavioral responses, not just `$TERM`.

**How:**
1. Send probe sequences (query color support, Unicode width, sixel)
2. Measure timing responses (different emulators have different latencies)
3. Build fingerprint: `{ truecolor: 0.95, unicode_wide: 1.0, sixel: 0.0, latency_ms: 2.3 }`
4. Match against known terminal profiles

**Novel because:** `$TERM` is often wrong (e.g., `TERM=xterm-256color` in kitty). Behavioral fingerprinting is accurate.

**Complexity:** Medium
**Value:** High (correct rendering on any terminal)

---

### Concept 2: Bidirectional PTY Telemetry Channel

**Idea:** Use the **PTY itself as a data channel** for app-to-shell communication beyond stdin/stdout.

**How:**
```rust
// App sends "meta-commands" via special escape sequences
// Shell plugin intercepts and acts on them

// Example: App tells shell to set prompt before exiting
print!("\x1b]1337;SetPrompt=	Return to shell\x1b\\");

// Example: App requests shell to run command after exit
print!("\x1b]1337;RunOnExit=cd /tmp\x1b\\");
```

**Novel because:** PTY is treated as dumb pipe. This makes it a **control channel**.

**Complexity:** Medium (requires shell integration)
**Value:** Medium (smoother app→shell handoff)

---

### Concept 3: Dynamic Font Metric Negotiation

**Idea:** Query terminal for **actual font dimensions** and adjust layout accordingly.

**How:**
```rust
// 1. Print known-width text, measure cursor delta
print!("WWWW");  // 4 wide chars
let delta = measure_cursor_movement();  // Should be 8 cells

// 2. If delta != 8, font has non-standard aspect ratio
let aspect_ratio = delta as f32 / 4.0;

// 3. Adjust graphics rendering for actual aspect ratio
render_circle(..., aspect_ratio_correction: aspect_ratio / 2.0);
```

**Novel because:** TUIs assume 1:2 cell aspect ratio. Some fonts/terminals differ.

**Complexity:** Low
**Value:** Medium (correct graphics on all terminals)

---

### Concept 4: Terminal "Dark Mode" Detection

**Idea:** Detect terminal background color to auto-select light/dark theme.

**How:**
```rust
// Method 1: Query DSR (Device Status Report)
// Some terminals respond with background color
print!("\x1b[?11t");  // Request background color
// Response: \x1b]11;rgb:RRRR/GGGG/BBBB\x1b\\

// Method 2: Heuristic - probe with invisible color, measure readability
// If low contrast, assume similar background

// Method 3: Check environment clues
let dark_mode = env::var("GTK_THEME")
    .map(|t| t.contains("dark"))
    .unwrap_or(true);  // Assume dark by default
```

**Novel because:** Most TUIs hardcode theme or require manual flag. Auto-detection is rare.

**Complexity:** Low
**Value:** Medium (better UX, zero config)

---

### Concept 5: Escape Sequence Compression

**Idea:** **Compress repeated escape sequences** using terminal-specific abbreviations.

**How:**
```rust
// Instead of:
// "\x1b[38;2;255;128;64m" (12 bytes for one color)

// Use terminal-specific short forms:
// kitty: "\x1b[38:2:255:128:64m" (11 bytes, slightly shorter)
// Or define custom abbreviations in startup

// Better: Track current state, omit redundant codes
struct EscapeEncoder {
    current_fg: Option<Color>,
    current_bg: Option<Color>,
    current_attrs: Attributes,
}

impl EscapeEncoder {
    pub fn set_color(&mut self, fg: Color) -> String {
        if self.current_fg == Some(fg) {
            return String::new();  // Already set, no code needed
        }
        self.current_fg = Some(fg);
        fg.to_ansi()
    }
}
```

**Novel because:** All TUIs emit full escape sequences every time. Stateful compression is unused.

**Complexity:** Medium
**Value:** High (30-50% bandwidth reduction for complex TUIs)

---

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Terminal Capability Detection from Blessed, Brackets, and Kittym

Blessed's `tput.js` demonstrates parsing terminfo/termcap databases and compiling capability entries into usable sequences — a critical primitive for any framework that must work across xterm, rxvt, screen, tmux, and Linux virtual console. The terminfo capability model (`cup`, `clear`, `el`, `ed`, `smcup`, `rmcup`, `smkx`, `rmkx`, `civis`, `cnorm`, `sgr0`) provides the canonical vocabulary. Brackets-lib's `BTermPlatform` trait abstracts this into a backend seam: every feature flag (crossterm, curses, opengl, webgpu) is a terminal capability boundary. Kitty/WezTerm papers show modern terminals as capability-rich: truecolor (24-bit), hyperlinks (OSC 8), bracketed paste, focus reporting, kitty graphics (OSC 1337), sixel, and kitty keyboard protocol (CSI ?u). Urwid's 14 display modules (curses, raw, escape, HTML, LCD, web) demonstrate the practical range of capability levels a single framework must support. The detection sequence from tcell is representative: check `TERM` env → probe for color support → send query sequences → build capability profile → enable features progressively. Textual goes further: detects terminal size, validates color support, checks for unicode availability, and degrades gracefully for non-terminal output (piping to file renders styled markup as plaintext). The "progressive enhancement" pattern from the kitty-protocol paper is the canonical approach: start with basic ANSI, detect capabilities, enable features progressively, always have fallback. CACA and libtcod demonstrate the lowest-common-denominator baseline: 7-bit ASCII + cursor movement is sufficient for full functionality.

### Practical Capability Detection Sequence
```
1. Send CSI > 0 q (secondary DA)
2. Parse response: CSI > terminal_version; build_features
3. Query specific: CSI ?u (kitty kbd), DCS + p (sixel), OSC 52 (clipboard)
4. Probe true color: write \x1b[38;2;R;G;B m and observe if terminal responds
5. Build capability profile: { truecolor: bool, kitty_graphics: bool, ... }
6. Enable features progressively; always have ANSI fallback for every code path
```

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Embedded PTY Spawner from Canopy

Canopy's Tauri backend demonstrates a production-grade embedded terminal lifecycle:

**PTY initialization:**
```rust
let pair = pty_system
    .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
    .map_err(|e| format!("Failed to open PTY: {}", e))?;
let child = pair.slave.spawn_command(cmd).map_err(|e| ...)?;
// Drop slave immediately — we use master
drop(pair.slave);
let reader = pair.master.try_clone_reader()?;
let writer = pair.master.take_writer()?;
```

**Environment sanitization (avoids nested Claude sessions):**
```rust
cmd.env_clear();
for (key, value) in std::env::vars() {
    if key.starts_with("CLAUDECODE") || key.starts_with("CLAUDE_CODE") { continue; }
    if key == "PATH" { continue; }
    cmd.env(key, value);
}
cmd.env("PATH", ensure_full_path());
cmd.env("TERM", "xterm-256color");
```

**CLI availability detection pattern:**
```rust
let full_path = ensure_full_path(); // augment PATH with ~/.local/bin, Homebrew, nvm, etc.
let which = std::process::Command::new("which").arg("claude").env("PATH", &full_path) ...;
```

**Why this matters for TUI fundamentals:** Any framework launching interactive tools must inherit the correct shell environment, avoid environment variable leakage from the parent process, and handle terminal-probe layouts.

## 4.2 Terminal Size Negotiation From Canopy to Embedding App

Canopy handles terminal resize by propagating dimensions from xterm.js to the PTY backend:

```typescript
const ro = new ResizeObserver(() => {
  const { width, height } = container.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  fitAddon.fit();
  resizeTerminal(termId, xterm.rows, xterm.cols);
});
ro.observe(container);
```

This implements the canonical bidirectional resize contract: frontend observes DOM -> frontend fits xterm -> frontend informs backend -> backend resizes PTY -> subprocess receives SIGWINCH.

---

# PART 5: CROSS-CORPUS TERMINAL FUNDAMENTALS SYNTHESIS

## 5.1 Escape Sequence Architecture: The Five Prefixes

Every TUI speaks the same language. The corpus reveals five control sequence prefixes that form the complete vocabulary:

| Prefix | Name | Escape | Use Case |
|--------|------|--------|----------|
| CSI | Control Sequence Introducer | `ESC[` | Cursor movement, colors, screen control |
| OSC | Operating System Command | `ESC]` | Window titles, hyperlinks, clipboard |
| APC | Application Program Command | `ESC_` | Application-specific commands (kitty) |
| PM  | Privacy Message | `ESC^` | Private messages (kitty) |
| SOS | Start of String | `ESCX` | String passthrough |

**CSI sub-types by final byte:**
```
ESC[ ... @  →  Insert characters (ICH)
ESC[ ... A  →  Cursor up (CUU)
ESC[ ... B  →  Cursor down (CUD)
ESC[ ... C  →  Cursor forward (CUF)
ESC[ ... D  →  Cursor back (CUB)
ESC[ ... H  →  Cursor position (CUP)
ESC[ ... J  →  Erase in display (ED)
ESC[ ... K  →  Erase in line (EL)
ESC[ ... m  →  Select graphic rendition (SGR)
ESC[ ... q  →  Cursor style (DECSCUSR)
```

**OSC parameter format:** `ESC]number;contentBEL` or `ESC]contentST` (string terminator = ESC\)

Kitty protocol uses APC for graphics: `ESC_Gparams;dataESC\` — this is the escape sequence that enables inline image display without sixel.

## 5.2 Unicode Cell Width: The Three-Way Split

Three frameworks (tcell, urwid, blessed) converge on the same cell width model, but implement it differently:

**Tcell** — `Cell` struct with `CurrRunes []rune`, `Style Style`, `Width int`. Width is stored per-cell. `GetWidestRawWidth()` handles CJK. Combining characters are stored as additional runes in the slice with width 0.

**Urwid** — `wcwidth(char)` returns 0 (combining), 1 (narrow), 2 (wide). Text layout engine (`text_layout.py`, 643 lines) wraps text by summing `wcwidth()` per character. Supports `space`, `any`, `clip`, `ellipsis` wrap modes. CJK handling since 2004.

**Blessed** — `lib/unicode.js` handles wide character detection, emoji width, grapheme cluster awareness, and astral plane support. Uses `UnicodeWidthChar` equivalent.

**The rule:** Never use `len(string)` for terminal layout. Always use cell-width summation. The `unicode-width` crate (Rust), `wcwidth` (C/Python), or equivalent is non-negotiable for any TUI that handles non-ASCII text.

**Combining character pattern from tcell:**
```go
type Cell struct {
    CurrRunes []rune  // [base, combining1, combining2, ...]
    Style     Style
    Width     int     // 0 for combining, 1 for narrow, 2 for wide
}
```

## 5.3 Double-Buffer Rendering: The Universal Pattern

Every framework in the corpus uses the same rendering pipeline. The implementation varies; the algorithm does not:

```
1. Render widgets → back buffer (off-screen)
2. Compare back buffer ↔ front buffer (diff)
3. Build minimal escape sequence output for changed cells only
4. Single write() to terminal
5. Swap buffers
```

**Blessed** calls this "damage tracking" — dirty widgets are collected, rendered to back buffer, diffed against front buffer, and only changed cells produce escape sequences. BCE (back-color-erase) reduces output further by using the terminal's background color erase attribute.

**Tcell** implements dirty tracking as `[]bool` parallel to `[]Cell`. `Show()` iterates cells and skips clean ones. `Sync()` forces full refresh.

**Urwid** uses `Canvas` as the rendering unit. Every widget's `render()` returns a `Canvas` (TextCanvas, SolidCanvas, CompositeCanvas). `CacheCanvas` memoizes expensive renders. The display backend's `draw_screen(canvas)` handles the diff.

**Bracket-lib** uses `VirtualConsole` for off-screen buffering with `DrawBatch` for batched rendering. `SparseConsole` adds memory efficiency for mostly-empty screens.

**Key insight:** The diff algorithm is what separates a 60fps TUI from a 10fps TUI. Full-screen redraws on every frame are O(rows × cols). Damage tracking is O(changed cells).

## 5.4 PTY Lifecycle: From Spawn to Reap

The corpus reveals a complete PTY lifecycle model synthesized from urwid's VTerm, Canopy's portable-pty, and tcell's screen abstraction:

**Spawn:**
```
1. openpty() → (master, slave) pair
2. slave.spawn_command(cmd) → child process
3. drop(slave) — close slave fd immediately
4. master.try_clone_reader() → reader handle
5. master.take_writer() → writer handle
6. Store (master, writer, child) as the PTY triple
```

**Environment setup (from Canopy):**
```
- Clear env, rebuild from std::env::vars()
- Strip CLAUDECODE* / CLAUDE_CODE* (prevent nested sessions)
- Override PATH with augmented version (~/.local/bin, Homebrew, nvm)
- Set TERM=xterm-256color (clamp for consistency)
- Inject provider-specific vars (AWS_REGION, etc.) if needed
```

**Resize propagation:**
```
Frontend detects size change → fitAddon.fit() → compute rows/cols
→ resizeTerminal(id, rows, cols) → ioctl(TIOCSWINSZ) on master PTY
→ kernel sends SIGWINCH to child → child redraws
```

**Reap:**
```
child.kill() → SIGTERM to child process
reader loop exits when master EOF
drop(master) → close fd
emit Exit event to frontend
```

**Why the triple matters (from Canopy):** Keeping master (for reads/ioctl), writer (for writes), and child (for signals) as separate handles gives precise control. Merging them couples lifecycle decisions — you can't resize after dropping the master, but you can still kill the child.

## 5.5 Terminal Backend Comparison Matrix

The corpus covers 6 distinct terminal backend strategies. Here's the cross-reference:

| Framework | Language | Backend Strategy | Terminfo | True Color | Unicode | Mouse | Bracketed Paste |
|-----------|----------|-----------------|----------|------------|---------|-------|-----------------|
| Blessed | JS | Program abstraction + tput.js | ✅ Full parser | ✅ 24-bit | ✅ CJK + emoji | ✅ | ❌ |
| Bracket-lib | Rust | BTermPlatform trait (4 backends) | Via crossterm | ✅ 24-bit | ✅ | ✅ | Via crossterm |
| Tcell | Go | Screen interface + tscreen impl | ✅ Built-in | ✅ 24-bit | ✅ CJK + combining | ✅ | ✅ EventPaste |
| Urwid | Python | 14 display modules | Via curses | ✅ 24-bit | ✅ CJK (20y) | Via raw | Via raw |
| Kitty-protocol | Spec | Escape sequence spec | N/A | ✅ 24-bit | ✅ | ✅ Extended | ✅ Clipboard |
| Canopy | Rust/TS | portable-pty + xterm.js | Via xterm | ✅ Via xterm | ✅ Via xterm | Via xterm | Via xterm |

**Key takeaway:** Every production TUI needs a backend abstraction layer. The specific mechanism varies (trait, interface, display module, program object), but the pattern is universal: separate terminal I/O from application logic so you can swap backends (curses ↔ raw ↔ web ↔ GPU) without rewriting the app.

## 5.6 Terminal Capability Detection: Complete Probe Sequence

Synthesizing the detection logic from all six sources into a single canonical sequence:

```
Phase 1: Environment
  ├── TERM env var → base capability estimate
  ├── COLORTERM env var → truecolor hint
  ├── TERM_PROGRAM env var → emulator-specific features
  └── LC_ALL / LANG → Unicode locale hint

Phase 2: Query Sequences
  ├── CSI > 0 q → Secondary DA (terminal version + features)
  ├── CSI ? u  → Kitty keyboard protocol support
  ├── DCS + p   → Sixel graphics support
  ├── OSC 52     → Clipboard read/write
  └── CSI 11 t   → Background color query (xterm)

Phase 3: Probe & Measure
  ├── Print wide char (Ā), measure cursor delta → Unicode width support
  ├── Write truecolor SGR, observe rendering → Truecolor confirmation
  ├── Send bracketed paste start/end → Paste mode support
  └── Measure response latency → Emulator fingerprint

Phase 4: Build Profile
  CapabilityProfile {
    truecolor: bool,
    unicode_wide: bool,
    unicode_combining: bool,
    kitty_keyboard: bool,
    kitty_graphics: bool,
    sixel: bool,
    bracketed_paste: bool,
    clipboard: bool,
    mouse: bool,
    cols: usize,
    rows: usize,
    cell_aspect_ratio: f32,
  }
```

**Progressive enhancement rule (from kitty-protocol paper):** Start with basic ANSI (CSI + SGR). Enable features only after detection. Every feature code path must have an ANSI fallback. Never assume a capability based on TERM alone — always probe.

---
