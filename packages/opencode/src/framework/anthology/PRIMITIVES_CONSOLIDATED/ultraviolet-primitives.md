# Ultraviolet Primitives Analysis

## Overview
**Ultraviolet (UV)** is a **set of low-level primitives** for building **terminal user interfaces (TUIs)** in Go. It provides:
- **Cell-based rendering** with a **diffing algorithm** (only redraws changed cells).
- **Cross-platform input handling** (keyboard, mouse, resize, etc.).
- **Constraint-based layout** (inspired by CSS Flexbox and the Cassowary algorithm).
- **Alternate screen buffer** support for full-screen TUIs.
- **Optimized rendering** for SSH and low-bandwidth environments.

UV **powers Bubble Tea v2 and Lip Gloss v2**, replacing the ad-hoc terminal primitives from earlier versions with a **cohesive, imperative API** that can also be used **standalone**.

**Purpose**: Low-level TUI primitives (rendering, input, layout).
**Language**: Go.
**Maturity**: Production (active development).
**Dependencies**: None (pure Go, but uses platform-specific syscalls).

---

## Core Primitives

### 1. **Terminal**
**Purpose**: Manage the **application lifecycle** (raw mode, input events, start/stop).

**Primitives**:
- **`DefaultTerminal()`**: Create a terminal with default settings.
- **`NewTerminal(console, opts...)`**: Create a terminal with custom options.
- **`Start()`**: Start the terminal (enter raw mode, begin event loop).
- **`Stop()`**: Stop the terminal (exit raw mode, restore state).
- **`Screen()`**: Get the terminal’s screen.
- **`Events()`**: Get the channel of input events.
- **`Suspend()`**: Suspend the terminal (e.g., for shelling out to an editor).

**Example**:
```go
package main

import (
    "log"
    uv "github.com/charmbracelet/ultraviolet"
)

func main() {
    // Create a terminal
    t := uv.DefaultTerminal()
    
    // Start the terminal
    if err := t.Start(); err != nil {
        log.Fatal(err)
    }
    defer t.Stop()
    
    // Process events
    for ev := range t.Events() {
        switch ev := ev.(type) {
        case uv.KeyPressEvent:
            if ev.MatchString("q", "ctrl+c") {
                return
            }
        }
    }
}
```

**Key Features**:
- **Raw Mode**: Disables line buffering, echo, and signal handling.
- **Event Loop**: Provides a channel of `Event` types (keyboard, mouse, resize, etc.).
- **Suspend/Resume**: Supports temporarily suspending the terminal (e.g., for shelling out to `vim`).

---

### 2. **TerminalScreen**
**Purpose**: Manage the **screen state** (rendering, alternate screen, cursor, mouse modes, etc.).

**Primitives**:
- **`EnterAltScreen()`**: Switch to the **alternate screen buffer** (for full-screen TUIs).
- **`ExitAltScreen()`**: Switch back to the **main screen buffer**.
- **`Resize(width, height)`**: Resize the screen.
- **`Bounds()`**: Get the screen’s bounds (width, height).
- **`CellAt(x, y)`**: Get the cell at position `(x, y)`.
- **`SetCell(x, y, cell)`**: Set the cell at position `(x, y)`.
- **`Render()`**: Render the screen to the terminal.
- **`Flush()`**: Flush the output to the terminal.
- **`Clear()`**: Clear the screen.

**Example**:
```go
scr := t.Screen()

// Enter alternate screen
scr.EnterAltScreen()

// Get screen bounds
bounds := scr.Bounds()
fmt.Printf("Screen size: %dx%d\n", bounds.Dx(), bounds.Dy())

// Set a cell
scr.SetCell(0, 0, uv.Cell{Rune: 'A'})

// Render and flush
scr.Render()
scr.Flush()
```

**Alternate Screen**:
- **Full-Screen TUIs**: Use `EnterAltScreen()` to take over the entire terminal.
- **Inline TUIs**: Skip `EnterAltScreen()` to run inline (preserves scrollback).
- **Restoration**: Always call `ExitAltScreen()` when done (or use `defer`).

---

### 3. **Screen Interface**
**Purpose**: A **minimal interface** for working with screens (decouples code from the terminal).

