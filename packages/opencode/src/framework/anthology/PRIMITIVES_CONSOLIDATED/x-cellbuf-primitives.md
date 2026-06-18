# Cellbuf Primitives Analysis (x/cellbuf)

## Overview
**`x/cellbuf`** is a **cell-based terminal buffer library** for Go, providing a **low-level abstraction** for terminal rendering. It represents the terminal screen as a **grid of cells**, where each cell can contain:
- A **rune** (character).
- A **style** (ANSI SGR attributes).
- A **hyperlink** (clickable link).
- A **width** (for wide characters like CJK or emoji).
- **Combining runes** (for complex scripts or emoji sequences).

**Purpose**: Low-level terminal rendering and screen management.
**Language**: Go.
**Maturity**: Production (experimental in `x`, but stable).
**Dependencies**: `x/ansi` (for styles).

---

## Core Primitives

### 1. **Cell**
**Purpose**: Represent a single character cell in the terminal.

**Primitives**:
- **`Cell` struct**: The fundamental unit of the terminal screen.
  ```go
  type Cell struct {
      Style Style      // ANSI SGR style (foreground, background, bold, etc.)
      Link  Link        // Hyperlink (if any)
      Comb  []rune     // Combining runes (for complex graphemes)
      Width int        // Display width (1 for ASCII, 2 for CJK/emoji)
      Rune  rune       // Main rune (0 if part of a wider cell)
  }
  ```

**Key Fields**:
| Field | Description | Example |
|-------|-------------|---------|
| `Rune` | The primary character in the cell | `'A'`, `'世'`, `'😀'` |
| `Width` | Display width (1 for ASCII, 2 for wide chars) | `1` or `2` |
| `Style` | ANSI style (foreground, background, bold, etc.) | `Style{FG: Red, Bold: true}` |
| `Link` | Hyperlink (if the cell is clickable) | `Link{URL: "https://example.com"}` |
| `Comb` | Combining runes (e.g., accents, emoji modifiers) | `[]rune{'\u0301'}` (combining acute accent) |

**Predefined Cells**:
- **`BlankCell`**: A space with width 1 and no style (`Cell{Rune: ' ', Width: 1}`).
- **`EmptyCell`**: A zero-width placeholder (`Cell{}`).

**Example**:
```go
import "github.com/charmbracelet/x/cellbuf"

// Create a cell with a red 'A'
cell := cellbuf.Cell{
    Rune:  'A',
    Width: 1,
    Style: cellbuf.Style{FG: cellbuf.ColorRed},
}

// Create a cell with a wide character (CJK)
cell := cellbuf.Cell{
    Rune:  '世',
    Width: 2,
}

// Create a cell with a hyperlink
cell := cellbuf.Cell{
    Rune:  'L',
    Width: 1,
    Link:  cellbuf.Link{URL: "https://example.com"},
}
```

---

### 2. **Style**
**Purpose**: Represent ANSI SGR styles for cells.

**Primitives**:
- **`Style` struct**: Wrapper around `ansi.Style` for cell styling.
  ```go
  type Style struct {
      ansi.Style  // Embedded ANSI style
  }
  ```

**Key Features**:
- Inherits all functionality from `x/ansi` (bold, italic, colors, etc.).
- Adds **equality checking** (`Equal` method).
- Supports **cloning** (`Clone` method).

**Example**:
```go
// Create a bold red style
style := cellbuf.Style{
    ansi.Style: ansi.NewStyle(ansi.Bold, ansi.FGRed),
}

// Apply to a cell
cell := cellbuf.Cell{
    Rune:  'X',
    Width: 1,
    Style: style,
}
```

---

### 3. **Link**
**Purpose**: Represent hyperlinks for cells.

**Primitives**:
- **`Link` struct**: Stores hyperlink data.
  ```go
  type Link struct {
      URL   string  // The target URL
      ID    string  // Optional link ID (for OSC 8 sequences)
  }
  ```

**Key Features**:
- **OSC 8 Compatibility**: Works with terminals that support [OSC 8 hyperlinks](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda).
- **Equality Checking**: `Equal` method for comparing links.

**Example**:
```go
// Create a hyperlink
link := cellbuf.Link{
    URL: "https://example.com",
    ID:  "link1",
}

// Apply to a cell
cell := cellbuf.Cell{
    Rune:  'C',
    Width: 1,
    Link:  link,
}
```

---

### 4. **Buffer**
**Purpose**: Represent the terminal screen as a 2D grid of cells.

**Primitives**:
- **`Buffer` struct**: A 2D grid of cells with metadata.
  ```go
  type Buffer struct {
      Cells   [][]Cell  // 2D grid of cells (rows x columns)
      Width   int       // Buffer width (columns)
      Height  int       // Buffer height (rows)
      Dirty   bool      // Whether the buffer has unsaved changes
  }
  ```

