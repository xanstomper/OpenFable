# Rich Primitives Analysis & Porting Guide for TalonCLI

## Executive Summary

**Rich is a goldmine for TalonCLI.** Unlike the other studied projects, Rich provides **production-ready, composable primitives** for terminal rendering that can be directly ported to Rust/Go. The key insight: Rich's **Segment + Style + Console** architecture is the missing link between your Rust framebuffer and Bubble Tea's string-based rendering.

**Verdict:** Extract and port these 5 core primitives from Rich:
1. **Segment** — atomic unit of styled text with cell-length awareness
2. **Style** — bitfield-based terminal style with SGR mapping
3. **cell_len** — Unicode-aware cell width calculation
4. **Control codes** — non-printable ANSI command abstraction
5. **Line splitting/cropping** — viewport-aware text layout

---

## Primitive 1: Segment (The Atomic Unit)

### Source: `rich/segment.py` (780 lines)

### Core Structure
```python
@rich_repr()
class Segment(NamedTuple):
    """A piece of text with associated style."""
    text: str
    style: Optional[Style] = None
    control: Optional[Sequence[ControlCode]] = None
    
    @property
    def cell_length(self) -> int:
        """Number of terminal cells required."""
        return 0 if self.control else cell_len(self.text)
    
    @property
    def is_control(self) -> bool:
        """Check if segment contains control codes."""
        return self.control is not None
```

### Key Methods to Port

#### 1. `split_cells(cut: int)` — Split at cell boundary
```python
def split_cells(self, cut: int) -> Tuple["Segment", "Segment"]:
    """Split segment at specified column.
    
    Critical: Handles double-width characters by replacing with spaces
    to preserve display width.
    """
    # Fast path: all single-cell characters
    if _is_single_cell_widths(self.text):
        if cut >= len(self.text):
            return self, Segment("", self.style, self.control)
        return (
            Segment(self.text[:cut], self.style, self.control),
            Segment(self.text[cut:], self.style, self.control),
        )
    
    # Slow path: binary search + adjustment for wide chars
    # (see full implementation in segment.py:155-180)
```

**Port to Rust as:**
```rust
#[derive(Clone, Debug)]
pub struct Segment {
    pub text: String,
    pub style: Option<Style>,
    pub control: Vec<ControlCode>,
}

impl Segment {
    pub fn cell_length(&self) -> usize {
        if !self.control.is_empty() {
            0
        } else {
            cell_len(&self.text)
        }
    }
    
    pub fn split_cells(&self, cut: usize) -> (Segment, Segment) {
        // Fast path + wide-char handling
    }
}
```

#### 2. `split_lines()` — Iterator over line segments
```python
@classmethod
def split_lines(cls, segments: Iterable["Segment"]) -> Iterable[List["Segment"]]:
    """Split sequence of segments into lines.
    
    Yields one list of segments per line (split on \\n).
    """
    line: List[Segment] = []
    for segment in segments:
        if "\n" in segment.text and not segment.control:
            text, style, _ = segment
            while text:
                _text, new_line, text = text.partition("\n")
                if _text:
                    line.append(cls(_text, style))
                if new_line:
                    yield line
                    line = []
        else:
            line.append(segment)
    if line:
        yield line
```

**Port to Rust as:**
```rust
pub fn split_lines<'a>(
    segments: impl Iterator<Item = &'a Segment>
) -> impl Iterator<Item = Vec<&'a Segment>> {
    // Line-splitting iterator
}
```

#### 3. `adjust_line_length()` — Crop/pad line to width
```python
@classmethod
def adjust_line_length(
    cls,
    line: List["Segment"],
    length: int,
    style: Optional[Style] = None,
    pad: bool = True,
) -> List["Segment"]:
    """Adjust line to given width (crop or pad)."""
    line_length = sum(seg.cell_length for seg in line)
    
    if line_length < length:
        if pad:
            return line + [cls(" " * (length - line_length), style)]
        return line[:]
    elif line_length > length:
        new_line = []
        current_length = 0
        for segment in line:
            seg_len = segment.cell_length
            if current_length + seg_len < length or segment.control:
                new_line.append(segment)
                current_length += seg_len
            else:
                # Crop this segment
                text, segment_style, _ = segment
                cropped_text = set_cell_size(text, length - current_length)
                new_line.append(cls(cropped_text, segment_style))
                break
        return new_line
    return line[:]
```

**Port to Rust:** Direct translation possible.

---

## Primitive 2: Style (Bitfield Terminal Styles)

### Source: `rich/style.py` (796 lines)

