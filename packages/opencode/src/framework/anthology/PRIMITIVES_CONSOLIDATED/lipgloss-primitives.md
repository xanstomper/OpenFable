# Lip Gloss - Terminal Styling Primitives

## Overview

Lip Gloss is a CSS-like styling library for terminal applications. It provides a fluent builder API for defining styles that can be applied to strings, with support for colors, borders, layout, and more.

---

## 1. Core Architectural Pattern: Style Builder

### 1.1 Immutable Style Objects

**Primitive:** Styles are immutable values built via method chaining

```go
style := lipgloss.NewStyle().
    Bold(true).
    Foreground(lipgloss.Color("#FF0000")).
    Padding(1, 2).
    Border(lipgloss.RoundedBorder())
```

**Language-Agnostic Abstraction:**

```python
# Python
class Style:
    def __init__(self, **kwargs):
        self._bold = kwargs.get('bold', False)
        self._fg = kwargs.get('fg', None)
        self._padding = kwargs.get('padding', (0, 0, 0, 0))
        # ... etc
    
    def bold(self, value: bool) -> 'Style':
        return Style(**{**self._asdict(), 'bold': value})
    
    def foreground(self, color: Color) -> 'Style':
        return Style(**{**self._asdict(), 'fg': color})
    
    def render(self, text: str) -> str:
        # Apply ANSI codes and layout
        ...
```

```rust
// Rust
#[derive(Clone, Default)]
struct Style {
    bold: bool,
    fg: Option<Color>,
    bg: Option<Color>,
    padding: Padding,
    border: Option<Border>,
    // ...
}

impl Style {
    pub fn new() -> Self { Self::default() }
    
    pub fn bold(mut self, value: bool) -> Self {
        self.bold = value;
        self
    }
    
    pub fn render(&self, text: &str) -> String {
        // Apply styling
    }
}
```

**Key Insights:**
- **Fluent API**: Each setter returns a new style instance
- **Immutable**: Original style unchanged, enables reuse
- **Lazy rendering**: Style applied only when `.render()` called
- **Composable**: Styles can inherit/extend other styles

---

## 2. Color System Architecture

### 2.1 Color Profile Hierarchy

**Primitive:** Terminal color capability detection with fallback

```
┌─────────────────────────────────────────┐
│          Color Profile Levels           │
├─────────────────────────────────────────┤
│  1. ASCII (no color)                    │
│  2. ANSI 4-bit (16 colors)              │
│  3. ANSI 256 (256 colors)               │
│  4. True Color (24-bit, 16.7M colors)   │
└─────────────────────────────────────────┘
```

**Detection Pattern:**

```python
class ColorProfile(Enum):
    ASCII = 0
    ANSI_4BIT = 1
    ANSI_256 = 2
    TRUE_COLOR = 3

def detect_profile(environ: dict, stdout) -> ColorProfile:
    # Check TERM, COLORTERM, Westworld detection
    if environ.get('COLORTERM') == 'truecolor':
        return ColorProfile.TRUE_COLOR
    if '256' in environ.get('TERM', ''):
        return ColorProfile.ANSI_256
    # Fall through to ASCII
    return ColorProfile.ASCII
```

### 2.2 Color Types

**Primitive:** Unified color interface supporting multiple formats

```go
// Supported formats:
lipgloss.Color("1")           // ANSI 4-bit index
lipgloss.Color("21")          // ANSI 256 index
lipgloss.Color("#ff0000")     // Hex RGB
lipgloss.Color("#f00")        // Short hex
lipgloss.RGBColor(255, 0, 0)  // RGB struct
```

**Implementation Pattern:**

```python
from dataclasses import dataclass
from typing import Union
import re

@dataclass
class RGBA:
    r: int
    g: int
    b: int
    a: int = 255

class Color:
    @staticmethod
    def parse(s: str) -> 'Color':
        if s.startswith('#'):
            return Color._parse_hex(s)
        elif s.isdigit():
            return Color._parse_index(int(s))
        raise ValueError(f"Invalid color: {s}")
    
    @staticmethod
    def _parse_hex(s: str) -> 'Color':
        s = s.lstrip('#')
        if len(s) == 3:
            s = ''.join(c*2 for c in s)
        r = int(s[0:2], 16)
        g = int(s[2:4], 16)
        b = int(s[4:6], 16)
        return Color(r, g, b)
    
    def to_ansi(self, profile: ColorProfile) -> str:
        if profile == ColorProfile.ANSI_4BIT:
            # Snap to nearest 4-bit color
            return self._to_4bit()
        elif profile == ColorProfile.ANSI_256:
            return f"\x1b[38;5;{self._to_256_index()}m"
        else:
            return f"\x1b[38;2;{self.r};{self.g};{self.b}m"
```

