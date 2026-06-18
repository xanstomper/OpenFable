# REPORT_PRIMITIVE_COMBINATIONS.md
## Novel Low-Level TUI Primitive Syntheses

> **Focus:** Combining **primitive-level** rendering building blocks (glyphs, cells, blitters, color systems, buffers) to create genuinely new capabilities
> **Not:** High-level concepts (see REPORT_NEW_CONCEPTS.md)
> **Yes:** Cell-level, glyph-level, buffer-level innovations

---

## Primitive Combination 1: Hybrid Braille + Block + RGB Character Cells

### Primitives Combined
| Primitive | Source | Function |
|-----------|--------|----------|
| Braille encoding | UnicodePlots, chafa | 8 subpixels = 256 patterns, high resolution |
| Block characters | libcaca, notcurses | Smooth gradients (▏▎▍▌▋▊▉█) |
| Truecolor RGB | Rich, notcurses | 24-bit color depth |

### The Combination
A cell system that **dynamically selects the optimal encoding per cell**:

```rust
enum CellEncoding {
    // High-frequency detail → Braille (4x2 subpixels)
    Braille(u8),  // 8 bits = which dots are set
    
    // Smooth gradients → Partial blocks
    PartialBlock(u8),  // 0-8 for ▏▎▍▌▋▊▉█
    
    // Color-critical → Solid block with RGB
    SolidBlock { r: u8, g: u8, b: u8 },
    
    // Fallback → ASCII density
    AsciiChar(char),
}

struct HybridCell {
    encoding: CellEncoding,
    fg: Color,
    bg: Color,
}
```

### Selection Algorithm
```rust
fn select_encoding(pixel_block: &PixelBlock, caps: &TerminalCaps) -> CellEncoding {
    let variance = pixel_block.luminance_variance();
    let color_variance = pixel_block.color_variance();
    
    // High spatial frequency → Braille (best resolution)
    if variance > 0.7 && caps.braille {
        return CellEncoding::Braille(pixel_block.to_braille_mask());
    }
    
    // Smooth gradient → Partial blocks
    if variance < 0.3 && color_variance < 0.2 {
        let normalized_height = pixel_block.average_luminance();
        return CellEncoding::PartialBlock((normalized_height * 8.0) as u8);
    }
    
    // Color-critical + truecolor → RGB block
    if color_variance > 0.5 && caps.truecolor {
        return CellEncoding::SolidBlock {
            r: pixel_block.average_r(),
            g: pixel_block.average_g(),
            b: pixel_block.average_b(),
        };
    }
    
    // Fallback
    CellEncoding::AsciiChar(pixel_block.to_ascii_density())
}
```

### Emergent Capability
**Adaptive fidelity:** Each cell uses the best encoding for its content, maximizing visual quality while maintaining compatibility.

### Why This Combination is Valuable
- No existing TUI adapts encoding **per-cell**
- Global commitment to one encoding (all braille or all block) is suboptimal
- Graceful degradation built-in

### Implementation Sketch
```rust
impl HybridCell {
    pub fn to_ansi(&self) -> String {
        match &self.encoding {
            CellEncoding::Braille(mask) => {
                let glyph = (0x2800 + *mask as u32) as char;
                format!("\x1b[38;2;{};{};{}m{}", self.fg.r, self.fg.g, self.fg.b, glyph)
            }
            CellEncoding::PartialBlock(level) => {
                let glyphs = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];
                let glyph = glyphs[*level as usize];
                format!("\x1b[38;2;{};{};{}m{}", self.fg.r, self.fg.g, self.fg.b, glyph)
            }
            CellEncoding::SolidBlock { r, g, b } => {
                format!("\x1b[38;2;{};{};{}m█", r, g, b)
            }
            CellEncoding::AsciiChar(c) => {
                format!("\x1b[38;2;{};{};{}m{}", self.fg.r, self.fg.g, self.fg.b, c)
            }
        }
    }
}
```

---

