# LibCACA Terminal Primitives Report

## Overview
LibCACA (Color ASCII Art) is a C library for converting graphics to colored ASCII art. It's the engine behind tools like `img2txt` and `caca-view`.

## Root Primitives

### 1. Canvas System
**Location:** `caca/caca.h`, `caca/canvas.c`

**Core Types:**
- `caca_canvas_t` - Main canvas object
- `caca_create_canvas(width, height)` - Create canvas
- `caca_free_canvas()` - Cleanup

**Features:**
- Character buffer storage
- Per-cell color attributes
- Double-buffering support
- Clipping regions

### 2. Character/Set System
**Supported Character Sets:**
- ASCII (basic 7-bit)
- Extended ASCII (IBM Code Page 437)
- Unicode blocks
- Braille characters
- Shades (░▒▓█)
- Custom mappings

**Functions:**
- `caca_set_canvas_charset()` - Select character set
- Multiple predefined charsets available

### 3. Color System
**Attributes:**
- 16 ANSI colors (8 + 8 bright)
- Foreground/background per cell
- Bold, italic, underline, blink
- True color support (in newer versions)

**Functions:**
- `caca_set_color_ansi(canvas, fg, bg)`
- `caca_set_color_rgb(canvas, fg, bg)`
- `caca_put_char(x, y, char, color)`

### 4. Drawing Primitives
**Available:**
- `caca_put_char()` - Single character
- `caca_put_str()` - String rendering
- `caca_draw_line()` - Line drawing
- `caca_draw_circle()` - Circle drawing
- `caca_fill_triangle()` - Filled shapes
- `caca_draw_polyline()` - Polygon outlines

### 5. Image Import
**Functions:**
- `caca_import_image_from_memory()`
- `caca_import_image_from_file()`
- Multiple format support via libimlib2

### 6. Dithering System
**Algorithms:**
- None (nearest color)
- Floyd-Steinberg
- Atkinson
- Ordered dithering (Bayer matrix)

**Functions:**
- `caca_set_dither_brightness()`
- `caca_set_dither_contrast()`
- `caca_set_dither_antialias()`

### 7. Export/Output
**Formats:**
- ANSI escape sequences
- IRC mIRC colors
- HTML/CSS
- PNG (screenshot)
- Raw character data

**Functions:**
- `caca_export_memory()` - Export to buffer
- `caca_export_file()` - Export to file

### 8. Display Backend
**Built-in Viewers:**
- ncurses display
- X11 window
- Slang, AAlib backends

## Directory Structure
attr.c
box.c
caca0.c
caca0.h
caca.c
caca_conio.c
caca_conio.h
caca_debug.h
caca.h
caca_internals.h
caca.pc.in
caca_prof.h
caca_stubs.h
caca_types.h
canvas.c
charset.c
codec
conic.c
dirty.c
dither.c
driver
event.c
figfont.c
file.c
font.c
frame.c
getopt.c
graphics.c
libcaca.def
libcaca.vcxproj
libcaca.vcxproj.filters
line.c
Makefile.am
mono9.data
monobold12.data
prof.c
string.c
t
time.c
transform.c
triangle.c

## Reusable Patterns

### 1. Canvas Abstraction
Universal pattern for terminal rendering:
```c
typedef struct caca_canvas {
    int width, height;
    char *chars;      // Character buffer
    uint32_t *attrs;  // Color attributes
    int dirty;        // Change tracking
} caca_canvas_t;
```

### 2. Character Set Mapping
```python
CHARSETS = {
    'ascii': ' .:-=+*#%@',
    'braille': ''.join(chr(c) for c in range(0x2800, 0x28ff)),
    'blocks': ' ░▒▓█',
}
```

### 3. Dithering Algorithm
Floyd-Steinberg error diffusion:
```
for each pixel:
    old_pixel = original
    new_pixel = quantize(old_pixel)
    error = old_pixel - new_pixel
    distribute error to neighboring pixels
```

### 4. Attribute Encoding
ANSI color pair encoding:
```
attr = (bg << 4) | fg
CSI {attr}m for ANSI output
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Canvas Buffer | 5/5 | Universal | Core TUI pattern |
| Character Sets | 5/5 | Universal | Unicode is universal |
| Color System | 5/5 | High | ANSI widely supported |
| Drawing Primitives | 5/5 | Universal | Bresenham, etc. |
| Dithering | 5/5 | Universal | Pure algorithm |
| Export Formats | 4/5 | High | Text-based output |

## Implementation Recommendations

### For Rust/Go/Python:
1. Create canvas struct with char + color arrays
2. Implement drawing primitives (line, circle, fill)
3. Add character set mappings
4. Implement Floyd-Steinberg dithering
5. Output ANSI escape sequences

### Key Data Structures:
```rust
struct Canvas {
    width: usize,
    height: usize,
    chars: Vec<char>,
    attrs: Vec<Attr>,
}

struct Attr {
    fg: Color,
    bg: Color,
    bold: bool,
    // ...
}
```

## Files of Interest
- libcaca/caca/caca.h - Main API header
- libcaca/caca/canvas.c - Canvas implementation
- libcaca/caca/draw.c - Drawing primitives
- libcaca/caca/dither.c - Dithering algorithms
- libcaca/caca/export.c - Export functions

## Lessons for TUI Development
1. Separate content (chars) from style (attrs)
2. Support multiple character sets for flexibility
3. Dithering dramatically improves image quality
4. Dirty tracking enables efficient rendering
5. Multiple export formats increase utility
