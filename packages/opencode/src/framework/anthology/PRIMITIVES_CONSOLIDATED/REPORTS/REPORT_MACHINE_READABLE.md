# REPORT_MACHINE_READABLE.md
## Machine-Readable Specification for High-Quality TUIs

> **Purpose:** Structured specification that could feed into a code generator, linter, or design tool
> **Format:** JSON Schema-compatible Markdown with YAML frontmatter

---

```yaml
version: "1.0.0"
spec_type: "TUI_Architecture_Spec"
audience: ["code_generators", "linters", "design_tools", "runtime_validators"]
```

---

## 1. TUI Architecture Layers

```yaml
layers:
  - id: "terminal_emulator"
    name: "Terminal Emulator"
    responsibilities:
      - "renders ANSI escape sequences"
      - "handles keyboard/mouse input"
      - "manages window size"
      - "applies font rendering"
    interfaces:
      - "ANSI escape sequences"
      - "PTY (pseudo-terminal)"
      - "stdin/stdout"
    constraints:
      - "cell-based grid (no arbitrary pixel positioning)"
      - "limited color depth (4/8/24 bit)"
      - "character width constraints (1-2 cells per glyph)"

  - id: "framebuffer_core"
    name: "Framebuffer Core"
    responsibilities:
      - "maintains persistent cell buffer"
      - "tracks dirty regions"
      - "composites layered buffers"
      - "emits minimal ANSI output"
    data_structures:
      - type: "Framebuffer"
        fields:
          - name: "width"
            type: "usize"
            description: "terminal cells wide"
          - name: "height"
            type: "usize"
            description: "terminal cells tall"
          - name: "layers"
            type: "Vec<Layer>"
            description: "z-ordered rendering layers"
          - name: "dirty_regions"
            type: "Vec<Rect>"
            description: "cells changed since last render"
      - type: "Cell"
        fields:
          - name: "glyph"
            type: "char"
            description: "Unicode character to display"
          - name: "fg"
            type: "Color"
            description: "foreground color (24-bit)"
          - name: "bg"
            type: "Color"
            description: "background color (24-bit)"
          - name: "attrs"
            type: "Attributes"
            description: "bold, italic, underline, etc."
      - type: "Layer"
        fields:
          - name: "cells"
            type: "Vec<Cell>"
          - name: "blend_mode"
            type: "BlendMode"
            enum: ["Normal", "Multiply", "Screen", "Overlay", "Add", "Alpha"]
          - name: "z_index"
            type: "i32"

  - id: "glyph_encoder"
    name: "Glyph Encoder"
    responsibilities:
      - "converts pixels/subpixels to glyphs"
      - "selects optimal encoding per context"
      - "handles terminal capability fallbacks"
    encodings:
      - name: "ASCII"
        resolution: "1x1"
        characters: " .:-=+*#%@"
        fallback: true
      - name: "Block"
        resolution: "2x1"
        characters: "▀▄█"
      - name: "Braille"
        resolution: "4x2"
        range: "U+2800-U+28FF"
        patterns: 256
        recommended: true
      - name: "Sextant"
        resolution: "3x2"
        range: "U+1FB80-U+1FBAF"
        requires_unicode: 13
      - name: "Octant"
        resolution: "4x2"
        range: "U+1FB00-U+1FB47"
        requires_unicode: 16

  - id: "animation_engine"
    name: "Animation Engine"
    responsibilities:
      - "runs at target FPS (typically 60)"
      - "advances all active animations"
      - "emits frame events"
      - "manages particle systems"
    interfaces:
      - method: "add_animation(id, animation)"
      - method: "remove_animation(id)"
      - method: "tick(delta_ms)"
      - event: "on_frame_complete"

  - id: "effect_system"
    name: "Effect System"
    responsibilities:
      - "particle emitters"
      - "easing functions"
      - "decay/fade systems"
      - "text morph transitions"
    easing_functions:
      - name: "linear"
        formula: "t"
      - name: "ease_in_quad"
        formula: "t * t"
      - name: "ease_out_quad"
        formula: "t * (2 - t)"
      - name: "ease_out_elastic"
        formula: "-(2^(-10t)) * sin((10t - 10.75) * c4)"
      - name: "ease_out_bounce"
        formula: "n1 * t^2, ..."

  - id: "input_handler"
    name: "Input Handler"
    responsibilities:
      - "reads raw terminal input"
      - "parses escape sequences"
      - "dispatches events"
    protocols:
      - name: "XTerm Legacy"
        key_format: "escape sequences"
        modifiers: false
      - name: "Kitty Keyboard Protocol"
        key_format: "CSI u"
        modifiers: true
        release_events: true
      - name: "SGR Mouse"
        mouse_format: "CSI < button; x; y M/m"
        capabilities: ["buttons", "motion", "scroll"]
```

