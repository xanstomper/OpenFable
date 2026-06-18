# Anthology: Widget Architecture

> **Subject:** Widget Architecture - building reusable, composable UI components for TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Widget Architecture Mastery

### 9.1 The Widget Trait

```rust
pub trait Widget {
    fn id(&self) -> WidgetId;
    fn render(&self, fb: &mut Framebuffer);
    fn layout(&self, constraints: Constraints) -> LayoutResult;
    fn handle_event(&mut self, event: Event) -> Vec<Action>;
    fn min_size(&self) -> Size;
    fn preferred_size(&self) -> Size;
    fn is_focusable(&self) -> bool;
    fn focus(&mut self);
    fn blur(&mut self);
}

pub struct WidgetId(pub u64);

pub struct Size {
    pub width: usize,
    pub height: usize,
}

pub struct Constraints {
    pub min_width: usize,
    pub max_width: usize,
    pub min_height: usize,
    pub max_height: usize,
}

pub struct LayoutResult {
    pub rect: Rect,
    pub overflow: bool,
}

#[derive(Clone, Copy)]
pub struct Rect {
    pub x: usize,
    pub y: usize,
    pub width: usize,
    pub height: usize,
}

pub enum Action {
    Focus(WidgetId),
    Blur,
    SetText(String),
    Command(Command),
    Scroll(ScrollDelta),
    Close,
    None,
}
```

### 9.2 Container Widgets

```rust
pub struct Container {
    pub child: Box<dyn Widget>,
    pub padding: Spacing,
    pub border: BorderStyle,
    pub margin: Spacing,
    pub background: Option<Color>,
}

impl Widget for Container {
    fn render(&self, fb: &mut Framebuffer) {
        let rect = self.rect();

        // Draw background
        if let Some(bg) = self.background {
            fb.fill_rect(rect, bg);
        }

        // Draw border
        self.border.render(fb, rect);

        // Render child inside padded area
        let child_rect = Rect::new(
            rect.x + self.padding.left + self.border.width(),
            rect.y + self.padding.top + self.border.width(),
            rect.width - self.padding.left - self.padding.right - self.border.width() * 2,
            rect.height - self.padding.top - self.padding.bottom - self.border.height() * 2,
        );

        self.child.render_at(child_rect, fb);
    }

    fn layout(&self, constraints: Constraints) -> LayoutResult {
        let child_constraints = Constraints {
            min_width: constraints.min_width.saturating_sub(
                self.padding.left + self.padding.right + self.border.width() * 2
            ),
            max_width: constraints.max_width.saturating_sub(
                self.padding.left + self.padding.right + self.border.width() * 2
            ),
            min_height: constraints.min_height.saturating_sub(
                self.padding.top + self.padding.bottom + self.border.height() * 2
            ),
            max_height: constraints.max_height.saturating_sub(
                self.padding.top + self.padding.bottom + self.border.height() * 2
            ),
        };

        let child_result = self.child.layout(child_constraints);

        LayoutResult {
            rect: Rect::new(
                self.rect.x,
                self.rect.y,
                child_result.rect.width + self.padding.left + self.padding.right + self.border.width() * 2,
                child_result.rect.height + self.padding.top + self.padding.bottom + self.border.height() * 2,
            ),
            overflow: child_result.overflow,
        }
    }
}

pub struct Stack {
    pub children: Vec<Box<dyn Widget>>,
    pub layout: StackLayout,
}

pub enum StackLayout {
    Vertical,
    Horizontal,
    Overlay,
}

impl Widget for Stack {
    fn layout(&self, constraints: Constraints) -> LayoutResult {
        match self.layout {
            StackLayout::Vertical => self.layout_vertical(constraints),
            StackLayout::Horizontal => self.layout_horizontal(constraints),
            StackLayout::Overlay => self.layout_overlay(constraints),
        }
    }
}

pub struct Flex {
    pub direction: FlexDirection,
    pub children: Vec<FlexChild>,
    pub gap: usize,
    pub alignment: FlexAlign,
}

pub struct FlexChild {
    pub widget: Box<dyn Widget>,
    pub grow: f32,
    pub shrink: f32,
    pub basis: usize,
}

impl Widget for Flex {
    fn layout(&self, constraints: Constraints) -> LayoutResult {
        let mut total_basis = 0;
        let mut total_grow = 0.0;

        for child in &self.children {
            total_basis += child.basis;
            total_grow += child.grow;
        }

        // Calculate available space after gaps
        let total_gap = self.gap * (self.children.len() - 1);
        let available = constraints.max_width.saturating_sub(total_gap);

        let remaining = available.saturating_sub(total_basis);

        let mut current_pos = 0;
        let mut max_height = 0;
        let mut child_rects = Vec::new();

        for child in &self.children {
            let child_width = if total_grow > 0.0 {
                child.basis + ((remaining as f32 * child.grow / total_grow) as usize)
            } else {
                child.basis
            };

            let child_height = child.widget.preferred_size().height;

            let child_rect = Rect::new(current_pos, 0, child_width, child_height);
            child_rects.push(child_rect);

            current_pos += child_width + self.gap;
            max_height = max_height.max(child_height);
        }

        LayoutResult {
            rect: Rect::new(
                self.rect.x,
                self.rect.y,
                current_pos.saturating_sub(self.gap),
                max_height,
            ),
            overflow: false,
        }
    }
}
```

