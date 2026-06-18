# Anthology: Theming Systems

> **Subject:** Theming Systems — consistent visual design across TUIs
> **Includes:** How-to Guide + Novel Concepts Report + Enhanced Primitive Analysis

---

# PART 1: HOW-TO GUIDE

## Theming Systems Mastery

### 14.1 Theme Architecture

```rust
pub struct Theme {
    pub name: String,
    pub version: String,
    pub author: String,
    pub colors: ColorPalette,
    pub typography: Typography,
    pub spacing: SpacingScale,
    pub borders: BorderStyles,
    pub effects: EffectStyles,
    pub semantic: SemanticColors,
    pub widgets: WidgetThemes,
}

pub struct ColorPalette {
    pub primary: Color,
    pub secondary: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    pub info: Color,
    pub background: Color,
    pub surface: Color,
    pub on_primary: Color,
    pub on_background: Color,
    pub neutral: Vec<Color>,  // 50-900 scale
}

pub struct Typography {
    pub font_family: String,
    pub font_size: u8,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub font_weights: HashMap<String, u32>,
}

pub struct SpacingScale {
    pub unit: usize,
    pub scale: Vec<usize>,  // 0, 1, 2, 3, 4, 6, 8, 12, 16, 24
}

pub struct SemanticColors {
    pub text_primary: Color,
    pub text_secondary: Color,
    pub text_disabled: Color,
    pub border_default: Color,
    pub border_focused: Color,
    pub border_error: Color,
    pub shadow: Color,
}
```

### 14.2 Theme Switching at Runtime

```rust
pub struct ThemeManager {
    pub current: Theme,
    pub themes: HashMap<String, Theme>,
    pub listeners: Vec<Box<dyn ThemeListener>>,
    pub auto_switch: bool,
}

pub trait ThemeListener {
    fn on_theme_change(&mut self, old: &Theme, new: &Theme);
}

impl ThemeManager {
    pub fn apply(&mut self, name: &str) -> Result<(), ThemeError> {
        let new_theme = self.themes.get(name)
            .ok_or(ThemeError::NotFound)?
            .clone();

        let old_theme = std::mem::replace(&mut self.current, new_theme.clone());

        for listener in &mut self.listeners {
            listener.on_theme_change(&old_theme, &new_theme);
        }

        self.persist_current(name);
        Ok(())
    }

    pub fn detect_system_theme(&self) -> Option<String> {
        // Check OS theme (dark/light)
        #[cfg(target_os = "macos")]
        {
            let output = Command::new("defaults")
                .args(&["read", "-g", "AppleInterfaceStyle"])
                .output()
                .ok()?;
            let theme = String::from_utf8_lossy(&output.stdout);
            if theme.contains("Dark") {
                Some("dark".to_string())
            } else {
                Some("light".to_string())
            }
        }

        #[cfg(target_os = "linux")]
        {
            // Check gsettings or other DE-specific methods
            let _ = std::env::var("GTK_THEME");
            // ...
        }

        None
    }
}
```

### 14.3 Color Utilities

```rust
pub struct ColorUtils;

impl ColorUtils {
    pub fn blend(a: &Color, b: &Color, t: f32) -> Color {
        let t = t.clamp(0.0, 1.0);
        Color {
            r: (a.r as f32 * (1.0 - t) + b.r as f32 * t) as u8,
            g: (a.g as f32 * (1.0 - t) + b.g as f32 * t) as u8,
            b: (a.b as f32 * (1.0 - t) + b.b as f32 * t) as u8,
        }
    }

    pub fn darken(color: &Color, amount: f32) -> Color {
        let factor = 1.0 - amount;
        Color {
            r: (color.r as f32 * factor) as u8,
            g: (color.g as f32 * factor) as u8,
            b: (color.b as f32 * factor) as u8,
        }
    }

    pub fn lighten(color: &Color, amount: f32) -> Color {
        let blend = Color::WHITE;
        Self::blend(color, &blend, amount)
    }

    pub fn complementary(color: &Color) -> Color {
        let (h, s, v) = Self::rgb_to_hsv(color.r, color.g, color.b);
        let h = (h + 180.0) % 360.0;
        Self::hsv_to_rgb(h, s, v)
    }

    pub fn analogous(color: &Color, angle: f32) -> (Color, Color) {
        let (h, s, v) = Self::rgb_to_hsv(color.r, color.g, color.b);
        let h1 = (h + angle) % 360.0;
        let h2 = (h - angle + 360.0) % 360.0;
        (
            Self::hsv_to_rgb(h1, s, v),
            Self::hsv_to_rgb(h2, s, v),
        )
    }

    pub fn text_color_for_background(bg: &Color) -> Color {
        let luminance = Self::relative_luminance(bg);
        if luminance > 0.5 {
            Color::BLACK
        } else {
            Color::WHITE
        }
    }
}
```