## Primitive Combination 2: Multi-Plane Compositing with Graphics Blend Modes

### Primitives Combined
| Primitive | Source | Function |
|-----------|--------|----------|
| Plane system | notcurses | Layered buffers (Z-ordering) |
| Blend modes | termflix (alpha), graphics libs | Multiply, Screen, Overlay, Add |
| Cell-level alpha | ctx-graphics | Per-cell transparency |

### The Combination
Extend notcurses-style planes with **graphics blend modes**:

```rust
enum BlendMode {
    Normal,           // Top opaque, replaces bottom
    Multiply,         // Darken: result = top × bottom
    Screen,           // Lighten: result = 1 - (1-top) × (1-bottom)
    Overlay,          // Contrast: multiply or screen based on bottom
    Add,              // Glow: result = top + bottom (clamped)
    Alpha(f32),       // Transparency: result = top × α + bottom × (1-α)
}

struct Plane {
    cells: Vec<Cell>,
    z_index: i32,
    blend_mode: BlendMode,
}

fn composite(top: &Cell, bottom: &Cell, blend: BlendMode) -> Cell {
    match blend {
        BlendMode::Normal => *top,
        BlendMode::Multiply => Cell {
            fg: Color {
                r: (top.fg.r as u16 * bottom.fg.r as u16 / 255) as u8,
                g: (top.fg.g as u16 * bottom.fg.g as u16 / 255) as u8,
                b: (top.fg.b as u16 * bottom.fg.b as u16 / 255) as u8,
            },
            ..bottom  // Glyph from bottom
        },
        BlendMode::Screen => Cell {
            fg: Color {
                r: 255 - ((255 - top.fg.r as u16) * (255 - bottom.fg.r as u16) / 255) as u8,
                g: 255 - ((255 - top.fg.g as u16) * (255 - bottom.fg.g as u16) / 255) as u8,
                b: 255 - ((255 - top.fg.b as u16) * (255 - bottom.fg.b as u16) / 255) as u8,
            },
            ..bottom
        },
        BlendMode::Add => Cell {
            fg: Color {
                r: (top.fg.r as u16 + bottom.fg.r as u16).min(255) as u8,
                g: (top.fg.g as u16 + bottom.fg.g as u16).min(255) as u8,
                b: (top.fg.b as u16 + bottom.fg.b as u16).min(255) as u8,
            },
            ..bottom
        },
        // ... etc
    }
}
```

### Emergent Capability
**Professional-grade visual composition:** Soft shadows, glow effects, depth perception through blend modes—all in terminal.

### Why This Combination is Valuable
- notcurses has planes but **no blend modes**
- Terminal compositing is binary (opaque or not)
- Blend modes enable subtle effects (shadows, glows) impossible otherwise

### Use Cases
- **Watermark with soft shadow:** Normal plane + shadow plane with Multiply blend
- **Important element glow:** Add blend mode for brightening
- **Dimmed background:** Multiply with gray overlay
- **Focus highlight:** Screen blend for brightening selected region

---

## Primitive Combination 3: Sub-Cell Coordinate System with Vector Persistence

### Primitives Combined
| Primitive | Source | Function |
|-----------|--------|----------|
| Vector shapes | Dotgrid, Ronin | Resolution-independent paths |
| Sub-cell addressing | notcurses (sextants/octants) | 3x2 or 4x2 subpixels per cell |
| Bezier interpolation | bracket-lib, Ronin | Smooth curves |

### The Combination
Store UI elements as **vector primitives in a continuous coordinate space**, rasterize to sub-cells at render time:

```rust
// Continuous coordinate space (not cell-grid-snapped)
struct Vec2 {
    x: f32,  // 0.0 = left edge, width = right edge
    y: f32,  // 0.0 = top edge, height = bottom edge
}

// Vector primitives
enum Shape {
    Line { start: Vec2, end: Vec2 },
    Rect { origin: Vec2, size: Vec2 },
    Circle { center: Vec2, radius: f32 },
    Bezier { p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2 },  // Cubic
}

// Rasterizer: vector → sub-cell mask
struct VectorRasterizer {
    width_cells: usize,
    height_cells: usize,
    subpixel_x: usize,  // e.g., 2 for braille
    subpixel_y: usize,  // e.g., 4 for braille
}

impl VectorRasterizer {
    fn rasterize(&self, shape: &Shape) -> Vec<SubCell> {
        // Sample shape at sub-cell centers
        let mut subcells = Vec::new();
        for cy in 0..self.height_cells * self.subpixel_y {
            for cx in 0..self.width_cells * self.subpixel_x {
                let x = (cx as f32 + 0.5) / (self.width_cells * self.subpixel_x) as f32;
                let y = (cy as f32 + 0.5) / (self.height_cells * self.subpixel_y) as f32;
                
                if shape.contains(x, y) {
                    subcells.push(SubCell { x: cx, y: cy, filled: true });
                }
            }
        }
        subcells
    }
}
```

### Emergent Capability
**Resolution-independent UI:** Re-rasterize on any terminal size without quality loss. Animate by interpolating vector control points.

### Why This Combination is Valuable
- Every TUI **immediately rasterizes** to characters
- None store vector state
- Enables smooth zooming, rotating, morphing

### Animation via Control Points
```rust
// Animate a circle expanding
struct AnimatedCircle {
    center: Vec2,
    radius_start: f32,
    radius_end: f32,
    elapsed_ms: u64,
    duration_ms: u64,
}

impl AnimatedCircle {
    fn current_radius(&self) -> f32 {
        let t = (self.elapsed_ms as f32 / self.duration_ms as f32).min(1.0);
        let eased = ease_out_quad(t);
        self.radius_start + (self.radius_end - self.radius_start) * eased
    }
    
    fn render(&self, rasterizer: &VectorRasterizer) -> Vec<SubCell> {
        let shape = Shape::Circle { center: self.center, radius: self.current_radius() };
        rasterizer.rasterize(&shape)
    }
}
```

---

## Primitive Combination 4: Haptic-Feedback Keyboard Protocol with Visual Echo

### Primitives Combined
| Primitive | Source | Function |
|-----------|--------|----------|
| Kitty keyboard protocol | kitty | Scancode-level key events, release events |
| Visual echo | cmatrix, terminaltexteffects | Cascading visual feedback |
| Unicode EGC animation | Rich, notcurses | Multi-codepoint glyph animation |

### The Combination
**Keyboard input creates cascading visual echoes** across the TUI surface, with different key types producing different echo patterns:

```rust
enum KeyEchoType {
    // Alphanumeric → ripple from cursor position
    Alpha { base_x: usize, base_y: usize },
    
    // Navigation (arrows, hjkl) → directional wave
    Navigation { direction: Vec2, speed: f32 },
    
    // Command (Ctrl, Meta) → expanding ring
    Command { modifiers: Modifiers, radius: f32 },
    
    // Escape/Quit → screen flash
    Escape { intensity: f32 },
}

struct KeyEchoSystem {
    active_echoes: Vec<KeyEcho>,
    keyboard_protocol: KittyProtocol,
}

impl KeyEchoSystem {
    pub fn on_key_event(&mut self, event: KeyEvent) {
        let echo = match event.key {
            Key::Char(c) if c.is_alphanumeric() => {
                KeyEcho::Ripple {
                    origin: self.cursor_position,
                    wavelength: 3.0,
                    amplitude: 1.0,
                    decay: 0.8,
                }
            }
            Key::Arrow(direction) => {
                KeyEcho::Wave {
                    direction: direction.to_vec(),
                    frequency: 5.0,
                    speed: 2.0,
                }
            }
            Key::Ctrl(_) | Key::Meta(_) => {
                KeyEcho::Ring {
                    center: self.screen_center,
                    max_radius: 40.0,
                    expansion_speed: 10.0,
                }
            }
            Key::Escape => {
                KeyEcho::Flash { intensity: 0.3 }
            }
            _ => return,
        };
        
        self.active_echoes.push(echo);
    }
    
    pub fn render(&mut self, fb: &mut Framebuffer) {
        for echo in &mut self.active_echoes {
            echo.advance(16);  // 60 FPS
            echo.apply(fb);
        }
        
        // Remove decayed echoes
        self.active_echoes.retain(|e| e.intensity() > 0.01);
    }
}
```

