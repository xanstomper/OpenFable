# Anthology: Rendering Architecture

> **Subject:** Rendering Architecture - how pixels become terminal characters
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Rendering Architecture Mastery

### 2.1 The Rendering Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Application  │ →  │ Framebuffer  │ →  │ ANSI Output  │
│    State     │    │   (Cells)    │    │  (Terminal)  │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                    │
       │                   │                    │
       ▼                   ▼                    ▼
  What to show    How to represent    How to transmit
```

### 2.2 Cell-Based Framebuffer

```rust
pub struct Cell {
    pub glyph: char,
    pub fg: Color,
    pub bg: Color,
    pub attrs: Attributes,  // bold, italic, underline, etc.
}

pub struct Framebuffer {
    pub width: usize,
    pub height: usize,
    pub cells: Vec<Cell>,
    pub dirty: Vec<bool>,  // Track changed cells
}

impl Framebuffer {
    pub fn new(width: usize, height: usize) -> Self {
        Framebuffer {
            width,
            height,
            cells: vec![Cell::default(); width * height],
            dirty: vec![false; width * height],
        }
    }
    
    pub fn set_cell(&mut self, x: usize, y: usize, cell: Cell) {
        let idx = y * self.width + x;
        if self.cells[idx] != cell {
            self.cells[idx] = cell;
            self.dirty[idx] = true;
        }
    }
    
    pub fn render(&mut self) -> String {
        let mut output = String::new();
        let mut last_fg = None;
        let mut last_bg = None;
        
        for y in 0..self.height {
            output.push_str(&format!("\x1b[{};1H", y + 1));  // Move to row start
            
            for x in 0..self.width {
                let idx = y * self.width + x;
                if !self.dirty[idx] {
                    continue;  // Skip unchanged cells
                }
                
                let cell = &self.cells[idx];
                
                // Optimize: only emit color codes if changed
                if Some(cell.fg) != last_fg {
                    output.push_str(&format!("\x1b[38;2;{};{};{}m", cell.fg.r, cell.fg.g, cell.fg.b));
                    last_fg = Some(cell.fg);
                }
                if Some(cell.bg) != last_bg {
                    output.push_str(&format!("\x1b[48;2;{};{};{}m", cell.bg.r, cell.bg.g, cell.bg.b));
                    last_bg = Some(cell.bg);
                }
                
                output.push(cell.glyph);
                self.dirty[idx] = false;
            }
        }
        
        output
    }
}
```

### 2.3 Dirty Region Tracking

**Naive approach:** Render entire screen every frame
**Optimized approach:** Only render changed regions

```rust
pub struct DirtyTracker {
    dirty_cells: HashSet<(usize, usize)>,
    dirty_rects: Vec<Rect>,
}

impl DirtyTracker {
    pub fn mark_dirty(&mut self, x: usize, y: usize) {
        self.dirty_cells.insert((x, y));
        self.merge_into_rects(x, y);
    }
    
    pub fn merge_into_rects(&mut self, x: usize, y: usize) {
        // Find or create rectangle containing this cell
        // Merge adjacent rectangles for efficiency
    }
    
    pub fn take_dirty_regions(&mut self) -> Vec<Rect> {
        std::mem::take(&mut self.dirty_rects)
    }
    
    pub fn clear(&mut self) {
        self.dirty_cells.clear();
        self.dirty_rects.clear();
    }
}
```

### 2.4 Double Buffering

**Problem:** Rendering mid-frame causes tearing
**Solution:** Double buffering with atomic swap

```rust
pub struct DoubleBufferedRenderer {
    front_buffer: Framebuffer,
    back_buffer: Framebuffer,
}

impl DoubleBufferedRenderer {
    pub fn render(&mut self, draw_fn: &dyn Fn(&mut Framebuffer)) -> String {
        // 1. Draw to back buffer
        draw_fn(&mut self.back_buffer);
        
        // 2. Compute diff (what changed)
        let diff = self.compute_diff();
        
        // 3. Render only changes
        let output = self.render_diff(&diff);
        
        // 4. Swap buffers
        std::mem::swap(&mut self.front_buffer, &mut self.back_buffer);
        
        output
    }
    
