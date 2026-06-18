# TalonCLI Rendering Architecture Study

## Executive Summary

This study analyzes 16+ terminal rendering projects to extract reusable primitives for TalonCLI—a Rust-backend, Go-frontend (Bubble Tea) TUI for AI coding agents. The key finding: **Bubble Tea is your control plane, not your graphics engine**. A unified framebuffer architecture with adapter layers is required to achieve "alive" animations.

---

## Cluster 1: Immediate-Mode TUI Systems (State-Diff Renderers)

### Projects
- **tcell** (Go)
- **rich** (Python)
- **Bubble Tea** (Go) — *your frontend*

### Core Pattern
```
State → String/Cell Output → Diff → Terminal
```

Every frame is rebuilt from state. The renderer diffs output against previous frame to minimize writes.

### What to Reuse
| Primitive | Source | Application |
|-----------|--------|-------------|
| Event loop (tick/update/render) | Bubble Tea | Main control loop |
| Viewport + layout composition | tcell, rich |Widget positioning |
| State-driven UI trees | Bubble Tea | Agent state management |
| Dirty-region triggers | tcell | Selective redraw hints |

### What NOT to Copy
- ❌ Animation logic inside `View()` — kills performance
- ❌ String concatenation as rendering strategy
- ❌ Using layout system for motion (scrollers will stutter)
- ❌ Treating widgets as animation primitives

### Verdict
**Bubble Tea handles input, state, and widget layout. Rendering is delegated to your Rust framebuffer.**

---

## Cluster 2: Retained-Mode Terminal Engines (True Graphics)

### Projects
- **notcurses** (C) — *gold standard*
- **libtcod** (C/C++) — *roguelike focus*
- **bracket-lib** (Rust) — *modern libtcod port*

### Core Pattern
```
Framebuffer (persistent) → Mutate → Composite → Present
```

Maintains a persistent buffer in memory. Frames are mutations, not rebuilds.

### Critical Patterns from Notcurses (`blit.c`, `blitset.h`)

#### 1. Blit Function Signature
```c
typedef int (*ncblitter)(
    struct ncplane* n,      // target plane
    int linesize,           // source stride
    const void* data,       // pixel data
    int scaledy, int scaledx, // output geometry
    const struct blitterargs* bargs
);
```

#### 2. Blitset Abstraction
```c
struct blitset {
    ncblitter_e geom;       // NCBLIT_1x1, NCBLIT_2x1, NCBLIT_4x2, etc.
    int width, height;      // pixel dimensions per cell
    const char* chars;      // glyph mapping
};
```

#### 3. Feature Detection
```c
// From blitset.h
rgba_blitter_default(tinfo* tcache, ncscale_e scale) {
    if (!tcache->caps.utf8) return NCBLIT_1x1;      // ASCII fallback
    if (scale == NCSCALE_NONE) return NCBLIT_2x1;   // Half-block
    if (tcache->caps.octants) return NCBLIT_4x2;    // 8 sub-pixels
    if (tcache->caps.sextants) return NCBLIT_3x2;   // 6 sub-pixels
    if (tcache->caps.quadrants) return NCBLIT_2x2;  // 4 sub-pixels
    return NCBLIT_2x1;
}
```

### What to Reuse
| Primitive | Source | Application |
|-----------|--------|-------------|
| Layered buffers (bg/mid/fg) | notcurses | Agent UI layers |
| Dirty-region updates | notcurses | Performance |
| Explicit frame lifecycle | libtcod | Clear→Draw→Compose→Present |
| Coordinate-based rendering | bracket-lib | Pixel-perfect motion |
| Blending rules (alpha-like) | notcurses | Overlay effects |
| Feature detection | notcurses | Terminal capability probing |

### What NOT to Copy
- ❌ Heavy C-style global state
- ❌ Game-loop tight coupling with rendering
- ❌ Monolithic engine design (overkill for CLI)

### Verdict
**This is your missing piece. Build a Rust framebuffer crate with these patterns.**

---

## Cluster 3: Raster-to-Terminal Converters (Glyph Mapping)

### Projects
- **chafa** (C) — *best-in-class*
- **libcaca** (C) — *legacy ASCII*
- **cmatrix** (C) — *rain effect*