### 14.4 Theme File Format

```yaml
# theme.yaml
name: "Tokyo Night"
version: "1.0.0"
author: "Tokyo Night Theme"

colors:
  primary: "#7aa2f7"
  secondary: "#bb9af7"
  success: "#9ece6a"
  warning: "#e0af68"
  danger: "#f7768e"
  info: "#7dcfff"

  background: "#1a1b26"
  surface: "#16161e"

  on_primary: "#1a1b26"
  on_background: "#c0caf5"

  neutral:
    - "#414868"  # 50
    - "#565f89"  # 100
    - "#737aa2"  # 200
    - "#9aa5ce"  # 300
    - "#c0caf5"  # 400
    - "#cfc9c2"  # 500
    - "#d5d6db"  # 600

typography:
  font_family: "JetBrains Mono"
  font_size: 12
  line_height: 1.5
  letter_spacing: 0.0

spacing:
  unit: 1
  scale: [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32]

widgets:
  button:
    normal: { fg: "#c0caf5", bg: "#7aa2f7" }
    hover: { fg: "#1a1b26", bg: "#9ece6a" }
    pressed: { fg: "#1a1b26", bg: "#5a87f7" }
    disabled: { fg: "#565f89", bg: "#16161e" }

  input:
    normal: { fg: "#c0caf5", bg: "#16161e", border: "#414868" }
    focused: { fg: "#c0caf5", bg: "#1a1b26", border: "#7aa2f7" }
    error: { fg: "#f7768e", bg: "#1a1b26", border: "#f7768e" }

  scrollbar:
    track: "#16161e"
    thumb: "#414868"
    thumb_hover: "#565f89"
```

### 14.5 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Hardcoded colors | No theming support | Use semantic color names |
| No contrast check | Unreadable in some terminals | Check WCAG AA |
| Too many themes | Maintenance burden | Start with light/dark |
| No fallbacks | Broken on downgrade | Default theme always works |
| Missing color profile detection | Colors wrong on limited terminals | Detect and downsample |
| Partial xterm theme object | Inconsistent colors across terminals | Declare all 17 xterm keys |
| No style inheritance | Duplication across widget states | Use base style + overrides |

---

# PART 2: NOVEL CONCEPTS REPORT

## Theming Systems: Untapped Opportunities

### Concept 1: Context-Adaptive Themes

**Idea:** Theme that **automatically adjusts** based on usage context.

```rust
pub struct ContextAdaptiveTheme {
    base: Theme,
    overrides: HashMap<Context, PartialTheme>,
}

pub enum Context {
    Daytime,
    Nighttime,
    Presenting,      // Screen sharing
    LowBattery,
    HighContrast,    // Accessibility
    ColorBlind(BlindType),
}

impl ContextAdaptiveTheme {
    pub fn effective_theme(&self, ctx: Context) -> Theme {
        let mut theme = self.base.clone();
        if let Some(override_) = self.overrides.get(&ctx) {
            theme.apply(override_);
        }
        theme
    }
}
```

**Novel because:** TUIs use static themes. Context adaptation = always-optimal readability.

**Complexity:** Medium
**Value:** Medium (better UX, accessibility)