    fn compute_diff(&self) -> Vec<(usize, usize)> {
        let mut changes = Vec::new();
        for y in 0..self.front_buffer.height {
            for x in 0..self.front_buffer.width {
                let idx = y * self.front_buffer.width + x;
                if self.front_buffer.cells[idx] != self.back_buffer.cells[idx] {
                    changes.push((x, y));
                }
            }
        }
        changes
    }
}
```

### 2.5 Layered Rendering

**Concept:** Multiple Z-ordered buffers composited together

```rust
pub enum BlendMode {
    Normal,
    Multiply,
    Screen,
    Overlay,
    Add,
}

pub struct Layer {
    pub buffer: Framebuffer,
    pub z_index: i32,
    pub blend: BlendMode,
    pub visible: bool,
}

pub struct Compositor {
    pub layers: Vec<Layer>,
}

impl Compositor {
    pub fn composite(&self) -> Framebuffer {
        let mut result = Framebuffer::new(self.width, self.height);
        
        // Sort by Z-index, render back to front
        let mut sorted_layers: Vec<_> = self.layers.iter()
            .filter(|l| l.visible)
            .collect();
        sorted_layers.sort_by_key(|l| l.z_index);
        
        for layer in sorted_layers {
            for y in 0..self.height {
                for x in 0..self.width {
                    let top_cell = &layer.buffer.cells[y * self.width + x];
                    let bottom_cell = &result.cells[y * self.width + x];
                    
                    result.cells[y * self.width + x] = 
                        self.blend_cells(top_cell, bottom_cell, &layer.blend);
                }
            }
        }
        
        result
    }
    
    fn blend_cells(&self, top: &Cell, bottom: &Cell, mode: &BlendMode) -> Cell {
        match mode {
            BlendMode::Normal => *top,
            BlendMode::Multiply => Cell {
                fg: Color {
                    r: (top.fg.r as u16 * bottom.fg.r as u16 / 255) as u8,
                    g: (top.fg.g as u16 * bottom.fg.g as u16 / 255) as u8,
                    b: (top.fg.b as u16 * bottom.fg.b as u16 / 255) as u8,
                },
                ..*bottom
            },
            // ... other blend modes
        }
    }
}
```

### 2.6 Glyph Encoding Strategies

| Encoding | Resolution | Characters | Use Case |
|----------|------------|------------|----------|
| ASCII | 1x1 | ` .:-=+*#%@` | Universal fallback |
| Block | 2x1 | `▀▄█` | Simple gradients |
| Braille | 4x2 | `⡇⣿` (U+2800-28FF) | **High detail** |
| Sextants | 3x2 | `🬀🬁` (U+1FB80-1FBAF) | Unicode 13+ |
| Octants | 4x2 | `🬌🬍` (U+1FB00-1FB47) | Unicode 16+ |

**Braille encoding example:**
```rust
pub fn pixels_to_braille(pixels: &[[bool; 8]]) -> char {
    let mut mask = 0u8;
    for (i, &bit) in pixels.iter().enumerate() {
        if bit {
            mask |= 1 << i;
        }
    }
    (0x2800 + mask as u32) as char
}

// Usage: 2x4 pixel block → 1 Braille character
let pixel_block = [
    [true, false, true, false, false, false, true, false],  // 8 pixels
];
let braille_char = pixels_to_braille(&pixel_block);
// Result: ⡇ (U+2807)
```

### 2.7 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Full redraw every frame | Stutter, high CPU | Use dirty tracking |
| No double buffering | Tearing on updates | Implement front/back buffers |
| Ignoring blend modes | Flat, lifeless UI | Add layer compositing |
| ASCII-only rendering | Low detail graphics | Support Braille/sextants |

---

# PART 2: NOVEL CONCEPTS REPORT

## Rendering Architecture: Untapped Opportunities

### Concept 1: Resolution-Adaptive Glyph Selection

**Idea:** Per-cell **dynamic encoding selection** based on content requirements.

**How:**
```rust
enum GlyphEncoding {
    Ascii(u8),      // Density 0-9
    Braille(u8),    // 8-bit mask
    Sextant(u8),    // 6-subpixel mask
    Block(u8),      // 0-8 fill level
}

fn select_encoding(pixel_variance: f32, color_variance: f32, caps: &Caps) -> GlyphEncoding {
    match (pixel_variance, color_variance, caps) {
        (v, _, _) if v > 0.7 && caps.braille => GlyphEncoding::Braille(compute_braille_mask()),
        (_, v, _) if v > 0.5 && caps.sextants => GlyphEncoding::Sextant(compute_sextant_mask()),
        _ => GlyphEncoding::Block(compute_fill_level()),
    }
}
```

