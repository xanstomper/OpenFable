# Anthology: Text Rendering

> **Subject:** Text Rendering - displaying, styling, and manipulating text in TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Text Rendering Mastery

### 8.1 Unicode Text Rendering

```rust
use unicode_width::UnicodeWidthChar;

pub struct TextRenderer {
    pub default_style: Style,
    pub wrap_width: Option<usize>,
    pub ellipsis: bool,
}

#[derive(Clone, Debug)]
pub struct Style {
    pub fg: Color,
    pub bg: Color,
    pub bold: bool,
    pub dim: bool,
    pub italic: bool,
    pub underline: bool,
    pub blink: bool,
    pub reverse: bool,
    pub hidden: bool,
    pub strikethrough: bool,
}

impl Default for Style {
    fn default() -> Self {
        Style {
            fg: Color::WHITE,
            bg: Color::BLACK,
            bold: false,
            dim: false,
            italic: false,
            underline: false,
            blink: false,
            reverse: false,
            hidden: false,
            strikethrough: false,
        }
    }
}

impl TextRenderer {
    pub fn render(&self, text: &str, style: &Style) -> Vec<StyledChar> {
        text.chars()
            .map(|c| StyledChar {
                char: c,
                width: c.width().unwrap_or(0),
                style: style.clone(),
            })
            .collect()
    }

    pub fn measure_width(&self, text: &str) -> usize {
        text.chars().map(|c| c.width().unwrap_or(0)).sum()
    }

    pub fn truncate_to_width(&self, text: &str, max_width: usize) -> (String, usize) {
        let mut width = 0;
        let mut result = String::new();

        for c in text.chars() {
            let cw = c.width().unwrap_or(0);
            if width + cw > max_width {
                if self.ellipsis && width + 1 <= max_width {
                    result.push('…');
                    width += 1;
                }
                break;
            }
            result.push(c);
            width += cw;
        }

        (result, width)
    }

    pub fn wrap_text(&self, text: &str, width: usize) -> Vec<String> {
        let mut lines = Vec::new();
        let mut current_line = String::new();
        let mut current_width = 0;

        for word in text.split_whitespace() {
            let word_width = self.measure_width(word);

            if current_width + word_width > width && !current_line.is_empty() {
                lines.push(std::mem::take(&mut current_line));
                current_width = 0;
            }

            if !current_line.is_empty() {
                current_line.push(' ');
                current_width += 1;
            }

            current_line.push_str(word);
            current_width += word_width;
        }

        if !current_line.is_empty() {
            lines.push(current_line);
        }

        lines
    }
}
```

### 8.2 Rich Text and Markup Parsing