---

## 2. Rendering Pipeline Specification

```yaml
rendering_pipeline:
  stages:
    - id: "state_update"
      description: "application state changes"
      triggers: ["user_input", "async_result", "tick"]
      output: "StateDelta"

    - id: "layout_compute"
      description: "compute widget rects from constraints"
      input: "StateDelta"
      output: "LayoutResult"
      algorithms: ["flexbox", "grid", "constraint_solver"]

    - id: "framebuffer_mutate"
      description: "update framebuffer cells from layout"
      input: "LayoutResult"
      output: "Framebuffer (with dirty regions)"
      optimization: "only mutate changed cells"

    - id: "composite"
      description: "blend layers with blend modes"
      input: "Framebuffer"
      output: "CompositedFramebuffer"
      blend_modes: ["Normal", "Multiply", "Screen", "Add", "Alpha"]

    - id: "encode_glyphs"
      description: "encode cells to terminal glyphs"
      input: "CompositedFramebuffer"
      output: "GlyphBuffer"
      encoding_selection: "per-cell adaptive"

    - id: "emit_ansi"
      description: "generate minimal ANSI output"
      input: "GlyphBuffer"
      output: "ANSI String"
      optimizations:
        - "skip unchanged cells (dirty region)"
        - "compress consecutive identical codes"
        - "use shortest form for colors"
        - "omit redundant SGR reset"

  frame_rate:
    target_fps: 60
    max_fps: 120
    min_fps: 30
    adaptive_quality: true

  dirty_tracking:
    method: "cell-level bitmask"
    storage: "Vec<bool> per framebuffer"
    merge_rects: true
    max_dirty_regions: 1000
```

---

## 3. State Management Specification

```yaml
state_management:
  architecture: "Elm Architecture (The Elm Architecture)"
  pattern: "Model -> Update -> View -> Msg"

  model:
    immutability: true
    equality: "derived (Hash + Eq)"
    serialization: "serde"

  update:
    purity: "update function must be pure"
    side_effects: "encapsulated in Cmds"
    merge_strategy: "structural sharing"

  subscriptions:
    path_based: true
    granularity: "field-level"
    filter: "path prefix match"

  commands:
    types:
      - "IO (network, filesystem)"
      - "Timer (delayed execution)"
      - "Async (concurrent operation)"
      - "Batch (multiple commands)"

  undo_redo:
    pattern: "Command Pattern"
    max_stack: 1000
    merge_similar: true
    group_by: "intent"

  persistence:
    formats: ["JSON", "MessagePack", "CBOR"]
    autosave_interval: "30s"
    migration: "versioned with migration functions"
    atomic_writes: true
```

---

## 4. Input Processing Specification

```yaml
input_processing:
  modes:
    - id: "canonical"
      line_buffered: true
      echo: true
      special_chars: ["Ctrl+C", "Ctrl+Z"]
      use_case: "simple CLI tools"

    - id: "raw"
      line_buffered: false
      echo: false
      all_keys_delivered: true
      use_case: "full TUIs"

  key_protocols:
    - id: "xterm_legacy"
      escape_prefix: "\\x1b["
      modifiers: false
      release_events: false

    - id: "kitty"
      escape_prefix: "\\x1b[>1u"
      format: "CSI u (key_code; modifiers; unicode)"
      modifiers: true
      release_events: true

  mouse_protocols:
    - id: "x10"
      format: "\\x1b[M button x y"
      max_coords: 223

    - id: "sgr"
      format: "\\x1b[< button; x; y M/m"
      max_coords: 2000
      required_for: "modern TUIs"

  event_loop:
    polling: "poll/select/epoll"
    timeout_ms: 16  # 60 FPS
    events:
      - "KeyPress"
      - "KeyRelease"
      - "MousePress"
      - "MouseRelease"
      - "MouseMotion"
      - "Scroll"
      - "Resize"
      - "Paste"
      - "FocusGain"
      - "FocusLoss"

  focus_management:
    algorithm: "spatial (tab order)"
    wrap: true
    focus_indicators: ["underline", "box", "color"]
```

---

## 5. Terminal Capability Detection

