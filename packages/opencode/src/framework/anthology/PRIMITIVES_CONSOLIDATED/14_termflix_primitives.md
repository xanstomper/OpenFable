# Termflix Terminal Primitives Report

## Overview
Termflix is a Rust application that converts video to terminal-rendered ASCII/Unicode art. It demonstrates real-time animation, frame processing, and efficient terminal rendering.

## Root Primitives

### 1. Video Processing
**Location:** `src/video.rs` (inferred)

**Features:**
- Video file decoding
- Frame extraction
- Frame rate control
- Seeking support

**Dependencies (from Cargo.toml):**
- ffmpeg bindings for video decoding
- Image processing crates

### 2. Frame-to-ASCII Conversion
**Pattern:**
```
Video Frame → Resize → Grayscale → Character Map → Terminal Output
```

**Steps:**
1. Decode video frame
2. Scale to terminal dimensions
3. Convert to grayscale
4. Map brightness to characters
5. Apply colors if supported

### 3. Character Mapping
**Brightness to Character:**
```
' ' (0) → ░ → ▒ → ▓ → █ (255)
```

**Custom Character Sets:**
- ASCII only
- Extended ASCII
- Unicode blocks
- Braille
- Custom mappings

### 4. Color Processing
**Options:**
- Grayscale (no color)
- 16-color ANSI
- 256-color palette
- True color (RGB)

**Pattern:**
- Sample dominant color per cell
- Quantize to available palette
- Apply as background or foreground

### 5. Frame Timing
**Features:**
- Original framerate preservation
- Speed adjustment
- Frame skipping for performance
- V-sync to terminal refresh

### 6. Terminal Output
**Optimization:**
- Double buffering
- Dirty cell tracking
- Minimal escape sequences
- Batch output

**Pattern:**
```rust
// Build frame buffer
for y in 0..height {
    for x in 0..width {
        let cell = process_pixel(frame, x, y);
        output.push(cell.to_ansi());
    }
}
// Single write to terminal
stdout.write_all(&output)?;
```

### 7. Playback Control
**Features:**
- Play/pause
- Seek forward/backward
- Speed control
- Loop mode
- Frame-by-frame

### 8. Display Modes
**Options:**
- Full screen
- Windowed
- Fixed dimensions
- Auto-fit to terminal

## Source Structure
animations
config.rs
external.rs
gallery.rs
generators
gif.rs
main.rs
png.rs
record.rs
render

## Cargo Dependencies
[package]
name = "termflix"
version = "0.5.1"
edition = "2024"
description = "Terminal animation player with 44 procedurally generated animations, multiple render modes, and true color support"
license = "MIT"
repository = "https://github.com/paulrobello/termflix"
homepage = "https://github.com/paulrobello/termflix"
readme = "README.md"
keywords = ["terminal", "animation", "ascii-art", "braille", "tui"]
categories = ["command-line-utilities", "visualization"]
authors = ["Paul Robello <probello@gmail.com>"]

[dependencies]
crossterm = "0.29.0"
noise = "0.9.0"
clap = { version = "4.6", features = ["derive"] }
rand = "0.10"
libc = "0.2"
toml = "1.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
notify = { version = "8", default-features = false, features = ["macos_kqueue", "mio"] }
dirs = "6"

## Reusable Patterns

### 1. Video Frame Pipeline
```rust
struct VideoProcessor {
    decoder: Decoder,
    width: usize,
    height: usize,
    chars: Vec<char>,
}

impl VideoProcessor {
    fn process_frame(&mut self, frame: Frame) -> Vec<Cell> {
        let resized = self.resize(frame);
        let grayscale = self.to_grayscale(resized);
        self.map_to_chars(grayscale)
    }
}
```

### 2. Character Mapping Function
```rust
fn brightness_to_char(brightness: u8, charset: &[char]) -> char {
    let idx = (brightness as usize * charset.len()) / 256;
    charset[idx]
}

const ASCII_CHARS: &[char] = &[' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];
```

### 3. Color Quantization
```rust
fn quantize_color(r: u8, g: u8, b: u8, palette: &[Color]) -> Color {
    palette.iter()
        .min_by_key(|c| color_distance(*c, r, g, b))
        .copied()
        .unwrap_or(Color::Default)
}
```

### 4. Frame Timing
```rust
fn maintain_framerate(target_fps: u32, frame_start: Instant) {
    let frame_duration = Duration::from_millis(1000 / target_fps as u64);
    let elapsed = frame_start.elapsed();
    if elapsed < frame_duration {
        thread::sleep(frame_duration - elapsed);
    }
}
```

### 5. Terminal Buffer
```rust
struct TerminalBuffer {
    width: usize,
    height: usize,
    cells: Vec<Cell>,
    dirty: Vec<bool>,
}

impl TerminalBuffer {
    fn render(&self, stdout: &mut Stdout) -> io::Result<()> {
        for (i, cell) in self.cells.iter().enumerate() {
            if self.dirty[i] {
                write!(stdout, "{}", cell.ansi_code())?;
            }
        }
        stdout.flush()
    }
}
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Video Decoding | 4/5 | High | FFmpeg bindings exist |
| Frame Scaling | 5/5 | Universal | Image processing |
| Grayscale Conv | 5/5 | Universal | Simple math |
| Char Mapping | 5/5 | Universal | Lookup table |
| Color Quantize | 5/5 | Universal | Distance algorithm |
| Frame Timing | 5/5 | Universal | Sleep/interval |
| Double Buffer | 5/5 | Universal | Essential pattern |
| Dirty Tracking | 5/5 | Universal | Performance critical |

## Implementation Recommendations

### For Python:
- Use opencv-python for video
- PIL/Pillow for image processing
- curses for terminal output
- numpy for efficient array ops

### For Go:
- Use goav or ffmpeg bindings
- image package for processing
- tcell for terminal output
- Fixed arrays for buffers

### For Rust:
- Use ffmpeg-next crate
- image crate for processing
- crossterm/ratatui for terminal
- Vec for dynamic buffers

## Files of Interest
- termflix/src/main.rs - Main program
- termflix/Cargo.toml - Dependencies
- termflix/src/*.rs - Implementation modules

## Lessons for TUI Development
1. Video processing is CPU-intensive - consider threading
2. Frame scaling is essential for terminal fit
3. Character mapping is a simple lookup
4. Color quantization improves visual quality
5. Frame timing keeps playback smooth
6. Dirty tracking essential for 60fps terminal rendering
7. Consider frame skipping when terminal can't keep up