### 2.3 Light/Dark Mode Adaptation

**Primitive:** Context-aware color selection

```go
lightDark := lipgloss.LightDark(hasDarkBackground)
red := lightDark(
    lipgloss.Color("#550000"),  // Darker for light bg
    lipgloss.Color("#ff0000"),  // Brighter for dark bg
)
```

**Pattern:**

```python
from typing import Callable

LightDarkFunc = Callable[[Color, Color], Color]

def LightDark(is_dark: bool) -> LightDarkFunc:
    def select(light: Color, dark: Color) -> Color:
        return dark if is_dark else light
    return select

# Usage
ld = LightDark(terminal_has_dark_background())
title_color = ld(Color("#333"), Color("#fff"))
```

### 2.4 Profile-Aware Color Selection

**Primitive:** Specify fallback colors for each profile level

```go
complete := lipgloss.Complete(profile)
color := complete(
    lipgloss.Color("1"),      // ANSI fallback
    lipgloss.Color("124"),    // ANSI 256 fallback
    lipgloss.Color("#ff34ac"), // True color
)
```

**Pattern:**

```python
CompleteFunc = Callable[[Color, Color, Color], Color]

def Complete(profile: ColorProfile) -> CompleteFunc:
    def select(ansi: Color, ansi256: Color, truecolor: Color) -> Color:
        if profile == ColorProfile.TRUE_COLOR:
            return truecolor
        elif profile == ColorProfile.ANSI_256:
            return ansi256
        else:
            return ansi
    return select
```

---

## 3. Color Manipulation Utilities

### 3.1 Alpha/Transparency

```python
def Alpha(color: Color, alpha: float) -> Color:
    """Adjust alpha (0.0 = transparent, 1.0 = opaque)"""
    alpha = max(0.0, min(1.0, alpha))
    r, g, b, _ = color.rgba()
    return RGBA(r, g, b, int(alpha * 255))
```

### 3.2 Lighten/Darken

```python
def Lighten(color: Color, percent: float) -> Color:
    """Make color lighter by percentage (0.0 - 1.0)"""
    percent = max(0.0, min(1.0, percent))
    r, g, b, a = color.rgba()
    add = 255 * percent
    return RGBA(
        min(255, r + add),
        min(255, g + add),
        min(255, b + add),
        a
    )

def Darken(color: Color, percent: float) -> Color:
    """Make color darker by percentage (0.0 - 1.0)"""
    percent = max(0.0, min(1.0, percent))
    r, g, b, a = color.rgba()
    mult = 1.0 - percent
    return RGBA(
        int(r * mult),
        int(g * mult),
        int(b * mult),
        a
    )
```

### 3.3 Complementary Colors

```python
def Complementary(color: Color) -> Color:
    """Get complementary color (180° on color wheel)"""
    h, s, v = rgb_to_hsv(color.r, color.g, color.b)
    h = (h + 180) % 360
    r, g, b = hsv_to_rgb(h, s, v)
    return RGBA(r, g, b, color.a)
```

---

## 4. Border System

### 4.1 Border Structure

**Primitive:** 14-part border definition

```go
type Border struct {
    Top          string  // Top edge
    Bottom       string  // Bottom edge
    Left         string  // Left edge
    Right        string  // Right edge
    TopLeft      string  // Top-left corner
    TopRight     string  // Top-right corner
    BottomLeft   string  // Bottom-left corner
    BottomRight  string  // Bottom-right corner
    MiddleLeft   string  // Left T-junction
    MiddleRight  string  // Right T-junction
    Middle       string  // Cross junction
    MiddleTop    string  // Top T-junction
    MiddleBottom string  // Bottom T-junction
}
```