---

### Concept 2: Behavioral Theme Learning

**Idea:** System **learns user preferences** from interactions.

```rust
pub struct ThemeLearning {
    preferences: HashMap<String, f32>,
    feedback_history: Vec<ThemeFeedback>,
}

pub struct ThemeFeedback {
    pub alternative: Theme,
    pub chosen: bool,
    pub duration_used: Duration,
    pub context: Context,
}

impl ThemeLearning {
    pub fn update_from_feedback(&mut self, feedback: ThemeFeedback) {
        if feedback.chosen {
            *self.preferences.entry(feedback.alternative.name.clone()).or_insert(0.0) += 1.0;
        }
    }

    pub fn suggest_theme(&self) -> Option<String> {
        let best = self.preferences.iter()
            .max_by(|a, b| a.1.total_cmp(b.1));
        best.map(|(name, _)| name.clone())
    }
}
```

**Novel because:** TUIs require manual theme selection. Learning = automatic personalization.

**Complexity:** Medium
**Value:** Medium (better UX over time)

---

**End of Theming Systems Anthology**

---

# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Color System Primitives from Frameworks

The color system converges across all frameworks on the same layered primitive stack:
- **16 ANSI colors** (8 normal + 8 bright) — universal baseline, xterm-compatible
- **256-color palette** (16 ANSI + 6×6×6 color cube + 24 grayscale ramp) — near-universal
- **24-bit truecolor** (16M RGB) — supported by Kitty, WezTerm, VTE, iTerm2, Windows Terminal
- **Color pair / style object** — fg/bg combination as a single semantic unit

Libcaca's `caca_set_color_ansi()` and `caca_set_color_rgb()` show the C-level version with bold/italic/underline/blink bit flags. Brackets-lib's `ColorPair { foreground: RGB, background: RGB }` with `lerp()`, `desaturate()`, `to_greyscale()` operations shows the operation set. Rich's `Style` compiles to an ANSI string once and caches it — this is the critical optimization: compile styles upfront, not per-cell. Textual's color system supports color profiles, blending, and opacity. Kitty's palette API (OSC 4 ; index ; rgb) enables dynamic palette modification at runtime.

**Color profile detection** (from Colorprofile): The detection cascade is:
1. Check `NO_COLOR` env var (disables all color if set)
2. Check `COLORTERM=truecolor` for 24-bit support
3. Check `TERM` for `256` substring
4. Fall through to ASCII if detection fails
5. Check if output is a TTY at all (NoTTY profile for piped output)

This cascade must be resolved before any color value is emitted. The theme system should store colors in a profile-agnostic format (e.g., hex RGB) and resolve to the target profile at render time.

## 3.2 Theme Architecture Primitives

Lipgloss establishes the style primitive contract: a `Style` is a value type (immutable, composable via `.Inherit()`) that produces an ANSI string. Textual's CSS cascade resolves conflicts via specificity and source order — the same algorithm browsers use. Rich uses a `Style` object with `.render()` method that returns a `(text, style)` `Segment`. For theme systems in practice: define semantic color tokens (`success`, `warning`, `error`, `muted`, `border`) mapped to concrete values per theme. All color decisions in application code reference tokens, never raw values. This enables dark/light mode switching by swapping one mapping.

**Style composition** (from Rich/Lipgloss): Styles compose via bitfield merging. The right-hand style takes precedence for explicitly-set attributes, while unset attributes inherit from the left-hand style. This is the foundation for theme inheritance: a base theme defines defaults, and per-widget overrides compose on top without duplicating the entire theme.

**Lipgloss `LightDark` primitive:** A function that takes a boolean (is dark background) and returns a selector function. This enables per-color dark/light adaptation without duplicating the entire theme definition:

```go
ld := lipgloss.LightDark(hasDarkBackground)
titleColor := ld(lipgloss.Color("#333"), lipgloss.Color("#fff"))
```

**Lipgloss `Complete` primitive:** Extends `LightDark` to a 3-tier fallback across color profiles:

```go
complete := lipgloss.Complete(profile)
color := complete(
    lipgloss.Color("1"),       // ANSI 4-bit fallback
    lipgloss.Color("124"),     // ANSI 256 fallback
    lipgloss.Color("#ff34ac"), // True color
)
```

This pattern means a single theme definition works across all terminal capabilities — the framework selects the best available color at render time.

## 3.3 Textual's CSS Cascade for Theming

Textual implements a full CSS cascade engine for TUIs. The theming implications are significant:

- **Selector specificity:** Widget type selectors (`Button`) have lower specificity than ID selectors (`#submit`) which have lower specificity than inline styles. This mirrors web CSS and enables layered theming.
- **Source order:** Later rules override earlier ones when specificity is equal. Theme files loaded later override defaults.
- **Inheritance:** Properties like `color` and `text-style` inherit from parent widgets unless explicitly overridden. This means setting `color` on a container propagates to all children.
- **Reactive re-rendering:** When a reactive attribute (including theme tokens) changes, Textual automatically re-renders affected widgets. This is the gold standard for theme switching — change one value, the entire UI updates.

```css
/* Textual CSS theming example */
App {
    background: #1a1b26;
    color: #c0caf5;
}

Button {
    background: #7aa2f7;
    color: #1a1b26;
    text-style: bold;
}

Button:hover {
    background: #9ece6a;
}

#submit-button {
    background: #f7768e;
}
```

## 3.4 Glamour's Stylesheet-Driven Theming

Glamour uses JSON/YAML stylesheets to define markdown rendering themes. The key primitive patterns:

- **Declarative stylesheet:** Theme is data, not code. A JSON file maps markdown elements (h1, code, blockquote) to style properties (color, backgroundColor, textDecoration, margin, padding).
- **Deterministic rendering:** Glamour deliberately does NOT perform color downsampling internally. Same input → same output, always. Color adaptation is delegated to Lipgloss or Colorprofile. This separation of concerns is critical: the theme defines intent, the renderer handles capability negotiation.
- **Environment-driven config:** `GLAMOUR_STYLE` environment variable points to a stylesheet file. This enables per-project or per-user theming without code changes.

```json
{
  "name": "Minimal",
  "styles": {
    "h1": { "color": "#6b50ff", "textDecoration": "bold", "margin": "1 0" },
    "p": { "color": "#ffffff", "margin": "0 0 1 0" },
    "code": { "backgroundColor": "#2d2d2d", "color": "#ff8080", "padding": "0 1" }
  }
}
```

## 3.5 Rich's Bitfield Style System

Rich's `Style` uses a bitfield for terminal attributes (bold, italic, underline, etc.) with a parallel `set_attributes` bitfield tracking which attributes are explicitly set vs. inherited. This enables:

- **Efficient composition:** Style merge is a bitwise OR/AND operation, not a struct comparison.
- **Selective override:** Only explicitly-set attributes override the base; unset attributes inherit.
- **ANSI code generation:** The bitfield maps directly to SGR codes (bit 0 → code 1 for bold, bit 2 → code 3 for italic, etc.).

The `Segment` primitive (text + style + control codes as a single unit) is the atomic rendering element. A styled string is a `Vec<Segment>`, and the theme system maps semantic tokens to `Segment` style values.

## 3.6 Colorprofile's Automatic Downsampling

Colorprofile provides the critical bridge between theme definitions (which use hex RGB) and terminal output (which may only support 16 colors):

- **`colorprofile.Detect()`:** Inspects `TERM`, `COLORTERM`, `NO_COLOR`, and TTY status to determine the profile.
- **`profile.Convert()`:** Converts any `color.Color` to the closest representable color in the target profile using Euclidean distance in RGB space.
- **`colorprofile.NewWriter()`:** Wraps an `io.Writer` to automatically rewrite ANSI escape sequences in output. This is the zero-effort integration path: write truecolor ANSI codes, the writer downsamples them.