### 9.3 Primitive Widgets

```rust
pub struct Text {
    pub content: String,
    pub style: Style,
    pub wrap: bool,
    pub max_width: Option<usize>,
    pub align: TextAlign,
}

impl Widget for Text {
    fn render(&self, fb: &mut Framebuffer) {
        let lines = if self.wrap {
            wrap_text(&self.content, self.max_width.unwrap_or(fb.width))
        } else {
            vec![self.content.clone()]
        };

        for (i, line) in lines.iter().enumerate() {
            if i >= fb.height {
                break;
            }
            fb.write_text(0, i, line, &self.style);
        }
    }
}

pub struct Button {
    pub label: String,
    pub style: ButtonStyle,
    pub is_hovered: bool,
    pub is_pressed: bool,
    pub is_disabled: bool,
}

impl Widget for Button {
    fn render(&self, fb: &mut Framebuffer) {
        let prefix = if self.is_pressed { "▼" } else if self.is_hovered { "▶" } else { " " };
        let suffix = if self.is_pressed { "▲" } else if self.is_hovered { "◀" } else { " " };

        let text = format!("{} {} {}", prefix, self.label, suffix);

        let style = if self.is_disabled {
            Style::dim(&Color::GRAY)
        } else if self.is_pressed {
            Style::reverse(&self.style.pressed)
        } else if self.is_hovered {
            self.style.hover.clone()
        } else {
            self.style.normal.clone()
        };

        fb.write_centered(self.rect.y, self.rect.height / 2, &text, &style);
    }
}

pub struct Input {
    pub value: String,
    pub cursor_pos: usize,
    pub placeholder: String,
    pub style: InputStyle,
    pub max_length: Option<usize>,
    pub password: bool,
}

impl Widget for Input {
    fn handle_event(&mut self, event: Event) -> Vec<Action> {
        match event {
            Event::Key(Key::Char(c)) if self.cursor_pos < self.value.len() || self.max_length.map_or(true, |m| self.value.len() < m) => {
                self.value.insert(self.cursor_pos, c);
                self.cursor_pos += 1;
                vec![Action::SetText(self.value.clone())]
            }
            Event::Key(Key::Backspace) if self.cursor_pos > 0 => {
                self.value.remove(self.cursor_pos - 1);
                self.cursor_pos -= 1;
                vec![Action::SetText(self.value.clone())]
            }
            Event::Key(Key::Left) if self.cursor_pos > 0 => {
                self.cursor_pos -= 1;
                vec![]
            }
            Event::Key(Key::Right) if self.cursor_pos < self.value.len() => {
                self.cursor_pos += 1;
                vec![]
            }
            _ => vec![],
        }
    }

    fn render(&self, fb: &mut Framebuffer) {
        let display_value = if self.password {
            "•".repeat(self.value.len())
        } else {
            self.value.clone()
        };

        let text = if display_value.is_empty() {
            self.placeholder.clone()
        } else {
            display_value
        };

        let style = if self.has_focus {
            self.style.focused.clone()
        } else {
            self.style.normal.clone()
        };

        fb.write_text(self.rect.x, self.rect.y, &text, &style);

        // Draw cursor
        if self.has_focus {
            fb.set_cursor_pos(
                self.rect.x + measure_width(&text[..self.cursor_pos]),
                self.rect.y,
            );
        }
    }
}

pub struct List {
    pub items: Vec<String>,
    pub selected: Option<usize>,
    pub style: ListStyle,
    pub scroll: ScrollState,
}

impl Widget for List {
    fn render(&self, fb: &mut Framebuffer) {
        let start = self.scroll.scroll_y;
        let end = (start + self.rect.height).min(self.items.len());

        for (i, item) in self.items[start..end].iter().enumerate() {
            let is_selected = self.selected == Some(start + i);
            let style = if is_selected {
                &self.style.selected
            } else {
                &self.style.normal
            };

            let prefix = if is_selected { "▶ " } else { "  " };
            let text = format!("{}{}", prefix, item);

            fb.write_text(self.rect.x, self.rect.y + i, &text, style);
        }
    }

    fn handle_event(&mut self, event: Event) -> Vec<Action> {
        match event {
            Event::Key(Key::Down) | Event::Key(Key::Char('j')) => {
                self.select_next();
                vec![]
            }
            Event::Key(Key::Up) | Event::Key(Key::Char('k')) => {
                self.select_previous();
                vec![]
            }
            Event::Scroll(delta) => {
                self.scroll_by(delta);
                vec![]
            }
            Event::Key(Key::Enter) => {
                if let Some(idx) = self.selected {
                    vec![Action::Command(Command::Select(idx))]
                } else {
                    vec![]
                }
            }
            _ => vec![],
        }
    }
}
```

