# Anthology: Data Visualization

> **Subject:** Data Visualization - presenting data effectively in terminal constraints
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Data Visualization Mastery

### 13.1 Core Chart Types

```rust
pub enum ChartType {
    Line { show_points: bool, smooth: bool },
    Bar { direction: BarDirection, grouped: bool, stacked: bool },
    Scatter { size_range: (f32, f32) },
    Heatmap { color_scale: ColorScale },
    Histogram { bins: usize, cumulative: bool },
    Pie { donut: bool, show_labels: bool },
    Area { fill: bool, fill_opacity: f32 },
    Candlestick { wick: bool },
    Radar { categories: Vec<String>, normalized: bool },
    Gauge { min: f64, max: f64, zones: Vec<Zone> },
}

pub struct Chart {
    pub chart_type: ChartType,
    pub data: DataSeries,
    pub axes: Axes,
    pub legend: Option<Legend>,
    pub title: Option<String>,
    pub width: usize,
    pub height: usize,
}

impl Chart {
    pub fn render_line_chart(&self, fb: &mut Framebuffer) {
        let series = &self.data.series[0];
        let (x_min, x_max) = self.axes.x_range;
        let (y_min, y_max) = self.axes.y_range;

        // Find y position for each point
        for (i, point) in series.points.iter().enumerate() {
            let x = self.x_axis_pos(i, series.len());
            let y = self.y_axis_pos(point.y, y_min, y_max);

            if self.chart_type.smooth {
                // Bezier curve
                // ...
            } else {
                // Direct line
                if i > 0 {
                    let prev_x = self.x_axis_pos(i - 1, series.len());
                    let prev_y = self.y_axis_pos(series.points[i - 1].y, y_min, y_max);
                    fb.draw_line(prev_x, prev_y, x, y, &self.axes.line_color);
                }
            }

            if self.chart_type.show_points {
                fb.set_cell(x, y, Cell::glyph('●', &self.axes.dot_color));
            }
        }
    }

    pub fn render_bar_chart(&self, fb: &mut Framebuffer) {
        let bar_count = self.data.series[0].points.len();
        let chart_height = self.height - 2;  // minus margins

        if self.chart_type.direction == BarDirection::Vertical {
            for (i, point) in self.data.series[0].points.iter().enumerate() {
                let bar_width = self.width / bar_count;
                let x = i * bar_width;
                let bar_height = ((point.y / self.axes.y_max) * chart_height as f64) as usize;

                // Draw bar
                for y in 0..bar_height {
                    let color = self.color_for_value(point.y);
                    fb.set_cell(x + bar_width / 2, chart_height - y, Cell::glyph('█', &color));
                }
            }
        }
    }
}
```

### 13.2 Terminal Graphics Primitives

```rust
pub struct TerminalGraphics {
    pub chars: Vec<char>,    // Plotting characters
    pub blocks: Vec<char>,   // Block elements (▁▂▃▄▅▆▇█)
    pub braille: Vec<char>,  // Braille patterns
}

impl TerminalGraphics {
    pub fn draw_line(&self, fb: &mut Framebuffer, x0: usize, y0: usize, x1: usize, y1: usize, glyph: char, color: &Color) {
        // Bresenham's line algorithm
        let dx = (x1 as i32 - x0 as i32).abs();
        let dy = (y1 as i32 - y0 as i32).abs();
        let sx = if x0 < x1 { 1 } else { -1 };
        let sy = if y0 < y1 { 1 } else { -1 };
        let mut err = dx - dy;

        let mut x = x0 as i32;
        let mut y = y0 as i32;

        loop {
            fb.set_cell(x as usize, y as usize, Cell::glyph(glyph, color));

            if x == x1 as i32 && y == y1 as i32 {
                break;
            }

            let e2 = 2 * err;
            if e2 > -dy {
                err -= dy;
                x += sx;
            }
            if e2 < dx {
                err += dx;
                y += sy;
            }
        }
    }

    pub fn draw_rect(&self, fb: &mut Framebuffer, x: usize, y: usize, w: usize, h: usize, char: char, color: &Color) {
        for dy in 0..h {
            for dx in 0..w {
                // Draw corners with different chars
                let c = match (dx, dy) {
                    (0, 0) => '┌',
                    (w - 1, 0) => '┐',
                    (0, h - 1) => '└',
                    (w - 1, h - 1) => '┘',
                    (0, _) | (w - 1, _) => '│',
                    (_, 0) | (_, h - 1) => '─',
                    _ => char,
                };
                fb.set_cell(x + dx, y + dy, Cell::glyph(c, color));
            }
        }
    }
}
```