```rust
pub enum RichToken {
    Text(String),
    Bold,
    Italic,
    Underline,
    Strike,
    Color(Color),
    Bg(Color),
    Link(String),
    Reset,
}

pub struct RichParser {
    pub style_stack: Vec<Style>,
    pub current_style: Style,
}

impl RichParser {
    pub fn parse(&mut self, input: &str) -> Vec<StyledSegment> {
        let mut segments = Vec::new();
        let mut current = String::new();
        let mut style = Style::default();

        let mut chars = input.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '[' {
                if !current.is_empty() {
                    segments.push(StyledSegment {
                        text: std::mem::take(&mut current),
                        style,
                    });
                }

                // Parse tag until ]
                let tag = self.parse_tag(&mut chars);
                self.apply_tag(tag, &mut style);
            } else {
                current.push(c);
            }
        }

        if !current.is_empty() {
            segments.push(StyledSegment {
                text: current,
                style,
            });
        }

        segments
    }

    fn parse_tag(&self, chars: &mut std::iter::Peekable<std::str::CharIndices>) -> String {
        let mut tag = String::new();
        while let Some((_, c)) = chars.next() {
            if c == ']' {
                break;
            }
            tag.push(c);
        }
        tag
    }

    fn apply_tag(&mut self, tag: String, style: &mut Style) {
        match tag.as_str() {
            "bold" => style.bold = true,
            "italic" => style.italic = true,
            "u" | "underline" => style.underline = true,
            "strike" => style.strikethrough = true,
            _ => {
                if let Some(color_str) = tag.strip_prefix("fg:") {
                    style.fg = Color::parse(color_str);
                } else if let Some(color_str) = tag.strip_prefix("bg:") {
                    style.bg = Color::parse(color_str);
                } else if let Some(color_str) = tag.strip_prefix('#') {
                    style.fg = Color::parse(&tag);
                }
            }
        }
    }
}

// styled segment for styled text runs
pub struct StyledSegment {
    pub text: String,
    pub style: Style,
}

impl StyledSegment {
    pub fn to_ansi(&self) -> String {
        let mut codes = Vec::new();

        if self.style.bold {
            codes.push("1");
        }
        if self.style.dim {
            codes.push("2");
        }
        if self.style.italic {
            codes.push("3");
        }
        if self.style.underline {
            codes.push("4");
        }
        if self.style.blink {
            codes.push("5");
        }
        if self.style.reverse {
            codes.push("7");
        }
        if self.style.hidden {
            codes.push("8");
        }
        if self.style.strikethrough {
            codes.push("9");
        }

        if self.style.fg != Color::WHITE {
            codes.extend(self.style.fg.to_ansi_fg_codes());
        }
        if self.style.bg != Color::BLACK {
            codes.extend(self.style.bg.to_ansi_bg_codes());
        }

        let prefix = if codes.is_empty() {
            String::new()
        } else {
            format!("\x1b[{}m", codes.join(";"))
        };

        let suffix = if prefix.is_empty() {
            String::new()
        } else {
            "\x1b[0m".to_string()
        };

        format!("{}{}{}", prefix, self.text, suffix)
    }
}
```

### 8.3 Color Systems

```rust
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: Option<u8>,  // Alpha channel
}

impl Color {
    pub const WHITE: Self = Color { r: 255, g: 255, b: 255, a: None };
    pub const BLACK: Self = Color { r: 0, g: 0, b: 0, a: None };
    pub const RED: Self = Color { r: 255, g: 0, b: 0, a: None };
    pub const GREEN: Self = Color { r: 0, g: 255, b: 0, a: None };
    pub const BLUE: Self = Color { r: 0, g: 0, b: 255, a: None };

    pub fn new(r: u8, g: u8, b: u8) -> Self {
        Color { r, g, b, a: None }
    }

    pub fn with_alpha(self, a: u8) -> Self {
        Color { a: Some(a), ..self }
    }

    pub fn from_hex(hex: &str) -> Option<Self> {
        let hex = hex.trim_start_matches('#');
        if hex.len() == 6 {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some(Color::new(r, g, b))
        } else if hex.len() == 3 {
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).ok()?;
            Some(Color::new(r, g, b))
        } else {
            None
        }
    }

    pub fn to_ansi_fg_codes(&self) -> Vec<String> {
        vec![format!("38;2;{};{};{}", self.r, self.g, self.b)]
    }

    pub fn to_ansi_bg_codes(&self) -> Vec<String> {
        vec![format!("48;2;{};{};{}", self.r, self.g, self.b)]
    }

    pub fn to_ansi_256_idx(&self) -> Option<u8> {
        if self.r == self.g && self.g == self.b && self.b <= 46 {
            // Grayscale: 232-255
            let idx = 232 + (self.b / 255) * 23;
            return Some(idx);
        }

        // 6x6x6 color cube (16-231) is tricky for this example
        None
    }
}

impl From<Color> for u32 {
    fn from(c: Color) -> u32 {
        ((c.r as u32) << 16) | ((c.g as u32) << 8) | (c.b as u32)
    }
}

impl From<u32> for Color {
    fn from(n: u32) -> Self {
        Color {
            r: ((n >> 16) & 0xFF) as u8,
            g: ((n >> 8) & 0xFF) as u8,
            b: (n & 0xFF) as u8,
            a: None,
        }
    }
}

impl std::fmt::Display for Color {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "#{:02X}{:02X}{:02X}", self.r, self.g, self.b)
    }
}
```