### 9.4 Widget Lifecycle

```rust
pub enum WidgetLifecycleEvent {
    Mount(Context),
    Update(StateDelta),
    Unmount,
    Focus,
    Blur,
    Resize(Rect),
    StyleChange(Style),
}

pub struct LifecycleHandler {
    pub widget: Box<dyn Widget>,
    pub state: WidgetState,
    pub children: Vec<Box<dyn Widget>>,
}

impl LifecycleHandler {
    pub fn mount(&mut self, context: Context) {
        self.widget.handle_event(WidgetLifecycleEvent::Mount(context));
        self.mount_children(context);
    }

    pub fn unmount(&mut self) {
        self.unmount_children();
        self.widget.handle_event(WidgetLifecycleEvent::Unmount);
    }

    pub fn update(&mut self, delta: StateDelta) {
        self.widget.handle_event(WidgetLifecycleEvent::Update(delta));
        self.update_children(delta);
    }
}
```

### 9.5 Composition Patterns

```rust
// Builder pattern for complex widgets
let complex_widget = Stack::vertical()
    .with_margin(1)
    .with_border(BorderStyle::Rounded)
    .with_child(
        Text::new("Title")
            .style(Style::bold().fg(Color::CYAN))
            .build()
    )
    .with_child(
        Flex::horizontal()
            .with_gap(1)
            .with_child(Button::new("OK").build())
            .with_child(Button::new("Cancel").build())
            .build()
    )
    .with_child(
        Input::new("Enter text...")
            .max_length(50)
            .build()
    )
    .build();

// Decorator pattern
let decorated = WithBorder::new(
    WithShadow::new(
        WithFocus::new(
            base_widget
        ),
        ShadowStyle::drop(),
    ),
    BorderStyle::rounded(),
);
```

### 9.6 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| God widget | One widget does everything | Split into primitives |
| Leaky abstractions | Child knows parent's internals | Use traits, not concrete types |
| Infinite re-render | Event loop triggers itself | Break event chains |
| No focus management | Tab order broken | Implement FocusManager |
| Tight coupling | Hard to test | Use Context trait |

---

# PART 2: NOVEL CONCEPTS REPORT

## Widget Architecture: Untapped Opportunities

### Concept 1: Self-Assembling Widget Graphs

**Idea:** Widgets that **automatically arrange** based on semantic relationships.

```rust
pub struct SemanticGraph {
    nodes: HashMap<WidgetId, SemanticNode>,
    edges: Vec<SemanticEdge>,
}

pub struct SemanticNode {
    pub widget: Box<dyn Widget>,
    pub category: WidgetCategory,
    pub importance: f32,
    pub relationships: Vec<WidgetId>,
}

pub enum WidgetCategory {
    Primary,    // Main content
    Secondary,  // Supporting content
    Tertiary,   // Metadata
    Decorative, // Visual flair
}

impl SemanticGraph {
    pub fn auto_layout(&self) -> LayoutResult {
        // Group by category
        let mut by_category = HashMap::new();
        for (id, node) in &self.nodes {
            by_category.entry(node.category).or_insert_with(Vec::new).push(*id);
        }

        // Primary widgets get largest space
        // Secondary widgets get medium space
        // Tertiary widgets get small space or hidden
        // Decorative widgets get minimal space

        let primary_rect = Rect::new(0, 0, 80, 20);
        let secondary_rect = Rect::new(0, 20, 80, 4);
        let tertiary_rect = Rect::new(0, 24, 80, 2);

        // Auto-layout within each category
        LayoutResult { /* ... */ }
    }
}
```

