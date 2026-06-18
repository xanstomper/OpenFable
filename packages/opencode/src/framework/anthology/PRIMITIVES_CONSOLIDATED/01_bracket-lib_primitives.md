# Bracket-Lib Terminal Primitives Report

## Overview
Bracket-lib (formerly RLTK) is a comprehensive Rust TUI framework with modular, multi-crate architecture supporting multiple backends (OpenGL, WebGPU, Crossterm, Curses).

## Root Primitives

### 1. Console/Buffer System
**Location:** `bracket-terminal/src/consoles/`

**Core Types:**
- `VirtualConsole` - Off-screen buffer for double-buffering
- `DrawBatch` - Batched rendering for performance optimization
- `SparseConsole` - Memory-efficient console with background layers
- `SpriteConsole` - Layered sprite rendering with z-ordering
- `FlexibleConsole` - Scalable console with resizing support
- `SimpleConsole` - Basic character cell buffer

**Reusable Patterns:**
```rust
// Double-buffered rendering pattern
console.clear();
console.set(x, y, color, glyph);
context.draw_batch(batch);
context.flush();
```

**Cross-language applicability:** Universal pattern for any TUI

### 2. Terminal Backend Abstraction (BTerm)
**Location:** `bracket-terminal/src/bterm.rs`, `hal/`

**Core Concepts:**
- `BTermInternal` - Central state management for fonts, shaders, consoles
- `DisplayConsole` - Wrapper connecting console to shader/font
- `BTermPlatform` trait - Backend abstraction layer
- Hardware abstraction layer (HAL) with multiple implementations

**Backends:**
- OpenGL (desktop)
- WebGPU (web/desktop)
- Crossterm (terminal-native)
- Curses (POSIX terminal)

**Reusable Pattern:**
```rust
trait BTermPlatform {
    fn get_dimensions(&self) -> (u32, u32);
    fn present(&mut self) -> BResult<()>;
    fn get_input_state(&self) -> Vec<BEvent>;
}
```

**Cross-language applicability:** Highly portable - any language can implement backend abstraction

### 3. Input System
**Location:** `bracket-terminal/src/input/`

**Core Types:**
- `BEvent` - Unified event type (key, mouse, focus, resize)
- `VirtualKeyCode` - Platform-agnostic key enumeration
- `Input` - Centralized input state with lazy_static global
- Event queue with parking_lot Mutex for thread safety

**Event Types:**
- KeyPress, KeyUp
- MouseMove, MouseMoveDelta
- MousePress, MouseUp
- MouseWheel
- Suspend, Resume
- TerminalResize

**Reusable Pattern:**
```rust
enum BEvent {
    KeyPress { key: VirtualKeyCode, modifiers: Modifiers },
    MouseMove { x: i32, y: i32 },
    TerminalResize { width: u32, height: u32 },
    // ...
}
```

### 4. Geometry Primitives
**Location:** `bracket-geometry/src/`

**Core Types:**
- `Point` / `Point3` - 2D and 3D integer coordinates
- `PointF` - Floating-point coordinates
- `Rect` - Rectangle with size/position operations
- `LineAlg` - Line drawing algorithms (Bresenham, DDA)
- `DistanceAlg` - Distance calculations (Pythagoras, Manhattan, Chebyshev)
- `BresenhamCircle` - Circle plotting iterator

**Reusable Functions:**
- `line2d(algorithm, start, end)` - Line generation
- `distance_2d(algorithm, a, b)` - Distance calculation
- Rect containment, intersection, center operations

**Cross-language applicability:** Pure math - directly portable

### 5. Color System
**Location:** `bracket-color/src/`

**Core Types:**
- `RGB` - RGB color with f32 components
- `RGBA` - RGB with alpha
- `HSV` - HSV color space
- `ColorPair` - Foreground/background color combination
- Named colors (W3C web colors)