```yaml
terminal_capabilities:
  detection_order:
    - "Kitty Keyboard Protocol negotiation (\\x1b[>1u)"
    - "True color support (COLORTERM=truecolor)"
    - "Unicode version (probe with wide chars)"
    - "Braille support (probe with U+2800)"
    - "Sixel support (probe with \\x1b[0q)"
    - "Kitty Graphics (probe with \\x1b_G)"
    - "Terminal size (ioctl TIOCGWINSZ)"

  capability_matrix:
    - capability: "truecolor"
      detection: "COLORTERM or terminfo RGB/Tc"
      fallback: "256 colors"
      fallback: "16 colors"
      fallback: "monochrome"

    - capability: "braille"
      detection: "Unicode support"
      fallback: "block characters"
      fallback: "ASCII"

    - capability: "sextant"
      detection: "Unicode 13+"
      fallback: "braille"

    - capability: "octant"
      detection: "Unicode 16+"
      fallback: "sextant"

    - capability: "kitty_graphics"
      detection: "TERM=xterm-kitty"
      fallback: "sixel"
      fallback: "unicode graphics"
      fallback: "ASCII art"
```

---

## 6. Performance Budgets

```yaml
performance_budgets:
  frame_time:
    target_ms: 16.67  # 60 FPS
    warning_ms: 20
    critical_ms: 33    # 30 FPS

  render_time:
    target_ms: 8
    warning_ms: 10
    critical_ms: 16

  input_latency:
    target_ms: 5
    warning_ms: 10
    critical_ms: 20

  memory:
    max_mb: 100
    warning_mb: 50

  escape_output:
    max_bytes_per_frame: 4096
    optimization: "dirty region + state compression"
```

---

## 7. Common Pitfalls (Linter Rules)

```yaml
lint_rules:
  - id: "no-animation-in-view"
    severity: "error"
    pattern: "animation logic inside View() function"
    reason: "causes GC stutter, recompute every frame"
    fix: "move animation to Rust framebuffer layer"

  - id: "no-full-redraw"
    severity: "warning"
    pattern: "rendering entire screen every frame"
    reason: "wastes CPU, stutters on large terminals"
    fix: "implement dirty region tracking"

  - id: "no-hardcoded-ansi"
    severity: "warning"
    pattern: "hardcoded escape sequences without capability check"
    reason: "breaks on terminals without that feature"
    fix: "use capability detection + fallback paths"

  - id: "no-blocking-io"
    severity: "error"
    pattern: "blocking I/O in render thread"
    reason: "freezes UI"
    fix: "use async I/O or dedicated I/O thread"

  - id: "no-assumed-size"
    severity: "warning"
    pattern: "hardcoded terminal dimensions"
    reason: "breaks on resize"
    fix: "query dynamic terminal size"

  - id: "no-wide-char-ignore"
    severity: "error"
    pattern: "string indexing without unicode_width check"
    reason: "CJK/emoji breaks layout"
    fix: "use char-aware measurement"

  - id: "no-atomic-update"
    severity: "warning"
    pattern: "multiple SetCell calls without flush"
    reason: "partial render visible"
    fix: "batch updates, flush once"
```

---

## 8. Human vs Machine Reasoning Differences

```yaml
reasoning_differences:
  human_reasoning:
    characteristics:
      - "perceives layout holistically"
      - "understands semantic context"
      - "expects smooth motion (60 FPS)"
      - "notices micro-stutters (16ms threshold)"
      - "prefers familiar patterns"
      - "tolerates loading spinners if animated"
      - "reads left-to-right, top-to-bottom"
      - "expects focus to follow attention"
      - "prefers declarative over imperative"
      - "wants 'alive' feedback for every action"
    failure_detection:
      - "stutters feel like broken UI"
      - "inconsistent motion feels buggy"
      - "missing affordances feel confusing"
      - "slow response feels broken"

  machine_reasoning:
    characteristics:
      - "processes cells as discrete grid"
      - "optimizes for throughput (cells/sec)"
      - "minimizes escape sequences"
      - "batches identical operations"
      - "prefers immutable state"
      - "treats time as discrete ticks"
      - "reasoning about dirty regions"
      - "reasoning about glyph encoding"
    optimization_targets:
      - "reduce ANSI bytes"
      - "minimize GC pressure"
      - "maximize frame rate"
      - "avoid unnecessary redraws"
      - "predictable memory usage"

  bridge_patterns:
    - "human expects smooth motion -> machine subdivides into ticks with easing"
    - "human sees content -> machine sees dirty regions to render"
    - "human sees 'alive' -> machine runs procedural noise at 60 FPS"
    - "human presses key -> machine parses escape + dispatches event"
    - "human expects instant -> machine prefetches + predicts"
```

---

## 9. TUI Classification Taxonomy

