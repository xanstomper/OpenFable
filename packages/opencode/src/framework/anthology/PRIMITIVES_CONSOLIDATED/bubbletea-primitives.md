# Bubble Tea Framework - Terminal Application Primitives

## Overview

Bubble Tea is an Elm-inspired architectural framework for building terminal user interfaces in Go. This report extracts the core primitives and patterns that can be generalized to other languages (Python, Rust, TypeScript, etc.).

---

## 1. Core Architectural Pattern: The Elm Architecture

### 1.1 Model-Update-View Cycle

**Primitive:** Unidirectional data flow with three core functions

```
Init() → Cmd
Update(Msg) → (Model, Cmd)
View() → View
```

**Language-Agnostic Abstraction:**

```python
# Python example
class Model:
    def init(self) -> Optional[Cmd]: ...
    def update(self, msg: Msg) -> Tuple['Model', Optional[Cmd]]: ...
    def view(self) -> View: ...
```

```rust
// Rust example
trait Model {
    fn init(&mut self) -> Option<Cmd>;
    fn update(&mut self, msg: Msg) -> Option<Cmd>;
    fn view(&self) -> View;
}
```

```typescript
// TypeScript example
interface Model {
  init(): Cmd | null;
  update(msg: Msg): [Model, Cmd | null];
  view(): View;
}
```

**Key Insights:**
- **Pure update function**: `Update` receives the current state and a message, returns new state and optional side-effect command
- **No direct mutations**: State changes only happen through the update cycle
- **View is a pure function of state**: No side effects in rendering

---

## 2. Command Pattern for Side Effects

### 2.1 Command Definition

**Primitive:** Commands are functions that return messages when complete

```go
type Cmd func() Msg
```

**Generalized Pattern:**

```python
# Python
Cmd = Callable[[], Msg]

def http_get(url: str) -> Cmd:
    def _cmd():
        response = requests.get(url)
        return ResponseMsg(response)
    return _cmd
```

```rust
// Rust
type Cmd = Box<dyn FnOnce() -> Msg + Send>;

fn tick_after(duration: Duration) -> Cmd {
    Box::new(move || {
        thread::sleep(duration);
        Msg::Tick(Instant::now())
    })
}
```

### 2.2 Command Combinators

**Primitive:** Batch (parallel) and Sequence (serial) execution

```go
// Batch: run commands concurrently
func Batch(cmds ...Cmd) Cmd

// Sequence: run commands in order
func Sequence(cmds ...Cmd) Cmd
```

**Generalized Implementation:**

```python
def batch(*cmds):
    """Run multiple commands concurrently"""
    def _batch():
        from concurrent.futures import ThreadPoolExecutor
        results = []
        with ThreadPoolExecutor() as executor:
            futures = [executor.submit(cmd) for cmd in cmds if cmd]
            for f in futures:
                results.append(f.result())
        return BatchMsg(results)
    return _batch

def sequence(*cmds):
    """Run commands sequentially"""
    def _sequence():
        for cmd in cmds:
            if cmd:
                msg = cmd()
                if isinstance(msg, (BatchMsg, SequenceMsg)):
                    # Recursively handle nested commands
                    pass
                else:
                    send_msg(msg)
    return _sequence
```

**Key Patterns:**
- `nil`/`None` commands are no-ops (allow conditional commands)
- Single command optimization: `Batch(single_cmd)` returns `single_cmd` directly
- Commands run in goroutines/background threads to avoid blocking

---

## 3. Message System

### 3.1 Message Types

**Primitive:** Messages carry data from commands/events to the update function

**Core Message Categories:**

1. **Input Messages**: KeyMsg, MouseMsg
2. **System Messages**: QuitMsg, InterruptMsg, WindowSizeMsg
3. **Command Results**: Custom messages from async operations
4. **Internal Messages**: BatchMsg, SequenceMsg

**Generalized Pattern:**

```python
# Python with type unions
Msg = Union[
    KeyPressMsg,
    MouseClickMsg,
    QuitMsg,
    WindowSizeMsg,
    CustomMsg,  # User-defined
]
```

```rust
// Rust with enum
enum Msg {
    KeyPress(Key),
    MouseClick(Mouse),
    Quit,
    WindowSize { width: u16, height: u16 },
    Custom(CustomData),
}
```

### 3.2 Keyboard Input Handling

**Primitive:** Comprehensive key representation with modifiers