**Operations:**
- `lerp(other, factor)` - Linear interpolation
- `to_greyscale()` - Grayscale conversion
- `desaturate()` - Desaturation
- `to_hsv()` / `from_hsv()` - Color space conversion

**Reusable Pattern:**
```rust
struct RGB { r: f32, g: f32, b: f32 }
struct ColorPair { foreground: RGB, background: RGB }
```

### 6. Random/Dice System
**Location:** `bracket-random/src/`

**Features:**
- Dice notation parsing ("3d6+12")
- Distribution sampling
- Seeded random (including JS seed for WASM)
- Iterator-based dice rolling

### 7. Pathfinding
**Location:** `bracket-pathfinding/src/`

**Algorithms:**
- A* (A-Star) pathfinding
- Dijkstra maps
- Distance field generation

### 8. Noise Generation
**Location:** `bracket-noise/src/`

**Features:**
- Perlin noise
- Simplex noise
- Value noise
- 1D/2D/3D/4D noise

### 9. Font/Texture System
**Location:** `bracket-terminal/src/hal/`

**Features:**
- Multi-font support
- Font atlasing
- Glyph-to-codepoint mapping
- Embedded resources via bracket-embedding

### 10. Game State System
**Location:** `bracket-terminal/src/gamestate.rs`

**Pattern:**
```rust
trait GameState {
    fn tick(&mut self, ctx: &mut BTerm) -> BResult<()>;
}
```

## Architecture Patterns

### 1. Modular Crate Design
Each subsystem is a separate crate:
- `bracket-algorithm-traits` - Shared traits
- `bracket-color` - Color management
- `bracket-geometry` - Geometric primitives
- `bracket-noise` - Noise generation
- `bracket-pathfinding` - Pathfinding
- `bracket-random` - RNG/dice
- `bracket-terminal` - Core TUI
- `bracket-embedding` - Resource embedding

### 2. Backend Feature Flags
```toml
[features]
crossterm = ["bracket-terminal/crossterm"]
curses = ["bracket-terminal/curses"]
opengl = ["bracket-terminal/opengl"]
webgpu = ["bracket-terminal/webgpu"]
```

### 3. Entity-Component Integration
Optional `specs` feature for ECS integration:
```rust
#[cfg(feature = "specs")]
use specs::Component;
```

### 4. Serialization Support
Optional `serde` feature for all primitives

### 5. Threaded Performance
Optional `threaded` feature for parallel operations

## Reusability Assessment

| Primitive | Reusability | Language Portability | Notes |
|-----------|-------------|---------------------|-------|
| Console Buffer | ★★★★★ | Universal | Core TUI pattern |
| Backend Abstraction | ★★★★★ | Universal | Essential for cross-platform |
| Input System | ★★★★★ | Universal | Event-driven pattern |
| Geometry | ★★★★★ | Universal | Pure math |
| Color System | ★★★★★ | Universal | Standard color theory |
| Pathfinding | ★★★★☆ | Universal | Algorithm is portable |
| Noise | ★★★★★ | Universal | Pure math |
| Dice/RNG | ★★★★☆ | Universal | Parsing is language-specific |
| Font System | ★★★☆☆ | Medium | Platform-specific loading |
| Game State | ★★★★☆ | Universal | Simple trait pattern |

## Implementation Recommendations

1. **Start with Console + Input** - Core TUI foundation
2. **Add Geometry + Color** - Essential for any visual output
3. **Implement Backend Abstraction** - Enables cross-platform
4. **Layer on advanced features** - Pathfinding, noise, etc.

## Files of Interest
- `bracket-terminal/src/bterm.rs` - Main terminal context
- `bracket-terminal/src/initializer.rs` - Builder pattern for setup
- `bracket-terminal/src/consoles/console.rs` - Console trait definition
- `bracket-geometry/src/point.rs` - Point implementation
- `bracket-color/src/rgb.rs` - RGB implementation