```yaml
tui_taxonomy:
  by_interaction_model:
    - category: "Navigational"
      examples: ["file browsers", "menu systems"]
      key_interaction: "move cursor, select"

    - category: "Editorial"
      examples: ["code editors", "text editors"]
      key_interaction: "insert, delete, navigate"

    - category: "Monitoring"
      examples: ["dashboards", "logs", "system status"]
      key_interaction: "scroll, filter, search"]

    - category: "Conversational"
      examples: ["chat clients", "agent runtimes", "REPLs"]
      key_interaction: "type, submit, stream"]

    - category: "Creative"
      examples: ["drawing tools", "music sequencers"]
      key_interaction: "draw, compose, manipulate"]

  by_complexity:
    - level: "Simple"
      cell_count: "< 1000"
      animation: "none"
      layout: "fixed"

    - level: "Moderate"
      cell_count: "1000 - 10,000"
      animation: "transitions"
      layout: "flex"

    - level: "Complex"
      cell_count: "10,000 - 100,000"
      animation: "particles, procedural"
      layout: "adaptive"

    - level: "Extreme"
      cell_count: "> 100,000"
      animation: "full framebuffer"
      layout: "dynamic with FOV culling"

  by_aesthetic:
    - style: "Minimal"
      colors: "monochrome or 16"
      effects: "none"
      motion: "none"

    - style: "Professional"
      colors: "256 or truecolor"
      effects: "subtle shadows"
      motion: "smooth transitions"

    - style: "Immersive"
      colors: "truecolor with gradients"
      effects: "glow, particles"
      motion: "continuous procedural"

    - style: "Experimental"
      colors: "full RGB"
      effects: "blend modes, chromatic aberration"
      motion: "physics-based"
```

---

## 10. Implementation Checklist

```yaml
implementation_checklist:
  foundations:
    - [ ] "PTY setup with raw mode"
    - [ ] "SIGWINCH handler for resize"
    - [ ] "Terminal capability detection"
    - [ ] "Unicode width handling (unicode-width crate)"
    - [ ] "RAII terminal cleanup guard"

  rendering:
    - [ ] "Framebuffer with dirty regions"
    - [ ] "Color downsampling (truecolor -> 256 -> 16)"
    - [ ] "Braille/block encoder adapters"
    - [ ] "Double buffering (optional)"
    - [ ] "Layer compositing with blend modes"

  animation:
    - [ ] "Fixed timestep game loop (60 FPS)"
    - [ ] "Easing function library"
    - [ ] "Tween system"
    - [ ] "Particle system base"
    - [ ] "Spring physics"

  input:
    - [ ] "Kitty keyboard protocol support"
    - [ ] "SGR mouse support"
    - [ ] "Bracketed paste mode"
    - [ ] "Focus management"
    - [ ] "Hit testing for mouse"

  state:
    - [ ] "Elm architecture (Model/Update/View)"
    - [ ] "Immutable state updates"
    - [ ] "Subscription system"
    - [ ] "Undo/redo (command pattern)"

  layout:
    - [ ] "Box model (margin/border/padding/content)"
    - [ ] "Flexbox layout"
    - [ ] "Grid layout"
    - [ ] "Responsive breakpoints"

  widgets:
    - [ ] "Widget trait"
    - [ ] "Container widgets (Stack, Flex, Grid)"
    - [ ] "Primitive widgets (Text, Button, Input, List)"
    - [ ] "Widget lifecycle (mount/update/unmount)"

  polish:
    - [ ] "Smooth scrolling with momentum"
    - [ ] "Loading spinners"
    - [ ] "Toast notifications"
    - [ ] "Error state styling"
    - [ ] "Empty state handling"
```

---

## 11. Rendering Anti-Patterns

```yaml
anti_patterns:
  - id: "string_concatenation"
    name: "String Concatenation Rendering"
    severity: "critical"
    description: "Rebuilding entire UI string every frame"
    why_bad:
      - "O(n) allocation per frame"
      - "GC pressure causes stutter"
      - "No dirty tracking"
      - "Animation impossible"
    solution: "Framebuffer with dirty regions"

  - id: "animation_in_view"
    name: "Animation in View() function"
    severity: "critical"
    description: "Updating animation state inside render function"
    why_bad:
      - "Non-deterministic rendering"
      - "Cannot replay/debug"
      - "Binds animation to frame rate"
    solution: "Separate animation engine from renderer"

  - id: "hardcoded_escapes"
    name: "Hardcoded Escape Sequences"
    severity: "high"
    description: "Assuming terminal supports specific sequences"
    why_bad:
      - "Breaks on incompatible terminals"
      - "No graceful degradation"
    solution: "Capability detection + abstraction layer"

  - id: "blocking_io_in_render"
    name: "Blocking I/O in Render Thread"
    severity: "critical"
    description: "Network/file I/O during render"
    why_bad:
      - "Freezes entire UI"
      - "Unresponsive during waits"
    solution: "Async I/O with message passing"

  - id: "no_dirty_tracking"
    name: "No Dirty Region Tracking"
    severity: "high"
    description: "Rendering entire screen every frame"
    why_bad:
      - "Wastes CPU"
      - "Cannot scale to large terminals"
    solution: "Cell-level dirty bitmask"

  - id: "single_encoding"
    name: "Single Glyph Encoding"
    severity: "medium"
    description: "Committing to ASCII/Braille globally"
    why_bad:
      - "Suboptimal fidelity"
      - "Poor compatibility tradeoffs"
    solution: "Per-cell adaptive encoding"
```

