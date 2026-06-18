# Textual Terminal Primitives Report

## Overview
Textual is a modern Python TUI framework that builds cross-platform user interfaces with a simple API. It can run in the terminal OR a web browser. Key innovation: **CSS-style declarative styling** + **reactive state management** for TUIs.

**Scale:** app.py (5040 lines), widget.py (4956 lines), 20+ CSS modules, 30+ widgets

## Root Primitives

### 1. App Lifecycle & Event Loop
**Location:** `src/textual/app.py` (5040 lines)

**Core Class:** `App[ReturnType]`

**Features:**
- Async-first (asyncio)
- Runs in terminal OR browser (same code)
- Headless mode for testing
- Built-in devtools (inspector, log panel)
- Screen stack management (multiple screens)
- Action system (command binding)

**Pattern:**
```python
from textual.app import App
from textual.widgets import Static

class MyApp(App):
    def compose(self):
        yield Static("Hello World")
    
    def on_mount(self):
        self.title = "My App"
        self.sub_title = "Running"

app = MyApp()
result = app.run()  # Returns ReturnType
```

### 2. Reactive State System
**Location:** `src/textual/reactive.py` (not checked but core feature)

**Pattern:**
```python
class MyWidget(Widget):
    # Declare reactive attributes
    value = reactive(0)
    enabled = reactive(True)
    
    # Watchers automatically called when value changes
    def watch_value(self, old: int, new: int):
        self.update_display()
    
    # Validate before setting
    def validate_value(self, value: int) -> int:
        if value < 0:
            raise ValueError("Value must be positive")
        return value
```

**Features:**
- Automatic re-rendering when state changes
- Computed properties (like Vue/React)
- Validators
- Type coercion

### 3. CSS Styling System
**Location:** `src/textual/css/` (20 modules)

**CSS Modules:**
- `styles.py` - Style definitions
- `stylesheet.py` - CSS parser and cascade
- `parse.py` - CSS syntax parser
- `match.py` - Selector matching
- `scalar.py` - CSS scalar values (%, vw, vh, em)
- `scalar_animation.py` - Animated transitions
- `transition.py` - Transition definitions
- `tokenize.py` - CSS lexer
- `_style_properties.py` - Style property descriptors

**Supported CSS Properties:**
```css
MyWidget {
    /* Layout */
    layout: grid;
    grid-size: 2 3;
    grid-columns: 1fr 2fr;
    grid-rows: auto 1fr;
    
    /* Box model */
    width: 50%;
    height: 100%;
    margin: 1 2;
    padding: 1;
    border: solid blue;
    
    /* Positioning */
    position: absolute;
    top: 10;
    left: 20;
    
    /* Typography */
    color: white;
    background: darkblue;
    text-style: bold italic;
    
    /* Visual */
    opacity: 0.8;
    layer: foreground;
    overflow: hidden auto;
    
    /* Animation */
    transition: background 0.5s;
}
```

### 4. Widget System
**Location:** `src/textual/widget.py` (4956 lines)

**Base Class:** `Widget`

**Features:**
- Component-based composition
- Lifecycle hooks (`on_mount`, `on_unmount`, `on_resize`)
- Message passing (event system)
- Query system (CSS-like selectors)
- DOM manipulation

**Pattern:**
```python
class MyWidget(Widget):
    def compose(self) -> ComposeResult:
        # Declare child widgets
        yield Header()
        yield Button("Click me", id="my-button")
        yield Footer()
    
    def on_button_pressed(self, event: Button.Pressed):
        # Handle button press
        self.query_one("#my-button").label = "Clicked!"
```

**Built-in Widgets (30+):**
- Basic: `Static`, `Label`, `Button`, `Link`
- Forms: `Input`, `Checkbox`, `Select`, `OptionList`, `RadioBox`, `MaskedInput`
- Containers: `Container`, `Grid`, `Horizontal`, `Vertical`, `ScrollableContainer`
- Display: `DataTable`, `DirectoryTree`, `ListView`, `ListItem`, `Placeholder`
- Markdown: `Markdown`, `MarkdownViewer`
- Utility: `Header`, `Footer`, `LoadingIndicator`, `Log`, `HelpPanel`, `KeyPanel`
- Advanced: `Collapsible`, `ContentSwitcher`, `Digits` (big numbers)