**Novel because:** All TUIs pick ONE encoding globally. Per-cell adaptive selection is unprecedented.

**Complexity:** Medium
**Value:** High (8x fidelity improvement where needed)

---

### Concept 2: Predictive Frame Interpolation

**Idea:** **Render intermediate frames** between state updates for smooth motion.

**How:**
```rust
struct InterpolatingRenderer {
    prev_state: AppState,
    next_state: AppState,
    interpolation_t: f32,  // 0.0 → 1.0
}

impl InterpolatingRenderer {
    pub fn update(&mut self, new_state: AppState) {
        self.prev_state = self.next_state.clone();
        self.next_state = new_state;
        self.interpolation_t = 0.0;
    }
    
    pub fn render_interpolated(&mut self) -> Framebuffer {
        let fb = self.lerp_state(&self.prev_state, &self.next_state, self.interpolation_t);
        self.interpolation_t = (self.interpolation_t + 0.016).min(1.0);  // 60 FPS
        fb
    }
    
    fn lerp_state(&self, a: &AppState, b: &AppState, t: f32) -> Framebuffer {
        // Interpolate positions, colors, etc.
    }
}
```

**Novel because:** TUIs jump discretely between states. This enables smooth 60 FPS motion even with 10 FPS state updates.

**Complexity:** Medium
**Value:** High (smooth motion feels "alive")

---

### Concept 3: Semantic Render Priority

**Idea:** **Render important content first**, stream progressively.

**How:**
```rust
enum RenderPriority {
    Critical,    // User cursor, active line
    High,        // Visible text
    Medium,      // Decorative elements
    Low,         // Background, watermarks
}

fn render_by_priority(fb: &mut Framebuffer, elements: &[Element]) {
    let mut by_priority: HashMap<RenderPriority, Vec<&Element>> = HashMap::new();
    
    // Group by priority
    for elem in elements {
        by_priority.entry(elem.priority).or_default().push(elem);
    }
    
    // Render critical first (user sees this immediately)
    for elem in by_priority.remove(&RenderPriority::Critical).unwrap() {
        elem.render(fb);
    }
    flush_to_terminal();  // Send partial frame
    
    // Render rest in priority order
    for priority in [RenderPriority::High, RenderPriority::Medium, RenderPriority::Low] {
        if let Some(elems) = by_priority.remove(&priority) {
            for elem in elems {
                elem.render(fb);
            }
            flush_to_terminal();
        }
    }
}
```

**Novel because:** All TUIs render everything before flushing. Progressive rendering = faster perceived response.

**Complexity:** Low
**Value:** Medium (perceived latency reduction)

---

**End of Rendering Architecture Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Rendering Primitives from Blessed, Brackets-Lib, and Tcell

Blessed's rendering pipeline is a clean implementation of the painter's algorithm with damage tracking: widgets render front-to-back (z-order respected) into a back buffer, then only changed cells generate escape sequences. The `screen.damage` buffer tracks which cells need updating, and `program.flush()` writes a single concatenated string to stdout — minimizing syscalls. Brackets-lib's `DrawBatch` takes the opposite approach: collect all draw commands in a batch, then submit them as a single unit to the GPU/curses backend in one `present()` call. Tcell demonstrates the `Screen` abstraction with `SetCell()` for direct per-cell control and `Sync()` for double-buffered flush — the simplest correct primitive. Urwid's `Canvas` types (`TextCanvas`, `SolidCanvas`, `CompositeCanvas`, `CacheCanvas`) show that rendering units should be composable: a widget renders to a canvas, and the display layer composites canvases. Notcurses' `ncplane` model shows the most advanced version: multiple independent rendering planes with alpha compositing, each rendered from a subregion, all composited in a single `ncplane_render()` call to minimize escape sequence count.

## 3.2 Character Selection and Color Mapping

Termflix's frame pipeline shows the canonical character-mapping primitive: brightness → index into a character array.
ASCII: `[' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']`
Extended: `' ░▒▓█'`
Braille: `\u2800` through `\u28FF` (256 patterns, 8 dots per cell)
Partial blocks: `'▏▎▍▌▋▊▉'` for sub-cell vertical resolution (9 levels per cell width)