---

## 12. Animation State Machine

```yaml
animation_state_machine:
  states:
    - id: "idle"
      transitions: ["running"]

    - id: "running"
      transitions: ["paused", "stopped", "completed"]

    - id: "paused"
      transitions: ["running", "stopped"]

    - id: "completed"
      transitions: ["running", "stopped"]

    - id: "stopped"
      transitions: ["running"]

  animation_types:
    - id: "tween"
      properties: ["start", "end", "duration", "easing"]
      loop: false
      reverse: false

    - id: "particle_emitter"
      properties: ["position", "rate", "template"]
      loop: true
      reverse: false

    - id: "spring"
      properties: ["current", "target", "stiffness", "damping"]
      loop: false
      reverse: false

    - id: "noise_field"
      properties: ["seed", "scale", "octaves"]
      loop: true
      reverse: false
```

---

## 13. Agent Runtime Integration Points

```yaml
agent_integration:
  events:
    - id: "agent_initializing"
      ui_effect: "progress bar + status text"
      animation: "spinner"

    - id: "agent_thinking"
      ui_effect: "watermark gaze shift"
      animation: "breathing pulse"

    - id: "agent_streaming"
      ui_effect: "live scroller"
      animation: "wave propagation"

    - id: "agent_error"
      ui_effect: "error panel + particle burst"
      animation: "shake + red glow"

    - id: "agent_success"
      ui_effect: "success toast"
      animation: "confetti burst"

  state_sources:
    - "agent process stdout/stderr"
    - "IPC socket (Unix domain socket)"
    - "WebSocket (remote agent)"
    - "stdin (interactive agent)"

  bidirectional_sync:
    ui_to_agent:
      - "scroll position -> pause/resume streaming"
      - "text selection -> copy to clipboard"
      - "button press -> interrupt agent"
    agent_to_ui:
      - "state transition -> animation trigger"
      - "output stream -> scroller update"
      - "error -> alert display"
```

---

## 14. Testing Specification

```yaml
testing:
  unit_tests:
    - "cell_width calculation for Unicode"
    - "easing function accuracy"
    - "layout constraint solving"
    - "dirty region computation"
    - "escape sequence generation"
    - "color conversion (RGB -> ANSI)"

  integration_tests:
    - "full render pipeline"
    - "input parsing (keyboard/mouse)"
    - "state update -> view"
    - "animation frame accuracy"
    - "resize handling"
    - "capability negotiation fallbacks"

  visual_regression:
    - "capture ANSI output"
    - "diff against golden master"
    - "ignore timestamps/dynamic content"
    - "test on multiple terminals"

  performance_tests:
    - "frame time under load"
    - "memory usage over time"
    - "escape sequence output size"
    - "dirty region efficiency"
    - "particle count vs FPS"

  accessibility_tests:
    - "color contrast ratios"
    - "keyboard navigability"
    - "screen reader announcement"
    - "focus indicator visibility"
```

---

## 15. Deployment Targets

```yaml
deployment:
  platforms:
    - id: "linux"
      terminals: ["kitty", "alacritty", "foot", "wezterm", "gnome-terminal"]
      recommended: "kitty or alacritty"

    - id: "macos"
      terminals: ["kitty", "alacritty", "wezterm", "iTerm2"]
      recommended: "kitty or wezterm"

    - id: "windows"
      terminals: ["Windows Terminal", "ConEmu"]
      recommended: "Windows Terminal"

  bundling:
    - "static binary (Rust musl)"
    - "Homebrew tap (macOS)"
    - "apt/yum repo (Linux)"
    - "winget (Windows)"

  runtime_requirements:
    - "Unicode 13+ (for sextant)"
    - "UTF-8 locale"
    - "TERM set correctly"
```

```

---

**End of Machine-Readable Report**