### 13.3 Color Scales

```rust
pub struct ColorScale {
    pub stops: Vec<ColorStop>,
    pub interpolation: ColorInterpolation,
}

pub struct ColorStop {
    pub position: f32,  // 0.0 to 1.0
    pub color: Color,
}

pub enum ColorInterpolation {
    RGB,
    HSV,
    LAB,  // Perceptually uniform
    LCh,
}

impl ColorScale {
    pub fn color_for_value(&self, value: f32) -> Color {
        let t = value.clamp(0.0, 1.0);

        match self.interpolation {
            ColorInterpolation::RGB => self.lerp_rgb(t),
            ColorInterpolation::HSV => self.lerp_hsv(t),
            ColorInterpolation::LAB => self.lerp_lab(t),
            ColorInterpolation::LCh => self.lerp_lch(t),
        }
    }

    fn lerp_rgb(&self, t: f32) -> Color {
        if self.stops.len() < 2 {
            return self.stops.first().map(|s| s.color).unwrap_or(Color::BLACK);
        }

        // Find surrounding stops
        let (low, high) = self.find_stops(t);

        // Linear interpolation
        let local_t = (t - low.position) / (high.position - low.position);
        low.color.lerp(&high.color, local_t)
    }

    fn find_stops(&self, t: f32) -> (&ColorStop, &ColorStop) {
        let mut low = &self.stops[0];
        let mut high = &self.stops[self.stops.len() - 1];

        for i in 0..self.stops.len() - 1 {
            if t >= self.stops[i].position && t <= self.stops[i + 1].position {
                low = &self.stops[i];
                high = &self.stops[i + 1];
                break;
            }
        }

        (low, high)
    }
}
```

### 13.4 Accessibility Guidelines

```rust
pub struct AccessibilityChecker {
    pub color_contrast_min: f32,
    pub color_blind_safe: bool,
}

impl AccessibilityChecker {
    pub fn check_contrast(&self, fg: &Color, bg: &Color) -> (bool, f32) {
        let luminance_fg = self.relative_luminance(fg);
        let luminance_bg = self.relative_luminance(bg);

        let ratio = (luminance_fg.max(luminance_bg) + 0.05) / (luminance_fg.min(luminance_bg) + 0.05);
        let passes = ratio >= self.color_contrast_min;

        (passes, ratio)
    }

    pub fn relative_luminance(&self, color: &Color) -> f32 {
        let to_linear = |c: u8| -> f32 {
            let c = c as f32 / 255.0;
            if c <= 0.03928 {
                c / 12.92
            } else {
                ((c + 0.055) / 1.055).powf(2.4)
            }
        };

        let r = to_linear(color.r);
        let g = to_linear(color.g);
        let b = to_linear(color.b);

        0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    pub fn check_color_blind_safe(&self, colors: &[Color]) -> Vec<Color> {
        // Simulate different types of color blindness
        let deuteranopia = colors.iter().map(|c| self.simulate_deuteranopia(c));
        let protanopia = colors.iter().map(|c| self.simulate_protanopia(c));
        // Ensure sufficient differentiation in both simulations
        // ...
        colors.to_vec()
    }
}
```

### 13.5 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Too many colors | Rainbow mess | Limit to 5-7 colors |
| Wrong color scale | Perceptual distortion | Use LAB/LCh interpolation |
| No accessibility | Colorblind users can't read | Check contrast ratios |
| Cluttered legend | Unreadable | Hide when not needed |
| Fixed scale | Misleading data | Dynamic scaling |

