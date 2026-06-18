# Notcurses Terminal Primitives Report

## Overview
Notcurses is a modern C library for terminal UIs, designed as a replacement for ncurses. It provides high-level abstractions for TUI development with support for true color, Unicode, and multimedia.

## Root Primitives

### 1. Plane System (Core Abstraction)
**Location:** `include/notcurses/plane.h`

**Core Concept:**
- `ncplane` - Virtual drawing surface (like a window in ncurses)
- Multiple planes can overlap and composite
- Each plane has its own coordinate system
- Planes can be moved, resized, deleted independently

**Key Functions:**
- `ncplane_new()` - Create plane
- `ncplane_destroy()` - Free plane
- `ncplane_putstr()` - Render text
- `ncplane_putchar()` - Single character
- `ncplane_home()` - Reset cursor

### 2. Stacking/Z-Order
**Pattern:**
- Planes have z-order (stacking order)
- Higher z-order planes appear on top
- `ncplane_move_top()`, `ncplane_move_bottom()`
- `ncplane_move_above()`, `ncplane_move_below()`

### 3. Cell/Character System
**Type:** `cell` - Extended character representation

**Features:**
- EGC (Extended Grapheme Cluster) support
- Foreground/background colors (24-bit)
- Style attributes (bold, italic, underline, strikethrough)
- Unicode combining characters

**Functions:**
- `cell_load()` - Load character into cell
- `cell_duplicate()` - Copy cell
- `cell_release()` - Free cell resources

### 4. Color System
**Features:**
- True color (24-bit RGB)
- Palette mode (256/16 colors)
- Default color support (transparent)
- Color quantization fallback

**Functions:**
- `ncplane_set_fg_rgb()` - Set foreground
- `ncplane_set_bg_rgb()` - Set background
- `ncplane_set_base()` - Set default colors

### 5. Box Drawing
**Functions:**
- `ncplane_box()` - Draw box around area
- `ncplane_rounded_box()` - Rounded corners
- `ncplane_double_box()` - Double-line box
- `ncplane_perimeter()` - Box around plane edge

**Box Characters:**
- Supports Unicode box drawing
- Custom border characters
- Rounded, double, single styles

### 6. Multiline Text
**Features:**
- Word wrapping
- Alignment (left, center, right, justified)
- Multi-line rendering
- Truncation options

**Functions:**
- `ncplaneprintln()` - Line with wrap
- `ncprint()` - Formatted output
- `ncplane_printf()` - printf-style

### 7. Input Handling
**Types:**
- `ncinput` - Input event structure
- `ncgetchar()` - Get character
- `ncpollinput()` - Non-blocking poll
- `ncblocking_getchar()` - Blocking read

**Event Types:**
- Key events (with modifiers)
- Mouse events (motion, clicks, scroll)
- Resize events
- Focus events

### 8. Multimedia Support
**Features:**
- Image display (via direct framebuffer)
- Video playback support
- Sixel graphics
- Kitty graphics protocol
- iTerm2 inline images

### 9. High-Level Widgets
**Available:**
- `ncrender()` - Render all planes
- `ncfdplane` - File descriptor plane (async I/O)
- `ncmenu` - Menu system
- `ncvisual` - Image/video handling
- `nctablet` - Tablet/button support
- `ncreel` - Scrollable list
- `ncform` - Form input
- `ncmultiselector` - Multi-select picker

### 10. Performance Features
**Optimizations:**
- Dirty region tracking
- Minimize terminal writes
- Batch rendering
- Double-buffering at plane level

## Include Directory
ncpp
notcurses

## Reusable Patterns

### 1. Plane Abstraction
```c
struct ncplane {
    int absx, absy;        // Absolute position
    int lenx, leny;        // Dimensions
    int z;                 // Z-order
    cell* contents;        // Character buffer
    bool* damaged;         // Dirty tracking
    struct ncplane* next;  // Plane stack link
};
```

### 2. Cell with EGC Support
```c
typedef struct cell {
    uint32_t channels;     // Colors packed
    uint32_t gcluster;     // Grapheme cluster
    char* gcluster_scratch; // Overflow for long EGCs
} cell;
```

### 3. Box Drawing Pattern
```c
ncplane_box(
    plane, &cell,
    yoff, xoff, leny, lenx,
    YouTube,
    brflags  // Which corners to round
);
```

### 4. Render Cycle
```c
while (running) {
    // Update plane contents
    ncplane_putstr(plane, "Hello");
    
    // Render to terminal
    ncrender(stdplane);
    
    // Handle input
    ncinput input;
    ncpollinput(nc, &input);
}
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Plane System | 5/5 | Universal | Excellent abstraction |
| Cell/EGC | 5/5 | High | Unicode is standard |
| True Color | 5/5 | High | Modern terminals support |
| Box Drawing | 5/5 | Universal | Unicode box chars |
| Z-Ordering | 4/5 | Universal | Compositing logic |
| Dirty Tracking | 5/5 | Universal | Essential optimization |
| Multimedia | 4/5 | Medium | Protocol-dependent |
| Input Events | 5/5 | Universal | Event pattern |

## Implementation Recommendations

### For Rust/Go/Python:
1. Implement plane as struct with buffer + position
2. Use Vec/array of planes with z-sort before render
3. Track dirty regions per plane
4. Compose planes top-to-bottom before output
5. Implement cell with unicode + color packed

### Key Insight:
The plane abstraction is superior to single-console because:
- Windows can overlap naturally
- Each widget can have its own plane
- Z-ordering handles occlusion automatically
- Dirty tracking is per-plane (more efficient)

## Files of Interest
- notcurses/include/notcurses/notcurses.h - Main API
- notcurses/include/notcurses/plane.h - Plane system
- notcurses/include/notcurses/cell.h - Cell/character
- notcurses/include/notcurses/input.h - Input handling

## Lessons for TUI Development
1. Multiple overlapping planes > single console
2. Z-ordering enables natural widget layering
3. Dirty tracking essential for performance
4. Extended grapheme clusters for full Unicode
5. True color as default, fallback to palette
6. Render batching reduces terminal flicker