**Primitives**:
- **`Bounds() Rectangle`**: Get the screen’s bounds.
- **`CellAt(x, y) Cell`**: Get the cell at `(x, y)`.
- **`SetCell(x, y, Cell)`**: Set the cell at `(x, y)`.
- **`WidthMethod() WidthMethod`**: Get the method used to calculate cell widths.

**Implementations**:
- **`TerminalScreen`**: The main screen (connected to the terminal).
- **`Buffer`**: An off-screen cell buffer (flat grid of cells).
- **`Window`**: An off-screen buffer with parent/child relationships.
- **`ScreenBuffer`**: A shared buffer for multiple screens.

**Example**:
```go
// Write code against Screen interface (decoupled from terminal)
var scr uv.Screen = t.Screen()

// Draw on any Screen
draw(scr, "Hello")

// Works with TerminalScreen, Buffer, Window, etc.
```

---

### 4. **Cell**
**Purpose**: Represent a single **terminal cell** (character + style).

**Primitives**:
- **`Cell` struct**: The fundamental unit of the terminal screen.
  ```go
  type Cell struct {
      Rune rune      // The character in the cell
      Style Style    // The style (foreground, background, etc.)
  }
  ```

**Key Fields**:
| Field | Description | Example |
|-------|-------------|---------|
| `Rune` | The Unicode character in the cell | `'A'`, `'世'`, `'😀'` |
| `Style` | The ANSI style (foreground, background, bold, etc.) | `Style{FG: ColorRed, Bold: true}` |

**Example**:
```go
// Create a cell with a red 'A'
cell := uv.Cell{
    Rune: 'A',
    Style: uv.Style{FG: uv.ColorRed},
}

// Set the cell on the screen
scr.SetCell(0, 0, cell)
```

---

### 5. **Style**
**Purpose**: Define the **visual appearance** of cells (colors, text attributes).

**Primitives**:
- **`Style` struct**: ANSI SGR attributes for a cell.
  ```go
  type Style struct {
      FG color.Color  // Foreground color
      BG color.Color  // Background color
      Bold bool       // Bold text
      Dim bool        // Dim/faint text
      Italic bool     // Italic text
      Underline bool  // Underlined text
      Blink bool      // Blinking text
      Reverse bool    // Swap FG/BG
      // ...
  }
  ```

**Color Types**:
- **`color.Color`**: Interface for colors (implemented by `color.RGBA`, `color.NRGBA`, etc.).
- **`uv.Color`**: A custom color type with predefined colors (e.g., `uv.ColorRed`).
- **ANSI Colors**: Supports 16-color, 256-color, and 24-bit RGB.

**Example**:
```go
// Create a style
style := uv.Style{
    FG: uv.ColorRed,
    BG: uv.ColorBlack,
    Bold: true,
}

// Apply to a cell
cell := uv.Cell{Rune: 'X', Style: style}
```

---

### 6. **screen package (Drawing Helpers)**
**Purpose**: High-level **drawing helpers** for working with any `Screen`.

**Primitives**:
- **`Context`**: A helper for **styled text rendering** (manages cursor position, styles).
- **`Clear(scr)`**: Clear the entire screen.
- **`Fill(scr, cell)`**: Fill the screen with a cell.
- **`Clone(scr)`**: Create a copy of the screen.

**Context Methods**:
| Method | Description |
|--------|-------------|
| `DrawString(text, x, y)` | Draw a string at `(x, y)` with the current style. |
| `Print(text)` | Draw a string at the current cursor position. |
| `SetStyle(style)` | Set the current style. |
| `SetCursor(x, y)` | Move the cursor to `(x, y)`. |
| `ResetStyle()` | Reset the style to default. |

**Example**:
```go
import "github.com/charmbracelet/ultraviolet/screen"

scr := t.Screen()
ctx := screen.NewContext(scr)

// Draw styled text
ctx.SetStyle(uv.Style{FG: uv.ColorRed, Bold: true})
ctx.DrawString("Hello, UV!", 0, 0)

// Reset style
ctx.ResetStyle()

// Render
scr.Render()
scr.Flush()
```

---