---

# PART 2: NOVEL CONCEPTS REPORT

## Data Visualization: Untapped Opportunities

### Concept 1: "Living" Data with Animated Transitions

**Idea:** Data visualizations that **animate between states** when data updates.

```rust
pub struct AnimatedChart {
    current_data: DataSeries,
    target_data: DataSeries,
    animation_progress: f32,
    transition_duration_ms: u64,
}

impl AnimatedChart {
    pub fn update_data(&mut self, new_data: DataSeries) {
        self.current_data = self.target_data.clone();
        self.target_data = new_data;
        self.animation_progress = 0.0;
    }

    pub fn render(&mut self, fb: &mut Framebuffer) -> DataSeries {
        self.animation_progress += self.delta_ms as f32 / self.transition_duration_ms as f32;
        if self.animation_progress > 1.0 {
            self.animation_progress = 1.0;
        }

        // Interpolate between current and target
        let interpolated = self.current_data.lerp(&self.target_data, self.animation_progress);
        self.render_series(&interpolated, fb);
        interpolated
    }
}
```

**Novel because:** TUIs redraw charts instantly. Animated transitions = smoother understanding of changes.

**Complexity:** Medium
**Value:** High (better data comprehension)

---

### Concept 2: Semantic Glyph Mapping

**Idea:** Map data values to **semantically meaningful characters**.

```rust
pub struct SemanticGlyphMapper {
    mappings: HashMap<DataType, Vec<(f32, char)>>,
}

impl SemanticGlyphMapper {
    pub fn glyph_for(&self, data_type: DataType, value: f32) -> char {
        match data_type {
            DataType::Temperature => {
                let glyphs = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
                let idx = ((value + 1.0) * 0.5 * (glyphs.len() - 1) as f32) as usize;
                glyphs[idx.clamp(0, glyphs.len() - 1)]
            }
            DataType::Pressure => '⣀',  // Braille-like
            DataType::Flow => '≣',       // Flow arrows
            _ => '●',
        }
    }
}
```

**Novel because:** Charts use geometric primitives. Semantic glyphs = instant recognition.

**Complexity:** Low
**Value:** Medium (domain-specific clarity)

---

**End of Data Visualization Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Terminal Plotting Pipeline: Data Space to Unicode Output

Every terminal data visualization follows the same four-stage contract:

```
Data Space (min_x..max_x, min_y..max_y)
  ↓ scale_to_grid / nice_limits
Grid Space (0..width, 0..height)
  ↓ character_selection (Braille / blocks / shapes)
Unicode Output (U+2800–U+28FF, box-drawing, blocks)
  ↓ color_map (RGB→ANSI / HSV→ANSI)
Colored ANSI Output
```

**Stage 1 — Coordinate Transformation (UnicodePlots):**
`scale_to_grid(value, min_val, max_val, grid_size)` normalizes to `[0, 1]` then multiplies by `grid_size - 1`. Inverse: `unscale_from_grid()` for cursor→data readout. `nice_limits(min, max)` adds 5% padding and rounds to clean bounds. `generate_ticks(min, max, count=5)` produces evenly-spaced axis ticks.

```rust
fn scale_to_grid(value: f64, min: f64, max: f64, grid: usize) -> usize {
    let n = (value - min) / (max - min);
    (n * (grid - 1) as f64).round() as usize
}
```

**Stage 2 — Character Selection:**
Three resolution tiers:
- **Standard blocks** (█▇▆▅▄▃▂▁▀): 1 cell = 1 data point. Vertical bar charts.
- **Braille patterns** (U+2800–U+28FF): 1 cell = 2×4 dot grid = 8 sub-cells. Dot density doubled horizontally, quadrupled vertically.
- **Half-blocks** (▀ top-half, ▄ bottom-half): 2 vertical levels per cell for images/heatmaps.