### 5. Message/Event System
**Pattern:**
```python
# Define custom message
class MyWidget:
    class Changed(Message):
        def __init__(self, value: str):
            super().__init__()
            self.value = value
    
# Post message
self.post_message(self.Changed("new value"))

# Handle message
def on_changed(self, event: MyWidget.Changed):
    print(f"Value changed to: {event.value}")
```

**Features:**
- Typed messages (dataclasses)
- Message bubbling
- Async handlers
- Message filtering
- Priority queues

### 6. Action System
**Pattern:**
```python
class MyApp(App):
    BINDINGS = [
        ("q", "quit", "Quit"),
        Binding("d", "toggle_dark", "Toggle Dark Mode"),
        Binding("ctrl+s", "save", "Save", show=False),
    ]
    
    def action_quit(self):
        self.exit()
    
    def action_toggle_dark(self):
        self.theme = "dark" if self.theme == "light" else "light"
    
    def action_save(self):
        self.notify("Saved!")
```

**Features:**
- Key binding shorthand
- Action methods (prefix: `action_`)
- Namespaces (`app.action_save`)
- Composable actions

### 7. Devtools
**Location:** `src/textual/devtools/`

**Features:**
- Live inspector (widget tree, styles, state)
- Log panel (structured logging)
- Hot reload (CSS, layout changes)
- Performance profiler

**Usage:**
```python
# Run with devtools
app.run(headless=False, inline=False)

# In app, open inspector with F12
# Logs appear in devtools panel
self.log("Debug info:", some_data)
```

### 8. Screen System
**Pattern:**
```python
class LoginScreen(Screen):
    def compose(self):
        yield Input(placeholder="Username")
        yield Input(placeholder="Password")
        yield Button("Login")

class MainScreen(Screen):
    def compose(self):
        yield Header()
        yield Content()
        yield Footer()

# Switch screens
self.push_screen("login")  # By name
self.push_screen(MainScreen())  # By instance
self.pop_screen()  # Go back
```

**Features:**
- Screen stack (push/pop navigation)
- Screen-specific bindings
- Per-screen state
- Transitions between screens

### 9. Animation System
**Pattern:**
```python
# Animate style changes
self.styles.opacity = 0.5
self.animate("styles.opacity", 1.0, duration=0.5)

# Animate custom attribute
self.animate("scroll_y", target_value, duration=1.0)
```

**Features:**
- Easing functions (ease-in, ease-out, etc.)
- Callbacks on complete
- Parallel animations
- Cancel support

### 10. ComposeResult / Declarative UI
**Pattern:**
```python
def compose(self) -> ComposeResult:
    # Generator-based widget declaration
    with Horizontal():
        yield Button("Left")
        with Vertical(id="center"):
            yield Static("Centered content")
        yield Button("Right")
    
    # Conditional rendering
    if self.show_details:
        yield DetailsPanel()
```

**Features:**
- Python generators (yield widgets)
- Context managers for containers
- Conditional rendering
- Dynamic widget trees

---

## CSS Property Reference (Partial)

### Layout
| Property | Values | Description |
|----------|--------|-------------|
| `layout` | `vertical`, `horizontal`, `grid`, `none` | Layout algorithm |
| `grid-size` | `<int> <int>` | Columns × rows |
| `grid-columns` | `1fr 2fr auto ...` | Column widths |
| `grid-rows` | `1fr auto ...` | Row heights |
| `grid-gutter` | `<scalar>` | Space between cells |

### Box Model
| Property | Values | Description |
|----------|--------|-------------|
| `width` | `<scalar>` | Widget width (%, vw, cells) |
| `height` | `<scalar>` | Widget height |
| `margin` | `<scalar>{1,4}` | Outside spacing |
| `padding` | `<scalar>{1,4}` | Inside spacing |
| `border` | `<style> <color>` | Border style and color |

### Typography
| Property | Values | Description |
|----------|--------|-------------|
| `color` | `<color>` | Text foreground |
| `background` | `<color>` | Text background |
| `text-style` | `bold`, `italic`, `underline` | Text formatting |

### Visual
| Property | Values | Description |
|----------|--------|-------------|
| `opacity` | `0.0-1.0` | Transparency |
| `layer` | `<name>` | Z-order layer |
| `overflow` | `hidden`, `scroll`, `auto` | Content overflow |

### Animation
| Property | Values | Description |
|----------|--------|-------------|
| `transition` | `<property> <duration>` | Animated style changes |
| `animation` | `<name> <duration>` | Keyframe animation |

---

## Reusable Patterns