### 8.4 Font and Glyph Management

```rust
pub struct FontAtlas {
    glyphs: HashMap<(char, Style), GlyphInfo>,
    fallback_glyph: GlyphInfo,
}

#[derive(Clone)]
pub struct GlyphInfo {
    pub character: char,
    pub width: usize,
    pub height: usize,
    pub advance: usize,
    pub bitmap: Vec<u8>,  // Pixel data
}

impl FontAtlas {
    pub fn get_glyph(&self, c: char, style: &Style) -> &GlyphInfo {
        self.glyphs.get(&(c, *style)).unwrap_or(&self.fallback_glyph)
    }

    pub fn measure_string(&self, s: &str) -> usize {
        s.chars().map(|c| self.get_glyph(c, &Style::default()).advance).sum()
    }

    pub fn combine_styled_text(&self, segments: &[StyledSegment]) -> StyledLine {
        let mut line = StyledLine::new();

        for segment in segments {
            for c in segment.text.chars() {
                line.push_char(c, &segment.style);
            }
        }

        line
    }
}
```

### 8.5 Text Alignment and Layout

```rust
#[derive(Clone, Copy, PartialEq)]
pub enum TextAlign {
    Left,
    Right,
    Center,
    Justify,
}

pub struct TextLayout {
    pub width: usize,
    pub align: TextAlign,
    pub wrap: bool,
    pub line_spacing: usize,
    pub paragraph_spacing: usize,
}

impl TextLayout {
    pub fn apply_alignment(&self, line: &str, available_width: usize) -> String {
        let line_width = self.measure_string(line);

        match self.align {
            TextAlign::Left => {
                format!("{:<width$}", line, width = available_width.min(available_width))
            }
            TextAlign::Right => {
                let padding = available_width.saturating_sub(line_width);
                format!("{:>width$}", line, width = padding + line_width)
            }
            TextAlign::Center => {
                let padding = (available_width.saturating_sub(line_width)) / 2;
                format!("{:>width$}", line, width = padding + line_width)
            }
            TextAlign::Justify => {
                self.justify_line(line, available_width)
            }
        }
    }

    fn justify_line(&self, line: &str, width: usize) -> String {
        let words: Vec<&str> = line.split_whitespace().collect();
        if words.len() <= 1 {
            return line.to_string();
        }

        let total_char_width = self.measure_string(line);
        let spaces_needed = words.len() - 1;
        let extra = width.saturating_sub(total_char_width + spaces_needed);

        let mut result = String::new();
        for (i, word) in words.iter().enumerate() {
            result.push_str(word);
            if i < words.len() - 1 {
                // Add space + distribute extra
                result.push(' ');
                for _ in 0..(extra / spaces_needed) {
                    result.push(' ');
                }
            }
        }

        result
    }
}
```

### 8.6 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Assuming 1 char = 1 cell | CJK/emoji breaks | Use unicode_width |
| Not handling combining chars | Accents disappear | Normalize to NFC |
| Ignoring width in alignment | Misaligned text | Measure first |
| Slicing strings blindly | Broken UTF-8 | Use char indices |
| No ellipsis handling | Overflow | Truncate with … |

---

# PART 2: NOVEL CONCEPTS REPORT

## Text Rendering: Untapped Opportunities

### Concept 1: Semantic Text Density Encoding

**Idea:** Vary **character density and spacing** to encode information density of words.

**How:**
```rust
pub struct DensityEncoder {
    importance_map: HashMap<String, f32>,
}

impl DensityEncoder {
    pub fn encode(&self, text: &str) -> String {
        text.chars()
            .map(|c| {
                let importance = self.importance_map.get(&c.to_string()).copied().unwrap_or(0.5);
                if importance > 0.7 {
                    c.to_string().repeat(2)  // Repeat important chars
                } else if importance < 0.3 {
                    "·".to_string()  // Dot for unimportant
                } else {
                    c.to_string()
                }
            })
            .collect()
    }
}
```

