# ANSI Primitives Analysis (x/ansi)

## Overview
**`x/ansi`** is a **comprehensive ANSI escape sequence library** for Go, providing **parsing, generation, and manipulation** of ANSI codes. It powers **Sequin** (ANSI inspector), **Glamour** (markdown renderer), and other Charmbracelet tools. The library is **ECMA-48 compliant** and supports **7-bit C1 control codes**, **SGR (Select Graphic Rendition)**, **colors**, **cursors**, **mouse events**, and more.

**Purpose**: ANSI escape sequence parsing, generation, and terminal control.
**Language**: Go.
**Maturity**: Production (experimental in `x`, but stable).
**Dependencies**: None (pure Go).

---

## Core Primitives

### 1. **SGR (Select Graphic Rendition) Styles**
**Purpose**: Define text formatting (bold, italic, colors, etc.) via ANSI SGR codes.

**Primitives**:
- **`Attr`**: An integer representing an SGR attribute (e.g., `1` for bold, `31` for red).
- **`Style`**: A slice of `Attr` values that can be combined and rendered as an ANSI sequence.

**Key Methods**:
| Method | Description | Example |
|--------|-------------|---------|
| `NewStyle(attrs...)` | Create a style with attributes | `NewStyle(Bold, FGRed)` |
| `String()` | Render the style as an ANSI sequence | `"\x1b[1;31m"` |
| `Styled(str)` | Apply style to a string (with reset) | `"\x1b[1;31mHello\x1b[m"` |
| `Reset()` | Add reset attribute | `style.Reset()` |

**SGR Attributes**:
| Attribute | Constant | Description |
|-----------|----------|-------------|
| `attrReset` | `0` | Reset all styles |
| `attrBold` | `1` | Bold text |
| `attrFaint` | `2` | Faint/dim text |
| `attrItalic` | `3` | Italic text |
| `attrUnderline` | `4` | Underlined text |
| `attrBlink` | `5` | Slow blinking text |
| `attrRapidBlink` | `6` | Rapid blinking text |
| `attrReverse` | `7` | Swap foreground/background |
| `attrConceal` | `8` | Hidden text |
| `attrStrikethrough` | `9` | Strikethrough text |

**Example**:
```go
import "github.com/charmbracelet/x/ansi"

// Create a bold red style
style := ansi.NewStyle(ansi.Bold, ansi.FGRed)

// Apply to text
fmt.Println(style.Styled("Error!"))  // "\x1b[1;31mError!\x1b[m"

// Or get the raw ANSI sequence
fmt.Println(style.String() + "Alert!" + ansi.ResetStyle)  // "\x1b[1;31mAlert!\x1b[m"
```

---

### 2. **Color Handling**
**Purpose**: Define and manipulate ANSI colors (24-bit, 256-color, 16-color).

**Primitives**:
- **Foreground Colors**:
  - `FGBlack`, `FGRed`, `FGGreen`, `FGYellow`, `FGBlue`, `FGMagenta`, `FGCyan`, `FGWhite`
  - `FGBrightBlack`, `FGBrightRed`, ..., `FGBrightWhite`
  - `FGColor(color.Color)`: 24-bit RGB color
  - `FGIndex(uint8)`: 256-color palette index
- **Background Colors**:
  - `BGBlack`, `BGRed`, ..., `BGWhite`
  - `BGBrightBlack`, ..., `BGBrightWhite`
  - `BGColor(color.Color)`: 24-bit RGB background
  - `BGIndex(uint8)`: 256-color palette index

**Example**:
```go
// 16-color foreground
style := ansi.NewStyle(ansi.FGRed)

// 256-color foreground
style := ansi.NewStyle(ansi.FGIndex(196))  // Orange

// 24-bit RGB foreground
style := ansi.NewStyle(ansi.FGColor(color.RGBA{255, 100, 0, 255}))

// Combined with other styles
style := ansi.NewStyle(ansi.Bold, ansi.FGColor(color.RGBA{0, 255, 0, 255}), ansi.BGBlack)
```

**Color Models**:
| Model | Description | ANSI Codes |
|-------|-------------|------------|
| **16-color** | Standard ANSI colors | `30`-`37` (FG), `40`-`47` (BG) |
| **256-color** | Extended palette | `38;5;<index>` (FG), `48;5;<index>` (BG) |
| **24-bit (TrueColor)** | Full RGB | `38;2;<r>;<g>;<b>` (FG), `48;2;<r>;<g>;<b>` (BG) |

