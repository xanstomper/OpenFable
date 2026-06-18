# Input Primitives Analysis (x/input)

## Overview
**`x/input`** is a **low-level terminal input driver** for Go, providing **cross-platform** handling of **keyboard**, **mouse**, and **paste** events. It’s the **core input primitive** used by **Bubble Tea** and other TUI frameworks, abstracting terminal input into a **unified event system**. `x/input` supports **multiple terminal protocols** (e.g., xterm, Kitty, Windows) and provides **event parsing** for raw terminal input.

**Purpose**: Terminal input handling (keyboard, mouse, paste, resize).
**Language**: Go.
**Maturity**: Production (experimental in `x`, but stable).
**Dependencies**: `x/ansi` (for parsing ANSI sequences).

---

## Core Primitives

### 1. **Event Types**
**Purpose**: Represent all possible terminal input events.

**Primitives**:
- **`Event`**: A type alias for `any` (all input events implement this).
- **`UnknownEvent`**: An unrecognized or unsupported event.
- **`MultiEvent`**: A batch of events (e.g., for paste or multi-byte sequences).

**Key Event Types**:
| Event Type | Description | Example |
|------------|-------------|---------|
| `KeyEvent` | Keyboard key press/release | `KeyEvent{Rune: 'a', Modifiers: Alt}` |
| `MouseEvent` | Mouse click, drag, or scroll | `MouseEvent{X: 10, Y: 20, Button: Left}` |
| `PasteEvent` | Pasted text (bracketed paste mode) | `PasteEvent{Text: "Hello"}` |
| `WindowSizeEvent` | Terminal resize | `WindowSizeEvent{Width: 80, Height: 24}` |
| `WindowOpEvent` | Terminal window operation (e.g., title change) | `WindowOpEvent{Op: 1, Args: [10, 20]}` |
| `FocusEvent` | Terminal focus in/out | `FocusEvent{Focused: true}` |

---

### 2. **Key Events**
**Purpose**: Handle keyboard input, including **special keys** (arrow keys, function keys, etc.).

**Primitives**:
- **`KeyEvent` struct**: Represents a keyboard event.
  ```go
  type KeyEvent struct {
      Rune     rune      // The rune (Unicode character) pressed
      Key      Key       // The special key (if any, e.g., KeyUp, KeyF1)
      Modifiers ModMask  // Modifier keys (Shift, Ctrl, Alt, Meta)
      Alt      bool      // Whether Alt was pressed
      Ctrl     bool      // Whether Ctrl was pressed
      Shift    bool      // Whether Shift was pressed
      Meta     bool      // Whether Meta (Command/Windows) was pressed
  }
  ```

**Key Constants**:
`x/input` defines **hundreds of special keys**, including:
- **Arrow Keys**: `KeyUp`, `KeyDown`, `KeyLeft`, `KeyRight`
- **Function Keys**: `KeyF1` to `KeyF64`
- **Keypad Keys**: `KeyKp0` to `KeyKp9`, `KeyKpEnter`, `KeyKpPlus`, etc.
- **Editing Keys**: `KeyHome`, `KeyEnd`, `KeyPgUp`, `KeyPgDown`, `KeyInsert`, `KeyDelete`
- **Modifier Keys**: `KeyCapsLock`, `KeyNumLock`, `KeyScrollLock`
- **System Keys**: `KeyPrintScreen`, `KeyPause`, `KeyMenu`

**Key Codes**:
- **`KeyExtended`**: A sentinel value (`unicode.MaxRune + 1`) for special keys.
- **Special keys** are defined as `KeyExtended + iota + 1` (e.g., `KeyUp = KeyExtended + 2`).

**Example**:
```go
// Check for Ctrl+C
if ev, ok := event.(input.KeyEvent); ok {
    if ev.Rune == 'c' && ev.Ctrl {
        fmt.Println("Ctrl+C pressed")
    }
}

// Check for arrow keys
if ev.Key == input.KeyUp {
    fmt.Println("Up arrow pressed")
}
```

**Modifier Masks**:
```go
// ModMask is a bitmask of modifier keys
type ModMask uint8

const (
    ModNone   ModMask = 0
    ModShift  ModMask = 1 << iota
    ModCtrl
    ModAlt
    ModMeta  // Command (macOS) or Windows key
)
```

