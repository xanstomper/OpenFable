# Colorprofile Primitives Analysis

## Overview
**Colorprofile** is a Go package for detecting terminal color capabilities and performing **automatic color degradation** (downsampling) of RGB/ANSI colors to match the terminal's supported profile. It ensures that applications render colors correctly across terminals with varying capabilities (true color, 256-color, 16-color, or no color).

**Purpose**: Terminal color capability detection and automatic color space degradation.
**Language**: Go.
**Maturity**: Production-ready.
**Dependencies**: None (pure Go).

---

## Core Primitives

### 1. **Color Profile Detection**
**Purpose**: Identify the terminal's color support level.

**Primitives**:
- **`colorprofile.Detect(w io.Writer, env []string) Profile`**: Detects the color profile of the terminal associated with the given writer (e.g., `os.Stdout`). Uses environment variables (e.g., `TERM`, `COLORTERM`, `NO_COLOR`) and terminal capabilities to determine the profile.

**Supported Profiles**:
| Profile | Description | Color Depth |
|---------|-------------|-------------|
| `TrueColor` | 24-bit RGB (16.7M colors) | 24-bit |
| `ANSI256` | 256-color palette | 8-bit |
| `ANSI` | 16-color ANSI (4-bit) | 4-bit |
| `Ascii` | No color support (plain text) | None |
| `NoTTY` | Not a TTY (e.g., piped output, files) | None |

**Detection Logic**:
1. Checks `NO_COLOR` environment variable (disables color if set).
2. Checks `TERM` and `COLORTERM` for known terminal types.
3. Uses `io.Writer` to query terminal capabilities (if possible).
4. Falls back to `Ascii` if detection fails.

**Example**:
```go
import "github.com/charmbracelet/colorprofile"

p := colorprofile.Detect(os.Stdout, os.Environ())
switch p {
case colorprofile.TrueColor:
    fmt.Println("Terminal supports 24-bit color")
case colorprofile.ANSI256:
    fmt.Println("Terminal supports 256 colors")
case colorprofile.ANSI:
    fmt.Println("Terminal supports 16 colors")
case colorprofile.Ascii:
    fmt.Println("Terminal has no color support")
case colorprofile.NoTTY:
    fmt.Println("Output is not a TTY (e.g., piped)")
}
```

---

### 2. **Color Downsampling (Conversion)**
**Purpose**: Convert colors from higher color depths to lower ones (e.g., true color → 256-color).

**Primitives**:
- **`profile.Convert(c color.Color) color.Color`**: Converts a `color.Color` (e.g., `color.RGBA`) to the closest representable color in the target profile.
- **Manual Conversion**: Explicitly convert to a specific profile (e.g., `colorprofile.ANSI256.Convert(c)`).

**Downsampling Strategies**:
| Target Profile | Conversion Method |
|----------------|-------------------|
| `TrueColor` | No conversion (passthrough) |
| `ANSI256` | Maps RGB to the closest of 256 predefined colors using Euclidean distance in RGB space. |
| `ANSI` | Maps to the closest of 16 ANSI colors (0-15). |
| `Ascii` | Strips all color information (returns `color.RGBA{0, 0, 0, 0}`). |
| `NoTTY` | Strips all ANSI escape sequences (plain text). |

**Example**:
```go
p := colorprofile.Detect(os.Stdout, os.Environ())
c := color.RGBA{0x6b, 0x50, 0xff, 0xff} // #6b50ff (purple)

// Auto-convert based on detected profile
converted := p.Convert(c)

// Manual conversion
ansi256Color := colorprofile.ANSI256.Convert(c)
ansiColor := colorprofile.ANSI.Convert(c)
```