---

### 3. **ANSI Parser**
**Purpose**: Parse ANSI escape sequences from strings (e.g., for debugging or transformation).

**Primitives**:
- **`Parser`**: A stateful parser for ANSI sequences.
- **`Parse()`**: Parse a string and execute handlers for each ANSI sequence.
- **`Handler`**: Callback functions for different ANSI sequence types (SGR, cursor, etc.).

**Supported Sequence Types**:
| Type | Description | Example |
|------|-------------|---------|
| **SGR** | Select Graphic Rendition | `\x1b[1;31m` |
| **CSI** | Control Sequence Introducer | `\x1b[<row>;<col>H` |
| **OSC** | Operating System Command | `\x1b]0;Title\x07` |
| **DCS** | Device Control String | `\x1bP...\x1b\` |
| **Fe** | Final Byte (single-byte) | `\x1bM` |
| **APC** | Application Program Command | `\x1b_...\x1b\` |

**Example**:
```go
import "github.com/charmbracelet/x/ansi"

input := "\x1b[1;31mError!\x1b[m\n"

// Create a parser
parser := ansi.NewParser()

// Parse the input
parser.Parse(input, func(seq ansi.Sequence) {
    switch seq.Type() {
    case ansi.SGR:
        fmt.Printf("SGR: %v\n", seq.Attributes())
    case ansi.Reset:
        fmt.Println("Reset")
    }
})
```

**Parser Handlers**:
```go
parser.OnSGR(func(attrs []ansi.Attr) {
    fmt.Printf("SGR attributes: %v\n", attrs)
})

parser.OnOSC(func(cmd int, data []byte) {
    fmt.Printf("OSC command %d: %s\n", cmd, data)
})