---

### 3. **Mouse Events**
**Purpose**: Handle mouse input (clicks, drags, scrolls).

**Primitives**:
- **`MouseEvent` struct**: Represents a mouse event.
  ```go
  type MouseEvent struct {
      X        int       // Column (1-based)
      Y        int       // Row (1-based)
      Button   MouseButton // Which button was pressed
      Modifiers ModMask  // Modifier keys (Shift, Ctrl, Alt, Meta)
      Drag     bool      // Whether this is a drag event
      Scroll   int       // Scroll delta (positive = up, negative = down)
  }
  ```

**Mouse Buttons**:
```go
type MouseButton int

const (
    MouseButtonNone   MouseButton = 0  // No button (e.g., mouse move)
    MouseButtonLeft   MouseButton = 1  // Left button
    MouseButtonRight  MouseButton = 2  // Right button
    MouseButtonMiddle MouseButton = 3  // Middle button
    MouseButtonWheelUp    MouseButton = 4  // Scroll up
    MouseButtonWheelDown  MouseButton = 5  // Scroll down
)
```

**Mouse Modes**:
`x/input` supports multiple **mouse tracking protocols**:
- **X10 Mode**: Basic mouse tracking (press/release only).
- **VT200 Mode**: Extended mouse tracking (drag support).
- **SGR Mode**: Pixel-precise mouse tracking (Kitty, iTerm2, etc.).
- **Kitty Mode**: Enhanced mouse tracking (Kitty terminal protocol).

**Example**:
```go
// Check for left mouse click
if ev, ok := event.(input.MouseEvent); ok {
    if ev.Button == input.MouseButtonLeft {
        fmt.Printf("Clicked at (%d, %d)\n", ev.X, ev.Y)
    }
}

// Check for scroll
if ev.Scroll != 0 {
    fmt.Printf("Scrolled by %d\n", ev.Scroll)
}
```

---

### 4. **Paste Events**
**Purpose**: Handle **bracketed paste mode** (pastes are wrapped in escape sequences).

**Primitives**:
- **`PasteEvent` struct**: Represents pasted text.
  ```go
  type PasteEvent struct {
      Text string  // The pasted text
  }
  ```

**Bracketed Paste Mode**:
- When enabled, pasted text is **wrapped** in `\x1b[200~` (start) and `\x1b[201~` (end).
- This prevents pasted text from being interpreted as **keyboard input** (e.g., `Ctrl+V` followed by text).

**Example**:
```go
// Handle pasted text
if ev, ok := event.(input.PasteEvent); ok {
    fmt.Printf("Pasted: %s\n", ev.Text)
}
```

---

### 5. **Window Events**
**Purpose**: Handle terminal resize and other window operations.

**Primitives**:
- **`WindowSizeEvent`**: Terminal resize event.
  ```go
  type WindowSizeEvent struct {
      Width  int  // New width (columns)
      Height int  // New height (rows)
  }
  ```
- **`WindowOpEvent`**: Generic window operation (e.g., title change).
  ```go
  type WindowOpEvent struct {
      Op   int    // Operation code
      Args []int  // Operation arguments
  }
  ```

**Example**:
```go
// Handle terminal resize
if ev, ok := event.(input.WindowSizeEvent); ok {
    fmt.Printf("Terminal resized to %dx%d\n", ev.Width, ev.Height)
}
```

---

### 6. **Focus Events**
**Purpose**: Handle terminal focus changes (e.g., user switches to another window).

**Primitives**:
- **`FocusEvent` struct**: Represents a focus change.
  ```go
  type FocusEvent struct {
      Focused bool  // True if terminal gained focus, false if lost
  }
  ```

**Example**:
```go
// Handle focus changes
if ev, ok := event.(input.FocusEvent); ok {
    if ev.Focused {
        fmt.Println("Terminal gained focus")
    } else {
        fmt.Println("Terminal lost focus")
    }
}
```

---

### 7. **Driver**
**Purpose**: Low-level terminal input driver (platform-specific).

