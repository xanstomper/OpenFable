# Blessed Terminal Primitives Report

## Overview
Blessed is a JavaScript TUI framework with over 16,000 lines of code, implementing a curses-like library with a high-level terminal interface API for Node.js. It's arguably the most complete widget library for terminals in any language.

## Root Primitives

### 1. Program/Terminal Abstraction
**Location:** `lib/program.js` (501 lines)

**Core Concept:** `Program` object that outputs escape sequences compatible with *any* terminal.

**Key Features:**
- Terminfo/termcap parsing and compilation
- CSR (change-scroll-region) optimization
- BCE (back-color-erase) support
- Painter's algorithm for rendering
- Screen damage buffer (dirty tracking)
- Smart cursor movements

**Pattern:**
```javascript
var program = blessed.program();
program.enterAlternateScreen();
program.clear();
program.output('\x1b[31mRed text\x1b[0m');
program.cursor(0, 0);
program.flush(); // Single write to stdout
```

### 2. Widget System (DOM-like)
**Location:** `lib/widget.js` + `lib/widgets/` (35+ widgets)

**Core Concept:** Widget API reminiscent of the DOM - tree-based composition with inheritance.

**Base Widget Class:**
```javascript
function Widget(options) {
  Node.call(this);  // Inherits from EventEmitter
  this.screen = options.screen;
  this.parent = null;
  this.children = [];
  // Layout properties
  this.width = options.width;
  this.height = options.height;
  this.left = options.left || 0;
  this.top = options.top || 0;
  // Style
  this.style = options.style || {};
}
```

**Widget Types (35+):**
- Basic: `box`, `text`, `line`, `element`
- Forms: `button`, `checkbox`, `input`, `textbox`, `textarea`, `form`, `radiobutton`, `radioset`, `prompt`, `question`
- Lists: `list`, `listbar`, `listtable`, `filemanager`
- Display: `progressbar`, `log`, `message`, `loading`, `ansiimage`, `image`, `video`
- Layout: `layout`, `screen`, `scrollablebox`, `scrollabletext`, `table`, `terminal`
- Overlay: `overlayimage`

### 3. Layout System
**Location:** `lib/widgets/layout.js`

**Features:**
- Box model (padding, margin, border)
- Position types: absolute, relative, centered
- Size types: fixed, percentage, auto
- Nested layouts

**Pattern:**
```javascript
var box = blessed.box({
  width: '50%',
  height: '50%',
  left: 'center',
  top: 'center',
  padding: { top: 1, right: 2, bottom: 1, left: 2 },
  margin: 'auto'
});
```

### 4. Event System
**Location:** `lib/events.js`, `lib/keys.js`

**Pattern:**
- Widget tree event bubbling
- Named events (`select`, `click`, `keypress`, `focus`, `blur`)
- Keyboard name mapping (termcap-style key names)

```javascript
button.on('select', function() {
  // triggered on activation
});

form.on('keypress', function(ch, key) {
  if (key.name === 'escape') this.destroy();
});
```

### 5. Color System
**Location:** `lib/colors.js`

**Features:**
- 16-color support
- 256-color support (xterm)
- True color (24-bit RGB)
- Color palette detection
- Automatic fallback

**Pattern:**
```javascript
// True color
style: {
  fg: '#ff0000',
  bg: 'rgba(0, 0, 0, 0.5)'
}

// 256 color
style: {
  fg: 196,  // bright red in 256 palette
  bg: 236   // dark gray
}
```

### 6. Screen Buffer Management
**Features:**
- Double buffering (front + back buffer)
- Damage tracking (only render changed cells)
- Cursor optimization (minimize movement)
- Line clearing with BCE (back-color-erase)

**Algorithm:**
```
1. Render widgets to back buffer
2. Compare back buffer to front buffer
3. Build minimal escape sequence output for changed cells
4. Flush single write to terminal
5. Swap buffers
```

### 7. Unicode Handling
**Location:** `lib/unicode.js`

**Features:**
- Wide character detection (CJK)
- Emoji width handling
- Grapheme cluster awareness
- Astral plane support

### 8. Tput/Terminfo
**Location:** `lib/tput.js`

**Features:**
- Parse terminfo databases
- Compile termcap entries
- Terminal capability detection
- Fallback defaults

---

## Reusable Patterns

### 1. Widget Inheritance Hierarchy
```
Node (EventEmitter)
  └── Element (base visual widget)
        ├── Box (basic container)
        │     ├── Text
        │     ├── Button
        │     ├── Input
        │     └── List
        ├── Form
        └── Screen (root)
```