**Novel because:** TUIs require explicit layout instructions. Semantic auto-layout = less boilerplate.

**Complexity:** High
**Value:** Medium (smarter defaults, but less control)

---

### Concept 2: Context-Aware Widget Adaptation

**Idea:** Widgets that **morph appearance/behavior** based on usage context.

```rust
pub struct ContextAwareWidget {
    inner: Box<dyn Widget>,
    context_detector: Box<dyn ContextDetector>,
    variants: HashMap<ContextType, Box<dyn Widget>>,
}

pub enum ContextType {
    Editing,        // User is typing
    Browsing,       // User is reading
    Debugging,      // Expert mode
    Presentation,   // Screen sharing
    Accessibility,  // Screen reader mode
}

impl ContextAwareWidget {
    pub fn update(&mut self, context: Context) {
        let detected = self.context_detector.detect(context);
        if let Some(variant) = self.variants.get(&detected) {
            self.inner = variant.clone();
        }
    }
}
```

**Novel because:** TUIs are static. Context-aware adaptation = right UI for right situation.

**Complexity:** High
**Value:** Medium-High (excellent UX with accessibility features)

---

**End of Widget Architecture Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Widget Taxonomies and Inheritance Hierarchies (Blessed, Textual, Urwid, ObjCurses)

Four frameworks converge on a base `Widget` trait/class with `render()`, `layout()`, and `handle_event()`/`handleInput()` methods, but diverge in composition strategy:

**Blessed** (JS): 35+ widget catalog — `box`, `text`, `line`, `button`, `checkbox`, `input`, `textbox`, `textarea`, `form`, `radiobutton`, `radioset`, `prompt`, `question`, `list`, `listbar`, `listtable`, `filemanager`, `progressbar`, `log`, `message`, `loading`, `ansiimage`, `image`, `video`, `layout`, `screen`, `scrollablebox`, `scrollabletext`, `table`, `terminal`, `overlayimage`. Inheritance: `Node (EventEmitter) → Element → Box → {Text, Button, Input, List, Form} → Screen`. Every widget inherits from `EventEmitter` — the entire tree is event-capable.

**Textual** (Python): 30+ typed widgets — `Static`, `Label`, `Button`, `Link`, `Input`, `Checkbox`, `Select`, `OptionList`, `RadioBox`, `MaskedInput`, `Container`, `Grid`, `Horizontal`, `Vertical`, `ScrollableContainer`, `DataTable`, `DirectoryTree`, `ListView`, `ListItem`, `Placeholder`, `Markdown`, `MarkdownViewer`, `Header`, `Footer`, `LoadingIndicator`, `Log`, `HelpPanel`, `KeyPanel`, `Collapsible`, `ContentSwitcher`, `Digits`. Uses `compose()` generator pattern instead of constructor injection. CSS selectors for widget query (`self.query_one("#my-button")`).

**Urwid** (Python): ~20 widget types with a unique **Canvas** rendering abstraction. Every widget's `render(size, focus)` returns a `Canvas` object (not raw text). Canvas types: `TextCanvas`, `SolidCanvas`, `CompositeCanvas`, `CanvasCombine`, `CacheCanvas`. Sizing modes: `FLOW` (width-constrained, auto-height), `BOX` (fixed w+h), `FIXED` (intrinsic). Container widgets: `Columns` (horizontal), `Pile` (vertical/flexbox), `GridFlow`, `Overlay`, `Frame`.

**ObjCurses** (Objective-C++): Classic OO wrapping of ncurses. `Widget : Entity` base with `x, y, width, height`, `parent`, `children`, `visible`, `focused`. Derived: `Label`, `Button`, `TextField`, `ListBox`, `Menu`, `Dialog`. Event dispatch via tree traversal — `handleInput(key)` walks children until focused widget accepts. Render via `renderAll()` recursive descent. RAII lifecycle: constructor allocates ncurses resources, destructor frees.