**Key Methods**:
| Method | Description |
|--------|-------------|
| `NewBuffer(width, height)` | Create a new buffer. |
| `SetCell(row, col, cell)` | Set a cell at (row, col). |
| `GetCell(row, col)` | Get a cell at (row, col). |
| `Fill(cell)` | Fill the entire buffer with a cell. |
| `Clear()` | Clear the buffer (fill with `BlankCell`). |
| `Resize(width, height)` | Resize the buffer. |
| `Clone()` | Create a deep copy of the buffer. |

**Example**:
```go
// Create a 10x10 buffer
buf := cellbuf.NewBuffer(10, 10)

// Set a cell at (0, 0)
buf.SetCell(0, 0, cellbuf.Cell{Rune: 'A', Width: 1})

// Get a cell
cell := buf.GetCell(0, 0)
fmt.Println(cell.Rune) // 'A'
```

---

### 5. **Screen**
**Purpose**: High-level terminal screen management.

**Primitives**:
- **`Screen` struct**: Manages a terminal screen with **soft scrolling** and **hard scrolling**.
  ```go
  type Screen struct {
      Buffer       *Buffer    // The visible buffer
      SoftBuffer   *Buffer    // Off-screen buffer for soft scrolling
      Cursor       image.Point // Cursor position (row, col)
      Origin       image.Point // Scroll origin (for soft scrolling)
      Width        int        // Screen width
      Height       int        // Screen height
      HardScroll   bool       // Whether hard scrolling is enabled
  }
  ```

**Key Features**:
- **Soft Scrolling**: Scrolling that preserves content (like a terminal emulator).
- **Hard Scrolling**: Scrolling that discards scrolled content (faster, but loses history).
- **Cursor Management**: Track cursor position and visibility.
- **Resize Handling**: Adjust to terminal resize events.

**Example**:
```go
// Create a new screen
screen := cellbuf.NewScreen(20, 10)

// Set a cell
screen.SetCell(0, 0, cellbuf.Cell{Rune: 'X', Width: 1})

// Scroll up
screen.ScrollUp(1)

// Resize
screen.Resize(25, 15)
```

---

### 6. **Geometry**
**Purpose**: Handle terminal dimensions and coordinates.

**Primitives**:
- **`geom.Point`**: A 2D point (row, column).
- **`geom.Rectangle`**: A rectangular region (x, y, width, height).

**Example**:
```go
// Create a point
p := geom.Point{X: 5, Y: 10}

// Create a rectangle
r := geom.Rectangle{Width: 20, Height: 10}
```

---

### 7. **Tab Stops**
**Purpose**: Handle tab characters in the terminal.

**Primitives**:
- **`TabStop` struct**: Represents a tab stop position.
- **`ExpandTabs(text, tabStops)`**: Expand tab characters to spaces.

**Example**:
```go
// Define tab stops at columns 4, 8, 12
stops := []cellbuf.TabStop{4, 8, 12}

// Expand tabs in text
text := "a\tb\tc"
expanded := cellbuf.ExpandTabs(text, stops)
// Result: "a   b   c"
```

---

### 8. **Text Wrapping**
**Purpose**: Wrap text to fit within terminal columns.

**Primitives**:
- **`Wrap(text, width)`**: Wrap text to a given width (accounting for wide characters).
- **`Truncate(text, width)`**: Truncate text to a given width (with ellipsis if needed).

**Example**:
```go
// Wrap text to 20 columns
text := "This is a very long line of text."
wrapped := cellbuf.Wrap(text, 20)
// Result: ["This is a very long", "line of text."]
```

---

### 9. **Writer**
**Purpose**: Write cells to an `io.Writer` (e.g., terminal).

**Primitives**:
- **`Writer` struct**: Writes cells to a terminal, handling ANSI sequences and wide characters.
  ```go
  type Writer struct {
      Output io.Writer  // Where to write (e.g., os.Stdout)
      Buffer *Buffer    // The buffer to write
  }
  ```

**Key Methods**:
| Method | Description |
|--------|-------------|
| `Write(buffer)` | Write the entire buffer to the output. |
| `WriteCell(cell)` | Write a single cell. |
| `WriteRune(rune)` | Write a single rune (with style). |
| `Flush()` | Flush the output. |

**Example**:
```go
// Create a writer
w := cellbuf.NewWriter(os.Stdout)

// Create a buffer
buf := cellbuf.NewBuffer(10, 1)
buf.SetCell(0, 0, cellbuf.Cell{Rune: 'H', Width: 1, Style: cellbuf.Style{FG: ansi.ColorRed}})

// Write the buffer
w.Write(buf)
```

---

### 10. **Hard Scroll**
**Purpose**: Implement **hard scrolling** (discarding scrolled content).

