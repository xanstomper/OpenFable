# LibTCOD Terminal Primitives Report

## Overview
LibTCOD (The C Omnipresent Debugger) is a C library originally designed for roguelike games. It provides console emulation, graphics, pathfinding, and procedural generation tools.

## Root Primitives

### 1. Console System (tcod_console)
**Core Types:**
- `TCOD_Console` - Virtual console buffer
- `TCOD_console_new(width, height)` - Create console
- `TCOD_console_print()` - Text rendering
- `TCOD_console_put_char()` - Single character
- `TCOD_console_blit()` - Console-to-console copy

**Features:**
- Multiple console layers
- Alpha blending support
- Console scaling
- Root console (display output)
- Off-screen consoles (double-buffering)

### 2. Color System (tcod_color)
**Types:**
- `TCOD_ColorRGB` - RGB triplet
- `TCOD_ColorHSV` - HSV triplet
- Named colors (predefined palette)

**Operations:**
- Color interpolation (lerp)
- Color addition/subtraction
- HSV conversion
- Greyscale conversion

### 3. Drawing Primitives (tcod_console)
**Functions:**
- `TCOD_console_put_char()` - Single glyph
- `TCOD_console_print()` - Text with alignment
- `TCOD_console_hline()` - Horizontal line
- `TCOD_console_vline()` - Vertical line
- `TCOD_console_line()` - Line drawing
- `TCOD_console_rect()` - Rectangle outline
- `TCOD_console_fill_rect()` - Filled rectangle
- `TCOD_console_circle()` - Circle drawing

### 4. Font System (tcod_renderer)
**Features:**
- Bitmap font loading (.png fonts)
- Character grid mapping
- Font scaling
- Multiple font formats supported
- Unicode support

### 5. Input System (tcod_event)
**Event Types:**
- `TCOD_EVENT_KEY_PRESS`
- `TCOD_EVENT_KEY_RELEASE`
- `TCOD_EVENT_MOUSE_MOTION`
- `TCOD_EVENT_MOUSE_BUTTON`
- `TCOD_EVENT_WINDOW_CLOSE`

**Keyboard:**
- Virtual key codes
- Unicode character support
- Modifier keys (shift, ctrl, alt)
- Key state polling

**Mouse:**
- Position tracking
- Button states
- Wheel scrolling

### 6. Pathfinding (tcod_path)
**Algorithms:**
- A* pathfinding
- Dijkstra maps
- Flood fill

**Functions:**
- `TCOD_path_new_using_map()`
- `TCOD_path_walk()`
- `TCOD_dijkstra_new()`

### 7. Heightmap Tools (tcod_heightmap)
**Features:**
- Heightmap creation/manipulation
- Terrain generation
- Erosion simulation
- Island generation
- Perlin noise integration

### 8. Noise Generation (tcod_noise)
**Types:**
- Perlin noise (1D-4D)
- Simplex noise
- Wavelet turbulence

**Functions:**
- `TCOD_noise_perlin()`
- `TCOD_noise_simplex()`

### 9. Random Number Generation (tcod_random)
**Distributions:**
- Uniform
- Gaussian (normal)
- Exponential

**Functions:**
- `TCOD_random_get_float()`
- `TCOD_random_get_int()`

### 10. Field of View (tcod_map)
**Algorithms:**
- Shadow casting
- Permissive FOV
- Recursive shadowcasting

**Functions:**
- `TCOD_map_compute_fov()`
- `TCOD_map_is_in_fov()`

## Header Files Structure
libtcod/src/libtcod/list.h
libtcod/src/libtcod/bresenham.h
libtcod/src/libtcod/noise_defaults.h
libtcod/src/libtcod/tileset_bdf.h
libtcod/src/libtcod/globals.h
libtcod/src/libtcod/error.h
libtcod/src/libtcod/tileset_render.h
libtcod/src/libtcod/sdl2/event.h
libtcod/src/libtcod/image.h
libtcod/src/libtcod/logging.h
libtcod/src/libtcod/fov_types.h
libtcod/src/libtcod/libtcod_int.h
libtcod/src/libtcod/mersenne.h
libtcod/src/libtcod/mouse_types.h
libtcod/src/libtcod/path.h
libtcod/src/libtcod/console.h
libtcod/src/libtcod/mouse.h
libtcod/src/libtcod/txtfield.h
libtcod/src/libtcod/context_viewport.h
libtcod/src/libtcod/config.h
libtcod/src/libtcod/console_drawing.h
libtcod/src/libtcod/tileset.h
libtcod/src/libtcod/console_etc.h
libtcod/src/libtcod/console_printing.h
libtcod/src/libtcod/heapq.h
libtcod/src/libtcod/pathfinder.h
libtcod/src/libtcod/console_types.h
libtcod/src/libtcod/tileset_truetype.h
libtcod/src/libtcod/random.h
libtcod/src/libtcod/utility.h

## Reusable Patterns

### 1. Virtual Console Pattern
```c
struct TCOD_Console {
    int width, height;
    TCOD_ColorRGB *fg_colors;
    TCOD_ColorRGB *bg_colors;
    int *characters;
    bool dirty;
};
```

### 2. Blitting/Compositing
```c
TCOD_console_blit(
    source_console,
    src_x, src_y, src_w, src_h,
    dest_console,
    dest_x, dest_y,
    foreground_alpha, background_alpha
);
```

### 3. Text Alignment
```c
typedef enum {
    TCOD_LEFT,
    TCOD_CENTER,
    TCOD_RIGHT
} TCOD_alignment_t;
```

### 4. Fox Calculation Pattern
```
1. Initialize FOV map from terrain
2. Call compute_fov(player_x, player_y, radius)
3. Query is_in_fov(x, y) for visibility
4. Re-compute only when player moves
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Console Buffer | 5/5 | Universal | Core TUI pattern |
| Color System | 5/5 | Universal | Standard color theory |
| Drawing Primitives | 5/5 | Universal | Bresenham, etc. |
| Font Loading | 4/5 | High | Bitmap fonts portable |
| Input Handling | 5/5 | Universal | Event-based pattern |
| Pathfinding | 5/5 | Universal | Pure algorithm |
| FOV Calculation | 5/5 | Universal | Ray casting portable |
| Noise Generation | 5/5 | Universal | Pure math |
| Heightmap | 4/5 | High | Terrain gen useful |
| Random | 5/5 | Universal | Standard distributions |

## Implementation Recommendations

### For Rust/Go/Python:
1. Implement console buffer with separate char/color arrays
2. Add drawing primitives (line, rect, circle)
3. Implement A* pathfinding
4. Add Perlin noise generator
5. Implement shadow-casting FOV
6. Create event queue for input

### Key Insight from TCOD:
- Separate "root console" (display) from "off-screen consoles" (buffers)
- Blitting allows composition of multiple layers
- Dirty tracking optimizes rendering
- Font is just a texture atlas mapped to character codes

## Files of Interest
- libtcod/include/libtcod.h - Main header
- libtcod/include/libtcod_console.h - Console API
- libtcod/include/libtcod_path.h - Pathfinding
- libtcod/include/libtcod_noise.h - Noise generation
- libtcod/include/libtcod_fov.h - Field of view

## Lessons for TUI Development
1. Virtual consoles enable layered rendering
2. Blitting with alpha enables transparency effects
3. Compute FOV once, query many times
4. Pathfinding cache for repeated queries
5. Bitmap fonts give precise control
6. Event queue decouples input from processing