```rust
const BRAILLE_DOTS: [u8; 8] = [0x01, 0x08, 0x02, 0x10, 0x04, 0x20, 0x40, 0x80];

fn braille_from_dots(dots: &[bool; 8]) -> char {
    let mut code: u32 = 0x2800;
    for (i, &on) in dots.iter().enumerate() {
        if on { code |= BRAILLE_DOTS[i] as u32; }
    }
    char::from_u32(code).unwrap()
}
```

**Stage 3 — Geometric Rendering (LibTCOD drawing primitives):**

| Primitive | LibTCOD API | Use in Data Viz |
|-----------|-------------|-----------------|
| Horizontal line | `TCOD_console_hline()` | Axis lines, grid lines |
| Vertical line | `TCOD_console_vline()` | Y-axis, grid lines |
| Rectangle outline | `TCOD_console_rect()` | Chart borders, legend box |
| Filled rectangle | `TCOD_console_fill_rect()` | Bar chart bars (block-based) |
| Circle | `TCOD_console_circle()` | Scatter plot dots |
| Single glyph | `TCOD_console_put_cell()` | Point markers |

**Stage 4 — Color Mapping (LibTCOD + LibCACA):**

LibTCOD's `ColorRGB` ↔ `ColorHSV` conversion enables both RGB ramps and perceptually-tuned gradients. `lerp()` interpolates between two colors:
```rust
fn color_lerp(a: RGB, b: RGB, t: f32) -> RGB {
    RGB {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
    }
}
```
For data scales: map `t = (value - min) / (max - min)` then interpolate across a gradient stop array. HSV interpolation (hue sweep) is commonly used for heatmaps; RGB interpolation for sequential scales. LibLAB interpolation — handled in application code — is better for perceptual uniformity across the full range.

## 3.2 Character Resolution Systems: Braille, Blocks, and Shade Sets

**Braille (UnicodePlots, LibCACA):**
Each Braille cell encodes 8 dots in a 2×4 grid. Bit layout:
```
Dot 1 (0x01)  Dot 2 (0x08)
Dot 3 (0x02)  Dot 4 (0x10)
Dot 5 (0x04)  Dot 6 (0x20)
Dot 7 (0x40)  Dot 8 (0x80)
```
This produces 256 possible patterns (U+2800–U+28FF). The effective resolution gain is 2× horizontal and 4× vertical vs a single character cell — the single most impactful primitive for terminal plotting density.

**Block Partials (UnicodePlots bar chart primitive):**
```rust
const BAR_CHARS: [char; 9] = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];
```
Each step represents 1/8 of a cell height, enabling smooth fractional bar rendering. A value of `3.7` maps to 3 full blocks (█) plus partial char index `round(0.7 * 8) = 6` → `▊`.

**Character Set Mappings (LibCACA):**
LibCACA defines multiple character sets for rasterization:
- ASCII ramp: `' .:-=+*#%@'` (10 levels)
- Block ramp: `' ░▒▓█'` (5 levels)
- Braille: all 256 patterns (256 levels)
- Custom: user-defined symbol tables

Selection depends on terminal font support. Braille requires Unicode; blocks are safe across most modern terminals; ASCII ramps are the universal fallback.

**Scatter Plot Shapes (UnicodePlots):**
`○ ● ◆ ▲ ▼ ★` — use distinct shapes to encode categories. Rule: encode category by shape, encode intensity by color. Never encode both with the same channel.

## 3.3 Dithering and Color Quantization (LibCACA)

When terminal color depth is limited (16 or 256 colors), dithering preserves the illusion of smooth gradients by distributing quantization error spatially.

**Floyd-Steinberg (LibCACA default):**
```
for each cell (x, y):
    old = grayscale(cell)
    new = quantize(old, palette)
    error = old - new
    propagate:
        cell(x+1, y)   += error * 7/16
        cell(x-1, y+1) += error * 3/16
        cell(x,   y+1) += error * 5/16
        cell(x+1, y+1) += error * 1/16
```

**Atkinston dithering** (alternative in LibCACA): distributes error to 6 neighbors (8/8 total) with a softer appearance but slightly more diffusion.