parser.OnCSI(func(cmd ansi.CSI) {
    fmt.Printf("CSI: %v\n", cmd)
})
```

---

### 4. **Cursor Control**
**Purpose**: Move and control the terminal cursor.

**Primitives**:
| Function | Description | ANSI Sequence |
|----------|-------------|---------------|
| `ansi.CursorUp(n)` | Move cursor up `n` lines | `\x1b[<n>A` |
| `ansi.CursorDown(n)` | Move cursor down `n` lines | `\x1b[<n>B` |
| `ansi.CursorForward(n)` | Move cursor forward `n` columns | `\x1b[<n>C` |
| `ansi.CursorBack(n)` | Move cursor back `n` columns | `\x1b[<n>D` |
| `ansi.CursorNextLine(n)` | Move to next line, column 1 | `\x1b[<n>E` |
| `ansi.CursorPrevLine(n)` | Move to previous line, column 1 | `\x1b[<n>F` |
| `ansi.CursorColumn(n)` | Move to column `n` | `\x1b[<n>G` |
| `ansi.CursorPosition(row, col)` | Move to row `row`, column `col` | `\x1b[<row>;<col>H` |
| `ansi.CursorSave` | Save cursor position | `\x1b7` |
| `ansi.CursorRestore` | Restore cursor position | `\x1b8` |
| `ansi.CursorHide` | Hide cursor | `\x1b[?25l` |
| `ansi.CursorShow` | Show cursor | `\x1b[?25h` |

**Example**:
```go
// Move cursor to (5, 10)
fmt.Print(ansi.CursorPosition(5, 10))

// Save and restore cursor
fmt.Print(ansi.CursorSave)
fmt.Print("Temporary text")
fmt.Print(ansi.CursorRestore)
```

---

### 5. **Screen Control**
**Purpose**: Clear the screen or scroll the terminal.

**Primitives**:
| Function | Description | ANSI Sequence |
|----------|-------------|---------------|
| `ansi.ClearScreen` | Clear entire screen | `\x1b[2J` |
| `ansi.ClearLine` | Clear current line | `\x1b[2K` |
| `ansi.ClearToEndOfScreen` | Clear from cursor to end of screen | `\x1b[J` |
| `ansi.ClearToStartOfScreen` | Clear from cursor to start of screen | `\x1b[1J` |
| `ansi.ClearToEndOfLine` | Clear from cursor to end of line | `\x1b[K` |
| `ansi.ClearToStartOfLine` | Clear from cursor to start of line | `\x1b[1K` |
| `ansi.ScrollUp(n)` | Scroll screen up `n` lines | `\x1b[<n>S` |
| `ansi.ScrollDown(n)` | Scroll screen down `n` lines | `\x1b[<n>T` |

**Example**:
```go
// Clear the screen and move cursor to top-left
fmt.Print(ansi.ClearScreen + ansi.CursorPosition(1, 1))
```

---

### 6. **Mouse Support**
**Purpose**: Handle mouse events in the terminal.

**Primitives**:
- **`ansi.EnableMouse`**: Enable mouse tracking (X10, VT200, or SGR mode).
- **`ansi.DisableMouse`**: Disable mouse tracking.
- **Mouse Event Parsing**: Parse mouse events from input.

**Mouse Modes**:
| Mode | Description | ANSI Sequence |
|------|-------------|---------------|
| **X10** | Basic mouse tracking (press/release) | `\x1b[?9h` |
| **VT200** | Extended mouse tracking (drag) | `\x1b[?1000h` |
| **SGR** | Pixel-precise mouse tracking | `\x1b[?1006h` |

**Example**:
```go
// Enable SGR mouse mode
fmt.Print(ansi.EnableMouse(ansi.MouseModeSGR))

// Parse mouse events (from terminal input)
parser := ansi.NewParser()
parser.OnMouse(func(ev ansi.MouseEvent) {
    fmt.Printf("Mouse event: %+v\n", ev)
})
```

**Mouse Event Types**:
- `MouseLeftClick`, `MouseRightClick`, `MouseMiddleClick`
- `MouseScrollUp`, `MouseScrollDown`
- `MouseDrag` (with button mask)
- `MouseRelease`

---

### 7. **Terminal Modes**
**Purpose**: Enable/disable terminal modes (e.g., alternate screen, bracketed paste).

**Primitives**:
| Function | Description | ANSI Sequence |
|----------|-------------|---------------|
| `ansi.EnterAlternateScreen` | Switch to alternate screen buffer | `\x1b[?1049h` |
| `ansi.ExitAlternateScreen` | Switch back to main screen buffer | `\x1b[?1049l` |
| `ansi.EnableBracketedPaste` | Enable bracketed paste mode | `\x1b[?2004h` |
| `ansi.DisableBracketedPaste` | Disable bracketed paste mode | `\x1b[?2004l` |
| `ansi.EnableFocus` | Enable focus in/out events | `\x1b[?1004h` |
| `ansi.DisableFocus` | Disable focus in/out events | `\x1b[?1004l` |

**Example**:
```go
// Enter alternate screen (for full-screen TUIs)
fmt.Print(ansi.EnterAlternateScreen)

// Exit alternate screen when done
fmt.Print(ansi.ExitAlternateScreen)
```

---

### 8. **Window and Tab Control**
**Purpose**: Control terminal window titles, tabs, and other properties.

**Primitives**:
| Function | Description | ANSI Sequence |
|----------|-------------|---------------|
| `ansi.SetTitle(title)` | Set terminal window title | `\x1b]0;<title>\x07` |
| `ansi.SetIconName(name)` | Set terminal icon name | `\x1b]1;<name>\x07` |
| `ansi.SetWindowSize(rows, cols)` | Set terminal window size (if supported) | `\x1b[8;<rows>;<cols>t` |
| `ansi.SetCursorStyle(style)` | Set cursor style (blinking, shape) | `\x1b[<style> q` |

**Example**:
```go
// Set window title
fmt.Print(ansi.SetTitle("My TUI App"))

// Set cursor style (blinking block)
fmt.Print(ansi.SetCursorStyle(ansi.CursorBlinkingBlock))
```

---

### 9. **Text Wrapping and Truncation**
**Purpose**: Handle text overflow in terminal cells.

**Primitives**:
- **`ansi.Wrap(text, width)`**: Wrap text to a given width (accounting for wide characters).
- **`ansi.Truncate(text, width)`**: Truncate text to a given width (with ellipsis if needed).
- **`ansi.Width(text)`**: Get the display width of text (accounting for wide characters).

**Example**:
```go
// Wrap text to 80 columns
wrapped := ansi.Wrap("Very long text...", 80)

// Truncate text to 20 columns
truncated := ansi.Truncate("Very long text...", 20)

// Get display width
width := ansi.Width("Hello 世界")  // 8 (H,e,l,l,o, ,世,界)
```

---

### 10. **Hyperlinks**
**Purpose**: Create clickable hyperlinks in the terminal (supported by some terminals).

**Primitives**:
- **`ansi.Hyperlink(url, text)`**: Create a hyperlink (OSC 8 sequence).
- **`ansi.HyperlinkID(id, text)`**: Create a hyperlink with a custom ID.

**Example**:
```go
// Create a hyperlink
fmt.Println(ansi.Hyperlink("https://example.com", "Click me!"))
```

**Supported Terminals**:
- Kitty
- iTerm2
- Windows Terminal
- WezTerm

---

### 11. **Progress Bars**
**Purpose**: Display progress bars in the terminal.

**Primitives**:
- **`ansi.ProgressBar(width, percent, style)`**: Render a progress bar.

**Example**:
```go
// Render a progress bar at 50% completion
bar := ansi.ProgressBar(20, 0.5, ansi.ProgressBarStyle{
    Filled:   ansi.NewStyle(ansi.FGGreen, ansi.BGGreen),
    Unfilled: ansi.NewStyle(ansi.FGWhite, ansi.BGWhite),
})
fmt.Println(bar)
```

---

### 12. **Underline Styles**
**Purpose**: Apply different underline styles (single, double, curly, dotted, dashed).

**Primitives**:
```go
// Underline styles
ansi.UnderlineSingle  // Standard underline
ansi.UnderlineDouble  // Double underline
ansi.UnderlineCurly   // Curly underline (not widely supported)
ansi.UnderlineDotted  // Dotted underline
ansi.UnderlineDashed  // Dashed underline

// Usage
style := ansi.NewStyle(ansi.UnderlineStyle(ansi.UnderlineDouble))
```

---

## Technical Insights

### **Parser Architecture**
The ANSI parser in `x/ansi` is **stateful** and **event-driven**:
1. **State Machine**: Tracks the current parsing state (e.g., in escape sequence, in CSI, etc.).
2. **Handlers**: Register callbacks for different sequence types (SGR, CSI, OSC, etc.).
3. **Efficiency**: Optimized for **high-throughput parsing** (e.g., for Sequin or terminal emulators).

### **Performance**
- **Zero Allocations**: The parser avoids allocations where possible.
- **Streaming**: Can parse ANSI sequences **incrementally** (useful for real-time input).
- **Low Latency**: Designed for **interactive TUIs** (no noticeable delay).

### **Cross-Terminal Compatibility**
- **ECMA-48 Compliant**: Follows the **ANSI X3.64** standard.
- **Widely Supported**: Works with most terminals (xterm, iTerm2, Kitty, Windows Terminal, etc.).
- **Fallbacks**: Gracefully degrades for terminals that don’t support certain features (e.g., hyperlinks).

### **Wide Character Support**
- **Unicode-Aware**: Correctly handles **wide characters** (e.g., CJK, emoji).
- **`wcwidth` Integration**: Uses the `x/wcwidth` package for accurate width calculations.

---

## Integration Patterns

### **1. Basic ANSI Styling**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/ansi"
)

func main() {
    // Bold red text
    style := ansi.NewStyle(ansi.Bold, ansi.FGRed)
    fmt.Println(style.Styled("Error: File not found"))
    
    // Green success message
    success := ansi.NewStyle(ansi.FGGreen).Styled("Success!")
    fmt.Println(success)
}
```

### **2. Parsing ANSI Input**
```go
package main

import (
    "fmt"
    "os"
    "github.com/charmbracelet/x/ansi"
)

func main() {
    parser := ansi.NewParser()
    parser.OnSGR(func(attrs []ansi.Attr) {
        fmt.Printf("SGR: %v\n", attrs)
    })
    
    // Parse stdin
    buf := make([]byte, 1024)
    for {
        n, err := os.Stdin.Read(buf)
        if err != nil {
            break
        }
        parser.Parse(buf[:n], nil)
    }
}
```

### **3. Terminal Cursor Control**
```go
package main

import (
    "fmt"
    "time"
    "github.com/charmbracelet/x/ansi"
)

func main() {
    // Save cursor
    fmt.Print(ansi.CursorSave)
    
    // Move to (5, 10) and print
    fmt.Print(ansi.CursorPosition(5, 10))
    fmt.Println("Hello, world!")
    
    // Wait and restore cursor
    time.Sleep(2 * time.Second)
    fmt.Print(ansi.CursorRestore)
}
```

### **4. Mouse Event Handling**
```go
package main

import (
    "bufio"
    "fmt"
    "os"
    "github.com/charmbracelet/x/ansi"
)

func main() {
    // Enable mouse tracking
    fmt.Print(ansi.EnableMouse(ansi.MouseModeSGR))
    defer fmt.Print(ansi.DisableMouse)
    
    // Parse mouse events
    parser := ansi.NewParser()
    parser.OnMouse(func(ev ansi.MouseEvent) {
        fmt.Printf("Mouse: %+v\n", ev)
    })
    
    // Read stdin and parse
    scanner := bufio.NewScanner(os.Stdin)
    for scanner.Scan() {
        parser.Parse(scanner.Bytes(), nil)
    }
}
```

### **5. Alternate Screen Buffer**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/ansi"
)

func main() {
    // Enter alternate screen
    fmt.Print(ansi.EnterAlternateScreen)
    defer fmt.Print(ansi.ExitAlternateScreen)
    
    // Clear screen and draw UI
    fmt.Print(ansi.ClearScreen)
    fmt.Println("Full-screen TUI")
}
```

---

## Use Cases
1. **Terminal UI Frameworks**: Build TUIs with styled text, cursor control, and mouse support.
2. **ANSI Debugging**: Inspect and debug ANSI sequences (like **Sequin**).
3. **Markdown Renderers**: Parse and render ANSI-styled markdown (like **Glamour**).
4. **Terminal Emulators**: Implement ANSI sequence handling in custom terminals.
5. **CLI Tools**: Add colors, progress bars, and interactive elements to CLIs.
6. **Testing**: Verify ANSI output in tests (e.g., golden file testing).

---

## Comparison to Alternatives
| Feature | `x/ansi` | [github.com/gdamore/tcell](https://github.com/gdamore/tcell) | [github.com/nsf/termbox-go](https://github.com/nsf/termbox-go) | [github.com/fatih/color](https://github.com/fatih/color) |
|---------|----------|-----------------------------------------------------------|-------------------------------------------------------------------|---------------------------------------------------------------|
| **ANSI Parsing** | ✅ Full | ❌ No | ❌ No | ❌ No |
| **ANSI Generation** | ✅ Full | ✅ Yes | ❌ No | ✅ Partial |
| **SGR Styles** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Partial |
| **24-bit Color** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Mouse Support** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Cursor Control** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Alternate Screen** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Hyperlinks** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Parser API** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Pure Go** | ✅ Yes | ❌ No (Cgo) | ❌ No (Cgo) | ✅ Yes |
| **Dependencies** | None | Cgo (ncurses) | Cgo (termbox) | None |

**Key Differentiators**:
- **Full ANSI Support**: Parsing and generation for **all ANSI sequence types** (SGR, CSI, OSC, etc.).
- **Pure Go**: No C dependencies (unlike `tcell` or `termbox-go`).
- **Event-Driven Parser**: Register handlers for specific ANSI sequences.
- **Modern Features**: Supports **hyperlinks**, **mouse events**, **bracketed paste**, etc.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/ansi.go` | Core ANSI constants and types. |
| `/style.go` | SGR style definitions and methods. |
| `/color.go` | Color handling (24-bit, 256-color, 16-color). |
| `/parser/` | ANSI sequence parser and handlers. |
| `/cursor.go` | Cursor control sequences. |
| `/mouse.go` | Mouse event parsing and generation. |
| `/mode.go` | Terminal mode control (alternate screen, etc.). |
| `/wrap.go` | Text wrapping and truncation. |
| `/sgr.go` | SGR-specific utilities. |

---

## Summary
**`x/ansi`** is a **comprehensive, pure-Go library** for **ANSI escape sequence handling**, providing:

1. **SGR Styles**: Bold, italic, colors, underline, etc.
2. **Color Support**: 16-color, 256-color, and 24-bit RGB.
3. **ANSI Parser**: Parse and handle all ANSI sequence types (SGR, CSI, OSC, etc.).
4. **Cursor Control**: Move, hide, show, and save/restore the cursor.
5. **Screen Control**: Clear screen, scroll, alternate buffer.
6. **Mouse Support**: Track mouse clicks, drags, and scrolls.
7. **Terminal Modes**: Alternate screen, bracketed paste, focus events.
8. **Hyperlinks**: Clickable links in supported terminals.
9. **Text Utilities**: Wrapping, truncation, width calculation.
10. **Wide Character Support**: Unicode-aware (CJK, emoji).

**Best For**: Building **TUI frameworks**, **ANSI parsers**, or **terminal tools** that need **full ANSI support**.
**Avoid If**: You need a **high-level TUI framework** (use **Bubble Tea** or **tview** instead).