```go
type Key struct {
    Text        string  // Actual characters ("a", "A", "1", "!")
    Mod         KeyMod  // Ctrl, Alt, Shift, Meta, Hyper, Super
    Code        rune    // Special keys (KeyEnter, KeyF1, etc.)
    ShiftedCode rune    // Shifted variant
    BaseCode    rune    // Layout-independent (PC-101)
    IsRepeat    bool    // Key held down
}
```

**Cross-Language Implementation:**

```python
class KeyMod(IntFlag):
    NONE = 0
    CTRL = 1
    ALT = 2
    SHIFT = 4
    META = 8
    HYPER = 16
    SUPER = 32

class Key:
    def __init__(self, text: str, code: int, mod: KeyMod = KeyMod.NONE):
        self.text = text
        self.code = code  # Unicode codepoint or special key constant
        self.mod = mod
        self.is_repeat = False
    
    def matches(self, pattern: str) -> bool:
        """Match key against string like 'ctrl+c' or 'shift+enter'"""
        parts = pattern.split('+')
        # Parse and compare modifiers and key
```

**Special Key Constants (universal):**
- Navigation: Up, Down, Left, Right, Home, End, PgUp, PgDown
- Editing: Insert, Delete, Backspace, Tab, Enter, Escape
- Function: F1-F64
- Media: Play, Pause, Volume, etc.
- Keypad: Kp0-Kp9, KpEnter, etc.

### 3.3 Mouse Input Handling

**Primitive:** Mouse events with position and button state

```go
type Mouse struct {
    X, Y   int         // Zero-based coordinates
    Button MouseButton  // Left, Right, Middle, Wheel*, etc.
    Mod    KeyMod      // Modifier keys held during click
}
```

**Mouse Modes:**
1. **None**: No mouse events
2. **Cell Motion**: Clicks + drag (button held movement)
3. **All Motion**: All movement events

---

## 4. Event Loop and Runtime

### 4.1 Program Structure

**Primitive:** Central event loop coordinating all operations

```
┌─────────────────────────────────────────────────────────────┐
│                      Program.Run()                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Input Reader │    │ Command Pool │    │ Signal Handler│ │
│  │  (stdin/tty) │    │  (goroutines) │    │  (SIGINT,…)  │ │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│         └───────────────────┼───────────────────┘          │
│                             ▼                              │
│                    ┌────────────────┐                      │
│                    │   Message Chan │                      │
│                    └───────┬────────┘                      │
│                            ▼                               │
│                    ┌────────────────┐                      │
│                    │  Event Filter  │ (optional)           │
│                    └───────┬────────┘                      │
│                            ▼                               │
│                    ┌────────────────┐                      │
│                    │ Model.Update() │                      │
│                    └───────┬────────┘                      │
│                            │                               │
│                     (new state, cmd)                       │
│                            │                               │
│                            ▼                               │
│                    ┌────────────────┐                      │
│                    │ Model.View()   │                      │
│                    └───────┬────────┘                      │
│                            ▼                               │
│                    ┌────────────────┐                      │
│                    │   Renderer     │                      │
│                    └────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **Message Channel**: Central hub for all events
2. **Input Reader**: Terminal input (key, mouse, resize)
3. **Command Pool**: Background task execution
4. **Signal Handler**: OS signals (SIGINT, SIGTERM)
5. **Event Filter**: Optional message interception
6. **Renderer**: Terminal output with frame rate limiting

### 4.2 Context and Cancellation

**Primitive:** Graceful shutdown via context

```go
ctx, cancel := context.WithCancel(context.Background())
// On shutdown:
cancel()  // Signal all goroutines
<-handlers.shutdown()  // Wait for cleanup
```

**Cross-Language Pattern:**

```python
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def program_lifecycle():
    ctx = asyncio.create_task(asyncio.sleep(0))
    try:
        yield ctx
    finally:
        ctx.cancel()
        await asyncio.gather(ctx, return_exceptions=True)
```

```rust
use tokio::sync::broadcast;