### Core Structure
```python
@rich_repr
class Style:
    """A terminal style with color, bgcolor, and attributes."""
    
    __slots__ = [
        "_color", "_bgcolor", "_attributes", "_set_attributes",
        "_link", "_link_id", "_ansi", "_style_definition",
        "_hash", "_null", "_meta",
    ]
    
    # Bitfield for attributes (bold=bit0, dim=bit1, italic=bit2, ...)
    _style_map = {
        0: "1",   # bold
        1: "2",   # dim
        2: "3",   # italic
        3: "4",   # underline
        4: "5",   # blink
        5: "6",   # blink2
        6: "7",   # reverse
        7: "8",   # conceal
        8: "9",   # strike
        9: "21",  # underline2
        10: "51", # frame
        11: "52", # encircle
        12: "53", # overline
    }
```

### Key Features to Port

#### 1. Bitfield Attribute Storage
```python
class _Bit:
    """Descriptor to get/set a style attribute bit."""
    def __init__(self, bit_no: int):
        self.bit = 1 << bit_no
    
    def __get__(self, obj: "Style", objtype: Type["Style"]) -> Optional[bool]:
        if obj._set_attributes & self.bit:
            return obj._attributes & self.bit != 0
        return None

# Usage in Style class:
bold = _Bit(0)
dim = _Bit(1)
italic = _Bit(2)
# ... etc
```

**Port to Rust as:**
```rust
#[derive(Clone, Copy, Debug, Default)]
pub struct Style {
    pub color: Option<Color>,
    pub bgcolor: Option<Color>,
    pub attributes: u16,      // Which attributes are set
    pub set_attributes: u16,  // Which attributes have been explicitly set
    pub link: Option<String>,
    pub meta: Option<HashMap<String, String>>,
}

// Attribute bit positions
pub const ATTR_BOLD: u16      = 1 << 0;
pub const ATTR_DIM: u16       = 1 << 1;
pub const ATTR_ITALIC: u16    = 1 << 2;
pub const ATTR_UNDERLINE: u16 = 1 << 3;
pub const ATTR_BLINK: u16     = 1 << 4;
pub const ATTR_REVERSE: u16   = 1 << 5;
pub const ATTR_HIDDEN: u16    = 1 << 6;
pub const STRIKE: u16         = 1 << 7;
// ... etc

impl Style {
    pub fn is_bold(&self) -> Option<bool> {
        if self.set_attributes & ATTR_BOLD != 0 {
            Some(self.attributes & ATTR_BOLD != 0)
        } else {
            None
        }
    }
    
    pub fn with_bold(mut self, bold: bool) -> Self {
        self.set_attributes |= ATTR_BOLD;
        if bold {
            self.attributes |= ATTR_BOLD;
        } else {
            self.attributes &= !ATTR_BOLD;
        }
        self
    }
}
```

#### 2. Style Composition (Addition)
```python
def __add__(self, style: "Style") -> "Style":
    """Combine two styles (right-hand style takes precedence)."""
    # Merge colors (right wins if set)
    color = style._color if style._color is not None else self._color
    bgcolor = style._bgcolor if style._bgcolor is not None else self._bgcolor
    
    # Merge attributes (OR both, but respect set_attributes)
    attributes = (
        (self.attributes & ~style._set_attributes) |
        style.attributes
    )
    set_attributes = self._set_attributes | style._set_attributes
    
    # Right wins for link/meta
    link = style._link or self._link
    meta = style._meta or self._meta
    
    return Style(
        color=color, bgcolor=bgcolor,
        attributes=attributes, set_attributes=set_attributes,
        link=link, meta=meta
    )
```

**Port to Rust:**
```rust
impl Style {
    pub fn compose(&self, other: &Style) -> Self {
        Style {
            color: other.color.or(self.color),
            bgcolor: other.bgcolor.or(self.bgcolor),
            attributes: (self.attributes & !other.set_attributes) | other.attributes,
            set_attributes: self.set_attributes | other.set_attributes,
            link: other.link.clone().or_else(|| self.link.clone()),
            meta: other.meta.clone().or_else(|| self.meta.clone()),
        }
    }
}

impl std::ops::Add for Style {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.compose(&rhs)
    }
}
```

#### 3. ANSI Code Generation
```python
def ansi_codes(self) -> str:
    """Generate ANSI SGR codes for this style."""
    codes = []
    
    if self._color:
        codes.extend(self._color.ansi_codes())
    if self._bgcolor:
        codes.extend(self._bgcolor.ansi_codes())
    
    if self._set_attributes:
        for bit, code in self._style_map.items():
            if self._set_attributes & (1 << bit):
                if self._attributes & (1 << bit):
                    codes.append(code)
                else:
                    codes.append("2" + code)  # Turn off attribute
    
    if self._link:
        codes.append(f"8;;{self._link}")
    
    return ";".join(codes) if codes else ""
```