**Primitives**:
- **`Driver` interface**: Abstracts terminal input reading.
  ```go
  type Driver interface {
      Read() (Event, error)  // Read the next event
      Close() error          // Close the driver
  }
  ```

**Platform-Specific Drivers**:
| Platform | Driver | Notes |
|----------|--------|-------|
| **Unix (Linux/macOS)** | `NewDriver()` | Uses `/dev/tty` and termios |
| **Windows** | `NewDriver()` | Uses Windows Console API |
| **Kitty** | `NewKittyDriver()` | Uses Kitty keyboard protocol |
| **XTerm** | `NewXTermDriver()` | Uses xterm-compatible sequences |

**Example**:
```go
// Open a driver
driver, err := input.NewDriver()
if err != nil {
    log.Fatal(err)
}
defer driver.Close()

// Read events in a loop
for {
    ev, err := driver.Read()
    if err != nil {
        log.Fatal(err)
    }
    
    // Handle the event
    switch ev := ev.(type) {
    case input.KeyEvent:
        fmt.Printf("Key: %c\n", ev.Rune)
    case input.MouseEvent:
        fmt.Printf("Mouse: %d, %d\n", ev.X, ev.Y)
    case input.PasteEvent:
        fmt.Printf("Paste: %s\n", ev.Text)
    case input.WindowSizeEvent:
        fmt.Printf("Resize: %dx%d\n", ev.Width, ev.Height)
    }
}
```

---

### 8. **Parser**
**Purpose**: Parse raw terminal input into `Event` types.

**Primitives**:
- **`Parser` struct**: Parses raw bytes into events.
- **`Parse()`**: Parse a byte slice into events.
- **`ParseStream()`**: Parse a stream of bytes (e.g., from `os.Stdin`).

**Example**:
```go
// Create a parser
parser := input.NewParser()

// Parse raw input
inputBytes := []byte{"\x1b[A"}  // Up arrow key
events, err := parser.Parse(inputBytes)
if err != nil {
    log.Fatal(err)
}

for _, ev := range events {
    fmt.Printf("Event: %v\n", ev)
}
```

---

### 9. **Terminal Modes**
**Purpose**: Enable/disable terminal modes (e.g., mouse tracking, bracketed paste).

**Primitives**:
- **`EnableMouse(mode)`**: Enable mouse tracking.
- **`DisableMouse()`**: Disable mouse tracking.
- **`EnableBracketedPaste()`**: Enable bracketed paste mode.
- **`DisableBracketedPaste()`**: Disable bracketed paste mode.
- **`EnableFocus()`**: Enable focus in/out events.
- **`DisableFocus()`**: Disable focus events.

**Mouse Modes**:
```go
// Mouse tracking modes
const (
    MouseModeNone    = 0  // No mouse tracking
    MouseModeX10     = 9  // X10 compatibility mode
    MouseModeVT200   = 1000 // VT200 mode
    MouseModeSGR     = 1006 // SGR mode (pixel-precise)
    MouseModeKitty   = 1007 // Kitty mode
)

// Enable SGR mouse mode
input.EnableMouse(input.MouseModeSGR)
```

---

### 10. **Terminal Capabilities**
**Purpose**: Detect terminal capabilities (e.g., colors, mouse support).

**Primitives**:
- **`Detect()`**: Detect terminal capabilities.
- **`Capabilities` struct**: Stores detected terminal features.
  ```go
  type Capabilities struct {
      Colors       int  // Number of supported colors (0, 16, 256, etc.)
      Mouse        bool // Whether mouse tracking is supported
      BracketedPaste bool // Whether bracketed paste is supported
      Focus        bool // Whether focus events are supported
  }
  ```

**Example**:
```go
// Detect terminal capabilities
caps := input.Detect()
fmt.Printf("Colors: %d\n", caps.Colors)
fmt.Printf("Mouse: %v\n", caps.Mouse)
```

---

## Technical Insights

### **How Input Works**
1. **Driver Initialization**: A `Driver` is created for the current platform (Unix/Windows).
2. **Terminal Setup**: The driver configures the terminal (e.g., enables raw mode, mouse tracking).
3. **Event Reading**: The driver reads raw bytes from the terminal and parses them into `Event` types.
4. **Event Dispatch**: Events are passed to the application for handling.

