# Term Primitives Analysis (x/term)

## Overview
**`x/term`** is a **low-level terminal utility library** for Go, providing **platform-independent** access to terminal functions like **raw mode**, **terminal detection**, **size querying**, and **password input**. It abstracts system-specific APIs (e.g., `termios` on Unix, Windows Console API) into a **unified interface**, making it easier to build **cross-platform TUIs** and **CLI tools**.

**Purpose**: Terminal utilities (raw mode, detection, size, password input).
**Language**: Go.
**Maturity**: Production (experimental in `x`, but stable).
**Dependencies**: None (pure Go, but uses platform-specific syscalls).

---

## Core Primitives

### 1. **Terminal Detection**
**Purpose**: Check if a file descriptor is connected to a terminal.

**Primitives**:
- **`IsTerminal(fd uintptr) bool`**: Returns `true` if `fd` is a terminal (TTY).

**Use Cases**:
- Detect if the program is running in a terminal (vs. piped/redirected).
- Enable/disable ANSI colors based on terminal support.
- Switch between **interactive** and **non-interactive** modes.

**Example**:
```go
import "github.com/charmbracelet/x/term"

// Check if stdout is a terminal
isTTY := term.IsTerminal(os.Stdout.Fd())
if isTTY {
    fmt.Println("Running in a terminal!")
} else {
    fmt.Println("Running in a pipe/file!")
}
```

---

### 2. **Raw Mode**
**Purpose**: Enable **raw mode** for the terminal, allowing direct control over input.

**Primitives**:
- **`MakeRaw(fd uintptr) (*State, error)`**: Puts the terminal into **raw mode** and returns the previous state.
- **`Restore(fd uintptr, oldState *State) error`**: Restores the terminal to its previous state.
- **`GetState(fd uintptr) (*State, error)`**: Gets the current terminal state.
- **`SetState(fd uintptr, state *State) error`**: Sets the terminal to a specific state.

**What is Raw Mode?**
In **raw mode**, the terminal:
- **Disables line buffering**: Input is sent to the program **immediately** (no waiting for Enter).
- **Disables echo**: Keystrokes are **not printed** to the screen.
- **Disables signal handling**: `Ctrl+C`, `Ctrl+Z`, etc. are **not intercepted** by the terminal.
- **Enables special keys**: Arrow keys, function keys, etc. are sent as **escape sequences**.

**Example**:
```go
import (
    "os"
    "github.com/charmbracelet/x/term"
)

func main() {
    fd := os.Stdin.Fd()
    
    // Save the current terminal state
    oldState, err := term.MakeRaw(fd)
    if err != nil {
        panic(err)
    }
    defer term.Restore(fd, oldState) // Restore on exit
    
    // Now in raw mode: read input directly
    buf := make([]byte, 1)
    for {
        _, err := os.Stdin.Read(buf)
        if err != nil {
            panic(err)
        }
        
        // Handle input (e.g., check for 'q' to quit)
        if buf[0] == 'q' {
            break
        }
    }
}
```

**State Management**:
- **`State` struct**: Represents the terminal’s state (e.g., echo, line buffering, etc.).
- **Always restore the terminal state** when exiting (to avoid leaving the terminal in a broken state).

---

### 3. **Terminal Size**
**Purpose**: Query the terminal’s dimensions (width and height in characters).

**Primitives**:
- **`GetSize(fd uintptr) (width, height int, err error)`**: Returns the terminal’s width and height in **characters** (not pixels).

**Use Cases**:
- Adapt UI to the terminal size (e.g., responsive layouts).
- Center text or elements in the terminal.
- Detect terminal resize events (when combined with polling or signals).

**Example**:
```go
import (
    "fmt"
    "os"
    "github.com/charmbracelet/x/term"
)

func main() {
    width, height, err := term.GetSize(os.Stdout.Fd())
    if err != nil {
        fmt.Println("Not a terminal or error:", err)
        return
    }
    fmt.Printf("Terminal size: %dx%d\n", width, height)
}
```

---

### 4. **Password Input**
**Purpose**: Read a line of input **without echoing** (for passwords or sensitive data).

**Primitives**:
- **`ReadPassword(fd uintptr) ([]byte, error)`**: Reads a line from the terminal **without echoing** and returns the bytes (excluding the newline).

**Use Cases**:
- Password prompts in CLI tools.
- Secure input for API keys, tokens, etc.
- Any input where echoing would be undesirable.