**Port to Rust:**
```rust
impl Style {
    pub fn ansi_codes(&self) -> String {
        let mut codes = Vec::new();
        
        if let Some(color) = &self.color {
            codes.extend(color.ansi_codes());
        }
        if let Some(bgcolor) = &self.bgcolor {
            codes.extend(bgcolor.ansi_codes_bg());
        }
        
        for (bit, sgr_code) in STYLE_MAP.iter() {
            if self.set_attributes & (1 << bit) != 0 {
                if self.attributes & (1 << bit) != 0 {
                    codes.push(sgr_code.to_string());
                } else {
                    codes.push(format!("2{}", sgr_code));
                }
            }
        }
        
        if let Some(link) = &self.link {
            codes.push(format!("8;;{}", link));
        }
        
        codes.join(";")
    }
}
```

---

## Primitive 3: Cell Length Calculation (Unicode-Aware)

### Source: `rich/cells.py` (352 lines)

### Core Algorithm
```python
_SINGLE_CELL_UNICODE_RANGES = [
    (0x20, 0x7E),      # Latin
    (0xA0, 0xAC),
    (0xAE, 0x002FF),
    (0x00370, 0x00482),  # Greek/Cyrillic
    (0x02500, 0x025FC),  # Box drawing
    (0x02800, 0x028FF),  # Braille ← CRITICAL FOR YOU
]

@lru_cache(maxsize=4096)
def get_character_cell_size(character: str, unicode_version: str = "auto") -> int:
    """Get cell size (0, 1, or 2) for a character."""
    codepoint = ord(character)
    
    # Control characters = 0 width
    if codepoint < 32 or 0x7F <= codepoint < 0xA0:
        return 0
    
    # Binary search in Unicode width table
    table = load_cell_table(unicode_version).widths
    # ... binary search implementation ...
    return 1  # Default

def cell_len(text: str) -> int:
    """Get total cell length of string."""
    if _is_single_cell_widths(text):  # Fast path for ASCII/latin
        return len(text)
    return sum(get_character_cell_size(c) for c in text)
```

### Port to Rust

```rust
use unicode_width::UnicodeWidthChar;  // Or embed Unicode table

// Fast-path check for single-cell ranges
const SINGLE_CELL_RANGES: &[(u32, u32)] = &[
    (0x20, 0x7E),
    (0xA0, 0xAC),
    (0xAE, 0x2FF),
    (0x370, 0x482),
    (0x2500, 0x25FC),  // Box drawing
    (0x2800, 0x28FF),  // Braille
];

fn is_single_cell_fast(s: &str) -> bool {
    s.chars().all(|c| {
        let cp = c as u32;
        SINGLE_CELL_RANGES.iter().any(|&(start, end)| cp >= start && cp <= end)
    })
}

#[inline]
pub fn cell_len(s: &str) -> usize {
    if is_single_cell_fast(s) {
        return s.len();  // ASCII path: byte len = cell len
    }
    s.chars()
        .map(|c| c.width().unwrap_or(1))
        .sum()
}

#[inline]
pub fn get_character_cell_size(c: char) -> usize {
    let cp = c as u32;
    if cp < 32 || (0x7F..0xA0).contains(&cp) {
        return 0;  // Control chars
    }
    c.width().unwrap_or(1)
}
```

**Critical for TalonCLI:** The Braille range (`0x2800–0x28FF`) is explicitly marked as single-cell. This means your Braille blitter can use Rich's cell_len for viewport calculations.

---

## Primitive 4: Control Codes (Non-Printable ANSI Commands)

### Source: `rich/segment.py` (ControlType enum)

### Core Structure
```python
class ControlType(IntEnum):
    """Non-printable control codes → ANSI sequences."""
    BELL = 1
    CARRIAGE_RETURN = 2
    HOME = 3
    CLEAR = 4
    SHOW_CURSOR = 5
    HIDE_CURSOR = 6
    ENABLE_ALT_SCREEN = 7
    DISABLE_ALT_SCREEN = 8
    CURSOR_UP = 9
    CURSOR_DOWN = 10
    CURSOR_FORWARD = 11
    CURSOR_BACKWARD = 12
    CURSOR_MOVE_TO_COLUMN = 13
    CURSOR_MOVE_TO = 14
    ERASE_IN_LINE = 15
    SET_WINDOW_TITLE = 16

ControlCode = Union[
    Tuple[ControlType],                    # No args
    Tuple[ControlType, Union[int, str]],   # One arg
    Tuple[ControlType, int, int],          # Two args
]
```