### Core Pattern
```
Pixel Data → Luminance/Color Analysis → Glyph Selection → ANSI Output
```

### Chafa Architecture (`chafa-canvas.c`, `chafa-symbol-map.h`)

#### 1. Symbol Tags System
```c
typedef enum {
    CHAFA_SYMBOL_TAG_SPACE     = (1 << 0),
    CHAFA_SYMBOL_TAG_SOLID     = (1 << 1),
    CHAFA_SYMBOL_TAG_BLOCK     = (1 << 3),
    CHAFA_SYMBOL_TAG_BRAILLE   = (1 << 11),
    CHAFA_SYMBOL_TAG_QUAD      = (1 << 7),
    CHAFA_SYMBOL_TAG_HALF      = CHAFA_SYMBOL_TAG_HHALF | CHAFA_SYMBOL_TAG_VHALF,
    CHAFA_SYMBOL_TAG_SEXTANT   = (1 << 22),
    CHAFA_SYMBOL_TAG_OCTANT    = (1 << 26),
    // ... 30+ tags total
} ChafaSymbolTags;
```

#### 2. Pixel-to-Glyph Pipeline
```c
// Simplified from chafa-canvas.c:1402
static void pick_symbol_and_colors_fast(
    ChafaCanvas *canvas,
    const guint32 *pixels,  // 8x8 pixel block
    gunichar *symbol_out,
    ChafaColor *fg_out,
    ChafaColor *bg_out
) {
    // 1. Analyze luminance distribution
    // 2. Build foreground/background mask
    // 3. Match against symbol library by tags
    // 4. Dither residual error
    // 5. Return optimal glyph + colors
}
```

#### 3. Key Constants
```c
#define CHAFA_SYMBOL_WIDTH_PIXELS 8
#define CHAFA_SYMBOL_HEIGHT_PIXELS 8
```

### What to Reuse
| Primitive | Source | Application |
|-----------|--------|-------------|
| Braille mapping (8-bit cell) | chafa | High-res scrollers |
| Luminance → glyph density | chafa | Image previews |
| Palette quantization | chafa | Color reduction |
| Aspect ratio correction | chafa | Correct proportions |
| Floyd-Steinberg dithering | chafa | Smooth gradients |
| Symbol tag filtering | chafa | Style presets |

### What NOT to Copy
- ❌ Full image pipeline overhead (you need micro-buffers)
- ❌ Static image assumptions (you want streaming frames)
- ❌ CLI tool structure (you need embedded engine)

### Verdict
**This is your detailed scroller engine. Implement Braille + block + sextant encodings.**

---

## Cluster 4: Graphics-Protocol Escape Systems

### Projects
- **kitty graphics protocol** (spec)
- **wezterm** (Lua/Rust)
- **SIXEL** (legacy)

### Core Pattern
```
Bypass character cells → Send images directly → Terminal composites
```

### Kitty Protocol Capabilities
- Inline images with escape sequences
- Layering (images behind text)
- Progressive loading
- Frame animation via chunked updates

### What to Reuse
| Primitive | Source | Application |
|-----------|--------|-------------|
| Image tiling strategies | kitty | Large asset handling |
| Frame chunking | kitty | Animation streaming |
| Progressive loading | kitty | Lazy thumbnails |
| Layering behind text | kitty | Background graphics |

### What NOT to Copy
- ❌ Relying on this for core UI animation (portability nightmare)
- ❌ Assuming portability (breaks across terminals)
- ❌ Building layout logic around graphics support
- ❌ Using as default rendering path

### Verdict
**Fallback escape hatch only. Use for: previews, logos, thumbnails, agent visual identity.**

---

## Cluster 5: Procedural Graphics / Creative Coding

### Projects
- **Ronin** (JavaScript/Lisp) — *hundredrabbits*
- **Dotgrid** (JavaScript) — *hundredrabbits*
- **ctx.graphics** (web)

### Core Pattern
```
Time + Math → Transformation Pipeline → Draw Commands → Frame
```

### Ronin Architecture Deep-Dive