**Novel because:** TUIs render all text at equal "weight". Density encoding = information richness.

**Complexity:** Medium
**Value:** High (more information in same screen space)

---

### Concept 2: Soundex-Text Visual Patterns

**Idea:** Convert text to **phonetic visual patterns** for instant recognition of similar-sounding words.

**How:**
```rust
pub struct SoundexPattern {
    pub pattern: Vec<u8>,  // 0-2 per character
}

impl SoundexPattern {
    pub fn from_text(text: &str) -> Self {
        let pattern = text.chars()
            .map(|c| match c {
                'a' | 'e' | 'i' | 'o' | 'u' => 0,  // Vowels = 0
                'b' | 'd' | 'g' | 'k' | 'p' | 't' => 1,  // Stops = 1
                'f' | 'v' | 's' | 'z' => 2,  // Fricatives = 2
                _ => 1,
            })
            .collect();

        SoundexPattern { pattern }
    }

    pub fn distance(&self, other: &SoundexPattern) -> usize {
        self.pattern.iter()
            .zip(other.pattern.iter())
            .filter(|(a, b)| a != b)
            .count()
    }
}
```

**Novel because:** No TUI helps recognize similar-sounding words (homophones, rhymes). Phonetic patterns enable instant visual comparison.

**Complexity:** Low
**Value:** Medium (text editing, poetry, code review)

---

### Concept 3: Time-Aware Glyph Selection

**Idea:** Choose glyphs based on **time of day** for circadian rhythm awareness.

**How:**
```rust
pub struct CircadianFont {
    daytime_glyphs: HashMap<char, char>,
    nighttime_glyphs: HashMap<char, char>,
}

impl CircadianFont {
    pub fn get_glyph(&self, c: char, hour: u32) -> char {
        let is_night = hour < 6 || hour > 20;
        if is_night {
            self.nighttime_glyphs.get(&c).copied().unwrap_or(c)
        } else {
            self.daytime_glyphs.get(&c).copied().unwrap_or(c)
        }
    }
}
```

**Novel because:** TUIs use static fonts. Circadian adjustment = reduced eye strain.

**Complexity:** Low
**Value:** Medium (accessibility, long sessions)

---

**End of Text Rendering Anthology**

---

# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Text Layout Engine: Wrap, Align, Truncate (Urwid)

Urwid's `text_layout.py` (643 lines) is the most battle-tested TUI text layout engine available (20+ years of production use). Four wrap modes with CJK-aware width tracking:

```python
layout = urwid.StandardTextLayout()
lines = layout.layout(
    text="Hello 世界",
    width=20,
    align="center",      # 'left' | 'center' | 'right'
    wrap="space",        # 'space' | 'any' | 'clip' | 'ellipsis'
    trim=0
)
# Returns: [(attr_string, width), ...]
```

**Critical primitives to port:**

| Primitive | Details |
|-----------|---------|
| Word-wrap with CJK | `wcwidth(char)` per codepoint, not `len(string)` |
| Ellipsis truncation | Truncates with `…` (U+2026), not `...` — counts as 1 cell |
| Alignment | Left/right/center pads after wrap; justify uses inter-word spacing distribution |
| Flow sizing | `Box`/`Flow`/`Fixed` — Flow widgets compute height from width constraint |
| Attribute preservation | Style spans survive wrapping; `underline`/`strikethrough` carry across wrapped lines |
| Region invalidation | Canvas-level dirty tracking avoids full redraw on text change |

**Canvas pipeline:** `Widget.render()` → `TextLayout.layout()` → `TextCanvas(encoded lines)` → `Display.draw_screen()` → terminal output. Canvas content validation enables memoization — unchanged regions skip re-render.

## 3.2 Style-Run Segmentation and Cached ANSI Compilation (Rich)

Rich's core insight: the atomic rendering unit is `(text: String, style: Style)`, not a single character. This enables style runs — contiguous spans sharing a compiled ANSI escape sequence.