**Ordered dithering (Bayer matrix):**
Uses a fixed threshold matrix (typically 4×4 or 8×8). Faster than error diffusion but introduces visible patterning. Suitable for real-time rendering where per-pixel error propagation is too expensive.

**For heatmaps:** Floyd-Steinberg on the value channel produces the smoothest gradients. For categorical data, use direct palette mapping (no dithering) to avoid visual noise at category boundaries.

## 3.4 Image and Raster Data Visualization (Chafa, Termflix)

**Chafa's image-to-terminal pipeline:**
```
Image Load → Scale to (cols × rows) → Color Quantize (256/16) → Symbol Map → Output
```
Chafa supports three symbol modes:
- `CHAFA_SYMBOL_MODE_BLOCKS`: maps pixel blocks to `▀▄█░▒▓` (top-half, bottom-half, full, shades)
- `CHAFA_SYMBOL_MODE_BRAILLE`: maps 2×4 pixel blocks to Braille (highest resolution)
- `SHADES`: maps to gradient ramp characters

**Sixel graphics** (Chafa, Notcurses): A raster graphics protocol that encodes 6-pixel-high bands as escape sequences. Supported in xterm, WezTerm, iTerm2, foot. Enables true pixel-accurate visualization at the cost of terminal compatibility.

**Termflix frame pipeline:**
```
Video Frame → Resize (fit terminal) → Grayscale → Character Map → ANSI Color → Output
```
Brightness-to-char: `charset[pixel * charset.len() / 256]`. Dominant color sampled per cell enables true-color reconstruction. Termflix's dirty-tracking optimization: only rewrite cells that changed between frames, reducing escape sequence output by 60–90% on static scenes.

**For data visualization applications:**
- Use Termflix-style frame differencing for real-time data dashboards: compute per-cell dirty flags, emit only changed regions.
- Chafa-style block mapping for rendering heatmaps from numeric arrays: treat `(width × height)` float matrix as a grayscale image, map through block/Braille symbols.

## 3.5 Color System Mechanics (LibTCOD, Bracket-Lib, LibCASCADE)

**Gradient construction (LibTCOD `lerp`):**
```rust
// Build N-stop gradient
fn gradient_color(stops: &[(f32, RGB)], t: f32) -> RGB {
    let t = t.clamp(0.0, 1.0);
    for i in 0..stops.len() - 1 {
        if t >= stops[i].0 && t <= stops[i + 1].0 {
            let local_t = (t - stops[i].0) / (stops[i + 1].0 - stops[i].0);
            return color_lerp(stops[i].1, stops[i + 1].1, local_t);
        }
    }
    stops.last().unwrap().1
}
```

**Bracket-Lib color system:**
`RGB { r: f32, g: f32, b: f32 }` with `lerp()`, `to_hsv()`, `to_greyscale()`, `desaturate()`. `ColorPair { foreground: RGB, background: RGB }` mirrors the char+color pair standard. Named colors from W3C palette provide sensible defaults (300+ named colors).

**Chafa/Notcurses true color:**
24-bit RGB with `set_fg_rgb(r, g, b)` / `set_bg_rgb(r, g, b)`. Detection: `COLORTERM=truecolor` env var or terminfo `colors#16777216`. Fallback chain: truecolor → 256-color → 16-color.

**For data viz palette selection:**
- Sequential data: single-hue gradient (e.g., white → blue)
- Diverging data: two-hue gradient with neutral midpoint (e.g., red → white → blue)
- Categorical data: maximally-separated hues (HSV: `H = i * 360/n`, fixed S=80%, V=90%)
- Perceptually uniform: use CIELAB. For terminal constraints, HSV fixed-saturation is an acceptable approximation.

## 3.6 Table and Structured Data Rendering (Rich)

Rich's table system provides structured data presentation primitives:

**Column width algorithm:**
1. Measure max text width per column
2. Add padding (left + right)
3. If total > terminal width: shrink widest columns proportionally, minimum = header width + 2
4. Text wraps within column using `textwrap`-style word breaking