### 2. Box Model Layout
```javascript
// All widgets support:
{
  width: 100 | '50%' | 'half',
  height: 25 | '100%' | 'fill',
  left: 0 | 'center' | '10%',
  top: 0 | 'center',
  padding: 1 | { top: 1, right: 2, bottom: 1, left: 2 },
  margin: 'auto' | 2
}
```

### 3. Event Bubbling
```javascript
// Events bubble up the tree
child.on('click', handler);      // First to fire
parent.on('click', handler);     // Then this
screen.on('click', handler);     // Finally root
```

### 4. Smart Rendering
```javascript
screen.render();  // Only renders damaged regions
// Internal logic:
// 1. Mark widget dirty when changed
// 2. Collect all dirty widgets
// 3. Render to back buffer
// 4. Diff against front buffer
// 5. Output minimal escape sequences
```

---

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Program Abstraction | 5/5 | High | Terminal detection universal |
| Widget Tree | 5/5 | Universal | DOM pattern well-understood |
| Box Model | 5/5 | Universal | CSS concepts widely known |
| Event Bubbling | 5/5 | Universal | Standard UI pattern |
| Damage Buffer | 5/5 | Universal | Core optimization |
| Color Fallback | 4/5 | High | Detection algo portable |
| Unicode Width | 4/5 | High | CJK handling important |
| Terminfo Parse | 3/5 | Medium | C-heavy, complex format |

---

## Implementation Recommendations

### For Rust:
- Use `termwiz` or `crossterm` for Program layer
- Struct hierarchy for widgets (Box -> Element -> Widget)
- Vec for child collection
- Custom event enum with bubbling
- Two `Vec<Cell>` buffers for double-buffering

### For Go:
- Interface for Widget base
- tcell for Program layer
- Slice for children
- Channel-based event system
- Layout with percentage calculations

### For Python:
- Already exists (Urwid, Textual)
- Could extract Blessed's layout algorithm
- Event bubbling pattern worth adopting

---

## Files of Interest
- `lib/program.js` - Terminal abstraction (501 lines)
- `lib/widget.js` - Base widget class (61 lines)
- `lib/widgets/box.js` - Fundamental container
- `lib/widgets/form.js` - Form input handling
- `lib/widgets/list.js` - List widget
- `lib/widgets/layout.js` - Layout engine
- `lib/colors.js` - Color handling
- `lib/tput.js` - Terminfo parser
- `lib/unicode.js` - Unicode width handling

---

## Lessons for TUI Development
1. **Widget tree + DOM pattern** is more intuitive than ncurses windows
2. **Box model** (padding/margin/border) essential for complex layouts
3. **Event bubbling** enables clean separation of concerns
4. **Damage buffer** critical for 60fps rendering
5. **BCE (back-color-erase)** reduces escape sequences significantly
6. **Smart cursor** minimizes movement overhead
7. **Terminfo parsing** enables true cross-terminal compatibility
8. **Percentage-based layouts** enable responsive TUIs
9. **35+ pre-built widgets** accelerate development
10. **True color with fallback** provides best experience on all terminals

---

## Unique Innovations in Blessed

1. **CSR (Change Scroll Region)** - Optimizes scrolling by telling terminal which region to scroll
2. **Painter's Algorithm** - Widgets rendered front-to-back with z-ordering
3. **BCE (Back Color Erase)** - Uses terminal's background color erase attribute
4. **Smart Cursor** - Calculates optimal cursor path to minimize escape sequences
5. **Terminfo in JS** - Complete terminfo/termcap implementation in pure JavaScript
6. **Padding/Margin** - First TUI to implement CSS-style box model
7. **Percentage Layouts** - Responsive TUI design before it was common

---

## Comparison to Other Frameworks

| Feature | Blessed | Urwid | Textual | ncurses |
|---------|---------|-------|---------|---------|
| Widget Count | 35+ | ~15 | ~25 | 0 (raw) |
| Box Model | ✅ | ❌ | ✅ | ❌ |
| Event Bubbling | ✅ | Partial | ✅ | ❌ |
| Damage Buffer | ✅ | ✅ | ✅ | Manual |
| True Color | ✅ | ✅ | ✅ | Manual |
| Percentage Layout | ✅ | ❌ | ✅ | ❌ |
| Padding/Margin | ✅ | ❌ | ✅ | ❌ |
| Language | JS | Python | Python | C |

**Blessed leads in:** Widget variety, box model, percentage layouts, padding/margin

---

## Key Takeaway

Blessed's genius is treating the terminal like a **browser**:
- Widget tree = DOM
- Box model = CSS layout
- Event bubbling = DOM events
- Damage buffer = React virtual DOM (before React existed)

This mental model makes TUI development accessible to web developers and produces more maintainable code than ncurses-style imperative APIs.