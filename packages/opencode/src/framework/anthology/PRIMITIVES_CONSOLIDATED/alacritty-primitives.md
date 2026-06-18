# Alacritty TUI Primitives

## Overview
Alacritty is a GPU-accelerated terminal emulator that demonstrates excellent TUI architecture. This analysis covers the key primitives for building terminal applications.

## Core Architecture

### 1. Terminal Emulation Engine

**State Machine (`Term` class):**
- Manages 27+ bitflag terminal modes (INSERT, LINEWRAP, BRACKETED_PASTE, etc.)
- Handles ANSI/VT100 escape sequence parsing
- Maintains cursor state, color palettes, and screen buffer
- Implements Vi-mode navigation and selection

**Grid Data Structure:**
```rust
struct Grid {
    rows: Vec<Row>,
    scrollback: Storage,
    mode: TermMode,
}
```
- Efficient 2D character storage with scrollback
- Dirty region tracking for incremental rendering
- O(1) cell access with lazy allocation

**Cell Representation:**
```rust
struct Cell {
    c: char,
    fg: Color,
    bg: Color,
    flags: CellFlags, // 32-bit bitfield for formatting
}
```
- 20-byte footprint per cell
- Supports Unicode, combining characters, emoji
- Bitflags for bold, italic, underline, dim, etc.

### 2. GPU Rendering Pipeline

**Renderer Architecture:**
- Dual-pipeline support: GLES2 (fallback) and GLSL 3.3 (optimized)
- Shader-based text rendering with font support
- Batch drawing for performance
- Damage tracking for efficient redraws

**Glyph Cache:**
- Texture atlas for character glyphs
- LRU eviction policy
- Dynamic font size support
- Ligature rendering (via external crates)

**Render Passes:**
1. Clear background
2. Draw visible grid cells (batched by color/style)
3. Render cursor (blinking, shape variants)
4. Draw selection highlight
5. Overlay (opacity, blur, image backgrounds)

### 3. Input Handling System

**Event Processing:**
```rust
enum Event {
    Keyboard(KeyEvent),
    Mouse(MouseEvent),
    Paste(String),
    Resize(Size),
}
```

**Key Binding System:**
- Mode-aware bindings (normal, insert, Vi, search)
- Modifier combinations (Ctrl, Alt, Shift, Super)
- Action types:
  - Send escape sequences
  - Execute commands
  - Clipboard operations
  - Window control
  - Scrolling

**Mouse Handling:**
- Button bindings (right-click, middle-click, wheel)
- Motion reporting modes (SGR, UTF-8, basic)
- Selection with drag
- Context menu invocation

**Input Protocols:**
- Kitty keyboard protocol (disambiguation, event types)
- Xterm mouse protocol
- Bracketed paste
- OSC 8 hyperlinks

### 4. Configuration System

**Hierarchical Loading:**
```
CLI args → User config → System config → Defaults
```

**Format Support:**
- TOML (primary)
- YAML (deprecated but supported)
- Import statements for modularity

**Configuration Schema:**
```toml
[font]
family = "JetBrains Mono"
size = 12.0
[window]
opacity = 0.8
blur = true
[terminal]
osc52 = true
[scrolling]
history = 10000
[mouse]
hide_when_typing = true
```

**Hot Reload:**
- File watcher for config changes
- Graceful application of new settings
- No restart required

### 5. Cross-Platform Support

**Window Backends:**
- X11 (Linux/Unix)
- Wayland (modern Linux)
- Windows (Win32 API)
- macOS (Cocoa)

**PTY Management:**
- Unix PTY via `rustix`
- Windows ConPTY
- Signal handling
- Job control

### 6. Performance Optimizations

**Memory:**
- Cell pooling to reduce allocations
- Ring buffer for scrollback
- Zero-copy where possible

**Rendering:**
- Damage tracking (only redraw changed regions)
- Batch drawing (minimize OpenGL calls)
- GPU texture caching

**Threading:**
- Separate rendering thread
- Lock-free queue for events
- Async I/O for PTY

## Key Design Patterns

### Separation of Concerns
- `alacritty_terminal` crate: Pure terminal logic, testable
- `alacritty` binary: UI, events, platform integration
- Clear boundary between emulation and presentation

### Immutable State Updates
- Copy-on-write for grid modifications
- Functional style for state transitions
- Easier reasoning and testing

### Event-Driven Architecture
- Event loop processes all input
- Commands queued for execution
- Non-blocking I/O

## Implementation Guide

### Building a Terminal Application

```rust
// 1. Initialize terminal
let mut term = Term::new(config, size);

// 2. Setup event loop
let mut event_loop = EventLoop::new();

// 3. Register handlers
event_loop.add_handler(Event::Keyboard, |event| {
    term.key_input(event.key);
    term.render_if_needed();
});

// 4. Run loop
event_loop.run();
```

### Adding Custom Escapes

```rust
// In config:
[[keyboard.bindings]]
key = "F1"
action = "SendString"
command = "\x1b[11~"

// Or in code:
term.send_private_mode(PrivateMode::DECKRMode);
```

### Custom Rendering

```rust
// Override render method
struct MyRenderer {
    renderer: alacritty::Renderer,
}

impl MyRenderer {
    fn render(&mut self, term: &Term) {
        // Custom background
        self.draw_background();
        
        // Standard terminal rendering
        self.renderer.render(term);
        
        // Overlay UI
        self.draw_status_bar();
    }
}
```

## Best Practices

1. **Use the terminal crate** for emulation, don't reinvent
2. **Leverage GPU** for text rendering when possible
3. **Track damage** to avoid full redraws
4. **Support standard escapes** for compatibility
5. **Cache glyphs** to reduce texture uploads
6. **Handle Unicode** properly (width, combining chars)
7. **Respect user config** for colors, fonts, bindings
8. **Test with real terminals** (screen, tmux, etc.)

## Common Pitfalls

- Forgetting to update dirty regions after scroll
- Not handling wide characters (emoji, CJK)
- Ignoring bracketed paste mode
- Poor Unicode width calculation
- Race conditions in event processing
- Memory leaks from unclosed PTY

## Extensions

### Plugins/Extensions
- Search mode with regex
- Sync scrolling across windows
- Remote terminal (SSH-like)
- Custom status bars
- Tabbed interface

### Integration
- Neovim integration (terminals as buffers)
- tmux integration
- Docker container terminals
- Remote desktop terminals

---

This architecture demonstrates a clean separation between terminal emulation (the "brain") and rendering/UI (the "face"), making it easy to build custom frontends while reusing the proven emulation engine.