**Pre-defined Borders:**
- `NormalBorder()` - Standard single-line
- `RoundedBorder()` - Rounded corners
- `ThickBorder()` - Bold lines
- `DoubleBorder()` - Double-line
- `BlockBorder()` - Full block characters
- `HiddenBorder()` - Invisible (spacing only)
- `ASCIIBorder()` - ASCII-safe (+, -, |)

### 4.2 Border Rendering

**Primitive:** Per-side enable/disable

```python
@dataclass
class BorderStyle:
    border: Border
    top: bool = True
    right: bool = True
    bottom: bool = True
    left: bool = True
    
    def render(self, content: str, profile: ColorProfile) -> str:
        lines = content.split('\n')
        width = max(len(line) for line in lines)
        
        result = []
        
        # Top edge
        if self.top:
            result.append(
                self.border.topLeft + 
                (self.border.top * width) + 
                self.border.topRight
            )
        
        # Side edges
        for line in lines:
            row = ""
            if self.left:
                row += self.border.left
            row += line.ljust(width)
            if self.right:
                row += self.border.right
            result.append(row)
        
        # Bottom edge
        if self.bottom:
            result.append(
                self.border.bottomLeft + 
                (self.border.bottom * width) + 
                self.border.bottomRight
            )
        
        return '\n'.join(result)
```

### 4.3 Border Gradients

**Primitive:** Color gradient along border edges

```python
def render_gradient_border(content: str, colors: list[Color]) -> str:
    """Apply gradient colors around border perimeter"""
    lines = content.split('\n')
    width = max(len(l) for l in lines)
    height = len(lines)
    
    # Generate gradient for perimeter
    perimeter = (width + 2) * 2 + height * 2
    gradient = generate_gradient(colors, perimeter)
    
    # Apply gradient to each border segment
    # (implementation details vary)
```

---

## 5. Layout and Spacing

### 5.1 Padding

**Primitive:** Interior spacing (content to border)

```python
def Padding(top: int, right: int, bottom: int, left: int) -> 'Style':
    """Set padding on all sides"""
    
def PaddingLeft(n: int) -> 'Style': ...
def PaddingRight(n: int) -> 'Style': ...
def PaddingTop(n: int) -> 'Style': ...
def PaddingBottom(n: int) -> 'Style': ...
```

**ANSI Implementation:**
```python
def apply_padding(text: str, padding: tuple) -> str:
    top, right, bottom, left = padding
    lines = text.split('\n')
    
    # Calculate max width
    max_width = max(len(line) for line in lines)
    
    # Add horizontal padding
    padded_lines = [
        ' ' * left + line + ' ' * right 
        for line in lines
    ]
    
    # Add vertical padding
    result = []
    result.extend([''] * top)
    result.extend(padded_lines)
    result.extend([''] * bottom)
    
    return '\n'.join(result)
```

### 5.2 Margin

**Primitive:** Exterior spacing (outside border/style)

```python
def Margin(top: int, right: int, bottom: int, left: int) -> 'Style':
    """Set margin on all sides"""
```

**Note:** Margin is typically applied during layout composition, not string rendering.

### 5.3 Width/Height Constraints

**Primitive:** Fixed or percentage-based sizing

```python
def Width(n: int) -> 'Style':
    """Set fixed width (content padded/truncated)"""

def Height(n: int) -> 'Style':
    """Set fixed height"""

def MaxWidth(n: int) -> 'Style':
    """Set maximum width"""

def MaxHeight(n: int) -> 'Style':
    """Set maximum height"""
```

---

## 6. Text Styling

### 6.1 Font Attributes

**Primitive:** ANSI text attributes

```python
@dataclass
class TextStyle:
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strikethrough: bool = False
    reverse: bool = False
    blink: bool = False
    faint: bool = False
```

**ANSI Codes:**
| Attribute | Code | Reset |
|-----------|------|-------|
| Bold | 1 | 22 |
| Faint | 2 | 22 |
| Italic | 3 | 23 |
| Underline | 4 | 24 |
| Blink | 5 | 25 |
| Reverse | 7 | 27 |
| Strikethrough | 9 | 29 |

### 6.2 Text Alignment

**Primitive:** Horizontal alignment within container

