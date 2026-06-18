# Tcell Terminal Primitives Report

## Overview
Tcell is a Go library for terminal screen handling. It provides a clean, cross-platform API for building terminal UIs with support for colors, mouse input, and Unicode.

## Root Primitives

### 1. Screen Abstraction
**Location:** `screen.go`, `tscreen.go`

**Interface:** `Screen`

**Methods:**
- `Init()` / `Fini()` - Lifecycle
- `Clear()` - Clear screen
- `SetContent(x, y, rune, []rune, Style)` - Set cell
- `GetContent(x, y)` - Get cell
- `SetCursor(x, y)` - Position cursor
- `HideCursor()` - Hide cursor
- `Show()` - Flush to terminal
- `SetStyle(Style)` - Default style
- `Sync()` - Force full refresh

**Implementation:** `tscreen` (terminal screen)

### 2. Cell System
**Location:** `cell.go`

**Type:** `Cell`

**Fields:**
- `CurrRunes []rune` - Character(s)
- `Style Style` - Visual style
- `Width int` - Display width (for CJK)

**Features:**
- Full Unicode support
- Combining character handling
- Wide character (CJK) support
- Style per cell

### 3. Style System
**Location:** `attr.go`

**Type:** `Style`

**Fields:**
- `fg Color` - Foreground
- `bg Color` - Background
- `attr AttrMask` - Attributes

**Attributes:**
- `AttrBold`
- `AttrDim`
- `AttrItalic`
- `AttrUnderline`
- `AttrBlink`
- `AttrReverse`
- `AttrStrikeThrough`

**Color Types:**
- `ColorDefault` - Terminal default
- `ColorReset` - Reset to default
- `ColorXXX` - Named colors (16)
- `Color{256}` - 256-color palette
- `ColorRGB` - True color

### 4. Event System
**Location:** `event.go`

**Type:** `Event` (interface)

**Event Types:**
- `EventKey` - Keyboard events
- `EventMouse` - Mouse events
- `EventResize` - Terminal resize
- `EventError` - Errors
- `EventInterrupt` - External interrupt
- `EventPaste` - Bracketed paste
- `EventFocus` - Focus gain/loss

**Key Events:**
```go
type EventKey struct {
    key Key
    mod ModMask
    rune rune
}
```

**Key Types:**
- `KeyRune` - Regular character
- `KeyEnter`, `KeyBackspace`, `KeyTab`
- `KeyEsc`, `KeyInsert`, `KeyDelete`
- `KeyHome`, `KeyEnd`, `KeyUp`, etc.
- `KeyF1` - `KeyF64` - Function keys

**Modifier Mask:**
- `ModShift`
- `ModCtrl`
- `ModAlt`
- `ModMeta`

### 5. Mouse Events
**Type:** `EventMouse`

**Buttons:**
- `Button1` - Left
- `Button2` - Middle
- `Button3` - Right
- `Button4`, `Button5` - Extra
- `ButtonNone` - Motion without click

**Actions:**
- `Press`
- `Release`
- `Motion`

### 6. Input Processing
**Pattern:**
```go
for {
    ev := screen.PollEvent()
    switch ev := ev.(type) {
    case *tcell.EventKey:
        handleKey(ev)
    case *tcell.EventMouse:
        handleMouse(ev)
    case *tcell.EventResize:
        handleResize(ev)
    }
}
```

**Blocking vs Polling:**
- `GetEvent()` - Blocking
- `PollEvent()` - Non-blocking
- `HasPendingEvent()` - Check availability

### 7. Terminal Capabilities
**Detection:**
- Color support (16/256/true)
- Unicode support
- Mouse support
- Resize events

**Methods:**
- `GetColors()` - Color palette
- `HasColors()` - Color capability
- `GetMouse()` - Mouse availability

### 8. Buffer Management
**Double Buffering:**
- Screen maintains off-screen buffer
- `Show()` computes diff
- Only changed cells are output
- Minimizes terminal I/O

### 9. Character Width
**Function:** `GetWidestRawWidth()`
- Handles CJK wide characters
- Proper cursor movement
- Cell occupancy tracking

### 10. Paste Handling
**Bracketed Paste:**
- `EventPaste` indicates paste mode
- Distinguish typed vs pasted input
- Handle multi-line paste

## File Analysis
// Copyright 2026 The TCell Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package tcell

import (
	"sync"

	"github.com/gdamore/tcell/v3/color"
)