```python
class Segment:
    text: str
    style: Optional[Style]
    
    def __init__(self, text: str, style: Style = None):
        self.text = text
        self.style = style

class Style:
    color: Color          # fg
    bgcolor: Color        # bg
    bold: bool
    italic: bool
    underline: bool
    strike: bool
    reverse: bool
    
    def compile(self) -> str:
        # Cache compiled ANSI string — key for perf at 60fps
        ...
```

**Primitive pattern:** Style compiles to ANSI once per unique style object, reused across all Segments sharing that style. This avoids redundant `[1;3;38;2;255;0;0m` generation for every cell.

Rich supports 16 ANSI colors, 256-color palette, and true color (24-bit RGB). Color auto-detection degrades gracefully: true color → 256-color → 16-color fallback based on `TERM` and `COLORTERM` env vars.

**Width-aware rendering:** Rich's `Options` object carries `max_width` and `height` — every `Renderable` adapts its output to available space via the `__rich_console__` protocol.

## 3.3 Character-Grid Pixel Encoding (Chafa, LibCACA)

Chafa and LibCACA solve the same problem — mapping pixel data to terminal character cells — with different approaches. Both are directly relevant to any TUI that renders images, graphs, or non-text glyphs.

**Chafa symbol modes:**

| Mode | Character Set | Resolution |
|------|--------------|------------|
| `CHAFA_SYMBOL_MODE_BLOCKS` | ` ░▒▓█` (5 levels) | 1 pixel → 1 char |
| `CHAFA_SYMBOL_MODE_BRAILLE` | Unicode Braille U+2800–U+28FF | 2×4 pixels → 1 char |
| `CHAFA_SYMBOL_MODE_SHADES` | ` ░▒▓█` + half-blocks | 2×1 pixels → 1 char |

Braille encoding (Chafa): each cell packs 8 dots into a single Unicode codepoint. Dot pattern `0b0000_0101` maps to codepoint `0x2800 | pattern`. This gives 2× the vertical resolution of block chars at the cost of less intuitive brightness mapping.

**LibCACA canvas model:**

```c
typedef struct caca_canvas {
    int width, height;
    char *chars;        // Character buffer
    uint32_t *attrs;    // Per-cell color attributes (fg | bg << 4)
    int dirty;          // Change tracking
} caca_canvas_t;
```

LibCACA separates content (chars) from style (attrs) at the per-cell level. Drawing primitives include: `caca_put_char()`, `caca_put_str()`, `caca_draw_line()`, `caca_draw_circle()` — the same Bresenham algorithms used in terminal circle/line drawing.

**Dithering comparison:**

| Algorithm | Library | Quality | Speed |
|-----------|---------|---------|-------|
| None (nearest) | Both | Low | Fastest |
| Floyd-Steinberg | LibCACA | High | O(n) per pixel |
| Ordered (Bayer) | LibCACA | Medium | O(1) per pixel |
| Atkinson | LibCACA | Very high | O(n) per pixel |

For text-rendering TUIs: dithering matters when mapping heatmaps, gradients, or grayscale data to the limited terminal palette. LibCACA's Floyd-Steinberg distributes quantization error to 4 neighbors (7/16 right, 3/16 below-left, 5/16 below, 1/16 below-right).

**Output format matrix (LibCACA):**

```
caca_export_memory() → ANSI | HTML/CSS | IRC mIRC colors | PNG | raw text
```

Same pipeline, multiple export targets — useful for TUIs that support both terminal display and file export/report generation.

## 3.4 Brightness-to-Character Mapping and Animated Text Rendering (Termflix)

Termflix demonstrates real-time text rendering at video framerates — directly relevant for TUIs that animate or stream rapidly updating text.

**Pipeline:**
```
Frame → Resize to terminal cols×rows → Grayscale → Brightness→Char → ANSI color → Double-buffer diff → Single write
```