let (shutdown_tx, mut shutdown_rx) = broadcast::channel(1);
// Spawn tasks that listen:
tokio::spawn(async move {
    tokio::select! {
        _ = shutdown_rx.recv() => return,
        // ... do work
    }
});
```

### 4.3 Frame Rate Limiting

**Primitive:** Controlled rendering to avoid excessive updates

```go
p.fps = 60  // Default, clamped to [1, 120]
ticker := time.NewTicker(time.Second / time.Duration(fps))
```

**Pattern:**
- Queue render requests
- Tick at fixed interval
- Render latest queued view on tick
- Skip intermediate updates

---

## 5. Terminal I/O Management

### 5.1 Raw Mode Setup

**Primitive:** Switch terminal to raw input mode

```go
// Save state
previousState := term.GetState(ttyInput)
// Enter raw mode
term.SetRawMode(ttyInput)
// On exit, restore
term.Restore(previousState)
```

**Terminal Modes to Manage:**
- Echo (disable)
- Canonical/line mode (disable)
- Signal generation (Ctrl+C, Ctrl+Z)
- Mouse input (enable if needed)
- Bracketed paste (enable)
- Keyboard enhancement protocols (Kitty, etc.)

### 5.2 Alternate Screen Buffer

**Primitive:** Full-screen vs inline modes

```go
// Enter alternate screen (full window)
ansi.EnterAlternateScreen
// Exit (restore previous content)
ansi.ExitAlternateScreen
```

**Cross-Language:**
```python
# ANSI escape codes
ENTER_ALTERNATE = "\x1b[?1049h"
EXIT_ALTERNATE = "\x1b[?1049l"

def run_fullscreen(app):
    sys.stdout.write(ENTER_ALTERNATE)
    sys.stdout.flush()
    try:
        app.run()
    finally:
        sys.stdout.write(EXIT_ALTERNATE)
        sys.stdout.flush()
```

### 5.3 Terminal Capability Detection

**Primitive:** Query terminal for features

```go
// Query synchronized output support
p.execute(ansi.RequestMode(ansi.ModeSynchronizedOutput))
// Query Unicode text core width
p.execute(ansi.RequestMode(ansi.ModeUnicodeCore))
// Request color profile
p.execute(ansi.RequestTermcap("RGB"))
```

**Capabilities to Detect:**
- True Color (24-bit) support
- Synchronized output (mode 2026)
- Kitty keyboard protocol
- Mouse support level
- Hyperlink support
- Sixel graphics

---

## 6. Renderer Architecture

### 6.1 Renderer Interface

**Primitive:** Pluggable rendering backends

```go
type renderer interface {
    render(View)
    resize(width, height int)
    setSyncdUpdates(enabled bool)
    setWidthMethod(method ansi.WidthMethod)
    setColorProfile(profile colorprofile.Profile)
    onMouse(msg MouseMsg) Cmd
}
```

**Renderer Types:**

1. **Standard Renderer**: Full TUI with ANSI codes
2. **Nil Renderer**: No output (daemon mode)
3. **Cursed Renderer**: High-performance (platform-specific)

### 6.2 View Structure

**Primitive:** Structured view with layers and metadata

```go
type View struct {
    Content                string   // ANSI-styled content
    Cursor                 *Cursor  // Optional cursor
    BackgroundColor        color.Color
    ForegroundColor        color.Color
    WindowTitle            string
    ProgressBar            *ProgressBar
    AltScreen              bool
    ReportFocus            bool
    MouseMode              MouseMode
    KeyboardEnhancements   KeyboardEnhancements
}
```

**Implementation Pattern:**

```python
@dataclass
class View:
    content: str = ""
    cursor: Optional[Cursor] = None
    background_color: Optional[Color] = None
    foreground_color: Optional[Color] = None
    window_title: Optional[str] = None
    alt_screen: bool = False
    report_focus: bool = False
    mouse_mode: MouseMode = MouseMode.NONE
```

---

## 7. Advanced Features

### 7.1 Event Filters

**Primitive:** Intercept and transform messages

```go
func filter(m Model, msg Msg) Msg {
    if quit, ok := msg.(QuitMsg); ok {
        if m.(myModel).hasChanges {
            return nil  // Suppress quit
        }
    }
    return msg
}
```

**Use Cases:**
- Prevent exit with unsaved changes
- Transform input (vim mode, macros)
- Route messages to sub-components
- Logging/debugging

### 7.2 Focus/Blur Events

**Primitive:** Detect terminal focus changes

```go
type FocusMsg struct{}  // Terminal gained focus
type BlurMsg struct{}   // Terminal lost focus
```

**Implementation:**
- Enable via `View.ReportFocus = true`
- Terminal sends `CSI I` (focus) / `CSI O` (blur)
- Useful for pausing animations, saving state

### 7.3 Suspend/Resume

**Primitive:** Background the program (Ctrl+Z behavior)

```go
// Send suspend message
tea.Suspend()
// Listen for resume
case ResumeMsg:
    // Re-initialize terminal
```

**Platform Support:**
- Unix: SIGTSTP/SIGCONT signals
- Windows: Not supported

---

## 8. Composability Patterns

### 8.1 Sub-Component Composition

**Primitive:** Delegate messages to child models

```go
type parentModel struct {
    child childModel
}