// Screen represents the physical (or emulated) screen.
// This can be a terminal window or a physical console.  Platforms implement
// this differently.
type Screen interface {
	// Init initializes the screen for use.
	Init() error

	// Fini finalizes the screen also releasing resources.
	Fini()

	// Clear logically erases the screen.
	// This is effectively a short-cut for Fill(' ', StyleDefault).
	Clear()

	// Fill fills the screen with the given character and style.
	// The effect of filling the screen is not visible until Show
	// is called (or Sync).
	Fill(rune, Style)

	// Put writes the first grapheme of the given string with th
	// given style at the given coordinates. (Only the first grapheme
	// occupying either one or two cells is stored.) It returns the
	// remainder of the string, and the width displayed.
	Put(x int, y int, str string, style Style) (string, int)

	// PutStr writes a string starting at the given position, using the
	// default style. The content is clipped to the screen dimensions.
	PutStr(x int, y int, str string)

	// PutStrStyled writes a string starting at the given position, using
	// the given style. The content is clipped to the screen dimensions.
	PutStrStyled(x int, y int, str string, style Style)

	// Get the contents at the given location.  If the
	// coordinates are out 

## Reusable Patterns

### 1. Screen Interface
```go
type Screen interface {
    Init() error
    Fini()
    Clear()
    SetContent(int, int, rune, []rune, Style)
    GetContent(int, int) (rune, []rune, Style, int)
    SetCursor(int, int)
    HideCursor()
    Show()
    Sync()
    PollEvent() Event
}
```

### 2. Double-Buffer Pattern
```go
type tscreen struct {
    cells    []Cell      // Off-screen buffer
    dirty    []bool      // Dirty tracking
    width    int
    height   int
    // ...
}

func (t *tscreen) Show() {
    for i, cell := range t.cells {
        if t.dirty[i] {
            outputCell(i, cell)
            t.dirty[i] = false
        }
    }
}
```

### 3. Event Queue
```go
type tscreen struct {
    eventQ chan Event
    // ...
}

func (t *tscreen) emitEvent(ev Event) {
    select {
    case t.eventQ <- ev:
    default:
        // Queue full, drop event
    }
}
```

### 4. Style Rendering
```go
func (s Style) ANSICode() string {
    var codes []string
    if s.fg != ColorDefault {
        codes = append(codes, s.fg.ansiForeground())
    }
    if s.bg != ColorDefault {
        codes = append(codes, s.bg.ansiBackground())
    }
    return "\x1b[" + strings.Join(codes, ";") + "m"
}
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Screen Interface | 5/5 | Universal | Excellent abstraction |
| Cell System | 5/5 | Universal | Unicode standard |
| Style System | 5/5 | Universal | ANSI is universal |
| Event Types | 5/5 | Universal | Event pattern |
| Double Buffer | 5/5 | Universal | Essential optimization |
| Dirty Tracking | 5/5 | Universal | Performance critical |
| Mouse Support | 4/5 | High | Most terminals support |
| Resize Events | 5/5 | High | SIGWINCH standard |
| Bracketed Paste | 4/5 | High | Modern terminals |
| Wide Characters | 5/5 | Universal | Unicode standard |

## Implementation Recommendations

### For Rust:
- Trait for Screen
- Struct for Cell with Vec<rune>
- Style compiles to ANSI string
- Channel for events
- Vec<bool> for dirty tracking

### For Python:
- ABC for Screen
- NamedTuple for Cell
- Style caches ANSI codes
- Queue for events

### Key Insights from Tcell:
1. Interface abstraction enables testing/mocking
2. Dirty tracking is critical for performance
3. Event channel decouples input from processing
4. Wide character tracking essential for CJK
5. Bracketed paste distinguishes input types
6. Sync() forces full refresh when needed

## Files of Interest
- tcell/screen.go - Screen interface
- tcell/tscreen.go - Terminal implementation
- tcell/cell.go - Cell type
- tcell/attr.go - Style/attributes
- tcell/event.go - Event types
- tcell/color.go - Color system

## Lessons for TUI Development
1. Always double-buffer (off-screen + dirty tracking)
2. Event-driven architecture is cleanest
3. Support full Unicode including wide chars
4. Provide both blocking and polling input
5. Handle resize gracefully (SIGWINCH)
6. Bracketed paste is important for modern terminals
7. True color with 256-color fallback
8. Format ANSI codes once, cache the result