**Key design decision — event bubbling vs. message posting:**
- Blessed: DOM-style bubbling (child → parent → root)
- Textual: typed message posting (`self.post_message(...)`) with bubbling, filtering, priority queues
- Urwid: signal system (`__signals__ = ['clicked']`, `urwid.connect_signal()`) with weak references and auto-cleanup
- ObjCurses: direct dispatch to focused widget via tree walk

## 3.2 Render Contracts and Damage Ownership (Urwid, Textual, Blessed, Rich)

Every mature framework converges on the same widget contract:

| Framework | Render Signature | Output | Dirty Tracking |
|-----------|-----------------|--------|----------------|
| Urwid | `render(size, focus) → Canvas` | Canvas object | Content validity per canvas |
| Textual | `render() → Renderables` | Segments | Reactive watchers |
| Blessed | `render()` writes to back buffer | Double-buffered cells | Per-widget dirty flag |
| Rich | `__rich_console__(console, options) → Iterator[Segment]` | Segment stream | None (stateless) |

**Rich's `RenderableType` protocol** is the minimal contract: any class implementing `__rich_console__(self, console, options)` yielding `Segment(text, style)` can be printed by `Console`. This is a trait/interface — no inheritance required. The `Segment` is the atomic unit of rendering: `(text: str, style: Style)`. Styles compile to ANSI once and cache.

**Urwid's Canvas** adds content validation — canvases expire when the widget marks itself dirty, enabling `CacheCanvas` memoization. The canvas carries cursor position and attribute encoding inline.

**Blessed's damage buffer** compares front and back buffers cell-by-cell, building minimal escape sequences for changed cells. Algorithm: render dirty widgets → diff buffers → output minimal escapes → swap. BCE (back-color-erase) reduces escape sequences by using the terminal's background color erase attribute.

**Rules extracted from all four:**
1. A widget should not render outside its allocated rect without clipping
2. `render()` must be side-effect-free — no mutation of parent/sibling state
3. A widget owns its own dirty state, not its parent
4. A child must never know its parent's app name or global state
5. Prefer `Box<dyn Widget>` / interface parameters over concrete types in delegate APIs

## 3.3 Layout Composition Patterns (Urwid, Blessed, Textual, Bracket-Lib)

**Urwid's container weighting** predates CSS flexbox. `Columns` accepts `('fixed', 20, widget)`, `widget` (weight), `('pack', widget)`. `Pile` uses `('fixed', 3, header)`, `body_widget` (fills remaining), `('fixed', 1, footer)`. `GridFlow` auto-wraps. `Overlay` provides absolute positioning (z-layered). `Frame` gives header/body/footer regions.

**Blessed's box model** is the first CSS-style layout in a TUI: `width: '50%' | 'half' | 100`, `height: '100%' | 'fill'`, `left: 'center' | '10%'`, `padding: { top: 1, right: 2, bottom: 1, left: 2 }`, `margin: 'auto' | 2`. Position types: absolute, relative, centered. Size types: fixed, percentage, auto. Nested layouts supported.

**Textual's CSS layout engine** supports `layout: grid`, `grid-size: 2 3`, `grid-columns: 1fr 2fr`, `grid-rows: auto 1fr`, `grid-gutter: 1`. Also `layout: vertical`, `layout: horizontal`, `layout: none`. CSS properties: `width`, `height`, `margin`, `padding`, `border`, `position: absolute`, `top`, `left`, `opacity`, `layer` (z-order), `overflow: hidden scroll auto`, `transition: background 0.5s`.

**Bracket-Lib** (Rust) uses a modular crate architecture — each subsystem is a separate crate (`bracket-terminal`, `bracket-color`, `bracket-geometry`, `bracket-noise`, `bracket-pathfinding`, `bracket-random`). Console types: `VirtualConsole` (double-buffer), `DrawBatch` (batched rendering), `SparseConsole` (memory-efficient with bg layers), `SpriteConsole` (z-ordered sprites), `FlexibleConsole` (resizable), `SimpleConsole` (basic cell buffer). Backend abstraction via `BTermPlatform` trait — supports OpenGL, WebGPU, Crossterm, Curses. The `GameState` trait (`fn tick(&mut self, ctx: &mut BTerm)`) is a widget-free alternative: imperative rendering without a widget tree.

## 3.4 Focus Management and Event Dispatch (ObjCurses, Urwid, Textual, Blessed)