UnicodePlots formalizes this into a `Canvas` abstraction with coordinate scaling and automatic character selection. The 2×4 Braille dot grid maps a data point to dot positions and combines into a single character — enabling 8× resolution improvement over standard characters. LibCACA demonstrates Floyd-Steinberg error diffusion for image rendering: each pixel's quantization error is distributed to neighbors, producing smooth gradients with limited character sets. CACA also codifies the content/style separation: characters and color attributes stored in separate parallel arrays, combined only at output time.

## 3.3 Color System Primitives Across Frameworks

The color systems across all frameworks converge on the same primitives:
- **16 ANSI colors** (8 normal + 8 bright) — universal baseline
- **256-color palette** (16 ANSI + 6×6×6 color cube + 24 grayscale ramp)
- **24-bit truecolor** (RGB, 16M colors) — now supported by most modern terminals
- **Color pair / style object** — fg/bg combination as a single semantic unit

Brackets-lib's `ColorPair`, Rich's `Style`, Tcell's `ColorPair`, Blessed's `style: { fg, bg }`, and Textual's `Styles` all encode the same concept. The critical distinction is compilation: Rich's Style compiles to an ANSI escape string once and caches it, avoiding repeated string formatting. Libcaca's `caca_set_color_ansi()` and `caca_set_color_rgb()` show the C-level version, with attribute flags for bold/italic/underline/blink encoded as bit flags.

## 3.4 Dirty Tracking and Double Buffering

Every mature TUI uses dirty tracking; the pattern is identical across all implementations:
1. Render to back buffer
2. Compare back buffer to front buffer cell-by-cell
3. Build minimal escape sequence output for changed cells only
4. Flush single write to terminal
5. Swap buffers

Blessed: `screen.damage` tracks changed cells, `program.flush()` outputs dirty diff
Tcell: `screen.Sync()` is the flush primitive
Brackets-lib: `context.present()` submits all buffered draws
Urwid: `Canvas` has `content validity` — invalidates when widget changes
Notcurses: `ncplane_render()` diffs planes and only emits changed cells
Termflix: `dirty: Vec<bool>` per-cell tracking for 60fps video rendering

## 3.5 Rendering in Practice: Rate, Format, and Output

The fundamental terminal output rate ceiling: 60fps = 16.6ms per frame. At 80×24, a full-screen write is ~2000 characters, well within bandwidth. At 200×60, full writes hit 12K+ chars, where dirty tracking becomes critical. TerminalTextEffects' output optimization — `Cache ANSI codes`, `Batch character output`, `Minimize cursor moves` — is the canonical recipe: cache style-to-string compilations, emit character runs not individual cells, and batch writes to avoid flushes between every escape sequence.

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Xterm.js Terminal Rendering Pipeline from Canopy

Canopy's `TerminalView` demonstrates the canonical xterm.js rendering contract for embedded TUIs:

**Initialization order (must follow):**
1. Create `Terminal({ cursorBlink: true, fontFamily, fontSize: 13, theme: XTERM_THEME, allowProposedApi: true })`
2. Load `FitAddon` first (enables correct resize calculations)
3. Call `xterm.open(containerRef.current)`
4. `requestAnimationFrame(() => fitAddon.fit())` — wait for container to have real DOM dimensions

**Theme contract:** Canopy defines 17 color keys explicitly. Missing keys fall back to xterm defaults, causing inconsistent appearance. The cursor uses accent color inversion (`cursor: #FF6B00`, `cursorAccent: #0D0D0D`) for dark backgrounds.

**Output pipeline contract:**
```
PTY Reader Thread (Rust)  --bytes-as-Vec<u8>-->  Tauri Channel  --event data-->  React Tauri IPC
  → xterm.write(Uint8Array) renders raw
  → TextDecoder().decode(bytes) strips ANSI → pattern-scan
```

**Font zoom render cycle:**
```
setFontSize(newSize)
  └─ xterm.options.fontSize = newSize
     ├─ fitAddon.fit()            ← DOM recalculation
     └─ resizeTerminal(termId, xterm.rows, xterm.cols)  ← PTY notification
```

**Render-efficiency primitive from Canopy:** The `emitStatus` callback short-circuits if `currentStatusRef.current === status`, preventing thousands of React re-renders from identical status emissions.

---

# PART 5: ADVANCED RENDERING PRIMITIVES FROM DEEP ANALYSIS

## 5.1 Cell Structure: The Complete Model

The Cell struct in the main report (Section 2.2) is a simplified model. Production cellbuf reveals five fields that every serious framebuffer needs:

```rust
struct Cell {
    glyph: char,          // Primary rune (U+0000 if part of a wider cell)
    width: u8,            // Display columns: 0 (combining), 1 (ASCII), 2 (CJK/emoji)
    fg: Color,            // Foreground RGB
    bg: Color,            // Background RGB
    attrs: Attributes,    // Bit flags: bold, italic, underline, strikethrough, etc.
    link: Option<Link>,   // OSC 8 hyperlink (URL + optional ID)
    combining: Vec<char>, // Zero-width combining runes (accents, emoji modifiers)
}
```

The `width` field is critical for framebuffer math. When rendering a string, each cell's width determines how many columns to advance:
- **Width 0** (combining marks): Overlay on the previous cell. Do not advance cursor.
- **Width 1** (ASCII/Latin): Standard advance by 1 column.
- **Width 2** (CJK/emoji): Advance by 2 columns. The next cell at that position must be `EmptyCell` (zero-width placeholder) to prevent double-rendering.

**Predefined cell constants:**
- `BlankCell` = space glyph, width 1, default style. Used for "empty but visible" positions.
- `EmptyCell` = zero rune, width 0, no style. Used as placeholder after wide characters.

**Why this matters:** A framebuffer that only stores `char + color` cannot correctly handle CJK text, emoji (👨‍👩‍👧‍👦 = family emoji, width 2), or combining accents (é = e + ◌́). The width field is what makes column math work.

## 5.2 Character Width and Unicode Correctness

`x/wcwidth` codifies the width rules every renderer must implement:

| Character Type | Width | Examples |
|----------------|-------|---------|
| ASCII/Latin | 1 | `A`, `z`, `7`, `!` |
| CJK Unified Ideographs | 2 | `世`, `中`, `語` |
| Hiragana/Katakana | 2 | `あ`, `カ`, `ン` |
| Hangul | 2 | `한`, `글` |
| Emoji (most) | 2 | `😀`, `🎉`, `🔴` |
| Combining marks | 0 | `◌́` (U+0301), `◌̈` (U+0308) |
| Zero-width space | 0 | U+200B |
| Control characters | 0 | U+0000–U+001F (except tab) |

**The row-major index formula changes with wide cells:**

```rust
// Naive (breaks on wide chars):
let idx = y * width + x;

// Correct: must skip width-2 cell placeholders
fn cell_index(buf: &Buffer, x: usize, y: usize) -> usize {
    let mut col = 0;
    for i in 0..buf.row_len(y) {
        if col == x { return y * buf.max_width + i; }
        col += buf.cells[y * buf.max_width + i].width;
    }
    // x is beyond row width
    y * buf.max_width + buf.row_len(y) - 1
}
```

For sparse/performance-critical representations, buffer rows can be stored as `(cell_index, Cell)` pairs rather than dense arrays, skipping empty cells entirely.

## 5.3 The Writer Pattern: Separating Buffer from Output

`x/cellbuf`'s `Writer` struct demonstrates the clean separation between framebuffer (what to render) and output terminal (how to emit):

```
┌──────────┐      ┌────────┐      ┌──────────┐      ┌──────────┐
│ Back     │ diff │ Dirty  │ sort │ Escape   │ write│ Terminal │
│ Buffer   │─────▶│ Cells  │─────▶│ Sequence │─────▶│ (stdout) │
│          │      │        │      │ Builder  │      │          │
└──────────┘      └────────┘      └──────────┘      └──────────┘
```

```rust
struct Writer {
    output: io::Writer,    // Where to write (stdout, file, buffer)
    front: Framebuffer,    // Previous frame
    back: Framebuffer,     // Current frame
    cached_styles: HashMap<Style, String>, // Style → ANSI string cache
}

impl Writer {
    fn flush(&mut self) -> io::Result<()> {
        let dirty = self.compute_diff();
        let mut output = String::with_capacity(dirty.len() * 8); // Estimate
        let mut last_style = None;
        
        for (x, y) in dirty.sorted_by_position() {
            let cell = &self.back.get(x, y);
            
            // Only emit style escape if it changed
            if Some(&cell.style) != last_style.as_ref() {
                output.push_str(self.cached_styles
                    .entry(cell.style.clone())
                    .or_insert_with(|| cell.style.to_ansi()));
                last_style = Some(cell.style.clone());
            }
            
            output.push(cell.glyph);
        }
        
        self.output.write_all(output.as_bytes())?;
        std::mem::swap(&mut self.front, &mut self.back);
        Ok(())
    }
}
```

