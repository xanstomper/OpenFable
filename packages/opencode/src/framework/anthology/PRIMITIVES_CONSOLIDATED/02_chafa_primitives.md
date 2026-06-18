# Chafa Terminal Primitives Report

## Overview
Chafa is a C library for converting images to terminal graphics. It supports multiple output formats including Unicode characters, Sixel, and iTerm2 inline images.

## Root Primitives

### 1. Canvas System
**Location:** `chafa/chafa-canvas.*`

**Core Structure:**
- `ChafaCanvas` - Main canvas object
- `chafa_canvas_new()` - Create canvas with config
- `chafa_canvas_unref()` - Cleanup

**Features:**
- Configurable dimensions (rows, columns)
- Multiple symbol set support
- Background/foreground color handling
- Pixel-to-character mapping

### 2. Image Processing
**Location:** `chafa/chafa-image.*`

**Functions:**
- Image loading from various formats
- Color quantization
- Scaling and cropping
- Alpha handling

### 3. Symbol/Character Mapping
**Location:** `chafa/chafa-canvas-config.*`

**Symbol Sets:**
- Block characters (block, half-block)
- Braille (dot patterns)
- Shades (gradient blocks)
- Custom symbol definitions

**Symbol Modes:**
- CHAFA_SYMBOL_MODE_BLOCKS
- CHAFA_SYMBOL_MODE_BRAILLE
- CHAFA_SYMBOL_MODE_SHADES
- CHAFA_SYMBOL_MODE_CUSTOM

### 4. Color Handling
**Features:**
- 256-color palette support
- True color (24-bit) support
- Grayscale conversion
- Dithering algorithms

### 5. Output Formats
**Supported:**
- Unicode character grids
- Sixel graphics
- iTerm2 inline images
- ANSI escape sequences

### 6. Configuration System
**Config Functions:**
- `chafa_canvas_config_new()`
- `chafa_canvas_config_set_width()`
- `chafa_canvas_config_set_height()`
- `chafa_canvas_config_set_symbol_mode()`

## Reusable Patterns

### 1. Image-to-Terminal Conversion Pipeline
Load Image -> Scale -> Quantize Colors -> Map to Symbols -> Render

### 2. Symbol Mapping Strategy
- Each pixel maps to a character
- 2x2 blocks for Braille (4 bits per cell)
- Full blocks for solid characters
- Half-blocks for vertical splits

### 3. Color Quantization
- Reduce image colors to terminal palette
- Dithering for smoother gradients
- Preserve visual fidelity within constraints

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Canvas Buffer | 5/5 | Universal | Core pattern |
| Image Loading | 4/5 | High | Use existing image libs |
| Color Quantization | 5/5 | Universal | Algorithm is pure math |
| Symbol Mapping | 5/5 | Universal | Directly portable |
| Sixel Output | 4/5 | High | Standard protocol |
| Dithering | 5/5 | Universal | Floyd-Steinberg, etc. |

## Implementation Recommendations

### For Rust/Go/Python:
1. Use existing image crate (image, go-image, PIL)
2. Implement color quantization (k-means or palette-based)
3. Create symbol mapping table
4. Output as Unicode grid or Sixel

### Key Algorithm (simplified pixel-to-character):
Each pixel's brightness determines character:
- >200: solid block
- >150: dark shade
- >100: medium shade
- >50: light shade
- else: space

## Files of Interest
- chafa/chafa.h - Main API header
- chafa/chafa-canvas.c - Canvas implementation
- chafa/chafa-image.c - Image processing
- chafa/chafa-placement.c - Character placement logic