### Port to Rust

```rust
#[derive(Clone, Debug, PartialEq)]
pub enum ControlCode {
    Bell,
    CarriageReturn,
    Home,
    Clear,
    ShowCursor,
    HideCursor,
    EnableAltScreen,
    DisableAltScreen,
    CursorUp(usize),
    CursorDown(usize),
    CursorForward(usize),
    CursorBackward(usize),
    MoveToColumn(usize),
    MoveTo { row: usize, col: usize },
    EraseInLine(EraseMode),
    SetWindowTitle(String),
}

#[derive(Clone, Debug, PartialEq)]
pub enum EraseMode {
    EndOfLine,
    StartOfLine,
    EntireLine,
}

impl ControlCode {
    pub fn to_ansi(&self) -> String {
        match self {
            ControlCode::Bell => "\x07".to_string(),
            ControlCode::CarriageReturn => "\r".to_string(),
            ControlCode::Home => "\x1b[H".to_string(),
            ControlCode::Clear => "\x1b[2J\x1b[H".to_string(),
            ControlCode::ShowCursor => "\x1b[?25h".to_string(),
            ControlCode::HideCursor => "\x1b[?25l".to_string(),
            ControlCode::EnableAltScreen => "\x1b[?1049h".to_string(),
            ControlCode::DisableAltScreen => "\x1b[?1049l".to_string(),
            ControlCode::CursorUp(n) => format!("\x1b[{}A", n),
            ControlCode::CursorDown(n) => format!("\x1b[{}B", n),
            ControlCode::CursorForward(n) => format!("\x1b[{}C", n),
            ControlCode::CursorBackward(n) => format!("\x1b[{}D", n),
            ControlCode::MoveToColumn(n) => format!("\x1b[{}G", n),
            ControlCode::MoveTo { row, col } => format!("\x1b[{};{}H", row + 1, col + 1),
            ControlCode::EraseInLine(mode) => {
                let code = match mode {
                    EraseMode::EndOfLine => "K",
                    EraseMode::StartOfLine => "1K",
                    EraseMode::EntireLine => "2K",
                };
                format!("\x1b[{}", code)
            }
            ControlCode::SetTitle(title) => format!("\x1b]0;{}\x07", title),
        }
    }
}
```

---

## Primitive 5: Viewport-Aware Rendering

### Source: `rich/console.py` (2698 lines) — Key extraction

### ConsoleOptions Structure
```python
@dataclass
class ConsoleOptions:
    """Options for rendering."""
    size: ConsoleDimensions      # (width, height)
    min_width: int
    max_width: int
    is_terminal: bool
    encoding: str
    max_height: int
    justify: Optional[JustifyMethod] = None
    overflow: Optional[OverflowMethod] = None
    no_wrap: Optional[bool] = False
    
    @property
    def ascii_only(self) -> bool:
        return not self.encoding.startswith("utf")
```

### Renderable Protocol
```python
class Renderable(ABC):
    @abstractmethod
    def __rich_console__(
        self, console: "Console", options: "ConsoleOptions"
    ) -> "RenderResult":
        """Return an iterable of segments."""
        pass
```

### Port Strategy for TalonCLI

**Rust Framebuffer → Bubble Tea Bridge:**
```rust
pub struct RenderContext {
    pub viewport: ViewportDimensions,
    pub encoding: Encoding,
    pub color_system: ColorSystem,
    pub justify: JustifyMethod,
    pub overflow: OverflowMethod,
}

pub trait Renderable {
    fn render(&self, ctx: &RenderContext) -> Vec<Segment>;
}

// Example: Code block with syntax highlighting
pub struct CodeBlock {
    code: String,
    language: String,
}

impl Renderable for CodeBlock {
    fn render(&self, ctx: &RenderContext) -> Vec<Segment> {
        let tokens = highlight(&self.code, &self.language);
        tokens.into_iter()
            .map(|(text, style)| Segment::new(text, style))
            .collect()
    }
}
```

**Go/Bubble Tea Integration:**
```go
type TalonModel struct {
    renderer   *rust.Renderer
    buffer     *rust.Framebuffer
    segments   []rust.Segment  // From last render
}

func (m TalonModel) View() string {
    // 1. Render agent state to Rust segments
    m.segments = m.renderer.Render(agentState)
    
    // 2. Convert segments to ANSI string
    var builder strings.Builder
    for _, seg := range m.segments {
        if seg.Control != nil {
            for _, ctrl := range seg.Control {
                builder.WriteString(ctrl.ToANSI())
            }
        }
        if seg.Text != "" {
            if seg.Style != nil {
                builder.WriteString(seg.Style.ANSI())
            }
            builder.WriteString(seg.Text)
            if seg.Style != nil {
                builder.WriteString(ansi.Reset)
            }
        }
    }
    return builder.String()
}
```