### **Raw Mode vs. Cooked Mode**
- **Cooked Mode**: Terminal processes input (e.g., line buffering, echo).
- **Raw Mode**: Terminal passes **all input directly** to the application (no buffering, no echo).
  - Required for **TUIs** to handle input in real-time.

### **Mouse Tracking Protocols**
| Protocol | Description | Pros | Cons |
|----------|-------------|------|------|
| **X10** | Basic mouse tracking | Widely supported | No drag support |
| **VT200** | Extended mouse tracking | Supports drag | Less precise |
| **SGR** | Pixel-precise tracking | High precision | Less widely supported |
| **Kitty** | Enhanced tracking | Supports modifiers, pixel coordinates | Kitty-specific |

### **Performance**
- **Non-Blocking Reads**: Drivers support **non-blocking reads** (e.g., `ReadTimeout`).
- **Buffered Input**: Events are buffered for **efficient reading**.
- **Low Latency**: Optimized for **real-time TUIs**.

### **Cross-Platform Support**
- **Unix (Linux/macOS)**: Uses `termios` for raw mode and `/dev/tty` for input.
- **Windows**: Uses the **Windows Console API** (no `termios`).
- **Kitty Protocol**: Supports **Kitty’s enhanced keyboard protocol** (for better key handling).

---

## Integration Patterns

### **1. Basic Event Loop**
```go
package main

import (
    "fmt"
    "log"
    "github.com/charmbracelet/x/input"
)

func main() {
    // Open a driver
    driver, err := input.NewDriver()
    if err != nil {
        log.Fatal(err)
    }
    defer driver.Close()
    
    // Enable mouse tracking
    input.EnableMouse(input.MouseModeSGR)
    defer input.DisableMouse()
    
    // Enable bracketed paste
    input.EnableBracketedPaste()
    defer input.DisableBracketedPaste()
    
    // Read events
    for {
        ev, err := driver.Read()
        if err != nil {
            log.Fatal(err)
        }
        
        switch ev := ev.(type) {
        case input.KeyEvent:
            if ev.Rune == 'q' {
                return
            }
            fmt.Printf("Key: %c\n", ev.Rune)
        case input.MouseEvent:
            fmt.Printf("Mouse: %d, %d\n", ev.X, ev.Y)
        case input.PasteEvent:
            fmt.Printf("Paste: %s\n", ev.Text)
        case input.WindowSizeEvent:
            fmt.Printf("Resize: %dx%d\n", ev.Width, ev.Height)
        }
    }
}
```

### **2. Bubble Tea Integration**
`x/input` is used internally by **Bubble Tea** for input handling. Here’s how you might use it directly:
```go
package main

import (
    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/x/input"
)

type Model struct {
    // Your model state
}

func (m Model) Init() tea.Cmd {
    return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        // Handle key events (Bubble Tea wraps x/input)
        if msg.String() == "q" {
            return m, tea.Quit
        }
    case tea.MouseMsg:
        // Handle mouse events
        fmt.Printf("Mouse: %d, %d\n", msg.X, msg.Y)
    }
    return m, nil
}

func (m Model) View() string {
    return "Press 'q' to quit"
}

func main() {
    p := tea.NewProgram(Model{})
    p.Start()
}
```

### **3. Custom Input Handler**
```go
package main

import (
    "bufio"
    "fmt"
    "os"
    "github.com/charmbracelet/x/input"
)

func main() {
    // Create a parser
    parser := input.NewParser()
    
    // Read from stdin
    scanner := bufio.NewScanner(os.Stdin)
    for scanner.Scan() {
        line := scanner.Bytes()
        events, err := parser.Parse(line)
        if err != nil {
            fmt.Printf("Error: %v\n", err)
            continue
        }
        
        for _, ev := range events {
            fmt.Printf("Event: %v\n", ev)
        }
    }
}
```

### **4. Mouse Drag Handling**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/input"
)