```python
def AlignLeft() -> 'Style': ...
def AlignCenter() -> 'Style': ...
def AlignRight() -> 'Style': ...

def apply_alignment(text: str, width: int, align: Align) -> str:
    lines = text.split('\n')
    result = []
    for line in lines:
        if align == Align.LEFT:
            result.append(line.ljust(width))
        elif align == Align.CENTER:
            result.append(line.center(width))
        elif align == Align.RIGHT:
            result.append(line.rjust(width))
    return '\n'.join(result)
```

---

## 7. Layout Composition

### 7.1 Joining Strings

**Primitive:** Join multiple styled strings

```python
# Vertical join (stack)
def JoinVertical(gap: int, *items: str) -> str:
    separator = '\n' * (gap + 1)
    return separator.join(items)

# Horizontal join (side-by-side)
def JoinHorizontal(gap: int, *items: str) -> str:
    # Split each item into lines
    # Pad each line to max width
    # Join corresponding lines with gap
    ...
```

### 7.2 Layering

**Primitive:** Overlay strings (e.g., for animations, cursors)

```python
def Layer(background: str, foreground: str, x: int, y: int) -> str:
    """Overlay foreground on background at position"""
    bg_lines = background.split('\n')
    fg_lines = foreground.split('\n')
    
    for i, fg_line in enumerate(fg_lines):
        if y + i >= len(bg_lines):
            break
        bg_line = bg_lines[y + i]
        # Overlay fg_line at position x
        ...
```

---

## 8. Terminal Capability Detection

### 8.1 Profile Detection Algorithm

```python
def detect_profile(environ: dict, stdin, stdout) -> ColorProfile:
    """Detect terminal color support"""
    
    # Check explicit overrides
    if environ.get('NO_COLOR'):
        return ColorProfile.ASCII
    
    if environ.get('COLORTERM') == 'truecolor':
        return ColorProfile.TRUE_COLOR
    
    # Check for known true-color terminals
    term = environ.get('TERM', '')
    term_program = environ.get('TERM_PROGRAM', '')
    
    if '24bit' in term or '24-bit' in term:
        return ColorProfile.TRUE_COLOR
    
    if term_program in ('Hyper', 'iTerm.app', 'WezTerm', 'Ghostty'):
        return ColorProfile.TRUE_COLOR
    
    # Check 256 color support
    if '256' in term:
        return ColorProfile.ANSI_256
    
    # Fall back to basic ANSI
    return ColorProfile.ANSI_4BIT
```

### 8.2 Dark/Light Background Detection

```python
def has_dark_background(stdin, stdout) -> bool:
    """Attempt to detect terminal background brightness"""
    
    # Method 1: Query terminal (ANSI DSR)
    # stdout.write('\x1b]11;?\x1b\\')  # Request bg color
    # response = stdin.read(...)
    # Parse response
    
    # Method 2: Check environment hints
    term = os.environ.get('TERM', '')
    if 'dark' in term.lower():
        return True
    if 'light' in term.lower():
        return False
    
    # Method 3: Heuristic based on $COLORFGBG
    colorfgbg = os.environ.get('COLORFGBG', '')
    if colorfgbg:
        parts = colorfgbg.split(';')
        if len(parts) >= 2:
            bg = int(parts[1])
            return bg < 8  # Dark ANSI colors
    
    # Default assumption
    return True
```

---

## 9. String Width Calculation

### 9.1 Unicode-Aware Width

**Primitive:** Calculate display width (not byte/char count)

```python
from unicodedata import east_asian_width

def display_width(s: str) -> int:
    """Calculate string width considering CJK and combining chars"""
    width = 0
    for char in s:
        if east_asian_width(char) in 'WF':
            width += 2  # Full/wide (CJK)
        elif east_asian_width(char) == 'N':
            width += 1  # Neutral
        elif east_asian_width(char) == 'H':
            width += 1  # Half-width
        elif east_asian_width(char) == 'A':
            width += 2  # Ambiguous (treat as wide)
        # Combining marks don't add width
    return width
```

### 9.2 Grapheme Cluster Awareness

**Primitive:** Handle emoji and combining sequences