---

## Porting Priority Order

### Phase 1: Foundation (Week 1)
1. **cell_len** — Port to Rust (`unicode-width` crate + custom table)
2. **Style** — Bitfield struct + ANSI generation
3. **Segment** — Core data structure

### Phase 2: Layout (Week 2)
4. **Control codes** — Enum + ANSI mapping
5. **split_cells** — Cell-boundary aware splitting
6. **split_lines** — Line iterator

### Phase 3: Integration (Week 3)
7. **adjust_line_length** — Crop/pad logic
8. **RenderContext** — Viewport-aware rendering
9. **Renderable trait** — Component abstraction

### Phase 4: Bubble Tea Bridge (Week 4)
10. **FFI bindings** — Rust → Go segment conversion
11. **View() integration** — String builder from segments

---

## Why Rich Beats Other Projects for TalonCLI

| Feature | Rich | Notcurses | terminaltexteffects | Ronin |
|---------|------|-----------|---------------------|-------|
| **Composable primitives** | ✅ Segment+Style | ❌ Monolithic blits | ❌ Effect-focused | ❌ Canvas-focused |
| **Unicode cell math** | ✅ Production-tested | ✅ | ✅ | ❌ Web canvas |
| **Style bitfields** | ✅ Efficient | ✅ | ❌ Python classes | ❌ Objects |
| **Control code abstraction** | ✅ Clean enum | ❌ Direct ANSI | ❌ ANSI strings | ❌ N/A |
| **Line splitting/cropping** | ✅ Robust | ✅ | ⚠️ Basic | ❌ N/A |
| **Portability** | ✅ Pure Python → Easy Rust | ❌ Heavy C deps | ⚠️ Python-specific | ❌ DOM-based |
| **Animation support** | ❌ Static only | ✅ High-performance | ✅ Effect loops | ✅ Time-based |

**Rich + Notcurses = Perfect Combo:**
- **Rich** provides the data model (Segment, Style, cell calculation)
- **Notcurses** provides the framebuffer + blitter architecture
- **Ronin** provides the temporal model (time → position functions)
- **terminaltexteffects** provides easing + particle systems

---

## Rust Crate Structure Recommendation

```
talon-render/
├── src/
│   ├── lib.rs              # Public API
│   ├── framebuffer/
│   │   ├── mod.rs          # Framebuffer core
│   │   ├── layer.rs        # Multi-layer buffers
│   │   └── dirty.rs        # Dirty region tracking
│   ├── segment/
│   │   ├── mod.rs          # Segment + Style (Rich port)
│   │   ├── style.rs        # Bitfield styles + ANSI
│   │   ├── control.rs      # Control codes
│   │   └── cell.rs         # cell_len (Rich port)
│   ├── blitter/
│   │   ├── mod.rs          # Blitter trait
│   │   ├── braille.rs      # 8x3 → ⣿
│   │   ├── sextant.rs      # 3x2 → 🬀
│   │   └── kitty.rs        # Inline images
│   ├── procedural/
│   │   ├── mod.rs          # Time model (Ronin port)
│   │   ├── noise.rs        # Perlin/simplex
│   │   └── drawable.rs     # Drawable trait
│   ├── effects/
│   │   ├── mod.rs          # Effect system
│   │   ├── easing.rs       # 50+ easing funcs (TTE port)
│   │   ├── particles.rs    # Particle system
│   │   └── morph.rs        # Text morphing
│   └── bridge/
│       ├── mod.rs          # Bubble Tea FFI
│       └── go_bindings.rs  # cgo/prost bindings
└── Cargo.toml
```

---

## Next Steps

You asked for **Bubble Tea bridge architecture (#2)**. Given Rich's primitives, here's the updated plan:

1. **Week 1:** Port Rich's Segment + Style + cell_len to Rust
2. **Week 2:** Build Framebuffer with Rich-segment output
3. **Week 3:** Create Bubble Tea FFI layer (Go ←→ Rust segment streaming)
4. **Week 4:** Integrate procedural animation (Ronin time model) + effects

Want me to start coding the **Rich primitive ports** (Segment, Style, cell_len) in Rust, or jump straight to the **Bubble Tea bridge architecture**?