**Character mapping function:**
```rust
fn brightness_to_char(brightness: u8, charset: &[char]) -> char {
    let idx = (brightness as usize * charset.len()) / 256;
    charset[min(idx, charset.len() - 1)]
}

// Standard ramp (10 levels):
const ASCII_CHARS: &[char] = &[' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];

// Unicode block ramp (5 levels):
const BLOCK_CHARS: &[char] = &[' ', '░', '▒', '▓', '█'];
```

**Frame timing for smooth animation:**
```rust
fn maintain_framerate(target_fps: u32, frame_start: Instant) {
    let frame_duration = Duration::from_micros(1_000_000 / target_fps as u64);
    let elapsed = frame_start.elapsed();
    if elapsed < frame_duration {
        thread::sleep(frame_duration - elapsed);
    }
}
```

**Dirty cell tracking (the key perf primitive):**
```rust
struct TerminalBuffer {
    width: usize,
    height: usize,
    cells: Vec<Cell>,
    dirty: Vec<bool>,       // One bool per cell
}

// Render loop:
for (i, cell) in self.cells.iter().enumerate() {
    if self.dirty[i] {       // Only emit ANSI for changed cells
        write!(stdout, "{}", cell.ansi_code())?;
    }
}
stdout.flush();
```

For animated text (loading spinners, progress indicators, live data), dirty tracking reduces output from O(cols×rows) per frame to O(changed cells). This is the difference between 60fps and 5fps on a 120×40 terminal.

## 3.5 Unicode-Aware Measurement and Terminal Encoding (Blessed, Urwid)

Blessed's `lib/unicode.js` handles CJK wide characters (2 cells), emoji (2 cells post-2015 Unicode), and zero-width joiners (ZWJ sequences). Combined with Urwid's `str_util.py` encoding system, these define the production rules for correct text measurement in any terminal.

**Width rules (from Blessed/Urwid):**

| Codepoint Class | Cell Width | Examples |
|----------------|-----------|----------|
| CJK Unified Ideographs | 2 | 世, 界, 中 |
| Hangul Jamo | 2 | 가, 나, 다 |
| Emoji (most) | 2 | 😀, 🚀, ✅ |
| Combining marks | 0 | ́, ̃, ̈ (accents) |
| ZWJ sequences | 2+ | 👨‍👩‍👧‍👦 (family emoji) |
| Control chars | 0 | `
`, `	`, `` |
| ASCII/Latin | 1 | a-z, A-Z, 0-9 |

**Urwid encoding matrix:**

| Encoding | Coverage |
|----------|----------|
| UTF-8 | Full Unicode |
| CJK (big5, gb2312, euc-jp, euc-kr) | East Asian |
| 8-bit (latin-1, cp437) | Legacy terminals |

**Blessed color pipeline (for text visual hierarchy):**
```
Style object → detect terminal capabilities → pick color tier → emit escapes
```
Tiers: True color (24-bit RGB) → 256-color (xterm palette) → 16-color (ANSI fallback). The cascade is automatic — Blessed detects support from `TERM`/`COLORTERM` and degrades without app-level branching.

**Key takeaway for text rendering:** Never count codepoints as cells. Never assume 1 byte = 1 char. Never emit ANSI sequences without detecting terminal capability first. These three rules, validated across 20+ years in Urwid and 16KLOC in Blessed, prevent the most common TUI text rendering bugs.


# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Terminal Font Rendering in Embedded Scenarios

Canopy's TerminalView configures:

**Font-family priority stack:**
`'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace`

**Line height:** 1.2 (optimized for dense code, not prose)

**Color profile:** Hardcoded ANSI 16 + 8 bright. No automatic TRUE_COLOR detection — Canopy emits the same ANSI palette regardless of terminal capabilities.

**Text decode + pattern scan pattern:**
```typescript
const text = new TextDecoder().decode(bytes)
  .replace(/\[[0-9;]*[a-zA-Z]/g, "");
checkForAttentionNeeded(text);
```

**Why strip ANSI before scanning:** A colored prompt like `[31mDo you want to proceed?[0m` wouldn't match `"Do you want to proceed?"` without stripping. The regex handles most CSI sequences; rare OSC sequences are not stripped (unlikely required for Claude output).

---