### 7. **layout package (Constraint-Based Layout)**
**Purpose**: A **constraint-based layout solver** (inspired by CSS Flexbox and the [Cassowary algorithm](https://en.wikipedia.org/wiki/Cassowary_(software))).

**Primitives**:
- **`Constraints`**: Min/max width and height for layout.
- **`Size`**: The calculated size of an element.
- **Layout Functions**: `Len`, `Min`, `Max`, `Percent`, `Ratio`, `Fill`.

**Example**:
```go
import "github.com/charmbracelet/ultraviolet/layout"

// Define constraints
constraints := layout.Constraints{
    MinWidth:  10,
    MaxWidth:  100,
    MinHeight: 5,
    MaxHeight: 50,
}

// Calculate size based on content
size := element.Layout(constraints)
```

**Layout Helpers**:
```go
// Fixed size
width := layout.Len(20)  // 20 cells

// Percentage
width := layout.Percent(50)  // 50% of available space

// Flexible
width := layout.Fill()  // Fill available space

// Minimum/Maximum
width := layout.Min(10)  // At least 10 cells
width := layout.Max(100) // At most 100 cells
```

---

### 8. **Buffer / Window**
**Purpose**: Off-screen **cell buffers** for composing UI elements.

**Primitives**:
- **`Buffer`**: A **flat grid** of cells (implements `Screen` and `Drawable`).
- **`Window`**: A **hierarchical buffer** with parent/child relationships (implements `Screen` and `Drawable`).

**Example**:
```go
// Create a buffer
buf := uv.NewBuffer(20, 10)

// Draw on the buffer
buf.SetCell(0, 0, uv.Cell{Rune: 'A'})

// Draw the buffer onto the screen
buf.Draw(scr)

// Create a window (with parent/child)
win := uv.NewWindow(20, 10, nil)
win.SetCell(0, 0, uv.Cell{Rune: 'B'})
win.Draw(scr)
```

**Use Cases**:
- **Off-Screen Rendering**: Compose UI elements in a buffer before drawing to the screen.
- **Hierarchical UIs**: Use `Window` for nested UI components (e.g., modals, popups).
- **Double Buffering**: Render to a buffer, then draw the buffer to the screen (reduces flicker).

---

### 9. **Input Events**
**Purpose**: Handle **keyboard**, **mouse**, and **resize** events.

**Event Types**:
| Event Type | Description | Example |
|------------|-------------|---------|
| `KeyPressEvent` | A key was pressed | `KeyPressEvent{Rune: 'a', Modifiers: uv.ModAlt}` |
| `KeyReleaseEvent` | A key was released | `KeyReleaseEvent{Rune: 'a'}` |
| `MousePressEvent` | A mouse button was pressed | `MousePressEvent{X: 10, Y: 20, Button: uv.MouseLeft}` |
| `MouseReleaseEvent` | A mouse button was released | `MouseReleaseEvent{X: 10, Y: 20, Button: uv.MouseLeft}` |
| `MouseMoveEvent` | The mouse was moved | `MouseMoveEvent{X: 10, Y: 20}` |
| `MouseScrollEvent` | The mouse was scrolled | `MouseScrollEvent{X: 0, Y: 1}` (scroll up) |
| `WindowSizeEvent` | The terminal was resized | `WindowSizeEvent{Width: 80, Height: 24}` |
| `PasteEvent` | Text was pasted (bracketed paste) | `PasteEvent{Text: "Hello"}` |
| `FocusEvent` | Terminal focus changed | `FocusEvent{Focused: true}` |

**KeyPressEvent Methods**:
- **`MatchString(keys...)`**: Check if the key matches any of the given strings.
  ```go
  if ev.MatchString("q", "ctrl+c") {
      // Quit
  }
  ```
- **`MatchRune(runes...)`**: Check if the key matches any of the given runes.
- **`Modifiers`**: Check modifier keys (`uv.ModAlt`, `uv.ModCtrl`, `uv.ModShift`).

**Example**:
```go
for ev := range t.Events() {
    switch ev := ev.(type) {
    case uv.KeyPressEvent:
        if ev.MatchString("q", "ctrl+c") {
            return
        }
        if ev.Rune == 'a' && ev.Modifiers == uv.ModAlt {
            fmt.Println("Alt+A pressed")
        }
    case uv.MousePressEvent:
        if ev.Button == uv.MouseLeft {
            fmt.Printf("Clicked at (%d, %d)\n", ev.X, ev.Y)
        }
    case uv.WindowSizeEvent:
        scr.Resize(ev.Width, ev.Height)
    }
}
```

---

### 10. **Diffing Renderer**
**Purpose**: **Optimize rendering** by only redrawing changed cells.

**Key Features**:
- **Cell Diffing**: Compares the current screen with the previous frame and only updates changed cells.
- **Optimized Cursor Movement**: Minimizes cursor movement for efficiency.
- **ECH/REP/ICH/DCH**: Uses **ANSI escape sequences** for efficient updates:
  - `ECH` (Erase Characters)
  - `REP` (Repeat Character)
  - `ICH` (Insert Characters)
  - `DCH` (Delete Characters)
- **Scroll Optimizations**: Optimizes scrolling for large updates.
- **Low Bandwidth**: Critical for **SSH** and slow connections.

**Example**:
```go
// The diffing renderer is automatic in TerminalScreen
scr := t.Screen()

// Just call Render() and Flush()
scr.Render()  // Diffs and renders only changed cells
scr.Flush()   // Flushes output to terminal
```

---

## Technical Insights

### **Architecture**
Ultraviolet is organized into **layered primitives**:
1. **Terminal**: Manages the **application lifecycle** (raw mode, input events, start/stop).
2. **TerminalScreen**: Manages the **screen state** (rendering, alternate screen, cursor, etc.).
3. **Screen**: A **minimal interface** for working with screens (decouples code from the terminal).
4. **Buffer/Window**: **Off-screen cell buffers** for composing UI elements.
5. **screen package**: **Drawing helpers** (Context, Clear, Fill, etc.).
6. **layout package**: **Constraint-based layout solver** (Cassowary algorithm).

### **Performance**
- **Diffing Renderer**: Only updates **changed cells**, minimizing terminal I/O.
- **Optimized ANSI Sequences**: Uses **ECH/REP/ICH/DCH** for efficient updates.
- **Low Latency**: Designed for **real-time TUIs** (no noticeable delay).
- **SSH-Friendly**: Minimizes **bandwidth usage** (critical for remote TUIs).

### **Cross-Platform Support**
| Platform | Input Handling | Raw Mode | Alternate Screen |
|----------|----------------|----------|------------------|
| **Linux** | termios + ANSI | ✅ Yes | ✅ Yes |
| **macOS** | termios + ANSI | ✅ Yes | ✅ Yes |
| **Windows** | Console API | ✅ Yes | ✅ Yes |
| **BSD** | termios + ANSI | ✅ Yes | ✅ Yes |

### **Input Protocols**
- **Kitty Keyboard Protocol**: Enhanced keyboard support (modifiers, special keys).
- **SGR Mouse**: Pixel-precise mouse tracking.
- **Bracketed Paste**: Safe paste handling (prevents paste from being interpreted as input).
- **Legacy Encodings**: Supports older terminal encodings.

### **Layout System**
- **Constraint-Based**: Inspired by **CSS Flexbox** and the **Cassowary algorithm**.
- **Flexible Sizing**: Supports `Len`, `Min`, `Max`, `Percent`, `Ratio`, `Fill`.
- **Nested Layouts**: Elements can be nested arbitrarily.

---

## Integration Patterns

### **1. Basic TUI with Ultraviolet**
```go
package main

import (
    "log"
    uv "github.com/charmbracelet/ultraviolet"
    "github.com/charmbracelet/ultraviolet/screen"
)

func main() {
    // Create terminal
    t := uv.DefaultTerminal()
    scr := t.Screen()
    
    // Enter alternate screen
    scr.EnterAltScreen()
    
    // Start terminal
    if err := t.Start(); err != nil {
        log.Fatal(err)
    }
    defer t.Stop()
    
    // Create drawing context
    ctx := screen.NewContext(scr)
    
    // Draw function
    display := func() {
        screen.Clear(scr)
        bounds := scr.Bounds()
        text := "Hello, Ultraviolet!"
        textWidth := scr.StringWidth(text)
        x := (bounds.Dx() - textWidth) / 2
        y := bounds.Dy() / 2
        ctx.DrawString(text, x, y)
        scr.Render()
        scr.Flush()
    }
    
    // Initial draw
    display()
    
    // Event loop
    for ev := range t.Events() {
        switch ev := ev.(type) {
        case uv.WindowSizeEvent:
            scr.Resize(ev.Width, ev.Height)
            display()
        case uv.KeyPressEvent:
            if ev.MatchString("q", "ctrl+c") {
                return
            }
        }
    }
}
```

### **2. Off-Screen Buffer**
```go
package main

import (
    uv "github.com/charmbracelet/ultraviolet"
)

func main() {
    t := uv.DefaultTerminal()
    scr := t.Screen()
    t.Start()
    defer t.Stop()
    
    // Create an off-screen buffer
    buf := uv.NewBuffer(20, 10)
    
    // Draw on the buffer
    buf.Fill(uv.Cell{Rune: ' '})  // Clear buffer
    buf.SetCell(0, 0, uv.Cell{Rune: 'A', Style: uv.Style{FG: uv.ColorRed}})
    
    // Draw buffer to screen
    buf.Draw(scr)
    scr.Render()
    scr.Flush()
    
    // Wait for quit
    for ev := range t.Events() {
        if ev, ok := ev.(uv.KeyPressEvent); ok && ev.MatchString("q") {
            return
        }
    }
}
```

### **3. Constraint-Based Layout**
```go
package main

import (
    "fmt"
    uv "github.com/charmbracelet/ultraviolet"
    "github.com/charmbracelet/ultraviolet/layout"
)

// A simple element that implements layout
func NewBox(width, height int) *Box {
    return &Box{width: width, height: height}
}

type Box struct {
    width, height int
}

func (b *Box) Layout(constraints layout.Constraints) layout.Size {
    // Respect constraints
    w := constraints.MaxWidth
    if b.width > 0 && b.width < w {
        w = b.width
    }
    h := constraints.MaxHeight
    if b.height > 0 && b.height < h {
        h = b.height
    }
    return layout.Size{Width: w, Height: h}
}

func (b *Box) Draw(scr uv.Screen, area layout.Rectangle) {
    // Draw the box
    for y := area.Min.Y; y < area.Min.Y + b.height; y++ {
        for x := area.Min.X; x < area.Min.X + b.width; x++ {
            scr.SetCell(x, y, uv.Cell{Rune: '*'})
        }
    }
}

func main() {
    // Use layout constraints
    constraints := layout.Constraints{
        MinWidth:  10,
        MaxWidth:  100,
        MinHeight: 5,
        MaxHeight: 50,
    }
    
    box := NewBox(20, 10)
    size := box.Layout(constraints)
    fmt.Printf("Box size: %dx%d\n", size.Width, size.Height)
}
```

### **4. Bubble Tea Integration**
Ultraviolet **powers Bubble Tea v2**. Here’s how they work together:
```go
package main

import (
    tea "charm.land/bubbletea/v2"
    "github.com/charmbracelet/ultraviolet"
)

type model struct {
    count int
}

func (m model) Init() tea.Cmd {
    return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        if msg.String() == "q" {
            return m, tea.Quit
        }
        if msg.String() == "space" {
            m.count++
        }
    }
    return m, nil
}

func (m model) View() string {
    return fmt.Sprintf("Count: %d\nPress space to increment, q to quit.", m.count)
}

func main() {
    // Bubble Tea automatically uses Ultraviolet for rendering
    p := tea.NewProgram(model{})
    p.Start()
}
```

### **5. Mouse Interaction**
```go
package main

import (
    uv "github.com/charmbracelet/ultraviolet"
    "github.com/charmbracelet/ultraviolet/screen"
)

func main() {
    t := uv.DefaultTerminal()
    scr := t.Screen()
    t.Start()
    defer t.Stop()
    
    scr.EnterAltScreen()
    ctx := screen.NewContext(scr)
    
    // Track mouse position
    var mouseX, mouseY int
    
    display := func() {
        screen.Clear(scr)
        ctx.DrawString("Mouse position:", 0, 0)
        ctx.DrawString(fmt.Sprintf("(%d, %d)", mouseX, mouseY), 0, 1)
        scr.Render()
        scr.Flush()
    }
    
    display()
    
    for ev := range t.Events() {
        switch ev := ev.(type) {
        case uv.MouseMoveEvent:
            mouseX, mouseY = ev.X, ev.Y
            display()
        case uv.KeyPressEvent:
            if ev.MatchString("q") {
                return
            }
        }
    }
}
```

---

## Use Cases
1. **TUI Frameworks**: Build a TUI framework (like **Bubble Tea v2**) on top of Ultraviolet.
2. **Custom TUIs**: Build **standalone TUIs** without a framework.
3. **Terminal Emulators**: Implement a **terminal emulator** with Ultraviolet’s rendering engine.
4. **Games**: Build **terminal-based games** (e.g., roguelikes, puzzles).
5. **CLI Tools**: Add **interactive features** to CLI tools (e.g., progress bars, forms).
6. **Debugging Tools**: Build **terminal debuggers** or **inspection tools**.
7. **Prototyping**: Quickly prototype **TUI ideas** with low-level control.

---

## Comparison to Alternatives
| Feature | Ultraviolet | [github.com/gdamore/tcell](https://github.com/gdamore/tcell) | [github.com/nsf/termbox-go](https://github.com/nsf/termbox-go) | [ncurses](https://invisible-island.net/ncurses/) (C) |
|---------|-------------|-----------------------------------------------------------|-------------------------------------------------------------------|---------------------------------------------------------------|
| **Cell-Based Rendering** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Diffing Renderer** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Constraint-Based Layout** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Cross-Platform Input** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Alternate Screen** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Mouse Support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Pure Go** | ✅ Yes | ❌ No (Cgo) | ❌ No (Cgo) | ❌ No (C) |
| **Kitty Protocol** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Bubble Tea Integration** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **No terminfo/termcap** | ✅ Yes | ❌ No | ✅ Yes | ❌ No |

**Key Differentiators**:
- **Diffing Renderer**: Only updates **changed cells** (optimized for SSH).
- **Constraint-Based Layout**: Built-in **Cassowary algorithm** for flexible layouts.
- **No terminfo/termcap**: Works **without** terminal databases (uses ANSI sequences).
- **Pure Go**: No C dependencies (unlike `tcell` or `ncurses`).
- **Bubble Tea Integration**: Powers **Bubble Tea v2** and **Lip Gloss v2**.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/terminal.go` | Core `Terminal` type and lifecycle management. |
| `/screen.go` | `TerminalScreen` type and screen state management. |
| `/cell.go` | `Cell` struct (character + style). |
| `/style.go` | `Style` struct (ANSI attributes). |
| `/screen/` | Drawing helpers (`Context`, `Clear`, `Fill`, etc.). |
| `/layout/` | Constraint-based layout solver. |
| `/buffer.go` | `Buffer` type (off-screen cell grid). |
| `/window.go` | `Window` type (hierarchical buffer). |
| `/input.go` | Input event types and parsing. |

---

## Summary
**Ultraviolet** is a **low-level TUI primitive library** for Go, providing:

1. **Terminal Management**: Raw mode, input events, start/stop lifecycle.
2. **Screen Management**: Alternate screen, rendering, cursor control.
3. **Cell-Based Rendering**: Represent the terminal as a grid of cells (character + style).
4. **Diffing Renderer**: Only redraws **changed cells** (optimized for SSH).
5. **Constraint-Based Layout**: Flexible layout system (Cassowary algorithm).
6. **Cross-Platform Input**: Keyboard, mouse, resize, paste, focus events.
7. **Off-Screen Buffers**: `Buffer` and `Window` for composing UI elements.
8. **Drawing Helpers**: `Context`, `Clear`, `Fill`, etc. for easy rendering.
9. **Bubble Tea Integration**: Powers **Bubble Tea v2** and **Lip Gloss v2**.
10. **Pure Go**: No dependencies, works on all platforms.

**Best For**: Building **TUI frameworks**, **custom TUIs**, or **terminal emulators** that need **low-level control** and **high performance**.
**Avoid If**: You need a **high-level TUI framework** (use **Bubble Tea** or **tview** instead).