```python
import regex  # Supports \X for grapheme clusters

def grapheme_count(s: str) -> int:
    """Count grapheme clusters (user-perceived characters)"""
    return len(regex.findall(r'\X', s))

def truncate_to_graphemes(s: str, n: int) -> str:
    """Truncate string to n grapheme clusters"""
    clusters = regex.findall(r'\X', s)
    return ''.join(clusters[:n])
```

---

## 10. ANSI Code Generation

### 10.1 Style to ANSI

**Primitive:** Convert style to ANSI escape sequence

```python
def style_to_ansi(style: Style, profile: ColorProfile) -> str:
    codes = []
    
    # Text attributes
    if style.bold:
        codes.append('1')
    if style.italic:
        codes.append('3')
    if style.underline:
        codes.append('4')
    if style.strikethrough:
        codes.append('9')
    if style.reverse:
        codes.append('7')
    
    # Colors
    if style.fg:
        codes.append(style.fg.to_ansi_fg(profile))
    if style.bg:
        codes.append(style.bg.to_ansi_bg(profile))
    
    if not codes:
        return ''
    
    return f'\x1b[{";".join(codes)}m'
```

### 10.2 ANSI Code Reference

| Effect | FG Code | BG Code |
|--------|---------|---------|
| Black | 30 | 40 |
| Red | 31 | 41 |
| Green | 32 | 42 |
| Yellow | 33 | 43 |
| Blue | 34 | 44 |
| Magenta | 35 | 45 |
| Cyan | 36 | 46 |
| White | 37 | 47 |
| Bright Black | 90 | 100 |
| Bright Red | 91 | 101 |
| 256 Color | 38;5;N | 48;5;N |
| True Color | 38;2;R;G;B | 48;2;R;G;B |
| Reset | 0 | - |

---

## 11. Caching and Performance

### 11.1 Style Caching

**Primitive:** Cache rendered output for static content

```python
from functools import lru_cache
import hashlib

class StyleCache:
    def __init__(self, maxsize: int = 128):
        self._cache = {}
        self._maxsize = maxsize
    
    def key(self, style: Style, text: str) -> str:
        """Generate cache key"""
        style_hash = hash(style)
        text_hash = hashlib.md5(text.encode()).hexdigest()
        return f"{style_hash}:{text_hash}"
    
    def get_or_render(self, style: Style, text: str) -> str:
        key = self.key(style, text)
        if key not in self._cache:
            if len(self._cache) >= self._maxsize:
                # Evict oldest
                self._cache.pop(next(iter(self._cache)))
            self._cache[key] = style.render(text)
        return self._cache[key]
```

---

## 12. Implementation Checklist

### Core Requirements

- [ ] Style builder with fluent API
- [ ] Immutable style objects
- [ ] Color parsing (hex, ANSI, 256)
- [ ] Color profile detection
- [ ] ANSI code generation
- [ ] Border definition and rendering
- [ ] Padding/margin support
- [ ] Text alignment
- [ ] Width calculation (Unicode-aware)

### Advanced Features

- [ ] Light/dark mode adaptation
- [ ] Profile-aware color fallback
- [ ] Color manipulation (lighten, darken, complement)
- [ ] Border gradients
- [ ] Layer/overlay support
- [ ] String joining (vertical/horizontal)
- [ ] Style caching
- [ ] Grapheme cluster handling

---

## 13. Language-Specific Adaptations

### Python
- Use `blessed` or `wcwidth` for width calculation
- `colorama` for Windows ANSI support
- `rich` as inspiration for similar patterns

### Rust
- `crossterm` for terminal capabilities
- `unicode-width` crate for width
- `color-spantrace` for color handling

### TypeScript/Node
- `ansi-escapes` for code generation
- `wcwidth` npm package
- `chalk` for similar builder patterns

---

## Summary

Lip Gloss provides a CSS-like styling system for terminals with:

1. **Builder Pattern**: Fluent, immutable style construction
2. **Color Hierarchy**: ASCII → ANSI → 256 → True Color with detection
3. **Adaptive Colors**: Light/dark mode, profile-aware fallbacks
4. **Border System**: 14-part borders with gradient support
5. **Layout**: Padding, margin, alignment, joining
6. **Unicode Support**: Grapheme-aware width calculation
7. **Performance**: Lazy rendering, optional caching

The patterns are highly portable and can be implemented in any language with string manipulation and ANSI terminal support.