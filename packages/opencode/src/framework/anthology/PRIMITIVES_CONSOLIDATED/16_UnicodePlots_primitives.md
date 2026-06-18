# UnicodePlots Terminal Primitives Report

## Overview
UnicodePlots is a Julia package for creating ASCII/Unicode visualizations directly in the terminal. It provides plotting primitives using Unicode characters for smooth, high-resolution graphics.

## Root Primitives

### 1. Plot Canvas System
**Location:** `src/canvas.jl` (inferred)

**Features:**
- Grid-based coordinate system
- Unicode character selection
- Axis rendering
- Label positioning

### 2. Character-Based Graphics
**Characters Used:**
- Box drawing: ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼
- Block elements: ░ ▒ ▓ █
- Braille: ⡁ ⡃ ⡇ ⣇ ⣧ ⣷ ⣶ ⣶ (8-dot patterns)
- Lines: ╱ ╲ ╳ (diagonal)
- Shapes: ○ ● ◆ ▲ ▼ ★

### 3. Plot Types
**Supported:**
- Line plots
- Scatter plots
- Bar charts
- Histograms
- Density plots
- Box plots
- Heatmaps
- Spy plots (sparse matrices)

### 4. Coordinate Transformation
**Pattern:**
```
Data Space (min_x, max_x, min_y, max_y)
    ↓ (scale)
Grid Space (0..width, 0..height)
    ↓ (character selection)
Unicode Character
```

### 5. Braille Graphics
**Key Insight:**
- 2x4 dot pattern per character
- 8 bits of information per cell
- Enables 8x resolution vs regular characters

**Pattern:**
```
Each Braille char represents 2宽 x 4高 pixel grid
Map data points to dot positions
Combine into single character
```

### 6. Axis System
**Features:**
- Automatic scaling
- Tick mark generation
- Label formatting
- Log scale support
- Date/time axes

### 7. Legend System
**Features:**
- Multi-series support
- Symbol + label
- Position options
- Auto-hide for single series

### 8. Color Support
**Features:**
- ANSI color codes
- Per-series coloring
- Background color
- Theme support

## Directory Structure
canvas
canvas.jl
common.jl
description.jl
graphics
graphics.jl
interface
lut.jl
plot.jl
show.jl
UnicodePlots.jl
volume.jl

## Reusable Patterns

### 1. Canvas Abstraction
```julia
abstract type Canvas end

struct GridCanvas <: Canvas
    width::Int
    height::Int
    buffer::Matrix{Char}
    colors::Matrix{Color}
end

function draw_point!(canvas, x, y, char, color)
    canvas.buffer[y, x] = char
    canvas.colors[y, x] = color
end
```

### 2. Coordinate Scaling
```julia
function scale_to_grid(value, min_val, max_val, grid_size)
    normalized = (value - min_val) / (max_val - min_val)
    return round(Int, normalized * (grid_size - 1))
end

function unscale_from_grid(pos, min_val, max_val, grid_size)
    normalized = pos / (grid_size - 1)
    return min_val + normalized * (max_val - min_val)
end
```

### 3. Braille Encoding
```julia
const BRAILLE_DOTS = [
    0x01 0x08  # ⠁ ⠈
    0x02 0x10  # ⠂ ⠐
    0x04 0x20  # ⠄ ⠠
    0x40 0x80  # ⡀ ⢀
]

function braille_char(dots::Vector{Bool})
    code = 0x2800  # Base Braille
    for (i, dot) in enumerate(dots)
        if dot
            code |= BRAILLE_DOTS[i]
        end
    end
    return Char(code)
end
```

### 4. Line Drawing (Bresenham)
```julia
function draw_line!(canvas, x0, y0, x1, y1, char='•')
    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    sx = x0 < x1 ? 1 : -1
    sy = y0 < y1 ? 1 : -1
    err = dx - dy
    
    while true
        draw_point!(canvas, x0, y0, char)
        x0 == x1 && y0 == y1 && break
        e2 = 2 * err
        if e2 > -dy
            err -= dy
            x0 += sx
        end
        if e2 < dx
            err += dx
            y0 += sy
        end
    end
end
```

### 5. Histogram Bars
```julia
const BAR_CHARS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']

function draw_bar!(canvas, x, y, height, value)
    full_bars = Int(floor(value))
    partial = (value - full_bars) * length(BAR_CHARS)
    partial_char = BAR_CHARS[Int(round(partial * length(BAR_CHARS))) + 1]
    
    for i in 1:full_bars
        canvas.buffer[y-i, x] = '█'
    end
    canvas.buffer[y-full_bars-1, x] = partial_char
end
```

### 6. Automatic Axis Scaling
```julia
function nice_limits(min_val, max_val)
    range = max_val - min_val
    padding = range * 0.05
    nice_min = floor(min_val - padding)
    nice_max = ceil(max_val + padding)
    return nice_min, nice_max
end

function generate_ticks(min_val, max_val, count=5)
    step = (max_val - min_val) / (count - 1)
    return [min_val + i * step for i in 0:(count-1)]
end
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Canvas Buffer | 5/5 | Universal | 2D char array |
| Coordinate Scale | 5/5 | Universal | Linear interpolation |
| Braille Graphics | 5/5 | Universal | Unicode standard |
| Line Drawing | 5/5 | Universal | Bresenham's algo |
| Bar Rendering | 5/5 | Universal | Partial blocks |
| Axis Generation | 5/5 | Universal | Tick algorithms |
| Color Mapping | 4/5 | High | ANSI support needed |
| Legend Layout | 4/5 | High | Text positioning |

## Implementation Recommendations

### For Rust:
- Vec<Vec<Char>> for canvas buffer
- Braille character constants
- Bresenham line implementation
- Linspace utility function

### For Python:
- Numpy arrays for efficient grids
- Unicode literals for braille
- Matplotlib-style API
- Terminal size detection

### For Go:
- [][]rune for canvas
- Fixed braille encoding table
- text/tabwriter for alignment
- termbox/tcell for output

## Key Unicode Characters for Plotting
```
Box Drawing: ─ ━ │ ┃ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ╭ ╮ ╯ ╰
Blocks: ░ ▒ ▓ █ ▏ ▎ ▍ ▌ ▋ ▊ ▉
Braille: ⠁ ⠂ ⠄ ⡀ ⠈ ⠐ ⠠ ⢀ (256 total)
Lines: ╱ ╲ ╳ ╔ ╗ ╚ ╝ ║═
Shapes: ○ ● ◎ ◆ ▲ △ ▼ ▽ ★ ☆
```

## Files of Interest
- UnicodePlots/src/*.jl - Julia implementation
- UnicodePlots/docs/ - Documentation

## Lessons for TUI Development
1. Braille gives 8x resolution for graphics
2. Partial block characters (▏▎▍) for smooth bars
3. Bresenham for clean line drawing
4. Automatic scaling is essential for usability
5. Box drawing chars make clean borders
6. Color enhances but shouldn't be required
7. Unicode rendering depends on terminal font