**Key optimization:** The style-to-ANSI cache (`cached_styles`) ensures each unique style combination is compiled to an ANSI string exactly once per session, not once per cell per frame.

## 5.4 SGR Attributes: The Complete Set

The report's `Attributes` field mentions "bold, italic, underline." The full SGR attribute space from `x/ansi` includes:

| Code | Attribute | Reset Code |
|------|-----------|------------|
| 0 | Reset all | — |
| 1 | Bold/Bright | 22 |
| 2 | Faint/Dim | 22 |
| 3 | Italic | 23 |
| 4 | Underline | 24 |
| 5 | Slow blink | 25 |
| 6 | Rapid blink | 25 |
| 7 | Reverse video | 27 |
| 8 | Conceal/Hidden | 28 |
| 9 | Strikethrough | 29 |
| 21 | Double underline | 24 |
| 53 | Overlined | 55 |

**Common bitflag encoding:**

```rust
bitflags! {
    struct Attributes: u16 {
        const BOLD          = 1 << 0;
        const FAINT         = 1 << 1;
        const ITALIC        = 1 << 2;
        const UNDERLINE     = 1 << 3;
        const BLINK         = 1 << 4;
        const REVERSE       = 1 << 5;
        const CONCEAL       = 1 << 6;
        const STRIKETHROUGH = 1 << 7;
        const DOUBLE_UNDER  = 1 << 8;
        const OVERLINED     = 1 << 9;
    }
}
```

## 5.5 Color System: Profile-Aware Rendering

The report describes 16/256/24-bit color levels. What's missing is the *degradation strategy* — how colors actually map between levels.

**Color profile hierarchy** (from `colorprofile`):

```
TrueColor (24-bit)  →  ANSI256 (8-bit)  →  ANSI (4-bit)  →  ASCII (none)
  16.7M colors          256 colors          16 colors         0 colors
```

**Downsampling strategy:**

```rust
// When targeting ANSI256 from TrueColor:
// 1. Separate the 16 base ANSI colors (indices 0-15)
// 2. The 6×6×6 color cube (indices 16-231):
//    index = 16 + 36*r + 6*g + b  (each component 0-5)
// 3. The 24 grayscale ramp (indices 232-255)
// 4. Find closest match by Euclidean distance in RGB space

fn rgb_to_256(r: u8, g: u8, b: u8) -> u8 {
    // Snap 0-255 range to 0-5 for cube components
    let r6 = (r as f32 / 255.0 * 5.0).round() as u8;
    let g6 = (g as f32 / 255.0 * 5.0).round() as u8;
    let b6 = (b as f32 / 255.0 * 5.0).round() as u8;
    
    // Check if grayscale (all components equal in cube space)
    if r6 == g6 && g6 == b6 && r6 > 0 && r6 < 5 {
        // Use grayscale ramp for better grayscale accuracy
        let gray_index = ((r as f32 / 255.0) * 23.0).round() as u8;
        return 232 + gray_index;
    }
    
    16 + 36 * r6 + 6 * g6 + b6
}
```

**Adaptive colors pattern** (from Lip Gloss `LightDark`):

```rust
struct AdaptiveColor {
    light: Color,  // For light terminal backgrounds
    dark: Color,   // For dark terminal backgrounds
}

fn resolve(adaptive: & AdaptiveColor, bg_is_dark: bool) -> &Color {
    if bg_is_dark { &adaptive.dark } else { &adaptive.light }
}
```

This enables TUI themes that work on both light and dark terminals without separate stylesheets.

**Complete ANSI 16-color palette reference:**

| Index | Name | RGB (normal) | RGB (bright) |
|-------|------|-------------|-------------|
| 0 | Black | `#000000` | `#808080` |
| 1 | Red | `#800000` | `#ff0000` |
| 2 | Green | `#008000` | `#00ff00` |
| 3 | Yellow | `#808000` | `#ffff00` |
| 4 | Blue | `#000080` | `#0000ff` |
| 5 | Magenta | `#800080` | `#ff00ff` |
| 6 | Cyan | `#008080` | `#00ffff` |
| 7 | White | `#c0c0c0` | `-` |

## 5.6 Plane-Based Rendering (Notcurses Model)

Notcurses' `ncplane` model is the gold standard for multi-layer rendering. Each plane is an independent framebuffer:

```rust
struct Plane {
    abs_x: i32,          // Absolute position on screen
    abs_y: i32,
    width: u32,
    height: u32,
    z: i32,              // Z-order (higher = on top)
    cells: Vec<Cell>,    // Own coordinate system
    damaged: Vec<bool>,  // Per-cell dirty tracking
    alpha: u8,           // Per-plane transparency
}

struct PlaneStack {
    planes: Vec<Plane>,
}

impl PlaneStack {
    fn render(&mut self) -> String {
        // Sort by z-order, bottom to top
        self.planes.sort_by_key(|p| p.z);
        
        let mut output = String::new();
        let cursor_x = 0;
        let cursor_y = 0;
        
        for plane in &self.planes {
            if plane.is_scrolling {
                output.push_str(&plane.render_scrolled());
                continue;
            }
            
            for y in 0..plane.height {
                for x in 0..plane.width {
                    let screen_x = plane.abs_x + x as i32;
                    let screen_y = plane.abs_y + y as i32;
                    if screen_x < 0 || screen_y < 0 { continue; }
                    
                    let cell = &plane.cells[y * plane.width + x];
                    if plane.alpha < 255 {
                        // Alpha composite with cell below
                        let below = self.get_cell_below(screen_x, screen_y, plane.z);
                        let blended = alpha_blend(cell, below, plane.alpha);
                        output.push_str(&self.cell_to_ansi(&blended));
                    } else {
                        output.push_str(&self.cell_to_ansi(cell));
                    }
                }
            }
        }
        
        output
    }
}
```

**Why planes matter for rendering architecture:**
1. **Per-widget rendering:** Each UI widget renders to its own plane, no global layout computation needed
2. **Independent scrolling:** A scrollable pane can scroll without re-rendering other planes
3. **Z-order without manual layer management:** Modal dialogs just get higher z values
4. **Damage isolation:** Only dirty planes need diff computation

## 5.7 Output Optimization: Canonical Escape Sequence Patterns

From `x/ansi` and TerminalTextEffects, the canonical output optimization recipe:

**Cursor positioning optimization:**
```rust
// Instead of absolute positioning for every cell:
// BAD: "\x1b[5;10H" for every single cell

// GOOD: Sort dirty cells by position, use relative moves
fn optimize_cursor_moves(cells: &mut Vec<(usize, usize, Cell)>) -> String {
    // Sort row-major (top-to-bottom, left-to-right)
    cells.sort_by(|a, b| (a.1, a.0).cmp(&(b.1, b.0)));
    
    let mut output = String::new();
    let mut cur_x = 0;
    let mut cur_y = 0;
    
    for (x, y, cell) in cells {
        if *y != cur_y {
            // New row: use cursor position absolute (row, column)
            output.push_str(&format!("\x1b[{};{}H", y + 1, x + 1));
            cur_y = *y;
            cur_x = *x;
        } else if *x != cur_x {
            // Same row: use forward/backward
            let diff = *x as i32 - cur_x as i32;
            if diff > 0 && diff <= 20 {
                output.push_str(&format!("\x1b[{}C", diff)); // Forward
            } else if diff < 0 && diff >= -20 {
                output.push_str(&format!("\x1b[{}D", -diff)); // Back
            } else {
                output.push_str(&format!("\x1b[{}G", x + 1)); // Absolute column
            }
            cur_x = *x;
        }
        
        // Omit character if it's a space with default style
        if cell.glyph == ' ' && cell.style.is_default() {
            cur_x += 1;
            continue;
        }
        
        output.push_str(&cell.style.to_ansi());
        output.push(cell.glyph);
        cur_x += cell.width as usize;
    }
    
    output
}
```

**ANSI code batching from TerminalTextEffects:**
1. **Cache ANSI codes:** Each unique style compiles to an ANSI string once. Cache in `HashMap<Style, String>`.
2. **Batch character output:** Emit runs of characters with the same style as a single write, not character-by-character.
3. **Minimize cursor moves:** Use relative cursor movement (`\x1b[C` forward, `\x1b[D` back) instead of absolute (`\x1b[H`) when the distance is short.
4. **Skip opaque cells:** When a cell is a space with default style, skip it entirely — the terminal already has that character.

## 5.8 Structured Rendering Pipeline: The Renderable Protocol

Rich's `Renderable` protocol and `Segment` model represent a higher-level rendering architecture:

```rust
// The core abstraction: anything that can produce styled text segments
trait Renderable {
    fn render(&self, ctx: &RenderContext) -> Vec<Segment>;
}

struct Segment {
    text: String,
    style: Style,        // fg, bg, bold, italic, underline, strikethrough
    // No position — segments are portrait-oriented (left-to-right, top-to-bottom)
}

struct RenderContext {
    width: usize,        // Available terminal width
    height: usize,       // Available terminal height
    color_profile: ColorProfile,
    tab_width: usize,
}
```

**The rendering pipeline becomes:**
```
Data Structure (Table, Panel, Text, etc.)
    → RenderContext.adapt(width, height)
    → Vec<Segment>   (styled text pieces)
    → wrap(segments, width)
    → grid(rows, cols)  ← Framebuffer
    → ANSI string
    → Terminal output
```

**Why this matters:** By separating "what to render" (Renderable) from "how to display" (Framebuffer), each layer can be tested and optimized independently. Glamour demonstrates this with markdown: the Markdown parser produces a renderable tree, the stylesheet applies styles, and the TermRenderer handles word-wrapping and ANSI generation — each is a separate module.

## 5.9 Frame Timing and Animation Rendering

From TerminalTextEffects and Bubble Tea, the animation rendering pattern:

```rust
struct AnimatingRenderer {
    // Frame timing
    target_fps: u32,           // 60 FPS default, clamped to [1, 120]
    frame_duration: Duration,  // 16.67ms at 60 FPS
    last_frame: Instant,
    delta_time: f32,           // Seconds since last frame

    // Interpolation state
    prev_snapshot: Framebuffer,
    next_snapshot: Framebuffer,
    t: f32,                    // Interpolation factor 0.0 → 1.0

    // Output coalescing
    pending_render: bool,
    render_deadline: Option<Instant>,
}

impl AnimatingRenderer {
    fn tick(&mut self) -> Option<String> {
        let now = Instant::now();
        self.delta_time = (now - self.last_frame).as_secs_f32();
        self.last_frame = now;

        // Advance interpolation
        self.t = (self.t + self.delta_time / self.animation_duration).min(1.0);

        // Only render at target FPS
        if let Some(deadline) = self.render_deadline {
            if now < deadline {
                return None; // Skip frame
            }
        }

        let output = self.render_interpolated();
        self.render_deadline = Some(now + self.frame_duration);
        Some(output)
    }

    fn render_interpolated(&self) -> String {
        // Lerp positions/colors between prev and next snapshots
        // This enables smooth 60 FPS animation even at 10 FPS state updates
    }
}
```

**Key insight from Bubble Tea's renderer:** Frame rate limiting uses a ticker that coalesces rapid state updates. If the model updates 100 times between render ticks, only the latest state is rendered. This prevents the renderer from falling behind on fast-updating content.

## 5.10 Complete Rendering Pipeline Summary

Pulling all the primitives together, a production rendering pipeline looks like:

```
┌─────────────────────────────────────────────────────────────────┐
│                     RENDERING PIPELINE v2                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Application State                                              │
│       │                                                         │
│       ▼                                                         │
│  Widget Tree ──compose──▶ Renderable::render(ctx) ──▶ Segments │
│       │                                                    │    │
│       │ (plane mode)                                       │    │
│       ▼                                                    ▼    │
│  Planes[n]                    wrap(segments, width)             │
│  ├── bounds                     │                              │
│  ├── z-order                    ▼                              │
│  ├── per-plane cells      Row/Col grid                         │
│  └── per-plane dirty            │                              │
│       │                         ▼                              │
│       │                   Framebuffer (Cell grid)               │
│       │                         │                              │
│       └─────────merge───────────┤                              │
│                                 ▼                              │
│                          Diff (front vs back)                   │
│                                 │                              │
│                                 ▼                              │
│                          Optimize:                              │
│                          • Sort dirty cells row-major           │
│                          • Skip default-style spaces            │
│                          • Minimize cursor moves                │
│                          • Batch same-style runs                │
│                                 │                              │
│                                 ▼                              │
│                          Style cache lookup                     │
│                          (Style → ANSI string, compiled once)   │
│                                 │                              │
│                                 ▼                              │
│                          Color profile conversion               │
│                          (TrueColor → ANSI256 → ANSI → ASCII)  │
│                                 │                              │
│                                 ▼                              │
│                          Single write to terminal               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---