**Primitives**:
- **`HardScroll` struct**: Manages hard scrolling for a buffer.
- **`ScrollUp(n)`**: Scroll up by `n` lines (discards top lines).
- **`ScrollDown(n)`**: Scroll down by `n` lines (discards bottom lines).

**Example**:
```go
// Create a hard scroll manager
scroll := cellbuf.NewHardScroll(buf)

// Scroll up by 1 line (discards the top line)
scroll.ScrollUp(1)
```

---

## Technical Insights

### **Cell Width Handling**
- **Wide Characters**: CJK characters (e.g., `世`, `中`) and emoji (e.g., `😀`) occupy **2 columns**.
- **Combining Characters**: Accents (e.g., `é` = `e` + `´`) are stored in the `Comb` field and **do not affect width**.
- **Zero-Width Characters**: Some characters (e.g., combining marks) have `Width = 0` and are **overlaid** on the previous cell.

**Example**:
```go
// '世' is a wide character (width = 2)
cell := cellbuf.Cell{Rune: '世', Width: 2}

// 'e' + combining acute (é) has width = 1
cell := cellbuf.Cell{Rune: 'e', Width: 1, Comb: []rune{'\u0301'}}
```

### **Performance**
- **Efficient Rendering**: Buffers are optimized for **minimal redraws** (only dirty cells are updated).
- **Memory Efficiency**: Uses **sparse representations** where possible.
- **Fast Resizing**: Resizing a buffer is **O(n)** (linear in the number of cells).

### **Soft vs. Hard Scrolling**
| Feature | Soft Scrolling | Hard Scrolling |
|---------|----------------|----------------|
| **Memory Usage** | High (stores scrolled content) | Low (discards scrolled content) |
| **Performance** | Slower (more memory operations) | Faster (discards content) |
| **Use Case** | Terminal emulators, full-screen TUIs | Simple TUIs, logging |
| **Implementation** | `SoftBuffer` + `Origin` | `HardScroll` (discards lines) |

### **Wide Character Support**
- Uses **`x/wcwidth`** for accurate width calculations.
- Correctly handles **combining characters** (e.g., `e` + `´` = `é`).
- Supports **emoji sequences** (e.g., `👨‍👩‍👧‍👦` = family of 4, width = 2).

---

## Integration Patterns

### **1. Basic Terminal Rendering**
```go
package main

import (
    "os"
    "github.com/charmbracelet/x/cellbuf"
    "github.com/charmbracelet/x/ansi"
)

func main() {
    // Create a buffer
    buf := cellbuf.NewBuffer(10, 5)
    
    // Fill with cells
    for i := 0; i < 5; i++ {
        for j := 0; j < 10; j++ {
            buf.SetCell(i, j, cellbuf.Cell{
                Rune:  rune('A' + j),
                Width: 1,
                Style: cellbuf.Style{FG: ansi.ColorWhite},
            })
        }
    }
    
    // Write to terminal
    w := cellbuf.NewWriter(os.Stdout)
    w.Write(buf)
}
```

### **2. Styled Text**
```go
package main

import (
    "os"
    "github.com/charmbracelet/x/cellbuf"
    "github.com/charmbracelet/x/ansi"
)

func main() {
    buf := cellbuf.NewBuffer(20, 1)
    
    // Set a styled cell
    buf.SetCell(0, 0, cellbuf.Cell{
        Rune:  'E',
        Width: 1,
        Style: cellbuf.Style{
            ansi.Style: ansi.NewStyle(ansi.Bold, ansi.FGRed),
        },
    })
    
    // Set a hyperlink
    buf.SetCell(0, 2, cellbuf.Cell{
        Rune:  'C',
        Width: 1,
        Link:  cellbuf.Link{URL: "https://example.com"},
    })
    
    // Write
    w := cellbuf.NewWriter(os.Stdout)
    w.Write(buf)
}
```

### **3. Wide Characters**
```go
package main

import (
    "os"
    "github.com/charmbracelet/x/cellbuf"
)

func main() {
    buf := cellbuf.NewBuffer(10, 1)
    
    // Set a wide character (CJK)
    buf.SetCell(0, 0, cellbuf.Cell{
        Rune:  '世',
        Width: 2,
    })
    
    // Set an emoji
    buf.SetCell(0, 2, cellbuf.Cell{
        Rune:  '😀',
        Width: 2,
    })
    
    // Write
    w := cellbuf.NewWriter(os.Stdout)
    w.Write(buf)
}
```