func (m parentModel) Update(msg Msg) (Model, Cmd) {
    // Route specific messages to child
    childMsg, ok := msg.(childMsgType)
    if ok {
        var cmd Cmd
        m.child, cmd = m.child.Update(childMsg)
        return m, cmd
    }
    // Parent handles rest
    return m, nil
}
```

**Pattern for Complex UIs:**
1. Define message types per component
2. Parent routes messages by type
3. Commands bubble up from children
4. State owned by parent, passed to children

### 8.2 Initialization Commands

**Primitive:** Start async work on launch

```go
func (m model) Init() Cmd {
    return tea.Batch(
        loadConfig(),
        fetchInitialData(),
        tea.Tick(time.Second, tickCmd),
    )
}
```

---

## 9. Go-Specific Implementation Details

### 9.1 What Requires Adaptation

| Go Feature | Alternative in Other Languages |
|------------|-------------------------------|
| Goroutines | asyncio/Threads/Workers |
| Channels | Queues/Streams/Actors |
| `interface{}` | Generics/Type unions |
| `defer` | Context managers/try-finally |
| Panic recovery | Exception handling |

### 9.2 Ultraviolet Integration

Bubble Tea uses `ultraviolet` for:
- Low-level terminal I/O
- ANSI escape code generation
- Keyboard/mouse event parsing
- Terminal capability detection

**For other languages:** Find equivalent:
- Python: `blessed`, `wcwidth`, `ansiwrap`
- Rust: `crossterm`, `ratatui`
- TypeScript: `blessed`, `xterm.js`

---

## 10. Implementation Checklist for New Languages

### Core Requirements

- [ ] Model interface (Init, Update, View)
- [ ] Message type system (sum types/unions)
- [ ] Command type (`() -> Msg`)
- [ ] Message channel/queue
- [ ] Event loop implementation
- [ ] Input reader (keys, mouse, resize)
- [ ] Command executor (background tasks)
- [ ] Renderer with frame limiting
- [ ] Terminal raw mode handling
- [ ] Signal/interrupt handling

### Nice-to-Have

- [ ] Batch/Sequence command combinators
- [ ] Event filter system
- [ ] Focus/blur detection
- [ ] Alternate screen buffer
- [ ] Synchronized output
- [ ] Kitty keyboard protocol
- [ ] Mouse support (all modes)
- [ ] Clipboard integration
- [ ] Terminal capability detection
- [ ] Sub-component composition helpers

---

## 11. Example: Minimal Implementation Skeleton

```python
import asyncio
from typing import Callable, Optional, Any, Union
from dataclasses import dataclass

# Types
Msg = Any  # Union of all message types
Cmd = Callable[[], Msg]
Model = Any  # Your model class

@dataclass
class Program:
    model: Model
    message_queue: asyncio.Queue = None
    
    async def run(self):
        self.message_queue = asyncio.Queue()
        
        # Start input reader
        asyncio.create_task(self.read_input())
        
        # Run init command
        cmd = self.model.init()
        if cmd:
            asyncio.create_task(self.execute_command(cmd))
        
        # Main loop
        while True:
            msg = await self.message_queue.get()
            
            # Handle quit
            if isinstance(msg, QuitMsg):
                break
            
            # Update
            self.model, cmd = self.model.update(msg)
            
            # Execute command
            if cmd:
                asyncio.create_task(self.execute_command(cmd))
            
            # Render
            print(self.model.view(), end='\r')
    
    async def execute_command(self, cmd: Cmd):
        try:
            msg = cmd()
            await self.message_queue.put(msg)
        except Exception as e:
            await self.message_queue.put(ErrorMsg(e))

# Usage
class MyModel:
    value: int = 0
    
    def init(self) -> Optional[Cmd]:
        return None
    
    def update(self, msg: Msg) -> tuple['MyModel', Optional[Cmd]]:
        if isinstance(msg, KeyPressMsg) and msg.text == 'q':
            return self, lambda: QuitMsg()
        return self, None
    
    def view(self) -> str:
        return f"Value: {self.value}"
```

---

## Summary

Bubble Tea provides a robust, composable architecture for terminal UIs based on:

1. **Elm Architecture**: Pure functional update cycle (Model, Update, View)
2. **Command Pattern**: Deferred side effects as first-class citizens
3. **Message Passing**: Type-safe event communication
4. **Event Loop**: Centralized coordination with graceful shutdown
5. **Terminal Abstraction**: Raw mode, alternate screen, capability detection
6. **Renderer**: Pluggable output with frame rate control

The patterns are highly portable to other languages with async/concurrency primitives. The main adaptation work involves replacing Go's channels/goroutines with language-specific concurrency models.