### 1. Reactive State with Watchers
```python
value = reactive(0)
computed_value = reactive(lambda: value * 2)

def watch_value(self, old, new):
    # Auto-called on change
    self.refresh()
```

### 2. CSS-in-Python (or external .tcss files)
```python
# Inline
widget.styles.width = Scalar(50, Unit.PERCENT)

# External file (app.tcss)
"""
MyWidget {
    width: 50%;
    background: darkblue;
}
"""
```

### 3. Message-Based Communication
```python
# Child posts message
self.post_message(Table.RowSelected(row_id=123))

# Parent handles
def on_table_row_selected(self, event: Table.RowSelected):
    self.load_details(event.row_id)
```

### 4. Action Bindings
```python
BINDINGS = [
    ("ctrl+q", "app.quit", "Quit"),
    Binding("d", "toggle_dark", "Theme", priority=True),
]
```

### 5. Screen Stack Navigation
```python
self.push_screen("settings")
# ... user interacts ...
self.pop_screen(result)  # Return value to parent
```

### 6. Animation with Easing
```python
self.animate(
    "opacity",
    target=1.0,
    duration=0.5,
    easing="in_out_cubic",
    on_complete=self.on_fade_complete
)
```

---

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Reactive State | 5/5 | High | Vue/React patterns well-known |
| CSS Styling | 5/5 | Universal | CSS widely understood |
| Message System | 5/5 | Universal | Event-driven standard |
| Screen Stack | 4/5 | High | Mobile nav pattern |
| Devtools | 4/5 | High | Browser devtools precedent |
| Action Bindings | 5/5 | Universal | Vim/Emacs precedent |
| Animation | 4/5 | High | CSS animation model |
| ComposeResult | 4/5 | High | JSX-like in other langs |
| Layout Engine | 3/5 | Medium | Complex implementation |

---

## Implementation Recommendations

### For Rust:
- `reactive` crate for state management
- CSS parser (existing Rust CSS crates)
- Tokio for async runtime
- Custom derive macros for reactive attributes

### For Go:
- Channels for message passing
- Struct tags for reactive hints
- CSS parser (go-css exists)
- Goroutines for animations

### For JavaScript/TypeScript:
- Already similar to React/Vue
- Could use existing reactive frameworks
- CSSOM for styling
- WebSocket for browser + terminal sync

---

## Files of Interest
- `src/textual/app.py` (5040 lines) - App lifecycle
- `src/textual/widget.py` (4956 lines) - Widget base class
- `src/textual/css/styles.py` - Style definitions
- `src/textual/css/stylesheet.py` - CSS cascade
- `src/textual/css/parse.py` - CSS parser
- `src/textual/css/scalar.py` - Scalar values
- `src/textual/css/scalar_animation.py` - Animations
- `src/textual/widgets/*` - 30+ widget implementations
- `src/textual/message.py` - Message base class
- `src/textual/reactive.py` - Reactive attributes

---

## Lessons for TUI Development
1. **CSS styling** makes TUIs accessible to web developers
2. **Reactive state** eliminates manual re-rendering logic
3. **Devtools** are essential for debugging complex TUIs
4. **Screen stack** enables multi-view apps naturally
5. **Message passing** decouples widget communication
6. **Action bindings** provide consistent keyboard UX
7. **Dual-mode (terminal + browser)** expands deployment options
8. **Type-safe messages** catch bugs early
9. **Animation system** adds polish with minimal code
10. **Generator-based compose** is more Pythonic than JSX

---

## Unique Innovations in Textual

1. **Terminal + Browser from same code** - Render abstraction is complete
2. **CSS cascade for TUIs** - First to fully implement CSS in terminal
3. **Reactive.watchers** - Automatic re-render on state change
4. **Built-in devtools** - Inspector, profiler, log panel
5. **Screen stack** - Mobile-style navigation in TUI
6. **Typed messages** - Dataclass-based event system
7. **Hot reload CSS** - See style changes instantly
8. **Async-first** - Native asyncio integration
9. **Scalar system** - CSS-like values (%, vw, em, cells)
10. **Layer system** - True z-ordering with named layers

---

## Key Takeaway

Textual brings **2024 web development patterns** to terminal UIs:
- Reactive state (Vue/React)
- CSS styling (web standard)
- Devtools (browser-inspired)
- Component architecture (modern frontend)
- Async/await (modern Python)

This makes TUI development feel like modern web development, just running in a terminal.