### **4. Soft Scrolling**
```go
package main

import (
    "os"
    "github.com/charmbracelet/x/cellbuf"
)

func main() {
    // Create a screen with soft scrolling
    screen := cellbuf.NewScreen(20, 5)
    
    // Fill the screen
    for i := 0; i < 5; i++ {
        for j := 0; j < 20; j++ {
            screen.SetCell(i, j, cellbuf.Cell{Rune: rune('A' + i*20 + j), Width: 1})
        }
    }
    
    // Scroll up (content is preserved in SoftBuffer)
    screen.ScrollUp(1)
    
    // Write
    w := cellbuf.NewWriter(os.Stdout)
    w.Write(screen.Buffer)
}
```

### **5. Bubble Tea Integration**
`cellbuf` is used internally by **Bubble Tea** for rendering. Here’s how you might use it directly:
```go
package main

import (
    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/x/cellbuf"
)

type Model struct {
    buf *cellbuf.Buffer
}

func NewModel() Model {
    buf := cellbuf.NewBuffer(20, 5)
    buf.Fill(cellbuf.BlankCell)
    return Model{buf: buf}
}

func (m Model) Init() tea.Cmd {
    return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    // Handle input and update buffer
    return m, nil
}

func (m Model) View() string {
    // Convert buffer to string (simplified)
    var s string
    for i := 0; i < m.buf.Height; i++ {
        for j := 0; j < m.buf.Width; j++ {
            cell := m.buf.GetCell(i, j)
            s += cell.String()
        }
        s += "\n"
    }
    return s
}

func main() {
    p := tea.NewProgram(NewModel())
    p.Start()
}
```

---

## Use Cases
1. **Terminal Emulators**: Implement a full terminal emulator (like **xterm** or **Alacritty**).
2. **TUI Frameworks**: Build a TUI framework (like **Bubble Tea**) on top of `cellbuf`.
3. **Screen Recording**: Capture terminal output for tools like **VHS**.
4. **Debugging**: Inspect terminal output at the cell level.
5. **Custom Widgets**: Build custom terminal widgets (e.g., progress bars, tables).
6. **Text Editors**: Implement a terminal-based text editor.

---

## Comparison to Alternatives
| Feature | `x/cellbuf` | [github.com/gdamore/tcell](https://github.com/gdamore/tcell) | [github.com/nsf/termbox-go](https://github.com/nsf/termbox-go) | [github.com/lucasb-eyer/go-colorful](https://github.com/lucasb-eyer/go-colorful) |
|---------|-------------|-----------------------------------------------------------|-------------------------------------------------------------------|-----------------------------------------------------------------------|
| **Cell-Based** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Wide Character Support** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Hyperlinks** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Soft Scrolling** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Hard Scrolling** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Pure Go** | ✅ Yes | ❌ No (Cgo) | ❌ No (Cgo) | ✅ Yes |
| **ANSI Integration** | ✅ Yes (`x/ansi`) | ✅ Yes | ✅ Yes | ❌ No |
| **Performance** | ⚡ Fast | ⚡ Fast | ⚡ Fast | ❌ N/A |

**Key Differentiators**:
- **Pure Go**: No C dependencies (unlike `tcell` or `termbox-go`).
- **Hyperlink Support**: Built-in support for **OSC 8 hyperlinks**.
- **Soft/Hard Scrolling**: Flexible scrolling modes.
- **Bubble Tea Integration**: Designed to work with **Bubble Tea** and other Charmbracelet tools.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/cell.go` | `Cell` struct and methods. |
| `/buffer.go` | `Buffer` struct and 2D grid operations. |
| `/screen.go` | `Screen` struct and scrolling logic. |
| `/style.go` | `Style` struct (wrapper around `x/ansi`). |
| `/link.go` | `Link` struct for hyperlinks. |
| `/writer.go` | `Writer` for outputting cells to a terminal. |
| `/hardscroll.go` | Hard scrolling implementation. |
| `/wrap.go` | Text wrapping and truncation. |
| `/tabstop.go` | Tab stop handling. |
| `/geom.go` | Geometry types (`Point`, `Rectangle`). |

---

## Summary
**`x/cellbuf`** is a **low-level, cell-based terminal buffer library** for Go, providing:

1. **Cell Abstraction**: Represent terminal characters with **runes**, **styles**, **hyperlinks**, and **widths**.
2. **2D Buffer**: Manage a **grid of cells** for the terminal screen.
3. **Soft/Hard Scrolling**: Flexible scrolling modes for different use cases.
4. **Wide Character Support**: Correctly handle **CJK**, **emoji**, and **combining characters**.
5. **Hyperlink Support**: Built-in support for **clickable links** (OSC 8).
6. **Text Wrapping**: Wrap and truncate text to fit terminal columns.
7. **Writer**: Output cells to a terminal with proper ANSI sequences.
8. **Pure Go**: No dependencies, works on all platforms.

**Best For**: Building **terminal emulators**, **TUI frameworks**, or **custom terminal widgets** that need **low-level control** over the terminal screen.
**Avoid If**: You need a **high-level TUI framework** (use **Bubble Tea** or **tview** instead).