**Progress bar encoding:**
Rich's `ProgressBar` uses elapsed/remaining time, ETA, transfer speed. The bar itself: `[████████████░░░░░░░░] 60%` — partial block `█` for filled, `░` for unfilled, with UTF-8 partial chars for sub-character precision.

**Rich `Segment(text, Style)` model:**
The atomic renderable unit is a `(text, Style)` pair. Style compiles to a single ANSI sequence (`\x1b[...m`) and is cached. This maps directly to the terminal cell model: each cell is `(char, fg_style, bg_style)`. For data visualization: divide numeric range into bucketed segments, each with a distinct `Style` foreground color → compact sparkline-like output.

```rust
// Rich-style sparkline
fn sparkline(values: &[f64], width: usize) -> Vec<Segment> {
    let (min, max) = min_max(values);
    let bucket_height = (max - min) / 7.0;
    values.iter().map(|v| {
        let level = ((v - min) / bucket_height).min(7.0) as usize;
        let ch = ['▁','▂','▃','▄','▅','▆','▇','█'][level];
        Segment::new(ch.to_string(), style_for_level(level))
    }).collect()
}
```

## 3.7 Performance: Dirty Tracking and Layer Composition (Notcurses, Termflix)

**Notcurses plane system for dashboards:**
An `ncplane` is a virtual drawing surface with its own coordinate system. For multi-widget dashboards, assign each chart/widget to a separate plane:
- Z-order handles overlap naturally
- Dirty tracking is per-plane (only re-render changed planes)
- Planes can be moved/resized without recomputing content

**Composite render order:**
```
bottom → top:
  background plane (solid color)
  grid plane (axis lines, tick marks)
  data plane (the actual chart)
  overlay plane (cursor tooltip, legend)
```
Each plane composes independently, only the final framebuffer is emitted to the terminal.

**Dirty cell tracking (Termflix pattern):**
```
cells: Vec<Cell>       // current frame
dirty: Vec<bool>       // changed flags
next:  Vec<Cell>       // next frame being built

// After building next frame:
for i in 0..cells.len() {
    if cells[i] != next[i] {
        dirty[i] = true;
        cells[i] = next[i].clone();
    }
}
// Render loop: only emit escape sequences where dirty[i] is true
```
This reduces output from O(screen_size) to O(changed_cells) per frame. Critical for real-time data streaming at >30fps.

## 3.8 Multi-Channel Encoding: The Never-Conflict Rule

When encoding data into terminal characters, always separate channels:

| Channel | Encoding | Do NOT also encode with |
|---------|----------|------------------------|
| Category | Character shape (○●◆▲) | Color |
| Intensity | Color (gradient) | Shape |
| Time | X-position (horizontal axis) | Color |
| Magnitude | Character size (block level) | Shape |
| Density | Braille dot pattern | Background color |

**Violation example:** using red circles for "hot" and blue squares for "cold" — this conflates category with intensity and fails for colorblind users.

**Correct approach:** one shape for all points, color encodes value; OR one color, shapes encode categories. Add a redundant pattern/texture channel only when both color and shape are needed for separate dimensions.

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Terminal Output as Live Data Stream

Canopy's `TerminalView` output handler is itself a data-streaming pattern:

**Stream contract (bidirectional):**
```
PTY → (reader thread) → Tauri Channel → IPC → React → xterm.write()
React → xterm.onData → writeToTerminal(termId, data) → writer → PTY → CLI
```

**Raw-byte send preserves ANSI:** xterm.js receives the exact bytes emitted by the PTY and reconstructs the colorized prompt exactly as a real terminal would. There is no re-interpretation of escape sequences at the Tauri boundary.

**Metric derivations from the stream (not currently tracked but feasible):**
- Bytes-per-second: sum of `event.data.len()` across 1-second windows
- Throughput histogram: throughput per active session
- Exit code distribution: count of `Exit { code }` across sessions
- Attention dwell: `Date.now() - lastAttentionTime` when session goes `waiting`

**Power user visualization reusing this stream:** Integrate a small Sparkline or histogram in the status bar that plots bytes-per-second across the session.

---