**Color Distance Algorithm**:
- For `ANSI256`, the library uses the **256-color palette** defined in the [xterm standard](https://en.wikipedia.org/wiki/ANSI_escape_code#256-color_mode).
- The closest color is found by calculating the **Euclidean distance** in RGB space:
  ```
  distance = sqrt((r1 - r2)^2 + (g1 - g2)^2 + (b1 - b2)^2)
  ```
- For `ANSI` (16-color), it maps to the closest of the 16 standard ANSI colors.

---

### 3. **Automatic ANSI Downsampling Writer**
**Purpose**: Wrap an `io.Writer` to automatically downsample ANSI escape sequences in output.

**Primitives**:
- **`colorprofile.NewWriter(w io.Writer, env []string) *Writer`**: Creates a writer that automatically downsampled ANSI color codes based on the detected terminal profile.
- **`writer.Profile`**: Override the detected profile (e.g., force `ANSI` or `NoTTY`).

**Key Features**:
- **Transparent Downsampling**: Automatically rewrites ANSI escape sequences (e.g., `\x1b[38;2;107;80;255m`) to match the terminal's capabilities.
- **NoTTY Handling**: Strips all ANSI codes if output is not a TTY (e.g., piped to a file).
- **Dynamic Profile Override**: Change the target profile at runtime.

**Example**:
```go
myFancyANSI := "\x1b[38;2;107;80;255mCute puppy!!\x1b[m"

// Auto-downsample for stdout
w := colorprofile.NewWriter(os.Stdout, os.Environ())
fmt.Fprintf(w, myFancyANSI) // Outputs true color, 256-color, or 16-color based on terminal

// Force 4-bit ANSI
w.Profile = colorprofile.ANSI
fmt.Fprintf(w, myFancyANSI) // Outputs 16-color ANSI

// Strip all colors
w.Profile = colorprofile.NoTTY
fmt.Fprintf(w, myFancyANSI) // Outputs "Cute puppy!!" (no ANSI codes)
```

**ANSI Code Handling**:
- **TrueColor**: Preserves `\x1b[38;2;R;G;Bm` (24-bit foreground) and `\x1b[48;2;R;G;Bm` (24-bit background).
- **ANSI256**: Converts to `\x1b[38;5;<index>m` (256-color foreground) and `\x1b[48;5;<index>m` (256-color background).
- **ANSI**: Converts to `\x1b[3<code>m` (4-bit foreground) and `\x1b[4<code>m` (4-bit background).
- **NoTTY/Ascii**: Strips all ANSI escape sequences.

---

## Technical Insights

### **Color Space Mapping**
| Profile | Foreground ANSI Code | Background ANSI Code | Color Range |
|---------|----------------------|-----------------------|-------------|
| TrueColor | `\x1b[38;2;R;G;Bm` | `\x1b[48;2;R;G;Bm` | 0-255 per channel |
| ANSI256 | `\x1b[38;5;<index>m` | `\x1b[48;5;<index>m` | 0-255 (palette index) |
| ANSI | `\x1b[3<code>m` | `\x1b[4<code>m` | 0-15 (4-bit) |

**ANSI 16-Color Palette**:
| Code | Color | RGB |
|------|-------|-----|
| 0 | Black | `#000000` |
| 1 | Red | `#800000` |
| 2 | Green | `#008000` |
| 3 | Yellow | `#808000` |
| 4 | Blue | `#000080` |
| 5 | Magenta | `#800080` |
| 6 | Cyan | `#008080` |
| 7 | White | `#c0c0c0` |
| 8 | Bright Black | `#808080` |
| 9 | Bright Red | `#ff0000` |
| 10 | Bright Green | `#00ff00` |
| 11 | Bright Yellow | `#ffff00` |
| 12 | Bright Blue | `#0000ff` |
| 13 | Bright Magenta | `#ff00ff` |
| 14 | Bright Cyan | `#00ffff` |
| 15 | Bright White | `#ffffff` |

### **Performance**
- **Detection**: Fast (environment variable checks + terminal queries).
- **Conversion**: O(1) for ANSI/NoTTY; O(256) for ANSI256 (precomputed palette lookups in practice).
- **Writer Overhead**: Minimal (buffered I/O with on-the-fly ANSI rewriting).

### **Limitations**
- **No TrueColor Detection in All Terminals**: Some terminals (e.g., Windows Terminal) may not advertise true color support correctly.
- **No Gamma Correction**: Color distance calculations assume linear RGB (no gamma correction for perceptual uniformity).
- **ANSI Code Parsing**: Only handles standard ANSI color codes (may not support all edge cases).

---

## Integration Patterns

### **1. Basic Detection + Manual Conversion**
```go
package main

import (
    "fmt"
    "image/color"
    "os"
    "github.com/charmbracelet/colorprofile"
)

func main() {
    p := colorprofile.Detect(os.Stdout, os.Environ())
    
    // Define a color
    c := color.RGBA{255, 100, 0, 255} // Orange
    
    // Convert based on terminal
    converted := p.Convert(c)
    
    // Use converted color (e.g., with a TUI library)
    fmt.Printf("Using color: %v\n", converted)
}
```

### **2. Automatic Writer for ANSI Output**
```go
package main

import (
    "fmt"
    "os"
    "github.com/charmbracelet/colorprofile"
)

func main() {
    // Create a writer that auto-downsamples ANSI
    w := colorprofile.NewWriter(os.Stdout, os.Environ())
    
    // Write ANSI-colored text
    fmt.Fprintf(w, "\x1b[38;2;255;100;0mOrange Text\x1b[m\n")
    
    // Force 256-color mode
    w.Profile = colorprofile.ANSI256
    fmt.Fprintf(w, "\x1b[38;2;255;100;0mOrange Text (256-color)\x1b[m\n")
}
```

### **3. Library Integration (e.g., with Lip Gloss)**
```go
package main

import (
    "fmt"
    "os"
    "github.com/charmbracelet/colorprofile"
    "github.com/charmbracelet/lipgloss"
)

func main() {
    p := colorprofile.Detect(os.Stdout, os.Environ())
    
    // Create a style
    style := lipgloss.NewStyle().Foreground(lipgloss.Color("#6b50ff"))
    
    // Convert the color if needed
    if p != colorprofile.TrueColor {
        // Lip Gloss handles this internally, but you can override
        style = style.Foreground(lipgloss.Color(p.Convert(color.RGBA{0x6b, 0x50, 0xff, 0xff}).(color.RGBA)))
    }
    
    fmt.Println(style.Render("Purple Text"))
}
```

---

## Use Cases
1. **Terminal-Aware Color Themes**: Automatically adjust color schemes based on terminal capabilities.
2. **Cross-Terminal Compatibility**: Ensure colors render correctly in terminals with varying support (e.g., iTerm2, Kitty, Windows Terminal, xterm).
3. **Piped Output Handling**: Strip ANSI codes when output is piped (e.g., `app | grep`).
4. **CI/CD Environments**: Detect and adapt to non-TTY environments (e.g., GitHub Actions, Travis CI).
5. **Accessibility**: Degrade to monochrome for terminals with no color support.

---

## Comparison to Alternatives
| Feature | Colorprofile | [tcell](https://github.com/gdamore/tcell) | [termenv](https://github.com/muesli/termenv) |
|---------|--------------|-------------------------------------------|--------------------------------------------|
| **Color Detection** | ✅ Yes | ✅ Yes | ✅ Yes |
| **ANSI Downsampling** | ✅ Yes | ❌ No | ✅ Yes |
| **TrueColor Support** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Writer Wrapper** | ✅ Yes | ❌ No | ✅ Yes |
| **Go Standard Library** | ✅ Yes | ❌ No | ✅ Yes |
| **No Dependencies** | ✅ Yes | ❌ No (cgo) | ✅ Yes |
| **Automatic ANSI Rewriting** | ✅ Yes | ❌ No | ✅ Yes |

**Key Differentiators**:
- **Simplicity**: Colorprofile is focused solely on color detection and downsampling.
- **Writer Wrapper**: Unique feature for automatic ANSI code rewriting.
- **No Cgo**: Pure Go (unlike `tcell`, which requires C dependencies).

---

## Key Files
| Path | Purpose |
|------|---------|
| `/profile.go` | Profile type definitions and detection logic. |
| `/convert.go` | Color conversion algorithms (RGB → ANSI256/ANSI). |
| `/writer.go` | ANSI-downsampling writer implementation. |

---

## Summary
Colorprofile is a **lightweight, dependency-free** Go library for:
1. **Detecting** terminal color capabilities (`TrueColor`, `ANSI256`, `ANSI`, `Ascii`, `NoTTY`).
2. **Converting** colors between color spaces (e.g., RGB → 256-color).
3. **Automatically downsampling** ANSI escape sequences in output via a wrapped `io.Writer`.

**Best For**: Go applications that need to render colors correctly across diverse terminal environments.
**Avoid If**: You need low-level terminal control (use `tcell` or `termbox` instead).