**Example**:
```go
import (
    "fmt"
    "os"
    "github.com/charmbracelet/x/term"
)

func main() {
    fmt.Print("Enter password: ")
    password, err := term.ReadPassword(os.Stdin.Fd())
    if err != nil {
        panic(err)
    }
    fmt.Println("\nPassword length:", len(password))
}
```

**Notes**:
- The password is **not echoed** to the screen.
- The returned slice **does not include the newline** (`\n`).
- Works on **Unix** and **Windows** (uses platform-specific APIs).

---

### 5. **Platform-Specific Implementations**
**Purpose**: Handle platform differences (Unix vs. Windows).

**Primitives**:
- **Unix (Linux/macOS/BSD)**: Uses `termios` and `ioctl` syscalls.
- **Windows**: Uses the Windows Console API.
- **Plan 9**: Uses Plan 9-specific syscalls.

**Files**:
| Platform | File | Notes |
|----------|------|-------|
| **Unix (Linux)** | `term_unix.go` | Uses `termios` and `ioctl` |
| **Unix (BSD)** | `term_unix_bsd.go` | BSD-specific implementations |
| **Unix (Other)** | `term_unix_other.go` | Fallback for other Unix-like systems |
| **Windows** | `term_windows.go` | Uses Windows Console API |
| **Plan 9** | `term_plan9.go` | Plan 9-specific implementations |

---

## Technical Insights

### **Raw Mode Implementation**
On **Unix** (Linux/macOS/BSD):
- Uses the `termios` struct to configure terminal behavior.
- Disables `ECHO`, `ICANON`, `ISIG`, and other flags.
- Uses `tcgetattr` and `tcsetattr` to get/set terminal attributes.

On **Windows**:
- Uses the Windows Console API (`GetConsoleMode`, `SetConsoleMode`).
- Disables `ENABLE_ECHO_INPUT` and `ENABLE_LINE_INPUT`.
- Enables `ENABLE_VIRTUAL_TERMINAL_PROCESSING` for ANSI support.

### **Terminal Detection**
On **Unix**:
- Uses `isatty` syscall to check if a file descriptor is a TTY.

On **Windows**:
- Uses `GetConsoleMode` to check if the handle is a console.

### **Terminal Size**
On **Unix**:
- Uses `ioctl` with `TIOCGWINSZ` to get the terminal size.

On **Windows**:
- Uses `GetConsoleScreenBufferInfo` to get the terminal size.

### **Password Input**
On **Unix**:
- Uses `termios` to temporarily disable `ECHO` and read a line.

On **Windows**:
- Uses `_getch` (from `conio.h`) to read characters without echo.

---

## Integration Patterns

### **1. Basic Raw Mode + Key Input**
```go
package main

import (
    "fmt"
    "os"
    "github.com/charmbracelet/x/term"
)

func main() {
    fd := os.Stdin.Fd()
    
    // Enable raw mode
    oldState, err := term.MakeRaw(fd)
    if err != nil {
        panic(err)
    }
    defer term.Restore(fd, oldState)
    
    // Read single characters
    fmt.Println("Press 'q' to quit")
    buf := make([]byte, 1)
    for {
        _, err := os.Stdin.Read(buf)
        if err != nil {
            panic(err)
        }
        
        if buf[0] == 'q' {
            break
        }
        fmt.Printf("You pressed: %c\n", buf[0])
    }
}
```

### **2. Terminal Size-Aware UI**
```go
package main

import (
    "fmt"
    "os"
    "github.com/charmbracelet/x/term"
)

func main() {
    width, height, err := term.GetSize(os.Stdout.Fd())
    if err != nil {
        fmt.Println("Not a terminal")
        return
    }
    
    // Draw a box that fits the terminal
    for i := 0; i < height; i++ {
        for j := 0; j < width; j++ {
            if i == 0 || i == height-1 || j == 0 || j == width-1 {
                fmt.Print("#")
            } else {
                fmt.Print(" ")
            }
        }
        fmt.Println()
    }
}
```

### **3. Password Prompt**
```go
package main

import (
    "fmt"
    "os"
    "github.com/charmbracelet/x/term"
)

func main() {
    fmt.Print("Enter password: ")
    password, err := term.ReadPassword(os.Stdin.Fd())
    if err != nil {
        panic(err)
    }
    fmt.Println("\nPassword entered (not shown)")
    
    // Verify password
    if string(password) == "secret" {
        fmt.Println("Access granted!")
    } else {
        fmt.Println("Access denied!")
    }
}
```