func main() {
    driver, _ := input.NewDriver()
    defer driver.Close()
    
    input.EnableMouse(input.MouseModeVT200)
    defer input.DisableMouse()
    
    var dragging bool
    var startX, startY int
    
    for {
        ev, _ := driver.Read()
        switch ev := ev.(type) {
        case input.MouseEvent:
            if ev.Button == input.MouseButtonLeft {
                if !dragging && !ev.Drag {
                    // Start drag
                    dragging = true
                    startX, startY = ev.X, ev.Y
                    fmt.Printf("Drag started at (%d, %d)\n", startX, startY)
                } else if dragging && ev.Drag {
                    // Drag in progress
                    fmt.Printf("Dragging to (%d, %d)\n", ev.X, ev.Y)
                } else if dragging {
                    // End drag
                    dragging = false
                    fmt.Printf("Drag ended at (%d, %d)\n", ev.X, ev.Y)
                }
            }
        }
    }
}
```

---

## Use Cases
1. **TUI Frameworks**: Build a TUI framework (like **Bubble Tea**) on top of `x/input`.
2. **Terminal Emulators**: Implement input handling in a custom terminal emulator.
3. **CLI Tools**: Add interactive input to CLI tools (e.g., keybindings, mouse support).
4. **Games**: Handle keyboard/mouse input for terminal-based games.
5. **Input Debugging**: Inspect raw terminal input (like **Sequin** for ANSI).
6. **Custom Widgets**: Build custom input widgets (e.g., text inputs, buttons).

---

## Comparison to Alternatives
| Feature | `x/input` | [github.com/gdamore/tcell](https://github.com/gdamore/tcell) | [github.com/nsf/termbox-go](https://github.com/nsf/termbox-go) | [github.com/crossterm-rs/crossterm](https://github.com/crossterm-rs/crossterm) (Rust) |
|---------|-----------|-----------------------------------------------------------|-------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| **Keyboard Input** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Mouse Input** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Paste Events** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Resize Events** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Focus Events** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Raw Mode** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Pure Go** | ✅ Yes | ❌ No (Cgo) | ❌ No (Cgo) | ❌ No (Rust) |
| **Kitty Protocol** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Cross-Platform** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Event Parsing** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |

**Key Differentiators**:
- **Pure Go**: No C dependencies (unlike `tcell` or `termbox-go`).
- **Kitty Protocol Support**: Enhanced keyboard handling for **Kitty terminal**.
- **Bracketed Paste**: Built-in support for **bracketed paste mode**.
- **Bubble Tea Integration**: Designed to work with **Bubble Tea** and other Charmbracelet tools.
- **Event-Driven**: Clean, event-based API for input handling.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/input.go` | Core event types (`Event`, `KeyEvent`, `MouseEvent`, etc.). |
| `/key.go` | Key constants and `KeyEvent` struct. |
| `/mouse.go` | Mouse constants and `MouseEvent` struct. |
| `/driver.go` | Platform-specific driver interface. |
| `/driver_unix.go` | Unix (Linux/macOS) driver implementation. |
| `/driver_windows.go` | Windows driver implementation. |
| `/kitty.go` | Kitty keyboard protocol support. |
| `/xterm.go` | XTerm-compatible sequences. |
| `/parse.go` | ANSI input parser. |
| `/paste.go` | Bracketed paste mode support. |
| `/focus.go` | Focus event support. |

---

## Summary
**`x/input`** is a **low-level, cross-platform terminal input driver** for Go, providing:

1. **Event-Driven Input**: Unified `Event` type for all input (keys, mouse, paste, resize, focus).
2. **Keyboard Support**: Full keyboard handling, including **special keys** (arrow keys, function keys, etc.) and **modifiers** (Shift, Ctrl, Alt, Meta).
3. **Mouse Support**: Multiple **mouse tracking protocols** (X10, VT200, SGR, Kitty).
4. **Paste Handling**: **Bracketed paste mode** for safe paste handling.
5. **Window Events**: Terminal **resize** and **focus** events.
6. **Platform Support**: Works on **Unix (Linux/macOS)** and **Windows**.
7. **Pure Go**: No dependencies, works on all platforms.
8. **Bubble Tea Integration**: Powers **Bubble Tea** and other Charmbracelet TUIs.

**Best For**: Building **TUI frameworks**, **terminal emulators**, or **interactive CLI tools** that need **low-level input control**.
**Avoid If**: You need a **high-level TUI framework** (use **Bubble Tea** or **tview** instead).
