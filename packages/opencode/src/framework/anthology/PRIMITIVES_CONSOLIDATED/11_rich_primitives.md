# Rich Terminal Primitives Report

## Overview
Rich is a Python library for rich terminal output. It provides high-level abstractions for colored text, tables, markdown rendering, syntax highlighting, and more.

## Root Primitives

### 1. Console System
**Location:** `rich/console.py`

**Core Class:** `Console`

**Features:**
- High-level print API
- Color and style support
- Width detection
- Output encoding
- File-like interface
- Context managers

**Key Methods:**
- `print()` - Rich text output
- `print_json()` - JSON formatting
- `log()` - Timestamped logging
- `status()` - Status spinner
- `progress()` - Progress bars
- `table()` - Table rendering

### 2. Renderable Protocol
**Pattern:**
```python
class RenderableType(Protocol):
    def __rich_console__(self, console, options) -> RenderResult:
        ...
```

**Built-in Renderables:**
- Text - Styled text
- Table - Data tables
- Panel - Boxed content
- Syntax - Code highlighting
- Markdown - MD rendering
- JSON - JSON formatting
- Progress - Progress bars
- Spinner - Animations

### 3. Text System
**Location:** `rich/text.py`

**Class:** `Text`

**Features:**
- Styled text spans
- ANSI color support
- True color support
- Style inheritance
- Text wrapping
- Truncation
- Emoji support

**Style Attributes:**
- foreground/background color
- bold, italic, underline
- strikethrough, blink
- reverse, conceal

### 4. Color System
**Location:** `rich/color.py`

**Types:**
- `Color` - RGB color
- `ColorParseError` - Exception
- `ColorTriplet` - RGB values

**Features:**
- Named colors (CSS)
- RGB/RGBa support
- 256-color palette
- System color detection
- Color blending

### 5. Layout System
**Location:** `rich/layout.py`

**Class:** `Layout`

**Features:**
- Grid-based layouts
- Nested layouts
- Size constraints
- Split directions (row/column)
- Proportional sizing

**Pattern:**
```python
layout = Layout()
layout.split(
    Layout(name="header", size=3),
    Layout(name="body"),
    Layout(name="footer", size=3),
)
```

### 6. Table System
**Location:** `rich/table.py`

**Class:** `Table`

**Features:**
- Auto-column sizing
- Row styling
- Borders (ASCII/Unicode)
- Alignment per column
- Header/footer rows
- Padding control

### 7. Progress System
**Location:** `rich/progress.py`

**Classes:** `Progress`, `ProgressColumn`

**Features:**
- Multiple simultaneous bars
- Custom columns
- ETA calculation
- Transfer speed
- Spinner animations
- Time remaining

### 8. Syntax Highlighting
**Location:** `rich/syntax.py`

**Class:** `Syntax`

**Features:**
- Pygments integration
- Line numbers
- Code background
- Theme support
- Multiple languages

### 9. Markdown Rendering
**Location:** `rich/markdown.py`

**Class:** `Markdown`

**Features:**
- Heading styles
- Code blocks
- Lists (ordered/unordered)
- Links
- Blockquotes
- Tables

### 10. Live Display
**Location:** `rich/live.py`

**Class:** `Live`

**Features:**
- Auto-refresh display
- Context manager
- Alternate screen
- Clear on exit
- Redirect stdout

## Directory Structure
abc.py
align.py
ansi.py
bar.py
box.py
cells.py
color.py
color_triplet.py
columns.py
console.py
constrain.py
containers.py
control.py
default_styles.py
diagnose.py
_emoji_codes.py
emoji.py
_emoji_replace.py
errors.py
_export_format.py
_extension.py
_fileno.py
file_proxy.py
filesize.py
highlighter.py
__init__.py
_inspect.py
json.py
jupyter.py
layout.py
live.py
live_render.py
logging.py
_log_render.py
_loop.py
__main__.py
markdown.py
markup.py
measure.py
_null_file.py
padding.py
pager.py
palette.py
_palettes.py
panel.py
_pick.py
pretty.py
progress_bar.py
progress.py
prompt.py
protocol.py
py.typed
_ratio.py
region.py
repr.py
rule.py
scope.py
screen.py
segment.py
spinner.py
_spinners.py
_stack.py
status.py
styled.py
style.py
syntax.py
table.py
terminal_theme.py
text.py
theme.py
themes.py
_timer.py
traceback.py
tree.py
_unicode_data
_win32_console.py
_windows.py
_windows_renderer.py
_wrap.py

## Reusable Patterns

### 1. Renderable Protocol
```python
from typing import Protocol

class RenderableType(Protocol):
    def __rich_console__(self, console, options):
        yield Segment("text", Style())
```

Any class implementing this can be printed by Console.

### 2. Segment System
```python
class Segment:
    def __init__(self, text: str, style: Style = None):
        self.text = text
        self.style = style
```

Segments are the atomic unit of rendering.

### 3. Style System
```python
class Style:
    color: Color
    bgcolor: Color
    bold: bool
    italic: bool
    underline: bool
    # ...compile to ANSI once, reuse
```

### 4. Width-Aware Rendering
```python
class Options:
    max_width: int
    height: int
    is_terminal: bool
    
# Renderables adapt to available space
```

### 5. Context Manager Pattern
```python
with Console().status("Loading..."):
    do_work()

with Progress() as progress:
    task = progress.add_task("Download", total=100)
    for item in items:
        progress.update(task, advance=1)
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Renderable Protocol | 5/5 | Universal | Interface/trait pattern |
| Segment System | 5/5 | Universal | Text + style tuple |
| Style System | 5/5 | Universal | ANSI compilation |
| Layout System | 4/5 | Universal | Grid algorithm |
| Table Rendering | 5/5 | Universal | Column width algos |
| Progress Bars | 5/5 | Universal | ASCII animation |
| Live Display | 5/5 | Universal | Alternate screen |
| Markdown Parse | 4/5 | High | Use existing parsers |
| Syntax Highlight | 4/5 | High | Tree-sitter/etc. |

## Implementation Recommendations

### For Rust:
- Trait for Renderable
- Struct for Segment
- Style compiles to ANSI string once
- Layout uses flexbox-like algorithm

### For Go:
- Interface for Renderable
- Struct for Segment
- Options pattern for configuration
- bufio for efficient output

### Key Insight from Rich:
The renderable protocol is the key abstraction - any type that can produce Segments can be printed. This enables:
- Composable UI elements
- Lazy rendering (only when printed)
- Consistent styling across types
- Easy extension with custom types

## Files of Interest
- rich/rich/console.py - Main console
- rich/rich/text.py - Text handling
- rich/rich/style.py - Style system
- rich/rich/segment.py - Segment type
- rich/rich/layout.py - Layout system
- rich/rich/table.py - Tables
- rich/rich/progress.py - Progress bars

## Lessons for TUI Development
1. Protocol/interface > inheritance for renderables
2. Segment = (text, style) is atomic unit
3. Compile styles to ANSI once, cache result
4. Layout should be constraint-based
5. Context managers for lifecycle (Live, Progress)
6. Auto-detect terminal capabilities
7. Graceful degradation for non-terminal output