#### 1. Surface Abstraction (`surface.js`)
```javascript
function Surface(client) {
    this.el = document.createElement('canvas');
    this.context = this.el.getContext('2d');
    
    // Drawing primitives
    this.stroke = (shape, color, width) => { ... };
    this.fill = (shape, color) => { ... };
    this.clear = (rect) => { ... };
    
    // Shape tracers (convert shape → path commands)
    this.trace = (shape, context) => {
        if (isRect(shape)) this.traceRect(shape, context);
        if (isLine(shape)) this.traceLine(shape, context);
        if (isCircle(shape)) this.traceCircle(shape, context);
        // ... 10+ shape types
    };
}
```

#### 2. Shape Definitions (`library.js`)
```javascript
this.pos = (x, y) => ({ x, y });
this.line = (ax, ay, bx, by) => ({ 
    a: this.pos(ax, ay), 
    b: this.pos(bx, by) 
});
this.rect = (x, y, w, h) => ({ x, y, w, h });
this.circle = (cx, cy, r) => ({ cx, cy, r });
this.color = (r, g, b, a) => ({ 
    r, g, b, a, 
    hex: '#...', 
    rgba: `rgba(${r},${g},${b},${a})` 
});
```

#### 3. Animation Loop (`client.js`)
```javascript
this.loop = () => {
    if (this.bindings.animate && typeof this.bindings.animate === 'function') {
        this.bindings.animate();  // User's frame function
    }
    requestAnimationFrame(() => this.loop());
};

// User registration (from on-animate.lisp)
(on "animate" redraw);

// Example animation (sine wave dash)
(defn elevation (i) 
  (add 
    (mul (sin (add (time 0.001) (div i 5))) 
         (div frame:h 5)) 
    frame:m))

(defn redraw ()
  (clear)
  (each (range 0 seg-count) draw-dash))
```

#### 4. Time Model
```javascript
this.time = (rate = 1) => Date.now() * rate;  // Milliseconds with scale
```

### What to Reuse
| Primitive | Source | Application |
|-----------|--------|-------------|
| Noise fields (Perlin/simplex) | Ronin | Organic motion |
| Vector field motion | Ronin | Particle systems |
| Time-based transforms (`t → pos`) | Ronin | Deterministic animation |
| Composable draw commands | Ronin | Effect layering |
| "Everything is a function of time" | Ronin | Replay/seek capability |
| Shape algebra (pos, line, rect) | Ronin | Spatial model |

### What NOT to Copy
- ❌ Lisp-like runtime coupling (not needed in your stack)
- ❌ Monolithic scripting engine
- ❌ Interactive canvas editor patterns

### Verdict
**This is what makes things feel *alive instead of updating*. Essential for agent "thinking" visuals.**

---

## Cluster 6: Effect Libraries (Prebuilt Animations)

### Projects
- **terminaltexteffects** (Python)
- **termflix** (Python)
- **cmatrix** (C)

### Core Pattern
```
Effect Definition → Particle/Motion System → Frame Generator → ANSI Stream
```

### TerminalTextEffects Architecture (`terminal.py`, `animation.py`, `easing.py`)

#### 1. Terminal Config (`terminal.py`)
```python
@dataclass
class TerminalConfig:
    frame_rate: int = 60  # Target FPS, 0 = unlimited
    canvas_width: int = -1  # -1 = auto, 0 = terminal width
    canvas_height: int = -1
    anchor_canvas: Literal['sw','s','se','e','ne','n','nw','w','c'] = 'sw'
    anchor_text: Literal['n','ne','e','se','s','sw','w','nw','c'] = 'sw'
    existing_color_handling: Literal['always','dynamic','ignore'] = 'ignore'
    reuse_canvas: bool = False  # Reuse previous canvas position
    ignore_terminal_dimensions: bool = False  # Render beyond terminal bounds
```

#### 2. Canvas Abstraction
```python
class Canvas:
    def __init__(self, config: TerminalConfig):
        self.width = config.canvas_width
        self.height = config.canvas_height
        self.cells = [[None for _ in range(self.width)] for _ in range(self.height)]
    
    def clear(self):
        self.cells = [[None for _ in range(self.width)] for _ in range(self.height)]
    
    def set_cell(self, x: int, y: int, char: str, fg: Color, bg: Color):
        # Bounds checking + cell update
        pass
    
    def render_frame(self) -> str:
        # Build ANSI string from cell grid
        return ansi_output
```