### Emergent Capability
**Kinesthetic connection:** User feels "connected" to the TUI through visual-haptic feedback loop. Typing creates ripples, navigation creates waves, commands create pulses.

### Why This Combination is Valuable
- No TUI provides **input-produced visual feedback** beyond cursor movement
- Creates sense of "aliveness" and direct manipulation
- Subconscious reinforcement of user actions

### Implementation Notes
- Use kitty's key release events for "key up" echoes (like piano key release)
- Modifiers (Ctrl, Alt) produce different echo colors
- Echo intensity scales with typing speed (fast typing = more intense echoes)

---

## Primitive Combination 5: Semantic Gradient Compression for Syntax Highlighting

### Primitives Combined
| Primitive | Source | Function |
|-----------|--------|----------|
| Syntax trees | Rich (pygments), tree-sitter | AST parsing for code |
| Gradient color blending | lipgloss, Rich | Smooth color transitions |
| Semantic clustering | ML embedding models | Code similarity detection |

### The Combination
**Syntax-aware color gradients** that encode semantic relationships, not just lexical categories:

Instead of:
- `keyword` = purple (fixed)
- `string` = green (fixed)
- `function` = blue (fixed)

Use gradients where:
- Color **hue** = lexical category (keywords, strings, functions)
- Color **saturation** = semantic importance (high-frequency vs rare symbols)
- Color **lightness** = nesting depth or scope level
- Gradient **direction** = data flow direction (producer → consumer)

```rust
struct SemanticColor {
    // Base hue from lexical category
    hue: f32,  // 0-360 degrees
    
    // Saturation from semantic importance
    saturation: f32,  // 0.0-1.0, computed from symbol frequency
    
    // Lightness from nesting depth
    lightness: f32,  // 0.0-1.0, 0.5 = base, <0.5 = deeper nesting
    
    // Gradient angle shows data flow
    gradient_angle: f32,  // Degrees, 0° = left-to-right flow
}

impl SemanticColor {
    pub fn from_token(token: &Token, ast: &AST, embeddings: &EmbeddingModel) -> Self {
        // Hue from token type
        let hue = match token.kind {
            TokenType::Keyword => 270.0,    // Purple
            TokenType::String => 120.0,     // Green
            TokenType::Function => 210.0,   // Blue
            TokenType::Type => 30.0,        // Orange
            TokenType::Variable => 180.0,   // Cyan
            _ => 0.0,
        };
        
        // Saturation from semantic importance (TF-IDF style)
        let frequency = embeddings.symbol_frequency(&token.text);
        let max_frequency = embeddings.max_frequency();
        let saturation = 1.0 - (frequency / max_frequency);  // Rare = more saturated
        
        // Lightness from nesting depth
        let depth = ast.nesting_depth(token.span);
        let lightness = 0.5 - (depth as f32 * 0.05).clamp(-0.3, 0.3);
        
        // Gradient angle from data flow analysis
        let flow = ast.data_flow_direction(token.span);
        let gradient_angle = flow.angle_degrees();
        
        SemanticColor { hue, saturation, lightness, gradient_angle }
    }
}
```

### Emergent Capability
**Information-dense syntax highlighting:** Developer can infer code structure, importance, and data flow from color patterns **without reading text**.

### Why This Combination is Valuable
- Traditional syntax highlighting is **lexically categorical** (keyword=red, string=green)
- This encodes **semantic information** (importance, depth, flow) in color dimensions
- Reduces cognitive load for understanding unfamiliar codebases