**ObjCurses** implements the canonical focus-and-dispatch loop:
```cpp
void Widget::handleInput(int key) {
    if (focused) { onKeyPress(key); return; }
    for (auto child : children) {
        if (child->focused) { child->handleInput(key); return; }
    }
}
void Widget::setFocus(bool f) {
    if (parent && f) parent->focusChild(this);
    focused = f;
    onFocusChanged(f);
}
```
Render via recursive descent: `renderAll()` calls `render()` then iterates children. Parent-child ownership simplifies cleanup.

**Urwid** supports 7 event loops (Select, GLib, Twisted, Asyncio, Tornado, Trio, ZeroMQ) via pluggable `EventLoop` interface. Focus flows through container widgets — `Columns`, `Pile`, and `Frame` track which child is focused and route keypresses accordingly.

**Textual** uses an action system (`BINDINGS = [("q", "quit", "Quit")]`) with `action_` prefix methods, namespaces (`app.action_save`), and priority bindings. Messages are typed dataclasses that bubble up the widget tree. Async handlers supported natively.

**Blessed** uses EventEmitter — `button.on('select', fn)`, `form.on('keypress', fn)`. Events bubble: child fires first, then parent, then screen root. Keyboard mapping via termcap-style key names (`key.name === 'escape'`).

## 3.5 Widget Communication Patterns (Urwid, Textual, Rich, ObjCurses)

| Pattern | Framework | Mechanism | Coupling |
|---------|-----------|-----------|----------|
| Signals | Urwid | `__signals__` + `connect_signal()` with weakref | Loose |
| Messages | Textual | `post_message(Changed(value))` + `on_changed()` | Loose |
| Events | Blessed | `on('select', fn)` bubbling | Medium |
| Renderable Protocol | Rich | `__rich_console__()` → `Segment` iterator | Minimal |
| Direct dispatch | ObjCurses | `handleInput(key)` tree walk | Tight |

**Urwid's signal system** is the most decoupled: widgets declare `__signals__ = ['clicked']`, emitters call `emit_signal(self, 'clicked')`, listeners register via `urwid.connect_signal(button, 'clicked', on_click)`. Weak references prevent memory leaks. Multiple handlers per signal. Per-instance and class-level signals.

**Textual's message system** uses typed dataclasses: `class Changed(Message): value: str`. Messages bubble from child to parent. Handlers: `def on_changed(self, event: MyWidget.Changed)`. Async handlers, message filtering, and priority queues supported.

**Rich's protocol** is the loosest coupling: any object implementing `__rich_console__()` is renderable. No inheritance, no registration. The `Segment(text, style)` is the universal currency. Styles compile to ANSI once and cache. This enables composable UI elements without a widget tree.

**Anti-pattern (from ObjCurses):** Tight coupling via direct method calls and parent-child references. The `handleInput` tree walk requires every widget to know its children. This works for small hierarchies but doesn't scale. Prefer signals or messages for anything beyond ~10 widgets.

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Compound Widget: TerminalView

Canopy's `TerminalView` (485 lines, 16 KB) is a self-contained compound widget:

**Responsibilities owned:**
1. xterm.js instance lifecycle
2. `FitAddon`, `WebLinksAddon`, `SearchAddon` plugin management
3. Font-zoom state machine (cmd+plus/minus/0)
4. Claude attention-pattern scanning
5. PTY spawn coordination via Tauri invoke
6. Drag-and-drop registration
7. Tab status emission (idle, running, waiting, done-*)

**Which parents invoke:**
- `onTerminalSpawned(tabId, terminalId)` — parent needs the terminal ID for PTY ops
- `onRegisterElement(terminalId, el | null)` — parent needs the DOM element for drag-drop
- `onStatusChange(status, exitCode)` — parent propagates to tab bar for visual indicator

**Dirty-status short-circuit:**
```typescript
const emitStatus = useCallback((status, exitCode) => {
  if (currentStatusRef.current === status) return; // short-circuit
  currentStatusRef.current = status;
  onStatusChangeRef.current?.(status, exitCode);
}, []);
```

This simple guard prevents thousands of redundant React state updates for identical terminal state.

**Search bar compound pattern:** Canopy composes `TerminalView` with an internal search UI. The search bar is not a separate component — it's an inline conditional render inside `TerminalView`. This keeps search state scoped to the terminal, independent of the parent.

---