### **4. Bubble Tea Integration**
`x/term` is used internally by **Bubble Tea** for raw mode and terminal size detection. Here’s how you might use it directly:
```go
package main

import (
    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/x/term"
)

type Model struct {
    width  int
    height int
}

func NewModel() Model {
    // Get initial terminal size
    width, height, _ := term.GetSize(0) // 0 = stdin
    return Model{width: width, height: height}
}

func (m Model) Init() tea.Cmd {
    return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        // Update size when terminal is resized
        m.width = msg.Width
        m.height = msg.Height
    }
    return m, nil
}

func (m Model) View() string {
    return fmt.Sprintf("Terminal size: %dx%d", m.width, m.height)
}

func main() {
    p := tea.NewProgram(NewModel())
    p.Start()
}
```

### **5. Detecting Terminal vs. Pipe**
```go
package main

import (
    "fmt"
    "os"
    "github.com/charmbracelet/x/term"
)

func main() {
    if term.IsTerminal(os.Stdout.Fd()) {
        // Running in a terminal: use ANSI colors
        fmt.Println("\x1b[31mError: File not found\x1b[m")
    } else {
        // Running in a pipe: no colors
        fmt.Println("Error: File not found")
    }
}
```

---

## Use Cases
1. **TUI Frameworks**: Enable raw mode and handle terminal resizing (like **Bubble Tea**).
2. **CLI Tools**: Add interactive input (e.g., password prompts, single-key commands).
3. **Terminal Emulators**: Implement low-level terminal control.
4. **Debugging Tools**: Inspect terminal properties (e.g., size, TTY status).
5. **Games**: Handle raw keyboard input for terminal-based games.
6. **Secure Input**: Read passwords or sensitive data without echoing.

---

## Comparison to Alternatives
| Feature | `x/term` | [github.com/gdamore/tcell](https://github.com/gdamore/tcell) | [github.com/nsf/termbox-go](https://github.com/nsf/termbox-go) | [golang.org/x/term](https://pkg.go.dev/golang.org/x/term) |
|---------|----------|-----------------------------------------------------------|-------------------------------------------------------------------|-----------------------------------------------------------------------|
| **Raw Mode** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Terminal Detection** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Terminal Size** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Password Input** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Pure Go** | ❌ No (uses syscalls) | ❌ No (Cgo) | ❌ No (Cgo) | ✅ Yes |
| **Cross-Platform** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **ANSI Support** | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Bubble Tea Integration** | ✅ Yes | ❌ No | ❌ No | ❌ No |

**Key Differentiators**:
- **Bubble Tea Integration**: Designed to work with **Bubble Tea** and other Charmbracelet tools.
- **Simple API**: Focused on **raw mode**, **detection**, **size**, and **password input** (no frills).
- **Platform-Specific Optimizations**: Uses the **best available method** for each platform.
- **No Cgo**: Unlike `tcell` and `termbox-go`, `x/term` uses **Go syscalls** (no C dependencies).

---

## Key Files
| Path | Purpose |
|------|---------|
| `/term.go` | Core API (raw mode, detection, size, password). |
| `/terminal.go` | Terminal state and mode definitions. |
| `/term_unix.go` | Unix (Linux) implementation. |
| `/term_unix_bsd.go` | BSD implementation. |
| `/term_unix_other.go` | Other Unix-like systems. |
| `/term_windows.go` | Windows implementation. |
| `/term_plan9.go` | Plan 9 implementation. |
| `/util.go` | Utility functions. |

---

## Summary
**`x/term`** is a **low-level terminal utility library** for Go, providing:

1. **Terminal Detection**: Check if a file descriptor is a terminal (`IsTerminal`).
2. **Raw Mode**: Enable/disable raw mode for direct input control (`MakeRaw`, `Restore`).
3. **Terminal Size**: Query the terminal’s width and height (`GetSize`).
4. **Password Input**: Read passwords without echoing (`ReadPassword`).
5. **Cross-Platform**: Works on **Unix (Linux/BSD/macOS)**, **Windows**, and **Plan 9**.
6. **Bubble Tea Integration**: Powers **Bubble Tea** and other Charmbracelet TUIs.

**Best For**: Building **TUI frameworks**, **CLI tools**, or **terminal emulators** that need **low-level terminal control**.
**Avoid If**: You need **high-level TUI components** (use **Bubble Tea** or **tview** instead).