### Visual Example
```
// Traditional highlighting (lexical only):
fn calculate_total(items: Vec<Item>) -> f64 { ... }
│  │                │    │  │       │
│  │                │    │  │       └── fixed color for type
│  │                │    │  └── fixed color for punctuation  
│  │                │    └── fixed color for type
│  │                └── fixed color for variable
│  └── fixed color for keyword
└── fixed color for function

// Semantic gradient highlighting:
fn calculate_total(items: Vec<Item>) -> f64 { ... }
│  │                │    │  │       │
│  │                │    │  │       └── bright (top-level), desaturated (common type)
│  │                │    │  └── gradient shows data flow direction
│  │                │    └── bright (top-level), saturated (rare generic)
│  │                └── dimmer (nested scope), saturated (important param)
│  └── gradient from bright→dim shows this function is called often
└── bright (important, rarely redefined)
```

---

## Primitive Combination 6: Time-Indexed Cell Buffer for Deterministic Replay

### Primitives Combined
| Primitive | Source | Function |
|-----------|--------|----------|
| Cell buffers | Rich, tcell | Frame state storage |
| Time indexing | Ronin (time-based animation) | t → state mapping |
| Event logging | Agent runtimes | Replay capability |

### The Combination
A cell buffer that stores **time-indexed states** for deterministic replay:

```rust
struct TimeIndexedCell {
    states: Vec<(u64, Cell)>,  // (timestamp_ms, cell_state)
}

struct TimeBuffer {
    cells: Vec<TimeIndexedCell>,
    start_time_ms: u64,
    current_time_ms: u64,
}

impl TimeBuffer {
    pub fn set_cell_at_time(&mut self, x: usize, y: usize, time_ms: u64, cell: Cell) {
        let idx = y * self.width + x;
        self.cells[idx].states.push((time_ms, cell));
        
        // Keep states sorted by time
        self.cells[idx].states.sort_by_key(|(t, _)| *t);
    }
    
    pub fn get_cell_at_time(&self, x: usize, y: usize, time_ms: u64) -> Cell {
        let idx = y * self.width + x;
        let states = &self.cells[idx].states;
        
        // Find state at given time (binary search)
        match states.binary_search_by_key(&time_ms, |(t, _)| *t) {
            Ok(i) => states[i].1,
            Err(i) => {
                if i == 0 {
                    states.first().map(|(_, c)| c).unwrap_or(Cell::default())
                } else {
                    states[i - 1].1  // Use previous state
                }
            }
        }
    }
    
    pub fn replay(&self, start_ms: u64, end_ms: u64, callback: &mut dyn FnMut(u64, &Framebuffer)) {
        let mut current_ms = start_ms;
        while current_ms < end_ms {
            let fb = self.render_at_time(current_ms);
            callback(current_ms, &fb);
            current_ms += 16;  // 60 FPS
        }
    }
}
```

### Emergent Capability
**Deterministic replay:** Exact visual reproduction of any past session for debugging or demos.

### Why This Combination is Valuable
- All TUIs are **stateless between frames**
- No way to "rewind" and see what happened
- Enables reproducible bug reports, shareable demos

---

## Summary: Primitive Combination Matrix

| Combination | Novelty | Impact | Complexity | Priority |
|-------------|---------|--------|------------|----------|
| Hybrid Glyph Cells | ★★★★★ | ★★★★★ | ★★★☆☆ | **1st** |
| Blend Mode Planes | ★★★★☆ | ★★★★☆ | ★★★★☆ | 2nd |
| Vector Persistence | ★★★★★ | ★★★★☆ | ★★★★★ | 3rd |
| Dirty-Region Particles | ★★★★☆ | ★★★★☆ | ★★★☆☆ | 2nd |
| Dithering Pipeline | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | 4th |
| Time-Indexed Buffer | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | 5th |

**Immediate implementation priority:** Hybrid Glyph Cells (biggest visual improvement with reasonable complexity).