#### 3. Animation Base (`animation.py`)
```python
class Animation:
    def __init__(self, terminal: Terminal):
        self.terminal = terminal
        self.frames_rendered = 0
        self.start_time = None
    
    def setup(self):
        """One-time initialization"""
        pass
    
    def render(self) -> str:
        """Return ANSI string for current frame"""
        raise NotImplementedError
    
    def is_complete(self) -> bool:
        """Check if animation finished"""
        return self.frames_rendered >= self.max_frames
    
    def step(self):
        """Advance internal state by one frame"""
        self.frames_rendered += 1
```

#### 4. Easing Functions (`easing.py` — 50+ functions)
```python
# From easing.py (22KB file)
def ease_in_quad(t): return t * t
def ease_out_quad(t): return t * (2 - t)
def ease_in_out_quad(t): return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t

def ease_in_cubic(t): return t * t * t
def ease_out_cubic(t): return 1 - pow(1 - t, 3)

def ease_in_out_sine(t): return -(cos(pi * t) - 1) / 2

def ease_in_elastic(t): 
    # Oscillatory decay
    c4 = (2 * pi) / 3
    return t == 0 ? 0 : t == 1 ? 1 : -pow(2, 10 * t - 10) * sin((t * 10 - 10.75) * c4)
```

### What to Reuse
| Primitive | Source | Application |
|-----------|--------|-------------|
| Particle emitters | termtexteffects |spark effects |
| Decay systems (fade-out) | termtexteffects | Trail effects |
| Motion curves (ease in/out) | termtexteffects | Smooth transitions |
| Text morph states | termtexteffects | Code transformation UI |
| Frame sequencing systems | termtexteffects | Effect composition |
| Canvas anchoring | termtexteffects | Layout flexibility |

### What NOT to Copy
- ❌ Hardcoded effects (you need generative, not fixed)
- ❌ Single-purpose animation loops
- ❌ Lack of composability (you want mixable effects)

### Verdict
**Your animation toolkit layer. Implement easing functions + particle system base classes.**

---

## Cluster 7: Legacy ASCII / Demo Systems

### Projects
- **libcaca** (C)
- **cmatrix** (C)
- Early ASCII renderers

### Core Pattern
```
Character Density Field → Scanline Render → Monochrome Output
```

### What to Reuse
| Primitive | Source | Application |
|-----------|--------|-------------|
| Character density mapping | libcaca | Intuitive glyph selection |
| Scanline rendering ideas | cmatrix | Matrix rain, data streams |
| Simple noise-to-text tricks | libcaca | Quick visualizations |

### What NOT to Copy
- ❌ Fixed 80s-style assumptions
- ❌ Static rendering pipelines
- ❌ Monochrome constraints

### Verdict
**Historical reference. Modern Blockly/Braille approaches are superior.**

---

## TalonCLI Unified Architecture

### Layer Stack

```
┌─────────────────────────────────────────────────────────┐
│                  Bubble Tea (Go Frontend)               │
│  - Input handling (keyboard, mouse)                     │
│  - State management (Elm architecture)                  │
│  - Widget layout (static UI components)                 │
│  - Agent orchestration commands                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ FFI / IPC (prost + tonic or shared memory)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Rust Framebuffer Crate (talon-render)       │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Layer 1: Framebuffer Core                         │  │
│  │ - Multi-layer buffers (bg/mid/fg/overlay)         │  │
│  │ - Dirty region tracking                           │  │
│  │ - Coordinate system (cell + sub-cell)             │  │
│  │ - Frame lifecycle (clear → draw → composite → flip)│  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Layer 2: Glyph Encoder Adapters                   │  │
│  │ - BrailleBlitter (8x3 → ⣿)                       │  │
│  │ - BlockBlitter (2x1 → ▀/▄/█)                     │  │
│  │ - SextantBlitter (3x2 → 🬀🬁🬂...)                │  │
│  │ - OctantBlitter (4x2 → 🬌🬍🬎...)                │  │
│  │ - KittyImageBlitter (inline PNG via escape)       │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Layer 3: Procedural Animation Engine              │  │
│  │ - Time model (milliseconds, scaled)               │  │
│  │ - Noise generators (Perlin, simplex, value)       │  │
│  │ - Vector field motion                             │  │
│  │ - Composable draw commands                        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Layer 4: Effect System                            │  │
│  │ - Particle emitters                               │  │
│  │ - Easing functions (50+ standard)                 │  │
│  │ - Decay/fade systems                              │  │
│  │ - Text morph transitions                          │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ ANSI output or Kitty escape sequences
                     ▼
              ┌──────────────┐
              │   Terminal   │
              │ (kitty/wezterm/
              │  alacritty)  │
              └──────────────┘
```

