# GUIDE_TO_TUI.md
## The Complete Guide to Building Advanced, Responsive, "Alive" Terminal User Interfaces

> **For:** Developers building high-throughput, multi-modal applications with terminal interfaces
> **Goal:** Production-quality TUIs that feel *alive* through natural movement, effects, and rendering

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Terminal Fundamentals](#terminal-fundamentals)
3. [Rendering Architecture](#rendering-architecture)
4. [Layout Systems](#layout-systems)
5. [Input Systems](#input-systems)
6. [State Management](#state-management)
7. [Animation Systems](#animation-systems)
8. [Scrolling Systems](#scrolling-systems)
9. [Text Rendering](#text-rendering)
10. [Widget Architecture](#widget-architecture)
11. [Multi-Pane Workspaces](#multi-pane-workspaces)
12. [Effect Pipelines](#effect-pipelines)
13. [Data Visualization](#data-visualization)
14. [Theming Systems](#theming-systems)
15. [Accessibility](#accessibility)
16. [Performance Engineering](#performance-engineering)
17. [Concurrency Architecture](#concurrency-architecture)
18. [Persistence & State Hydration](#persistence--state-hydration)
19. [Plugin Architecture](#plugin-architecture)
20. [Production Runtime](#production-runtime)
21. [Implementation Roadmap](#implementation-roadmap)
22. [Common Pitfalls Master Reference](#common-pitfalls-master-reference)

---

## Executive Summary

Building a TUI that feels "alive" requires abandoning the naive approach of string concatenation in favor of a **unified framebuffer architecture** with **procedural animation engines**. This guide synthesizes lessons from 18+ TUI frameworks (notcurses, Bubble Tea, Rich, libtcod, bracket-lib, terminaltexteffects, and more) into a practical, language-neutral roadmap.

### Key Insights

1. **Your UI framework is your CONTROL PLANE, not your graphics engine**
   - Use it for input handling, state management, and widget layout
   - Delegate rendering to a dedicated framebuffer

2. **Animation must happen OUTSIDE the View/Render function**
   - String rebuild every frame = stutter
   - Animate in a persistent framebuffer, display the result

3. **Terminal capability negotiation is mandatory**
   - Detect braille, sextants, truecolor, kitty protocol at runtime
   - Degrade gracefully when features aren't supported

4. **Procedural > Prebuilt**
   - Generative motion (noise fields, vector fields) feels more alive than hardcoded animations
   - Parameterized effects adapt to application states dynamically

5. **Every production TUI needs a backend abstraction layer**
   - Separate terminal I/O from application logic
   - Swap backends (curses ↔ raw ↔ web ↔ GPU) without rewriting the app

---

## Terminal Fundamentals

### The Terminal Stack

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

### Terminal Emulators (Capability Ranking)

| Emulator | Truecolor | Kitty Protocol | Sixel | GPU Accel | Unicode | Notes |
|----------|-----------|---------------|-------|-----------|---------|-------|
| kitty | ✅ | ✅ | ✅ | ✅ | ✅ | Best overall |
| wezterm | ✅ | ❌ | ✅ | ✅ | ✅ | Lua scripting |
| foot | ✅ | ❌ | ✅ | ❌ | ✅ | Wayland-native |
| alacritty | ✅ | ❌ | ❌ | ✅ | ✅ | Fast, minimal |
| iTerm2 | ✅ | ❌ | ✅ | ❌ | ✅ | macOS |
| Windows Terminal | ✅ | ❌ | ❌ | ❌ | Partial | Improving |

**Critical:** Your `TERM` variable must match. `TERM=xterm-256color` ≠ `TERM=kitty`. Many users run kitty with `TERM=xterm-256color` — probe, don't assume.

### The Five Escape Sequence Prefixes

Every TUI speaks the same control sequence language:

| Prefix | Name | Escape | Use Case |
|--------|------|--------|----------|
| CSI | Control Sequence Introducer | `ESC[` | Cursor movement, colors, screen control |
| OSC | Operating System Command | `ESC]` | Window titles, hyperlinks, clipboard |
| APC | Application Program Command | `ESC_` | Application-specific (kitty graphics) |
| PM | Privacy Message | `ESC^` | Private messages (kitty) |
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

**OSC parameter format:** `ESC]number;contentBEL` or `ESC]contentST` (ST = `ESC\`)

**Kitty protocol uses APC for graphics:** `ESC_Gparams;dataESC\` — enables inline image display without sixel.

### Essential Escape Sequences

**Cursor Control:**
```
\x1b[row;colH   Move cursor to position
\x1b[nA          Move up n lines
\x1b[?25l        Hide cursor
\x1b[?25h        Show cursor
\x1b[s           Save cursor position
\x1b[u           Restore cursor position
```

**Color Control:**
```
\x1b[31m         16 ANSI colors
\x1b[38;5;196m   256-color palette
\x1b[38;2;R;G;Bm Truecolor (24-bit)
```

**Screen Control:**
```
\x1b[2J          Clear screen
\x1b[K           Clear to end of line
\x1b[?1049h      Enter alternate screen buffer
\x1b[?1049l      Exit alternate screen buffer
```

### Terminal Capability Detection: Complete Probe Sequence

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

**Progressive enhancement rule:** Start with basic ANSI (CSI + SGR). Enable features only after detection. Every feature code path must have an ANSI fallback. Never assume a capability based on TERM alone — always probe.

### Unicode Cell Width: The Three-Way Split

Never use `len(string)` for terminal layout. Always use cell-width summation.

| Character | Type | Cell Width |
|-----------|------|------------|
| `A` | Latin | 1 |
| `中` | CJK | 2 (wide) |
| `́` (combining accent) | Combining | 0 |
| `🎉` (emoji) | Emoji | 2 (wide) |
| `⡇` (Braille) | Symbol | 1 |

**The rule:** Use `unicode-width` (or `wcwidth` in C/Python) — it is non-negotiable for any TUI handling non-ASCII text.

**Combining character pattern:** Store `[base, combining1, combining2, ...]` per cell with width 0 for combining runes. This is how tcell, urwid, and blessed all handle it.

### The PTY Layer

Your TUI doesn't talk to the terminal directly — it talks through a **pseudo-terminal (PTY)**:

```
Your App → PTY Master → Kernel → PTY Slave → Terminal Emulator
```

**Implications:**
1. **Buffering:** Output is buffered by the PTY (typically 4KB)
2. **Flow control:** XON/XOFF (^S/^Q) can freeze your app
3. **Signal handling:** SIGWINCH for resize, SIGINT for Ctrl+C

**Disable canonical mode for raw input.** Disable echo so your app controls all output. Handle SIGWINCH to detect resize.

### Terminal Fingerprinting (Behavioral Detection)

`$TERM` is often wrong (e.g., `TERM=xterm-256color` in kitty). Build a **probabilistic fingerprint** based on behavioral responses:

1. Send probe sequences (query color support, Unicode width, sixel)
2. Measure timing responses (different emulators have different latencies)
3. Build fingerprint: `{ truecolor: 0.95, unicode_wide: 1.0, sixel: 0.0, latency_ms: 2.3 }`
4. Match against known terminal profiles

### Escape Sequence Compression (Stateful Encoding)

All TUIs emit full escape sequences every time. Stateful compression saves 30-50% bandwidth:

**Pattern:** Track current terminal state; omit redundant codes:

```
If current_fg == requested_fg → emit nothing (already set)
If current_bg == requested_bg → emit nothing
If current_attrs == requested_attrs → emit nothing
```

This is low complexity, high value for complex TUIs.

### Terminal "Dark Mode" Detection

Auto-detect terminal background to select theme:

**Method 1 — DSR query:** `\x1b[?11t` → response `\x1b]11;rgb:RRRR/GGGG/BBBB\x1b\\` (xterm, kitty)
**Method 2 — Environment:** Check `GTK_THEME`, `AppleInterfaceStyle` (macOS)
**Method 3 — Default:** Assume dark (most terminal users run dark mode)

---

## Rendering Architecture

### The Rendering Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Application  │ →  │ Framebuffer  │ →  │ ANSI Output  │
│    State     │    │   (Cells)    │    │  (Terminal)  │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
  What to show    How to represent    How to transmit
```

### ❌ The Naive Approach (Don't Do This)

```
View() {
    s = "Header\n"
    for item in items:
        s += "  " + item + "\n"     // String concat every frame
    s += "Footer"
    return s
}
```

**Problems:**
- O(n) string allocation every frame
- No dirty tracking (redraws everything)
- Animation requires rebuilding entire tree
- GC pressure causes stutter

### ✅ The Advanced Approach (Do This)

```
View() {
    // 1. Tell framebuffer what changed
    renderer.UpdateState(&appState)
    // 2. Framebuffer renders to persistent buffer, returns ANSI
    return renderer.Render()
}
```

### Cell Structure: The Complete Model

Production cells need these fields:

| Field | Type | Purpose |
|-------|------|---------|
| glyph | char | Primary character (U+0000 if part of wider cell) |
| width | u8 | Display columns: 0 (combining), 1 (narrow), 2 (CJK/emoji) |
| fg | RGB | Foreground color (24-bit) |
| bg | RGB | Background color (24-bit) |
| attrs | bitflags | Bold, italic, underline, strikethrough, etc. |
| link | Optional | OSC 8 hyperlink (URL + optional ID) |
| combining | char[] | Zero-width combining runes (accents, emoji modifiers) |

### Double-Buffer Rendering: The Universal Pattern

Every high-performance TUI framework uses the same algorithm. Implementation varies; the pipeline does not:

```
1. Render widgets → back buffer (off-screen)
2. Compare back buffer ↔ front buffer (diff)
3. Build minimal escape sequence output for changed cells only
4. Single write() to terminal
5. Swap buffers
```

**This is what separates 60fps from 10fps.** Full-screen redraw is O(rows × cols). Damage tracking is O(changed cells).

**Verified across:** Blessed ("damage tracking"), Tcell (`Show()` diff), Urwid (Canvas validity), Bracket-lib (`DrawBatch` + `present()`), Notcurses (per-plane dirty `ncplane_render()`), Termflix (per-cell `dirty: Vec<bool>`).

### Dirty Region Tracking

**Per-cell tracking:** Maintain a parallel `dirty: Vec<bool>` alongside `cells: Vec<Cell>`. On flush, only emit ANSI where `dirty[i] == true`.

**Coarse rect coalescing:** Scan row-by-row, merge horizontally-adjacent dirty cells into rectangles. This cuts cursor-move escapes by 5-10x.

**Cell-level diffing:** Compare `front_buffer[i]` vs `back_buffer[i]`. Only output cells that actually changed.

**Color state tracking:** Cache the last-emitted fg/bg/attrs. Skip redundant SGR codes. This compounds with dirty tracking for significant bandwidth reduction.

### Layered Rendering (Z-Ordered Compositing)

Multiple overlapping buffers composited together:

| Blend Mode | Formula (per channel) | Use Case |
|-----------|----------------------|----------|
| Normal | `top` | Default layering |
| Multiply | `top * bottom / 255` | Shadowing, darkening |
| Screen | `255 - (255-top)(255-bottom)/255` | Glow effects |
| Add | `min(top + bottom, 255)` | Light effects, sparkles |
| Overlay | Multiply where dark, Screen where light | Textured backgrounds |

**Implementation:** Sort layers by z-index, composite back-to-front. A watermark layer behind text, an effects layer on top.

### Glyph Encoding Strategies

| Encoding | Resolution | Characters | Use Case |
|----------|------------|------------|----------|
| ASCII | 1x1 | ` .:-=+*#%@` | Universal fallback |
| Block (half) | 2x1 | `▀▄█` | Simple gradients |
| Quadrants | 2x2 | `▖▗▘▙` | Medium detail |
| Braille | 4x2 | `⡇⣿` (U+2800-28FF) | **High detail, 256 patterns** |
| Sextants | 3x2 | `🬀🬁🬂` (U+1FB80-1FBAF) | Unicode 13+, smooth gradients |
| Octants | 4x2 | `🬌🬍🬎` (U+1FB00-1FB47) | Unicode 16+, finest detail |
| Partial blocks | 1x variable | `▏▎▍▌▋▊▉` | Sub-cell vertical resolution (9 levels) |
| Kitty Inline | Pixel | PNG via APC escape | Images, logos (terminal-dependent) |

**Braille encoding algorithm:**
```
pixel_block = 2x4 pixel grid → 8 bits
mask = 0
for each pixel (i = 0..7):
    if pixel[i].alpha > 128: mask |= (1 << i)
glyph = U+2800 + mask
```

**Resolution-adaptive glyph selection (novel):** Per-cell dynamic encoding based on content. High variance regions use braille; smooth gradients use sextants; solid areas use block. All existing TUIs pick ONE encoding globally; per-cell adaptive selection gives 8x fidelity where needed.

### Character Selection for Image Rendering

**Brightness-to-character mapping:**
- ASCII: `[' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']`
- Extended: `' ░▒▓█'`
- Braille: U+2800 through U+28FF (256 patterns, 8 dots per cell)
- Partial blocks: `'▏▎▍▌▋▊▉'` (9 levels per cell width)

**Floyd-Steinberg error diffusion** (from LibCACA): Distribute each pixel's quantization error to neighbors for smooth gradients with limited character sets.

### Color System Primitives

The color systems across all frameworks converge on the same hierarchy:

| Level | Description | Coverage |
|-------|-------------|----------|
| 16 ANSI | 8 normal + 8 bright | Universal baseline |
| 256-color | 16 ANSI + 6×6×6 color cube + 24 grayscale | Good coverage |
| 24-bit truecolor | RGB, 16M colors | Most modern terminals |

**Color pair / style object pattern:** fg/bg combination as a single semantic unit, compiled once and cached. Avoid repeated string formatting of escape sequences — compile the Style to an ANSI string once, reuse.

### Predictive Frame Interpolation (Novel)

Render intermediate frames between state updates for smooth motion. Even with 10 FPS state updates, interpolation enables visual 60 FPS.

**Algorithm:**
```
On new state:
    prev_state = next_state
    next_state = new_state
    interpolation_t = 0.0

Each render frame:
    interpolated = lerp(prev_state, next_state, interpolation_t)
    interpolation_t = min(interpolation_t + 0.016, 1.0)  // 60 FPS
```

### Semantic Render Priority (Novel)

Render important content first, stream progressively:

| Priority | Content | Behavior |
|----------|---------|----------|
| Critical | User cursor, active line | Render + flush immediately |
| High | Visible text | Render next |
| Medium | Decorative elements | Render after |
| Low | Background, watermarks | Render last |

Progressive rendering = faster perceived response time. All current TUIs render everything before flushing.

---

## Layout Systems

### The Box Model for TUIs

```
┌────────────────────────────────────────┐
│           Margin (external)            │
│  ┌──────────────────────────────────┐  │
│  │         Border                   │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │        Padding             │  │  │
│  │  │  ┌──────────────────────┐  │  │  │
│  │  │  │      Content         │  │  │  │
│  │  │  └──────────────────────┘  │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Total width** = margin.left + margin.right + border_width×2 + padding.left + padding.right + content_width

### Flexbox-Style Layout

| Property | Values | Meaning |
|----------|--------|---------|
| direction | row, column, row-reverse, column-reverse | Main axis |
| wrap | no-wrap, wrap, wrap-reverse | Overflow behavior |
| justify | start, end, center, space-between, space-around, space-evenly, stretch | Main axis alignment |
| align_items | same as justify | Cross axis alignment |
| grow | float | How much to grow relative to siblings |
| shrink | float | How much to shrink when space is tight |
| basis | int | Initial size before distribution |

**Algorithm:** Calculate total basis, determine free space, distribute by grow (expanding) or shrink (contracting) ratios.

### Grid Layout

| Track Type | Meaning |
|-----------|---------|
| Fixed(n) | Exactly n cells |
| Fractional(f) | f fraction of available space (1fr, 2fr) |
| Auto | Sized by content |
| MinMax(min, max) | Bounded by range |

**Algorithm:** Resolve fixed tracks first → distribute remaining to fractional → auto tracks get leftovers or content size.

### Constraint-Based Layout (Cassowary)

Define constraints as relations between dimensions. Solver finds optimal solution. Handles conflicting constraints by priority.

**Constraint types:** Equal, Min, Max, Ratio (widget A is 0.3x width of widget B), Align.

### Responsive Layout Patterns

**Breakpoint-based:**
| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Small | < 60 cells | Single column |
| Medium | 60-120 cells | Two column |
| Large | > 120 cells | Three column |

**Progressive enhancement:** Start with essential content. Add sidebar at 60+, status bar at 100+, preview pane at 140+.

### Content-Aware Layout with Semantic Priorities (Novel)

| Semantic | Behavior | Example |
|----------|----------|---------|
| Critical | Never truncate | Error messages, active input |
| Important | Truncate only if necessary | Current file name |
| Contextual | Can abbreviate | Paths, function names |
| Decorative | Can hide entirely | Icons, watermarks |

Each item has `min_width`, `ideal_width`, and progressive abbreviations. Layout engine degrades intelligently instead of breaking.

### Temporal Layout (Novel)

Layout that **plans animations** when content changes. Instead of instant jumps, each layout change becomes a scheduled animation with from/to rects, duration, and easing function. This makes layout transitions feel alive.

---

## Input Systems

### Terminal Input Modes

| Mode | Characteristics | Use Case |
|------|----------------|----------|
| Canonical | Line-buffered, shell-edited, ^C/^Z handled by OS | CLI tools, simple prompts |
| Raw | Unbuffered, every keypress delivered immediately | Full TUIs, games, editors |

**Always restore terminal state on exit.** Use RAII/defer/try-finally at outermost scope.

### Keyboard Protocols

**Legacy XTerm Protocol:**
```
Arrow Up:    \e[A
Arrow Down:  \e[B
F1-F4:       \eOP, \eOQ, \eOR, \eOS
F5-F12:      \e[15~, \e[17~, etc.
```

**Limitations:** No distinction between Tab and Ctrl+I (same code). No modifier information for most keys. No key release events.

**Kitty Keyboard Protocol (Modern):**
```
Enable:  \x1b[>1u
Format:  \e[27;modifiers;keycode~
Example: \e[27;5;3~ = Ctrl+C (27=key, 5=mods, 3=keycode)
         \e[27;2;9~ = Shift+Tab
```

**Modifier bit encoding:** bit0=Shift, bit1=Alt, bit2=Ctrl, bit3=Super, bit4=Hyper, bit5=Meta

**Key events include:** physical key code, all modifier state, optional Unicode text, event type (Press, Repeat, Release).

### Mouse Input Protocols

**X10 (Basic):** `\e[M` + 3 bytes (button+32, x+32, y+32). Limited to positions < 223.

**SGR (Extended):** `\e[<button;x;yM` (press) or `\e[<button;x;ym` (release). Supports arbitrary positions.

**Enable SGR mouse:**
```
\x1b[?1003h  Any mouse tracking
\x1b[?1006h  SGR format
```

**Disable:**
```
\x1b[?1003l
\x1b[?1006l
```

### Paste Detection (Bracketed Paste)

```
Enable:  \x1b[?2004h
Start:   \x1b[200~
End:     \x1b[201~
```

Without bracketed paste, pasting text that contains control characters (^C, ^D) can trigger application commands instead of inserting text.

### Event Loop Architecture

**Core pattern:** Use poll/select with timeout. On input: parse and dispatch. On timeout: send tick for animations.

**Event types:** Key, Mouse, Resize, Paste, FocusGained, FocusLost, Tick, Custom.

**Focus reporting:** Kitty terminals emit `CSI I` on focus gain and `CSI O` on focus loss. Use this to pause animations or save state when the user switches tabs — free production robustness most TUIs ignore.

### Input Focus and Hit Testing

**Hit test:** For mouse events, walk the widget tree to find which widget contains (x, y), compute local coordinates, identify region (header, content, border).

**Focus management:** Tab order traversal, direction-based navigation (focus the widget closest to current in the requested direction), wrap-around.

### Intent-Based Input (Novel)

Interpret input based on context, not just raw key codes. The same key ('j') means navigation in a list, text entry in an editor, or a command in a terminal. Score intents from multiple detectors, choose highest.

---

## State Management

### The Elm Architecture (Model-Update-View)

```
┌─────────────┐
│     Model   │  ← Application state
└──────┬──────┘
       │
   ┌───▼───┐
   │ Update │  ← Handle messages, return new model + commands
   └───┬───┘
       │
   ┌───▼───┐
   │  View  │  ← Render model to screen
   └───┬───┘
       │
   ┌───▼───┐
   │  Msg   │  ← User input, events, async results
   └───────┘
```

**Key rules:**
- All state changes are explicit, typed messages
- Commands (side effects) are separated from state mutation
- State mutation only happens in the Update function
- View is a pure function of the model

### State Subscription and Reactive Updates

Widgets subscribe to specific state paths. When that path changes, only those widgets re-render. This avoids the "everything re-renders always" problem.

**Subscription pattern:** `subscribe(path="user.preferences.theme", widget_id)` → on update to that path → notify only subscribed widgets.

### Lens-Based Immutable Updates

For deeply nested state, use composed lenses to access and modify fields without manual destructuring:

```
user_lens ∘ preferences_lens ∘ theme_lens
→ modify "user.preferences.theme" in one operation
```

### Undo/Redo with Command Pattern

Each action implements `execute()` and `undo()`. Stack keeps history. **Merge consecutive commands** (e.g., adjacent text edits merge into one undo entry). Trim stack at max size.

### State Persistence and Migration

**Versioned serialization:** Every persisted state includes a version number. On load, run migration chain from old version to current.

**Migration pattern:** Each migration is a function `old_state → new_state`. Chain them in order. Never skip versions.

### Split-Persistence Strategy

Not all state uses the same storage:

| Storage | Use Case | Latency | Reliability |
|---------|----------|---------|-------------|
| Fast file / localStorage | Tab layout, UI state, dismissed items | ~0ms | Survives refresh |
| SQLite / embedded KV | Project data, structured records | ~1ms | ACID, survives crash |
| In-memory only | Undo history, transient focus, buffers | 0ms | Lost on unmount |

**Anti-pattern:** Putting everything in one layer. Persistent UI state in SQLite adds latency for no benefit. Structured data in flat files risks corruption.

### Streaming State for AI Agent UIs

For streaming responses, state is **incrementally revealed**:

1. **Separate streaming state from terminal state**: A spinner's tick cycle and a response buffer are independent
2. **State grows by accumulation**: Append-only (response tokens, output lines) is easier to manage than replacement
3. **Completion is a state transition**: `DoneMsg` is an FSM transition, not a boolean flag
4. **Viewport scroll is separate from content**: User can scroll while content streams

### Derived State Cache (Eval Pattern)

For expensive computed values (syntax highlighting, layout calculations): compute, cache, invalidate when dependencies change (detected by hash comparison). Avoids redundant computation every frame.

### State Management Decision Tree

```
Is your state local to one component?
├── YES → Simple struct fields or reactive attributes
│   └── Need deep nesting? → Lenses
│
└── NO → Does state need to survive restart?
    ├── YES → Structured? → SQLite or KV. Simple? → Flat file.
    │
    └── NO → Shared across boundary?
        ├── YES → Typed IPC + ref-based stale closure fix
        │
        └── NO → Lifecycle with distinct phases?
            ├── YES → FSM
            │   └── Need undo/redo? → Event sourcing
            │
            └── NO → Async/streaming?
                ├── YES → Streaming accumulation + Commands
                │
                └── NO → State Tree with Subscriptions
```

### Agent State Machine

```
Idle → Initializing → Thinking → Executing → {AwaitingInput | Success | Error}
Streaming → Success
Error → Idle (retry)
```

Each transition is logged with timestamp. Duration in current state is trackable. Invalid transitions are rejected.

**Attention state detection pattern:** Scan subprocess output for prompt patterns ("Do you want to proceed?", "Allow once") using rolling buffer + cooldown timer + buffer reset on user input. This derives state from output content rather than explicit events.

---

## Animation Systems

### The "Alive" Formula

```
Alive Motion = Procedural Noise + Event Response + Smooth Interpolation
```

### Animation Loop

Target 60 FPS (16.6ms per frame). Each tick: advance all active animations by delta_ms, remove finished animations, render frame. Sleep between frames to avoid busy-waiting.

### Easing Functions (Standard Set)

| Function | Formula | Feel |
|----------|---------|------|
| linear | t | Mechanical |
| ease_in_quad | t² | Slow start, fast end |
| ease_out_quad | t(2-t) | Fast start, slow end |
| ease_in_out_quad | 2t² if t<0.5, else -1+(4-2t)t | Smooth both ends |
| ease_in_cubic | t³ | Dramatic slow start |
| ease_out_cubic | 1-(1-t)³ | Dramatic slow end |
| ease_out_elastic | Sine-based overshoot | Springy, playful |
| ease_out_bounce | Piecewise quadratic | Bouncing ball |

**Rule:** Never jump instantly between values. Always interpolate with easing.

### Tweening

Interpolate any tweenable value (number, color, position) over time with easing:

```
current_value = start.lerp(end, easing(elapsed / duration))
```

**Tweenable types:** f32, Color (per-channel lerp), Vec2 (per-component lerp). Extend to any type by implementing lerp.

### Procedural Noise (Organic Base Motion)

Use **Perlin noise** or **Simplex noise** for natural, non-repetitive motion:

```
breathing_offset(time_ms, seed):
    x = perlin_noise_2d(time_ms * 0.001, 0.0, seed)
    y = perlin_noise_2d(time_ms * 0.001, 100.0, seed)
    return (x * 2.0, y * 1.0)  // 2 cells max displacement
```

### Event-Response Animation

Animate on meaningful events:

| Event | Animation |
|-------|-----------|
| Agent starts thinking | Watermark "gaze" shifts toward activity |
| Code diff streams in | Scroller wave propagates |
| Error occurs | Red spark particles from error location |
| Success | Confetti burst + green glow |
| User scrolls | Subtle parallax on background |
| Focus gained | Restart paused animations |
| Focus lost | Pause animations, save state |

### Particle Systems

**Particle structure:** position, velocity, acceleration, lifetime, max_lifetime, color, size, glyph.

**Emitter types:** Point, Circle (radius), Line (start→end), Burst (count + angle).

**Template:** velocity range, lifetime range, color gradient over time, size range.

**Physics:** Apply gravity, drag, and velocity each frame. Decay alpha by lifetime progress. Remove dead particles.

### Decay and Fade Systems

Apply physics per frame: velocity += gravity × dt, velocity *= (1 - drag × dt), position += velocity × dt. Fade color toward background as lifetime progresses. Shrink size over time. Remove when size < threshold or lifetime exceeded.

### Effect Composition DSL

Define animations declaratively, load at runtime:

```yaml
widget: watermark
trigger: agent_thinking
effects:
  - type: gaze_shift
    target: activity_center
    duration: 300ms
    easing: ease_out_quad
  - type: color_pulse
    from: "#888888"
    to: "#00FF00"
    loop: true
    frequency: 0.5hz
  - type: position_wave
    axis: y
    amplitude: 1
    wavelength: 10
    speed: 0.3
```

---

## Scrolling Systems

### Scroll State Machine

Track current offset, target offset, max offset, viewport dimensions, drag state. `scroll_by(dy, dx)` sets new target (clamped to valid range). `update(smooth_factor)` lerps current toward target.

**Operations:** page_up, page_down, home, end — all set target, not current. Smooth scrolling lerps current to target.

### Physical Scroll Physics

Velocity-based scrolling with friction, responsiveness, and snap modes:

| Snap Mode | Behavior |
|-----------|----------|
| None | Free scrolling |
| Integer | Snap to whole lines |
| Half | Snap to half lines |
| Pixel | Sub-line precision |

**Momentum:** On mouse drag, track velocity. On release, continue scrolling with exponential friction decay.

### Smooth Scrolling Algorithms

| Algorithm | Formula | Feel |
|-----------|---------|------|
| Lerp | current += (target - current) × factor | Smooth, simple |
| Spring | accel = (target - current) × stiffness; velocity += accel; velocity *= damping | Physical, bouncy |
| Overshoot | current += displacement × 0.2 + overshoot × 0.1 | Playful overshoot |

### Virtual Viewport

For content larger than the viewport, maintain a virtual coordinate system. Map content coordinates to viewport coordinates: `viewport_pos = content_pos - scroll_offset`. Only render visible region.

### Scroll Anchors and Sticky Elements

Widgets can be anchored at a position within the viewport. When they would scroll off-screen, they become sticky (pinned). Useful for headers, section titles.

### Overscroll Effects

| Effect | Visual |
|--------|--------|
| Bounce | Content bounces back from edge |
| Stretch | Content stretches beyond limit |
| Glow | Edge glow indicator |
| Elastic | Spring-back animation |

---

## Text Rendering

### Style Attributes (SGR Codes)

| Attribute | SGR Code | Terminal Support |
|-----------|----------|-----------------|
| Bold | 1 | Universal |
| Dim | 2 | Universal |
| Italic | 3 | Most modern |
| Underline | 4 | Universal |
| Blink | 5 | Universal (avoid) |
| Reverse | 7 | Universal |
| Hidden | 8 | Most |
| Strikethrough | 9 | Most modern |

**Compiled style pattern:** Combine all active codes into single SGR: `\x1b[1;3;38;2;255;128;64m` (bold + italic + orange). Compile once per style, cache.

### Rich Text and Markup

Parse inline markup into styled segments with a style stack:

1. Encounter `[bold]` → push Bold onto style stack
2. Encounter `[/bold]` → pop from style stack
3. Emit text runs with accumulated style

**Support:** `[bold]`, `[italic]`, `[underline]`, `[fg:#FF6B00]`, `[bg:#1A1B26]`, `[link:url]`.

### Text Operations

| Operation | Algorithm |
|-----------|-----------|
| Measure width | Sum of `cell_width(char)` for each character |
| Truncate | Walk chars, sum widths, stop at max. Append `…` if room. |
| Wrap | Word-by-word, start new line when word would exceed width |
| Center | `(viewport_width - text_width) / 2` padding |

### Color Systems

**RGB construction:** From hex string `#RRGGBB` or `#RGB`. With optional alpha channel.

**Color operations:**
- Blend(a, b, t): per-channel `a*(1-t) + b*t`
- Darken(color, amount): `color * (1 - amount)`
- Lighten(color, amount): `blend(color, WHITE, amount)`
- Complementary: shift hue by 180°
- Text-for-background: use relative luminance; > 0.5 → BLACK, else WHITE

---

## Widget Architecture

### Widget Interface

Every widget implements:
- `id()` — unique identifier
- `render(framebuffer)` — draw to buffer
- `layout(constraints)` → LayoutResult (rect + overflow flag)
- `handle_event(event)` → list of Actions
- `min_size()`, `preferred_size()` — size hints
- `is_focusable()`, `focus()`, `blur()` — focus lifecycle

### Container Widgets

**Container:** Wraps a child with padding, border, margin, background. Layout reduces constraints by padding+border before delegating to child.

**Stack:** Vertical, horizontal, or overlay arrangement of children.

**Flex:** Directional layout with grow/shrink/basis distribution and configurable gap.

### Primitive Widgets

| Widget | Key Properties |
|--------|---------------|
| Text | content, style, wrap, max_width, align |
| Button | label, style (normal/hover/pressed/disabled) |
| Input | value, cursor_pos, placeholder, max_length, password |
| Select | options, selected_index, is_open |
| Checkbox | label, is_checked |
| Progress | value, max, style (bar/spinner) |

### Focus/Blur as State Machine

Every focusable component has `on_focus` and `on_blur` handlers. On focus: restore cursor, load draft, show help. On blur: validate, persist draft, release resources. This is a micro-FSM embedded in every field.

---

## Multi-Pane Workspaces

### Pane Structure

A pane is a widget container with: id, rect, widget, title, border style, focus state, visibility, z-index, min/max size constraints.

### Border Styles

| Style | Characters | Look |
|-------|-----------|------|
| Simple | `┌─┐│└─┘` | Clean |
| Double | `╔═╗║╚═╝` | Bold |
| Rounded | `╭─╮│╰─╯` | Soft |
| Thick | `┏━┓┃┗━┛` | Heavy |
| ASCII | `+-+\|++` | Portable |

### Pane Manager Operations

- `split_horizontal(pane, ratio)` — divide pane left/right
- `split_vertical(pane, ratio)` — divide pane top/bottom
- `close_pane(pane)` — remove and grow adjacent to fill
- `focus_pane(pane)` — set focus, update focus stack
- `focus_next()` — cycle to next pane (spatial or sequential)

### Layout Strategies

| Strategy | Description |
|----------|-------------|
| Grid | Fixed N×M arrangement |
| Flex | Fluid, adapts to content |
| Tabbed | One visible at a time with tab bar |
| Stacked | Overlapping with tab select |
| Absolute | User-defined positions |

### Focus Navigation

Direction-based focus: navigate(Left/Right/Up/Down) using an adjacency graph. Next/Previous cycling through focus order.

---

## Effect Pipelines

### Built-in Composable Effects

| Effect | Trigger | Rendering |
|--------|---------|-----------|
| Particle emitter | Error, success, interaction | Sparks, confetti, trails |
| Easing functions | Any transition | 50+ standard curves |
| Decay / fade | Transient elements | Alpha fade, size shrink |
| Text morph | Content changes | Diff-based character animation |
| Waveform scroller | Live output | Streaming wave pattern |
| Color pulse | State change | Oscillating color shift |
| Position wave | Idle/decorative | Sinusoidal displacement |
| Gaze shift | Activity detection | Directional offset change |

### Effect Pipeline Architecture

Effects run in the animation loop, outside the View function. Each effect:
1. Checks trigger condition
2. Advances state by delta_ms
3. Writes to a dedicated overlay layer in the framebuffer
4. Self-removes when finished

---

## Data Visualization

### Core Chart Types

| Type | Variants | Best For |
|------|----------|----------|
| Line | smooth/linear, with/without points | Trends over time |
| Bar | vertical/horizontal, grouped/stacked | Comparisons |
| Scatter | variable point size | Correlations |
| Heatmap | custom color scales | 2D density |
| Histogram | cumulative | Distributions |
| Gauge | with zones | Single metric |
| Area | filled/partial | Cumulative trends |
| Candlestick | with wick | OHLC data |
| Radar | normalized | Multi-axis comparison |

### Terminal Graphics Primitives

**Bresenham's line algorithm** — the standard for drawing lines in cell grids:

```
dx = |x1 - x0|, dy = |y1 - y0|
err = dx - dy
Step toward endpoint, adjust err, plot cell at each step
```

**Rectangle drawing** with box-drawing characters for corners.

### Color Scales

| Interpolation | Character | Use When |
|--------------|-----------|----------|
| RGB | Simple, fast | Most cases |
| HSV | Hue-aware | Rainbow palettes |
| LAB | Perceptually uniform | Scientific data |
| LCh | Most perceptually uniform | Publication quality |

**Color scale definition:** Array of (position, color) stops. Interpolate between adjacent stops for any value 0.0-1.0.

---

## Theming Systems

### Theme Architecture

A theme is a composition of:
- **Color palette:** primary, secondary, success, warning, danger, info + background/surface + on-primary/on-background + neutral scale (50-900)
- **Typography:** font family, size, line height, letter spacing, weights
- **Spacing scale:** unit + progression (0, 1, 2, 3, 4, 6, 8, 12, 16, 24)
- **Semantic colors:** text-primary, text-secondary, text-disabled, border-default, border-focused, border-error, shadow
- **Widget themes:** per-widget style overrides

### Theme Switching at Runtime

Register listeners. On theme change: notify all listeners → re-render affected widgets. Persist selected theme name.

**Auto-detection:** Query OS dark/light setting. On Linux: `GTK_THEME` env var. On macOS: `defaults read -g AppleInterfaceStyle`. On Windows: registry check.

### Theme File Format (YAML)

```yaml
name: "Tokyo Night"
version: "1.0.0"
colors:
  primary: "#7aa2f7"
  secondary: "#bb9af7"
  success: "#9ece6a"
  warning: "#e0af68"
  danger: "#f7768e"
  background: "#1a1b26"
  surface: "#16161e"
  on_primary: "#1a1b26"
  on_background: "#c0caf5"
```

### Contrast Requirements

| Level | Ratio | Application |
|-------|-------|-------------|
| AA Normal | 4.5:1 | Body text |
| AA Large | 3:1 | Headings, large text |
| AAA Normal | 7:1 | Maximum readability |
| Non-text | 3:1 | UI components, borders |

---

## Accessibility

### ARIA Roles for TUIs

Map TUI widgets to semantic roles for screen reader and accessibility tree consumers:

| TUI Widget | ARIA Role |
|-----------|-----------|
| Alert bar | alert |
| Button | button |
| Checkbox | checkbox |
| Dialog/modal | dialog / alertdialog |
| Grid/table | grid |
| Link | link |
| List | listbox |
| Menu | menu / menuitem |
| Progress bar | progressbar |
| Radio group | radio |
| Slider | slider |
| Spin input | spinbutton |
| Status bar | status |
| Tab | tab / tablist |
| Text input | textbox |
| Timer | timer |
| Tooltip | tooltip |

### ARIA Attributes

| Attribute | Purpose |
|-----------|---------|
| label | Accessible name |
| description | Extended description |
| valuenow/valuemin/valuemax | For sliders, progress bars |
| checked | For checkboxes, radios |
| disabled | Non-interactive |
| hidden | Excluded from tree |
| live (polite/assertive/off) | Dynamic content announcements |

### Screen Reader Bridge

- `announce(text)` — queue text for speech
- `announce_priority(text)` — interrupt current speech
- Process queue when not speaking

### Keyboard Navigation

Full keyboard navigability is mandatory. Tab order traversal, arrow-key spatial navigation, Escape to close/dismiss. Every interactive element must be reachable.

### High Contrast Mode

Black background, white text, yellow primary. Border width increased. Focus indicator: underline or bold border. Never rely on color alone to convey information.

---

## Performance Engineering

### Profiling Metrics

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| FPS | 58-60 | 30-57 | < 30 |
| Frame time p95 | < 17ms | 17-33ms | > 33ms |
| Dirty cell ratio | < 0.1 | 0.1-0.5 | > 0.5 |
| Escape bytes per frame | < 2KB | 2-10KB | > 10KB |

**p95 frame time** is the metric that matters for perceived smoothness, not average.

**Dirty cell ratio:** changed cells / total cells per frame. Below 0.1 = efficient. Above 0.5 = something is wrong.

### Dirty Region Tracking (Performance-Critical)

This is the **core optimization** that makes 60fps TUIs possible.

**Algorithm:**
1. Maintain `cells[]`, `prev_cells[]`, `dirty[]` (parallel arrays)
2. On mutation: set cell, mark dirty
3. Before flush: scan dirty rows, coalesce horizontally-adjacent dirty cells into rectangles
4. Flush: for each dirty rect, move cursor, emit ANSI for changed cells only
5. After flush: clear dirty flags, swap cells↔prev_cells

**Key insight from Termflix:** Without dirty tracking at 200×60, full writes hit 12K+ chars per frame. Dirty tracking reduces this to O(changed cells).

### Double-Buffering

Render to back buffer, diff against front buffer, emit minimal delta, swap. Every high-performance TUI uses this (verified across 12 of 22 analyzed repos).

### Frame Limiter

Cap at 60 FPS. Without limiting, a tight render loop hits 1000+ FPS and causes the **terminal emulator** to consume more CPU than your app. Sleep the remaining frame time.

### Terminal Output Rate Ceiling

At 80×24, a full-screen write is ~2000 characters — well within bandwidth. At 200×60, full writes hit 12K+ chars where dirty tracking becomes critical.

**TerminalTextEffects' canonical optimization recipe:**
1. Cache ANSI code compilations (style → string, computed once)
2. Batch character output (emit runs of same-style characters together)
3. Minimize cursor moves (coalesce adjacent writes)
4. Batch writes to avoid flushes between every escape sequence

---

## Concurrency Architecture

### The Golden Rule

**All I/O happens in worker threads or async tasks. The main thread only processes messages from a queue.**

### Threading Model

| Thread | Responsibility |
|--------|---------------|
| Render | Build frames, write to terminal at 60 FPS |
| Input | Read stdin, parse escape sequences, post events |
| Event | Process events, update state, trigger re-renders |
| Workers | Shell commands, network requests, file operations |

### Async Event Loop Pattern

```
loop:
    select:
        input from stdin → parse → post event
        tick interval (16ms) → post Tick for animations
        event from queue → handle → update state → trigger render
```

### Task Management

Tasks have: id, kind, priority, status, creation/start/finish timestamps.

**Status progression:** Queued → Running(progress%) → Completed | Failed | Cancelled | Pending

**Priority queue** for task scheduling. **Max concurrent** limit prevents overload.

### Connection Resilience

**Retry policy:** max retries, initial delay, max delay, exponential backoff factor.

**Circuit breaker:** Three states — Closed (normal), Open (refusing requests), Half-Open (testing recovery). Failure threshold triggers Open. Recovery timeout allows Half-Open test.

### Network-Aware Constraints

For streamed output (SSE, WebSockets, logs): flow socket reads into the same event surface as stdin via a task queue. For slow requests: show a spinner or progress bar, not a frozen screen.

**Minimal primitive set:** single `NetworkClient` with timeout + retry, one task queue, and a failure taxonomy (`Timeout`, `ConnectionRefused`, `HttpError{code}`, `ParseError`) that the UI can render meaningfully.

---

## Persistence & State Hydration

### Serialization Formats

| Format | Human-Readable | Size | Speed | Use When |
|--------|---------------|------|-------|----------|
| JSON | Yes | Large | Medium | Debugging, config files |
| MessagePack | No | Small | Fast | Network, compact storage |
| CBOR | No | Small | Fast | IoT, constrained environments |
| Protobuf | No | Smallest | Fastest | High-volume, schema-required |

### Migration Strategies

Chain of migration functions, each upgrading one version. Never skip versions. Current version number stored in persisted data.

### Cache Strategies

**LRU Cache:** Fixed capacity. On get: move to front. On put: if at capacity, evict from back. Optional TTL for time-based invalidation.

**Atomic writes:** Write to temp file, then rename. Prevents corruption on crash.

### Time-Travel Debugging

Automatic state snapshots at regular intervals. Each snapshot stores: timestamp, state (or delta from previous), checksum. Enable rewinding, replaying, and exporting timeline for analysis.

---

## Plugin Architecture

### Plugin Interface

Every plugin implements:
- `name()`, `version()` — identity
- `init(context)` — receive host context on load
- `shutdown()` — cleanup on unload
- `on_event(event)` → list of actions — react to events
- `render(framebuffer)` — draw to shared buffer

### Plugin Manager

Register/unregister plugins. Init on register, shutdown on unregister. Load order respected. Events dispatched to all plugins in order.

### Hot-Swappable Plugins (Novel)

Load/unload widget plugins at runtime without restart. Watch file modification time; reload when changed. Enables instant development iteration.

**Sandboxing requirement:** Plugin failures must not crash the host. Isolate plugin state. Use trait interfaces for loose coupling.

---

## Production Runtime

### Terminal Lifecycle Pipeline

Every production TUI must execute this precise sequence:

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

**Production rule:** Always use defer/RAII/try-finally at the outermost scope. Never rely on the application to manually call shutdown steps.

### Signal Handling

| Signal | Action | Notes |
|--------|--------|-------|
| SIGINT | Post Quit message | Interceptable (e.g., "save changes?") |
| SIGTERM | Post Quit message | Graceful shutdown |
| SIGWINCH | Query new size, post Resize | Mandatory for responsiveness |
| SIGTSTP | Restore terminal, background | Suspend support |
| SIGCONT | Re-enter raw mode, post Resume | Resume support |

**Focus events** (CSI I / CSI O) let the TUI pause animations or save state when the terminal loses focus.

### PTY Lifecycle

```
Spawn:
  openpty() → (master, slave) pair
  slave.spawn_command(cmd) → child process
  drop(slave) — close slave fd immediately
  master.try_clone_reader() → reader handle
  master.take_writer() → writer handle
  Store (master, writer, child) as the PTY triple

Resize:
  Frontend detects size change → fit to container
  → compute rows/cols → ioctl(TIOCSWINSZ) on master PTY
  → kernel sends SIGWINCH to child → child redraws

Reap:
  child.kill() → SIGTERM
  reader loop exits on master EOF
  drop(master) → close fd
  emit Exit event
```

**Why the triple matters:** Keeping master (reads/ioctl), writer (writes), and child (signals) as separate handles gives precise control.

### Health Monitoring

| Check | Threshold | Status |
|-------|-----------|--------|
| Average frame time | < 16.6ms | Healthy, else Degraded |
| Memory usage | < 500MB | Healthy, else Degraded |
| Error rate | < 1% | Healthy, else Failing |

### Self-Healing Runtime (Novel)

Automatically detect and recover from component failures. Supervisor restarts failed components up to max retries, then escalates. Enables uninterrupted operation.

---

## Implementation Roadmap

### Phase 1: Framebuffer Core

Persistent cell buffer with dirty tracking. Layer support. Double-buffered diff.

### Phase 2: Glyph Encoders

ASCII fallback, braille encoder, sextant encoder, block encoder, kitty image encoder. Resolution-adaptive selection.

### Phase 3: Procedural Animation Engine

Noise functions (Perlin, Simplex, Value). Easing library (50+ functions). Drawable trait. Animation loop with tick.

### Phase 4: Input & Event System

Raw mode management with RAII guard. Kitty keyboard protocol parser. SGR mouse parser. Bracketed paste handler. Event dispatch.

### Phase 5: Layout Engine

Flexbox algorithm. Grid algorithm. Constraint solver (Cassowary). Responsive breakpoints. Semantic content priority.

### Phase 6: Widget Library

Primitives (Text, Button, Input, Select, Checkbox, Progress). Containers (Stack, Flex, Grid). Multi-pane manager. Tab management.

### Phase 7: State Management

Elm architecture (Model-Update-View). State tree with path subscriptions. Lens-based updates. Command pattern for undo/redo. Streaming state for agent UIs.

### Phase 8: Effects Library

Particle emitter + decay. Easing-based tweening. Text morph transitions. Waveform scroller. Declarative effect DSL.

### Phase 9: Theming & Accessibility

Theme architecture with runtime switching. YAML theme files. ARIA roles. Screen reader bridge. High contrast mode. Keyboard navigability.

### Phase 10: Production Hardening

Terminal lifecycle pipeline. Signal handlers. PTY management. Health monitoring. Persistence with migration. Plugin architecture. Performance profiling.

---

## Common Pitfalls Master Reference

| Pitfall | Why It Fails | Solution |
|---------|--------------|----------|
| Animation in View/Render | String rebuild = GC stutter | Animate in FB, render the result |
| SIXEL as primary renderer | <30% terminal support | Use only for optional previews |
| Layout system for motion | Grid-snapped, no sub-pixel | Use procedural engine for motion |
| Monolithic engine | Wrong abstraction, unmaintainable | Modular adapters + composable effects |
| Hardcoded effects | Can't adapt to state | Generative, parameterized effects |
| Assuming capabilities | Breaks on unknown terminals | Detect + negotiate at runtime |
| Rendering everything | Wastes CPU on unchanged regions | Dirty region tracking |
| No frame rate limit | 1000 FPS = wasted battery | Cap at 60 FPS, sleep between frames |
| Not handling SIGWINCH | App breaks on resize | Register signal handler |
| Assuming 80x24 | Layout breaks on large terminals | Query actual size |
| Not restoring terminal | Terminal broken after exit | RAII/defer/try-finally guard |
| Hardcoding ANSI codes | Breaks on unknown terminals | Use capability detection |
| Ignoring wide chars | Text misaligned | Use unicode-width / wcwidth |
| Full redraw every frame | Stutter, high CPU | Dirty tracking + double buffer |
| No double buffering | Tearing on updates | Front/back buffer swap |
| Fixed-width layouts | Break on small/large terminals | Flex/grid with fractional units |
| No minimum sizes | Content gets crushed | Add min-width constraints |
| Not restoring terminal on crash | Terminal left in raw mode | RAII guard at outermost scope |
| Assuming 8-bit input | Unicode input breaks | UTF-8 parser |
| Ignoring paste mode | Pasted ^C exits app | Enable bracketed paste |
| Blocking reads | UI freezes | Poll/select with timeout |
| Mutable shared state | Race conditions | Immutable updates or message passing |
| No subscription filtering | Everything re-renders | Subscribe to specific state paths |
| Blocking state updates | UI freezes during save | Async commands |
| No undo support | User mistakes are fatal | Command pattern |
| Version incompatibility | Old saves crash new app | Migration layer |
| Blocking network | UI freeze | Async I/O |
| No timeout | Hangs indefinitely | Connection timeout |
| No retry logic | Fails on transient errors | Exponential backoff |
| Mutation inside View | Stuttering re-renders | Separate render from animation state |
| Stale closures in callbacks | See old state | Ref pattern or Elm architecture |
| Single storage for all state | Latency for transient, corruption for structured | Split persistence |
| No semantic roles | Screen reader confused | Add ARIA roles |
| Low color contrast | Unreadable for colorblind | Check contrast ratios |
| No keyboard shortcuts | Mouse-only users excluded | Full keyboard nav |
| No live announcements | Screen reader misses updates | Live regions |
| No signal handling | Zombie processes | Handle SIGTERM/SIGINT |
| No health checks | Silent failures | Expose health status |
| No graceful shutdown | Data loss | Flush on exit |
| Plugin crashes host | One bad plugin kills app | Sandbox plugin failures |
| Tight plugin coupling | Hard to update | Trait/interface boundaries |
| No plugin lifecycle | Memory leaks | Cleanup on unload |