For theme systems: always define colors in truecolor (hex RGB). Use Colorprofile's writer wrapper or Lipgloss's `Complete()` primitive to handle degradation. Never hardcode ANSI indices in theme definitions.

## 3.7 Blessed's Terminfo-Aware Color System

Blessed (JavaScript) demonstrates terminfo/termcap-based color capability detection. The pattern:

1. Parse terminfo database for the current `TERM` value
2. Query color capabilities (number of colors, color pairs, whether BCE is supported)
3. Compile escape sequences from terminfo rather than hardcoding them
4. Use painter's algorithm for rendering (back-to-front to minimize overdraw)

The key insight: theme systems should not assume xterm-compatible escape sequences. Terminfo provides the correct sequences for the actual terminal in use.

## 3.8 Theme Token Architecture (Synthesis)

Drawing from all frameworks, the recommended token hierarchy:

```
Level 1: Raw Values
  #7aa2f7, #1a1b26, bold, 12px

Level 2: Semantic Tokens (theme-defined)
  primary → #7aa2f7
  background → #1a1b26
  font_size → 12

Level 3: Component Tokens (widget-specific)
  button.bg → primary
  button.fg → on_primary
  input.border → border_default

Level 4: State Tokens (interactive states)
  button.hover.bg → success
  button.pressed.bg → darken(primary, 0.1)
  input.error.border → danger
```

This 4-level hierarchy is consistent across Lipgloss (style composition), Textual (CSS cascade), Rich (Segment + Style), and Glamour (stylesheet mapping). The theme system should support all four levels, with each level resolving to the next until reaching a raw value.

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Canopy's xterm.js Theme Object

Canopy defines a canonical xterm.js `theme` object with 17 color keys:

```typescript
const XTERM_THEME = {
  background: "#0D0D0D", foreground: "#E0E0E0",
  cursor: "#FF6B00", cursorAccent: "#0D0D0D",
  selectionBackground: "#FF6B0040",
  black: "#1A1A1A", red: "#FF5555", green: "#50FA7B", yellow: "#FFB86C",
  blue: "#6272A4", magenta: "#FF79C6", cyan: "#8BE9FD", white: "#E0E0E0",
  brightBlack: "#555555", brightRed: "#FF6E6E", brightGreen: "#69FF94",
  brightYellow: "#FFCFA8", brightBlue: "#D6ACFF", brightMagenta: "#FF92DF",
  brightCyan: "#A4FFFF", brightWhite: "#FFFFFF",
};
```

**Key primitive patterns:**

1. **`cursorAccent`** (xterm-specific): provides the cursor background when the cursor is over content. Without it, the cursor color may be invisible on dark backgrounds. Setting it to `#0D0D0D` (near-black) alongside an orange cursor ensures the orange is always legible.

2. **`selectionBackground` with alpha:** `#FF6B0040` — xterm supports hex + alpha syntax (`RRGGBBAA`). The 25% transparent orange selection background looks visually layered over content.

3. **Full object contract:** Missing any key causes xterm.js to fall back to a default (often gray), breaking color consistency across terminals. Declaring all 17 keys ensures predictability.

## 4.2 Canopy's Theme Integration Patterns

Canopy's architecture reveals several theming patterns applicable to any Tauri-based or desktop-embedded TUI:

- **PTY environment injection:** Canopy sets `TERM=xterm-256color` when spawning PTY processes. This ensures subprocesses (vim, less, etc.) detect color support correctly. Theme systems should propagate the correct `TERM` value to spawned processes.

- **Font zoom propagation:** When the user changes font size (Cmd+/-), Canopy updates xterm.js `fontSize`, re-fits the terminal, AND propagates the new rows/cols to the PTY backend. Theme systems that support dynamic font sizing must propagate dimension changes to the PTY.

- **Status-triggered attention system:** Canopy scans terminal output for permission prompts using regex patterns on a rolling 500-char buffer. Theme systems can use the same pattern to trigger visual state changes (e.g., highlighting the prompt area, changing the cursor color) when the agent needs attention.