---

## Implementation Roadmap

### Phase 1: Framebuffer Core (Week 1-2)
```rust
// talon-render/src/framebuffer.rs
pub struct Framebuffer {
    width: usize,
    height: usize,
    layers: Vec<Layer>,  // bg, mid, fg, overlay
    dirty_regions: Vec<Rect>,
    capabilities: TerminalCaps,
}

pub struct Layer {
    cells: Vec<Cell>,
    blend_mode: BlendMode,
}

pub struct Cell {
    glyph: Glyph,
    fg: Color,
    bg: Color,
    subpixel_mask: u8,  // For braille/sextants
}
```

### Phase 2: Glyph Encoders (Week 2-3)
```rust
// talon-render/src/blitters/braille.rs
pub struct BrailleBlitter;

impl Blitter for BrailleBlitter {
    fn cell_width() -> usize { 2 }
    fn cell_height() -> usize { 4 }
    
    fn encode(&self, pixels: &[[u8;4]]) -> char {
        // 8 pixels → 1 Braille character (U+2800–U+28FF)
        let mut mask = 0u8;
        for (i, pixel) in pixels.iter().enumerate() {
            if pixel[3] > 128 {  // Alpha threshold
                mask |= 1 << i;
            }
        }
        (0x2800 + mask as u32) as char
    }
}
```

### Phase 3: Time + Procedural Engine (Week 3-4)
```rust
// talon-render/src/procedural.rs
pub struct AnimationContext {
    time_ms: u64,
    delta_ms: u64,
    ease_fn: EasingFunction,
}

pub trait Drawable {
    fn draw(&self, ctx: &AnimationFrame, fb: &mut Framebuffer);
}

pub struct ParticleSystem {
    emitter: Emitter,
    particles: Vec<Particle>,
    physics: PhysicsModel,
}
```

### Phase 4: Bubble Tea Bridge (Week 4-5)
```go
// taloncli/cmd/taloncli.go
type Model struct {
    state       AgentState
    renderer    *rust.Renderer  // FFI handle
    framebuffer *rust.Framebuffer
}

func (m Model) View() string {
    // 1. Update Rust framebuffer from state
    m.renderer.Render(&m.framebuffer)
    // 2. Get ANSI output
    return m.framebuffer.ToString()
}
```

### Phase 5: Effects Library (Week 5-6)
```rust
// talon-render/src/effects/mod.rs
pub mod particles;
pub mod easing;
pub mod morph;
pub mod waveform;

// Agent-specific effects
pub mod agent_thinking;  // Animated "thinking" indicator
pub mod code_diff;       // Syntax-highlighted diff animation
pub mod stream_scroll;   // Live output scroller
```

---

## Do-Not-Copy Boundaries (Critical)

| Anti-Pattern | Why It Fails | Alternative |
|--------------|--------------|-------------|
| Animation in `View()` | String rebuild every frame = stutter | Animate in Rust FB, Bubble Tea just displays |
| SIXEL as primary renderer | Terminal support <30% | Use only for optional image previews |
| Layout system for motion | Grid-snapped, no sub-pixel | Use procedural engine for motion |
| Monolithic engine | Unmaintainable, wrong abstraction | Modular adapters + composable effects |
| Hardcoded effects | Can't adapt to agent states | Generative, parameterized effects |

---

## Next Steps

Confirm which deliverable you want first:
1. **Rust framebuffer crate design** (complete API spec + data structures)
2. **Bubble Tea bridge architecture** (FFI patterns + state sync)
3. **Braille scroller implementation** (working code for 2–3 line live scroller)

All three will be built, but sequence matters for your Rust→Go split.