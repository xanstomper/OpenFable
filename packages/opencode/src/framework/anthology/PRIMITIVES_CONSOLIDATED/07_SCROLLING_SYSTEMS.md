# 07_SCROLLING_SYSTEMS.md
## Cross-Cutting Analysis: Scrolling Primitives Across 22 TUI Repositories

> **Focus:** Every primitive, pattern, and implementation related to scrolling, viewport management, content offset, scrolling regions, and scrollback — extracted from the full corpus of 22 analyzed repositories.
> **Scope:** Not a single-repo report. This is a topic-oriented synthesis. File N enriches this report only when its primitives pertain to scrolling.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scoping the Problem](#scoping-the-problem)
3. [Primitive Taxonomy](#primitive-taxonomy)
4. [Architecture Pattern 1: The Viewport](#architecture-pattern-1-the-viewport)
5. [Architecture Pattern 2: Buffer Offset / Content Window](#architecture-pattern-2-buffer-offset--content-window)
6. [Architecture Pattern 3: Terminal Scroll Region (CSR)](#architecture-pattern-3-terminal-scroll-region-csr)
7. [Architecture Pattern 4: Soft vs. Hard Scrolling](#architecture-pattern-4-soft-vs-hard-scrolling)
8. [Architecture Pattern 5: Plane-Based Scrolling](#architecture-pattern-5-plane-based-scrolling)
9. [Scroll Bar Primitives](#scroll-bar-primitives)
10. [Cursor-Scroll Coupling](#cursor-scroll-coupling)
11. [Input Event Mapping](#input-event-mapping)
12. [Language-Specific Implementations](#language-specific-implementations)
13. [Cross-Repository Primitive Matrix](#cross-repository-primitive-matrix)
14. [Implementation Recipe](#implementation-recipe)
15. [What's Missing / Future Work](#whats-missing--future-work)

---

## Executive Summary

Scrolling in TUIs is not one problem — it is at least five distinct sub-problems that most frameworks conflate:

1. **Viewport rendering** — Which portion of a large content buffer is visible on screen right now?
2. **Content offset tracking** — Where does the visible window start within the full content?
3. **Terminal scroll region manipulation** — Using CSR escape sequences to tell the terminal hardware which region to scroll.
4. **Scrollback / history preservation** — Keeping scrolled-away content available for reverse navigation.
5. **Plane/window repositioning** — Moving entire drawing surfaces within a larger virtual canvas.

No single repository nails all five. The Charmbracelet `x/cellbuf` comes closest with its explicit `Screen` type separating soft scroll from hard scroll. Notcurses gets plane-based scrolling right but ignores CSR. Blessed pioneered CSR optimization but conflates it with its damage buffer. Textual's reactive scroll system is the most ergonomic for application developers but hides the underlying primitives.

**Key insight for implementors:** Scrolling is a *rendering* concern, not a *layout* concern. Bubble Tea's `View()` string builder is fundamentally the wrong layer to handle scroll. The framebuffer (or cellbuf) layer must own scroll state, and the view function merely reads it.

---

## Scoping the Problem

A terminal screen is typically 80×24 cells. Content (log output, file contents, data tables) routinely exceeds this by orders of magnitude. Scrolling is the discipline of:

- Mapping a **large logical coordinate space** onto a **small physical viewport**
- Updating that mapping in response to **user input**, **content growth**, and **terminal resize**
- Doing so **without full-screen redraw** on every frame

The minimal state required:

```rust
struct ScrollState {
    /// First visible row (0-indexed) in the content
    offset: usize,
    /// Number of visible rows (viewport height)
    viewport_height: usize,
    /// Total rows in content
    content_height: usize,
    /// Auto-scroll: keep bottom visible when content grows?
    stick_to_bottom: bool,
}
```

Every framework either explicitly or implicitly maintains this state. The differences lie in *where*, *how exposed*, and *what triggers mutations*.

---

## Primitive Taxonomy

| # | Primitive | Repos | Complexity | Category |
|---|-----------|-------|------------|----------|
| P1 | Viewport viewport.Model | viewport (Bubbles), Textual (ScrollableContainer) | Low | Rendering |
| P2 | Buffer offset / content window | Bubbles (textinput, table), Urwid (ListBox) | Low | State |
| P3 | Terminal CSR (Change Scroll Region) | Blessed (program.js), alacritty | Medium | Protocol |
| P4 | Soft scroll (preserve history) | x/cellbuf (Screen + SoftBuffer) | Medium | Buffer Mgmt |
| P5 | Hard scroll (discard history) | x/cellbuf (HardScroll), cmatrix | Low | Buffer Mgmt |
| P6 | Plane repositioning | notcurses (ncplane_move_yx), libtcod (blit offset) | Medium | Compositing |
| P7 | Scroll bars | Rich (progress indicators), Blessed (scrollablebox) | Low | Widget |
| P8 | Cursor-scroll coupling | tcell, ncurses wscrl, kitty protocol | Low | Input |
| P9 | Mouse wheel → scroll mapping | Textual, tcell, kitty protocol | Low | Input |
| P10 | Parallax / multi-region scroll | GUIDE_TO_TUI (advanced) | High | Effect |

---

## Architecture Pattern 1: The Viewport

**Found in:** Bubbles `viewport`, Textual `ScrollableContainer`, Urwid `ListBox`, Rich `Live`

The viewport is the most common scroll abstraction: a fixed-size window over a larger content buffer, with explicit `ScrollUp(n)` / `ScrollDown(n)` methods.

**Bubbles `viewport.Model` (reference implementation):**

```go
type Model struct {
    Width         int
    Height        int
    YOffset       int    // First visible row
    YPosition     int    // Cursor position in content (for keyboard nav)
    HighPerformance bool // Skip rendering unchanged lines
}

func (m *Model) ScrollUp(n lines) {
    m.YOffset = max(0, m.YOffset - n)
    m.GotoBottom() // After manual scroll, release stick-to-bottom
}

func (m *Model) ScrollDown(n lines) {
    m.YOffset = min(m.maxScroll(), m.YOffset + n)
}

func (m *Model) maxScroll() int {
    return max(0, len(m.contentLines) - m.Height)
}
```

**Textual's reactive approach:**

```python
# Textual auto-computes scroll from content size
scroll_y = reactive(0, layout=True)  # Triggers re-layout on change

def watch_scroll_y(self, old: float, new: float) -> None:
    # Auto-called when scroll_y changes
    self.refresh()
```

**Urwid's approach (oldest, most explicit):**

Urwid doesn't have a single viewport widget. Instead, container widgets (`Frame`, `Pile`) expose a `focus` index that determines which child widget is visible. Scrolling is achieved by shifting the `focus` position:

```python
# Urwid: move focus to change visible region
pile = urwid.Pile([header, body, footer])
pile.focus_position = 1  # Focus on body
```

**Key difference:** Urwid ties scrolling to *widget focus* rather than a pixel/row offset. This is elegant for small widget lists but clunky for large text buffers.

**Rich `Live` display (implicit scrolling):**

```python
with Live(refresh_per_second=4) as live:
    live.update(renderable)  # Each update implicitly scrolls if content grows
    # Live handles the terminal scroll when overflow occurs
```

Rich's `Live` uses terminal scrolling (newline + terminal auto-scroll) for overflow. There is no explicit scrollback — just terminal emulator history.

**Takeaway:** The viewport pattern is universal. The key design decision is whether scroll state is owned by the widget (Bubbles model), the layout engine (Textual reactive), the focus system (Urwid), or is implicit in terminal behavior (Rich).

---

## Architecture Pattern 2: Buffer Offset / Content Window

**Found in:** Bubbles `textinput`, Bubbles `table`, Urwid `Canvas`

When content is stored in a flat buffer but only a portion is visible, the offset tracks where the visible window starts:

```rust
struct ContentWindow {
    buffer: Vec<Cell>,       // Full content
    cols: usize,             // Content width
    rows: usize,             // Content height (may be virtual/infinite)
    view_top: usize,         // First visible row
    view_left: usize,        // First visible column (for horizontal scroll)
    view_height: usize,      // Visible rows
    view_width: usize,       // Visible columns
}
```

**Bubbles `textinput` (horizontal offset):**

```go
type Model struct {
    value    []rune
    pos      int   // Cursor position
    offset   int   // Horizontal scroll offset
    width    int   // Visible width
}

// handleOverflow adjusts offset when cursor goes out of view
func (m *Model) handleOverflow() {
    if m.pos < m.offset {
        m.offset = m.pos
    }
    if m.pos >= m.offset + m.width {
        m.offset = m.pos - m.width + 1
    }
}
```

**Bubbles `table` (virtual scrolling):**

```go
// Table uses viewport for row virtualization
// Only visible rows are rendered each frame
type Model struct {
    rows     []Row
    cursor   int
    viewport viewport.Model  // Composes the viewport primitive
}

func (m Model) View() string {
    visibleRows := m.rows[m.viewport.YOffset : m.viewport.YOffset+m.viewport.Height]
    for _, row := range visibleRows {
        // render row
    }
}
```

**Urwid `Canvas` (region-based):**

Urwid's canvas system is unique: canvases carry their own coordinate space and are clipped during composition:

```python
# Canvas rendering with offset
canvas = widget.render(size)
# Clip to visible region
top = canvas[view_top:view_top + view_height]
# Render clipped canvas
```

**Takeaway:** Buffer offset is the lowest-level scroll primitive. Every higher-level abstraction (viewport, scroll region, plane) ultimately reduces to an offset + clip operation on a backing buffer.

---

## Architecture Pattern 3: Terminal Scroll Region (CSR)

**Found in:** Blessed `program.js`, alacritty, kitty

The terminal itself has hardware scrolling capability. The CSR escape sequence (`\x1b[top;bottomr`) tells the terminal which rows form the scrollable region. Content within that region scrolls when a line feed or index command reaches the bottom.

**Blessed's implementation (the gold reference):**

```javascript
// From Blessed program.js — Change Scroll Region
program.csr = function(top, bottom) {
    // Escape sequence: ESC [ top ; bottom r
    this.output('\x1b[' + (top + 1) + ';' + (bottom + 1) + 'r');
};

// Use CSR + scroll to implement efficient scroll within a sub-region
program.scroll = function(offset) {
    if (offset > 0) {
        // Scroll up: insert lines at bottom
        this.csr(top, bottom);
        this.cup(bottom, 0);       // Move cursor to bottom of region
        for (let i = 0; i < offset; i++) {
            this.nl();             // Newline scrolls region
        }
    } else if (offset < 0) {
        // Scroll down: insert lines at top
        this.csr(top, bottom);
        this.cup(top, 0);
        for (let i = 0; i < -offset; i++) {
            this.il();             // Insert line
        }
    }
};
```

**Why CSR matters:**

Without CSR, scrolling requires rewriting every visible cell — O(rows × cols) escape sequences. With CSR, scrolling is O(1) (one escape sequence + N newlines for N lines). The terminal hardware does the row shuffling.

**Limitation:** CSR affects the *entire terminal's* scroll region. If you set CSR to rows 5–20, scrolling happens only there, and rows 1–4 and 21+ remain static. Perfect for a header/body/footer layout. Problematic for multiple independently-scrollable panes.

**Kitty's approach:** Kitty extends CSR with *independent scroll margins* per pane, via its multi-pane protocol:

```
# Kitty: set scroll margins for a specific pane
# ESC[<pane_id>;top;bottomr
```

**Kitty also supports DECSTBM** (DEC Set Top-Bottom Margins) which is the standard xterm equivalent of CSR:

```bash
# Set scroll region to lines 2-23
printf '\x1b[2;24r'

# Reset (full screen scroll)
printf '\x1b[r'
```

**Comparison:**

| Feature | CSR (standard) | Kitty multi-pane |
|---------|---------------|-----------------|
| Standard | xterm DECSTBM | Kitty extension |
| Regions | 1 per terminal | 1 per pane |
| Escape | `ESC[top;bottomr` | `ESC[<pane>;top;bottomr` |
| Fallback | Universal | Kitty-only |

**Takeaway:** CSR is the most efficient scroll primitive but supports only one scroll region. For multi-pane TUIs, you need either multiple planes (each with its own buffer) or Kitty's extended protocol.

---

## Architecture Pattern 4: Soft vs. Hard Scrolling

**Found in:** x/cellbuf `Screen`, cmatrix, Blessed

This distinction is critical and most repos ignore it:

**Soft scrolling** preserves scrolled-away content. The buffer grows or maintains old data. Scrolling back up reveals previous content. Terminal emulators do this natively (scrollback buffer).

**Hard scrolling** discards scrolled-away content. When content scrolls up past the top, those rows are gone. The buffer window shifts.

**x/cellbuf `Screen` (the definitive Go implementation):**

```go
type Screen struct {
    Buffer       *Buffer    // Visible buffer (what's on screen)
    SoftBuffer   *Buffer    // Off-screen buffer for soft scroll
    Cursor       image.Point
    Origin       image.Point // Scroll origin (for soft scroll)
    HardScroll   bool       // Toggle: soft vs hard
}

// Soft scroll: content preserved in SoftBuffer
func (s *Screen) SoftScrollUp(n int) {
    for i := 0; i < n; i++ {
        // Move top line of SoftBuffer, shift visible buffer
        copy(s.Buffer.Cells[0:], s.Buffer.Cells[1:])
        s.Buffer.Cells[len(s.Buffer.Cells)-1] = s.getBlankRow()
    }
}

// Hard scroll: content discarded
func (s *Screen) HardScrollUp(n int) {
    for i := 0; i < n; i++ {
        // Just shift buffer — top rows are lost
        copy(s.Buffer.Cells[0:], s.Buffer.Cells[1:])
        s.Buffer.Cells[len(s.Buffer.Cells)-1] = s.getBlankRow()
    }
}
```

**cmatrix (hard scroll example):**

cmatrix uses a ring buffer (hard scroll with wrap). When the matrix rain reaches the bottom, old drops disappear:

```c
// cmatrix: each column independently scrolls
// Old characters fade and vanish — classic hard scroll
for (col = 0; col < maxCol; col++) {
    for (row = maxRow - 1; row > 0; row--) {
        matrix[col][row] = matrix[col][row - 1];  // Shift down
    }
    matrix[col][0] = new_character();  // New character at top
}
```

**Blessed's hybrid approach:**

Blessed uses a damage buffer + CSR. Scrolling affects the back buffer, then diffs are computed. Scrolled-away content stays in the back buffer until the widget is destroyed, giving pseudo-soft-scroll.

**Decision Matrix:**

| Scenario | Use Soft | Use Hard |
|----------|----------|----------|
| Log viewer, terminal output | ✅ | |
| Chat application | ✅ | |
| Matrix rain effect | | ✅ |
| Memory-constrained embedded TUI | | ✅ |
| Real-time data streaming (stick-to-bottom) | ✅ | |
| Multi-pane with history | ✅ | |

**Takeaway:** Most TUIs don't distinguish these. x/cellbuf is the only implementation surveyed that provides both as first-class toggles. This is a design gap in most frameworks.

---

## Architecture Pattern 5: Plane-Based Scrolling

**Found in:** notcurses, libtcod

Instead of scrolling content *within* a buffer, plane-based systems move the entire buffer (plane) relative to the screen:

```c
// notcurses: move a plane vertically
// This is "scrolling" by repositioning the drawing surface
ncplane_move_yx(plane, new_y, new_x);

// Or change the plane's origin within itself
ncplane_set_scrolling(plane, true);  // Enable scroll-by-write
```

**notcurses `ncplane` scroll-by-write:**

When a plane has scrolling enabled, writing to the bottom row automatically scrolls the plane up — hardware-assisted scrolling without explicit scroll calls:

```c
// Enable scrolling on a plane
struct ncplane* n = ncplane_new(...);
ncplane_set_scrolling(n, true);

// Writing past the bottom auto-scrolls
ncplane_putstr_yx(n, ncplane_dim_y(n)-1, 0, "New line\n");
```

**libtcod blit-based scrolling:**

libtcod uses blitting with offsets to simulate scrolling between consoles:

```c
// Blit source console to destination with offset = scroll effect
TCOD_console_blit(
    source_console,
    scroll_x, scroll_y,          // Source offset = scroll position
    width, height,               // Blit dimensions
    dest_console,
    dest_x, dest_y,              // Destination position
    fg_alpha, bg_alpha
);
```

**Key difference from viewport pattern:** Plane-based scrolling moves the *coordinate system*; viewport scrolling moves the *clipping window*. The visual result is the same, but plane-based supports overlapping scrollable regions (each with its own plane), while viewport assumes a single rectangular clip.

---

## Scroll Bar Primitives

**Found in:** Blessed (scrollablebox), Bubbles (viewport yposition indicators), Textual (built-in scrollbars)

**Blessed's scrollbar:**

```javascript
// Blessed scrollablebox: renders scrollbar as a column on the right
var scroll = this.scroll || 0;
var visible = this.height - 2;  // minus borders
var total = this._clines.length;
var thumb = Math.max(1, Math.floor(visible * visible / total));
var position = Math.floor(scroll / (total - visible) * (visible - thumb));

// Render scrollbar column
for (var y = 1; y < this.height - 1; y++) {
    if (y >= position + 1 && y < position + thumb + 1) {
        this.setContent(y, this.width - 2, '█');  // Thumb
    } else {
        this.setContent(y, this.width - 2, '│');  // Track
    }
}
```

**Textual's scrollbar (CSS-driven):**

```css
/* Textual: scrollbar styling via CSS */
ScrollView {
    scrollbar-size-vertical: 1;
    scrollbar-size-horizontal: 0;
    scrollbar-color: #555;
    scrollbar-color-active: #888;
    scrollbar-color-hover: #777;
}
```

**Bubbles viewport (no built-in scrollbar, but YPosition for custom):**

```go
// Bubbles viewport exposes YPosition for custom scrollbar rendering
type YPosition struct {
    YOffset   int
    YPosition int
}

// Custom scrollbar rendering
func renderScrollbar(m viewport.Model, height int) string {
    ratio := float64(m.YOffset) / float64(len(m.contentLines) - m.Height)
    thumbPos := int(ratio * float64(height))
    // Render track + thumb
}
```

**Minimal scrollbar math (language-agnostic):**

```rust
fn scrollbar_geometry(
    content_len: usize,
    viewport_len: usize,
    offset: usize,
    bar_height: usize,
) -> (usize, usize) {
    // Returns (thumb_position, thumb_size)
    let thumb_size = max(1, viewport_len * viewport_len / content_len);
    let max_offset = content_len - viewport_len;
    let thumb_pos = if max_offset > 0 {
        offset * (bar_height - thumb_size) / max_offset
    } else {
        0
    };
    (thumb_pos, thumb_size)
}
```

---

## Cursor-Scroll Coupling

**Found in:** tcell, ncurses, kitty protocol, Bubbles textinput

When the cursor moves beyond the visible area, the viewport must scroll to follow. This coupling is handled differently across repos:

**ncurses (the classic):**

```c
// ncurses: scroll when cursor goes past bottom
// wscrl(win, n) — scroll window by n lines
if (cury(win) > bottom_margin) {
    wscrl(win, cury(win) - bottom_margin);
}
```

**tcell (Go):**

```go
// tcell: no built-in cursor-scroll coupling
// Application must handle it manually
func ensureVisible(screen tcell.Screen, cursorY, scrollOffset, height int) int {
    if cursorY < scrollOffset {
        return cursorY  // Scroll up to cursor
    }
    if cursorY >= scrollOffset + height {
        return cursorY - height + 1  // Scroll down to cursor
    }
    return scrollOffset  // No change needed
}
```

**Bubbles textinput (horizontal coupling):**

```go
// Bubbles textinput: cursor drives horizontal offset
func (m *Model) handleOverflow() {
    if m.pos < m.offset {
        m.offset = m.pos
    } else if m.pos >= m.offset + m.width {
        m.offset = m.pos - m.width + 1
    }
}
```

**Kitty keyboard protocol (scroll on key):**

Kitty's protocol reports scroll events as key events, decoupling scroll from cursor:

```
# Kitty reports mouse scroll as key events:
# Scroll up:    ESC[1;2A  (shift+up)
# Scroll down:  ESC[1;2B  (shift+down)
```

**Takeaway:** Cursor-scroll coupling is an application-level concern in most frameworks. ncurses is the exception — it handles it at the library level via scrollok().

---

## Input Event Mapping

**Found in:** tcell, Textual, kitty protocol, Bubble Tea

| Input | tcell | Textual | Bubble Tea | Kitty Protocol |
|-------|-------|---------|------------|----------------|
| Up arrow | `KeyUp` | `key up` | `tea.KeyUp` | `ESC[A` |
| Down arrow | `KeyDown` | `key down` | `tea.KeyDown` | `ESC[B` |
| PageUp | `KeyPgUp` | `key pageup` | `tea.KeyPgUp` | `ESC[5~` |
| PageDown | `KeyPgDown` | `key pagedown` | `tea.KeyPgDown` | `ESC[6~` |
| Home | `KeyHome` | `key home` | `tea.KeyHome` | `ESC[H` |
| End | `KeyEnd` | `key end` | `tea.KeyEnd` | `ESC[F` |
| Mouse wheel up | `EventMouse(Button4)` | `MouseScrollUp` | `tea.MouseWheelUp` | `ESC[1;2A` |
| Mouse wheel down | `EventMouse(Button5)` | `MouseScrollDown` | `tea.MouseWheelDown` | `ESC[1;2B` |
| Ctrl+U | `KeyCtrlU` | `key ctrl+u` | `tea.KeyCtrlU` | custom |
| Ctrl+D | `KeyCtrlD` | `key ctrl+d` | `tea.KeyCtrlD` | custom |

**Textual's scroll-specific events:**

```python
# Textual: dedicated scroll events (higher-level than key events)
class ScrollUp(Message): ...
class ScrollDown(Message): ...
class ScrollLeft(Message): ...
class ScrollRight(Message): ...
class ScrollTo(Message):  # Jump to specific position
    def __init__(self, x: float | None, y: float | None): ...
```

**Bubble Tea mouse scroll:**

```go
// Bubble Tea: mouse wheel mapped to scroll commands
case tea.MouseMsg:
    switch msg.Button {
    case tea.MouseButtonWheelUp:
        m.viewport.ScrollUp(1)
    case tea.MouseButtonWheelDown:
        m.viewport.ScrollDown(1)
    }
```

---

## Language-Specific Implementations

### Go (Bubbles viewport + x/cellbuf)

The most complete scroll stack in Go:

```
x/cellbuf.Screen    → soft/hard scroll, origin tracking
x/cellbuf.Buffer    → cell grid with dirty tracking
bubbles/viewport    → high-level viewport widget
bubbles/textinput   → horizontal scroll offset
bubbles/table       → virtual row scrolling via viewport
Bubble Tea          → View() string (no scroll — delegate to viewport)
```

### Python (Textual + Urwid + Rich)

```
Textual ScrollableContainer → reactive scroll, CSS overflow
Textual ScrollView          → pixel-precise scroll
Urwid ListBox               → focus-based scrolling
Urwid Canvas                → region clipping
Rich Live                   → terminal auto-scroll (implicit)
```

### C (notcurses + ncurses + libcaca)

```
notcurses ncplane           → plane repositioning, scroll-by-write
ncurses wscrl/wscrl         → window-level scroll
libcaca canvas              → ASCII art canvas with offset
```

### JavaScript (Blessed)

```
Blessed program.js          → CSR optimization, damage buffer
Blessed scrollablebox       → widget with scrollbar
Blessed scrollabletext      → text with scroll
```

### Rust (bracket-lib + termflix)

```
bracket-lib Console         → blit with offset (libtcod-style)
termflix                    → frame buffer with scroll for video
```

---

## Cross-Repository Primitive Matrix

| Primitive | Go (x/cellbuf) | Go (Bubbles) | Python (Textual) | Python (Urwid) | C (notcurses) | JS (Blessed) |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| Viewport widget | ✅ | ✅ | ✅ | ✅ (ListBox) | ❌ | ✅ |
| Buffer offset | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Soft scroll | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hard scroll | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CSR optimization | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Plane reposition | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Scroll-by-write | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Scrollbar widget | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Reactive scroll | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Mouse wheel | ✅ (tcell) | ✅ | ✅ | ❌ | ✅ | ✅ |
| Cursor coupling | ✅ (textinput) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Stick-to-bottom | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Horizontal scroll | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Multi-region scroll | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

**Gap analysis:** No single implementation covers all primitives. The closest is a hypothetical merge of x/cellbuf (soft/hard scroll) + notcurses (planes) + Textual (reactive) + Blessed (CSR).

---

## Implementation Recipe

### Minimal Viable Scrolling (1 day)

```rust
struct ScrollView {
    content: Vec<String>,
    offset: usize,
    height: usize,
}

impl ScrollView {
    fn scroll_up(&mut self, n: usize) {
        self.offset = self.offset.saturating_sub(n);
    }
    fn scroll_down(&mut self, n: usize) {
        let max = self.content.len().saturating_sub(self.height);
        self.offset = (self.offset + n).min(max);
    }
    fn visible_lines(&self) -> &[String] {
        let end = (self.offset + self.height).min(self.content.len());
        &self.content[self.offset..end]
    }
}
```

### Production Scrolling (1 week)

Add:
- **Stick-to-bottom** for log tailing
- **Scrollbar rendering** (thumb + track)
- **Mouse wheel** support
- **PageUp/PageDown** (scroll by viewport height)
- **Home/End** (jump to start/end)
- **Horizontal scroll** for wide content
- **Dirty tracking** (only re-render changed lines)

### Advanced Scrolling (1 month)

Add:
- **Soft scroll** with history buffer
- **Multi-region CSR** (header/body/footer)
- **Smooth scroll animation** (interpolate offset over frames)
- **Parallax scroll** (background moves at different rate)
- **Search-jump** (scroll to match)
- **Scroll sync** (two viewports showing same content, different positions)

---

## What's Missing / Future Work

1. **Scroll animation** — No surveyed repo implements smooth animated scroll (easing the offset over multiple frames). Textual's `animate("scroll_y", ...)` is the closest but it's CSS-transition-based, not frame-interpolated.

2. **Scroll anchoring** — When content above the viewport changes height (e.g., code folding), the scroll offset should adjust to keep the same content row visible. No repo implements this.

3. **Scroll sync / linked scroll** — Two viewports showing different representations of the same content (e.g., code + minimap) that scroll together. Not implemented anywhere in the corpus.

4. **Infinite scroll** — Loading content on-demand as the user scrolls (like a web infinite scroll). Rich's `Live` approximates this for append-only, but true bidirectional infinite scroll is absent.

5. **Scroll gestures** — Touch/pinch-to-zoom scroll for touchscreen terminals. Not applicable to current terminal protocols but relevant for browser-based TUIs (Textual's browser mode).

6. **Scroll-to-search** — Scroll to the next match of a search query. Urwid's `ListBox` supports this via `set_focus`, but no dedicated primitive exists.

7. **Scroll state serialization** — Save/restore scroll position across sessions. Not implemented anywhere.

---

## Key Takeaway

Scrolling is not a widget — it's a *coordinate system transformation* that sits between your content buffer and your rendering pipeline. The best implementations (x/cellbuf, notcurses planes) treat it as a first-class buffer operation. The worst (Bubble Tea `View()` string building) push it to the application layer where it causes O(n) string allocations every frame.

**Build order:**
1. Buffer + offset (day 1)
2. Viewport widget with scroll methods (day 2)
3. Stick-to-bottom + scrollbar (day 3)
4. Soft/hard scroll toggle (week 2)
5. CSR optimization for single-region scroll (week 3)
6. Smooth scroll animation (month 2)

---

*Report synthesized from: x/cellbuf, x/term, Bubbles (viewport, textinput, table), Bubble Tea, Textual, Urwid, notcurses, libtcod, Blessed, tcell, Rich, cmatrix, kitty protocol, alacritty, objcurses, bracket-lib, termflix, libcaca.*