- **Provider-aware environment injection:** Canopy supports Direct, Bedrock, and Vertex providers, injecting different env vars per provider. Theme systems for agent-facing TUIs should support per-provider visual differentiation (e.g., color-coded borders indicating which cloud provider is active).

## 4.3 Cross-Reference: Theming Primitives Across All Analyzed Systems

| Primitive | Lipgloss | Colorprofile | Textual | Glamour | Rich | Blessed | Canopy |
|-----------|----------|-------------|---------|---------|------|---------|--------|
| Color profile detection | ✅ | ✅ | ✅ | ❌ (delegated) | ❌ (delegated) | ✅ (terminfo) | ❌ (fixed) |
| Truecolor support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-downsampling | ✅ (via Complete) | ✅ (via Writer) | ✅ (internal) | ❌ | ❌ | ✅ (terminfo) | ❌ |
| Style composition | ✅ (immutable) | — | ✅ (CSS cascade) | ✅ (stylesheet) | ✅ (bitfield) | ✅ (inline) | ❌ |
| Semantic tokens | ✅ | — | ✅ (CSS vars) | ✅ (JSON map) | ✅ (Style obj) | ✅ (style obj) | ✅ (17 keys) |
| Dark/light switching | ✅ (LightDark) | — | ✅ (reactive) | ✅ (stylesheet swap) | ✅ (theme swap) | ✅ (manual) | ❌ |
| Runtime theme swap | ✅ | ✅ (Writer profile) | ✅ (reactive) | ✅ (env var) | ✅ (Console swap) | ✅ | ❌ |
| Color manipulation | ✅ (blend, alpha) | ✅ (Convert) | ✅ (opacity) | ❌ | ✅ (Style arith) | ❌ | ❌ |
| Declarative format | Go API | Go API | CSS | JSON/YAML | Python API | JS API | TypeScript obj |

**Key insight:** No single framework provides all theming primitives. The most complete approach combines:
- **Colorprofile** for detection + downsampling
- **Lipgloss** for color manipulation + profile-aware selection
- **Textual's CSS cascade** for selector-based theming
- **Glamour's stylesheet** approach for declarative theme definitions
- **Rich's bitfield Style** for efficient composition
- **Canopy's full xterm theme object** for complete terminal color control

---

# PART 5: THEMING SYSTEMS — ARCHITECTURAL DECISIONS

## 5.1 Color Storage Format

**Always store colors as hex RGB (or RGBA) in theme definitions.** Never store ANSI indices or palette numbers. The render layer handles profile-specific conversion. This is the unanimous pattern across Lipgloss, Colorprofile, Glamour, and Rich.

## 5.2 Theme Definition Format

For Rust TUIs, use a typed struct (as in PART 1) with serde deserialization from YAML/JSON. For CSS-like cascading, adopt Textual's approach. For markdown-focused apps, adopt Glamour's stylesheet approach. The format should match the application's primary rendering model.

## 5.3 Runtime Switching Strategy

The most robust approach combines:
1. **Reactive state** (Textual/Bubble Tea pattern): Theme is part of application state; changing it triggers re-render.
2. **Listener pattern** (PART 1's ThemeManager): Components register for theme change notifications.
3. **CSS cascade** (Textual): Specificity-based resolution prevents accidental overrides.

## 5.4 Accessibility Requirements

- **WCAG AA contrast ratio** (4.5:1 for normal text, 3:1 for large text) must be enforced at the theme level, not left to the designer.
- **Color-blind modes** should be first-class theme variants, not afterthoughts. The `ContextAdaptiveTheme` (Concept 1) supports this.
- **No color-only information encoding:** Always pair color with another visual indicator (icon, text label, pattern).

## 5.5 Terminal Capability Negotiation

The theme system must negotiate with the terminal on two axes:
1. **Color depth** (handled by Colorprofile detection)
2. **Feature support** (handled by terminfo/termcap — Blessed's approach)

For web-based terminal renderers (xterm.js, Canopy), the capability negotiation is simpler: the renderer exposes its capabilities directly, and the theme object declares all 17 xterm keys.
