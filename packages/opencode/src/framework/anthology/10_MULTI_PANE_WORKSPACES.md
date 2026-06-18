# Anthology: Multi-Pane Workspaces

> **Subject:** Multi-Pane Workspaces - managing complex, rich TUIs with multiple panels and views
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Multi-Pane Workspaces Mastery

### 10.1 Pane Fundamentals

```rust
pub struct Pane {
    pub id: PaneId,
    pub rect: Rect,
    pub widget: Box<dyn Widget>,
    pub title: Option<String>,
    pub border: BorderStyle,
    pub is_focused: bool,
    pub is_visible: bool,
    pub z_index: i32,
    pub min_size: Size,
    pub max_size: Option<Size>,
}

pub enum BorderStyle {
    None,
    Simple,      // ┌─┐│└─┘
    Double,      // ╔═╗║╚═╝
    Rounded,     // ┌─┐│└─┘ with curves
    Thick,       // ┏━┓┃┗━┛
    Ascii,       // +-+|++
    Custom(Border),
}

pub struct Border {
    pub top_left: char,
    pub top: char,
    pub top_right: char,
    pub left: char,
    pub right: char,
    pub bottom_left: char,
    pub bottom: char,
    pub bottom_right: char,
}
```

### 10.2 Pane Manager

```rust
pub struct PaneManager {
    panes: HashMap<PaneId, Pane>,
    layout: LayoutEngine,
    focus_stack: Vec<PaneId>,
    split_history: Vec<SplitOperation>,
    max_history: usize,
}

impl PaneManager {
    pub fn new() -> Self {
        PaneManager {
            panes: HashMap::new(),
            layout: LayoutEngine::new(),
            focus_stack: Vec::new(),
            split_history: Vec::new(),
            max_history: 50,
        }
    }

    pub fn create_pane(&mut self, widget: Box<dyn Widget>, rect: Rect) -> PaneId {
        let id = PaneId::generate();
        let pane = Pane {
            id,
            rect,
            widget,
            title: None,
            border: BorderStyle::Simple,
            is_focused: false,
            is_visible: true,
            z_index: 0,
            min_size: Size { width: 10, height: 3 },
            max_size: None,
        };
        self.panes.insert(id, pane);
        id
    }

    pub fn split_horizontal(&mut self, pane_id: PaneId, ratio: f32) -> Result<PaneId, Error> {
        let pane = self.panes.get(&pane_id).ok_or(Error::PaneNotFound)?;
        let split_width = (pane.rect.width as f32 * ratio) as usize;
        let new_rect = Rect::new(
            pane.rect.x + split_width,
            pane.rect.y,
            pane.rect.width - split_width,
            pane.rect.height,
        );
        let mut updated_pane = pane.clone();
        updated_pane.rect.width = split_width;

        self.panes.insert(pane_id, updated_pane);
        let new_id = self.create_empty_pane(new_rect);
        self.record_split(SplitOperation::Horizontal { pane_id, ratio, new_id });
        Ok(new_id)
    }

    pub fn split_vertical(&mut self, pane_id: PaneId, ratio: f32) -> Result<PaneId, Error> {
        let pane = self.panes.get(&pane_id).ok_or(Error::PaneNotFound)?;
        let split_height = (pane.rect.height as f32 * ratio) as usize;
        let new_rect = Rect::new(
            pane.rect.x,
            pane.rect.y + split_height,
            pane.rect.width,
            pane.rect.height - split_height,
        );
        let mut updated_pane = pane.clone();
        updated_pane.rect.height = split_height;

        self.panes.insert(pane_id, updated_pane);
        let new_id = self.create_empty_pane(new_rect);
        self.record_split(SplitOperation::Vertical { pane_id, ratio, new_id });
        Ok(new_id)
    }

    pub fn close_pane(&mut self, pane_id: PaneId) -> Result<(), Error> {
        if self.panes.len() <= 1 {
            return Err(Error::CannotCloseLastPane);
        }

        let pane = self.panes.remove(&pane_id).ok_or(Error::PaneNotFound)?;

        // Grow adjacent pane to fill space
        if let Some(adjacent) = self.find_adjacent_pane(&pane) {
            let adjacent = self.panes.get_mut(&adjacent).unwrap();
            adjacent.rect.width += pane.rect.width;
        }

        self.focus_stack.retain(|&id| id != pane_id);
        Ok(())
    }

    pub fn focus_pane(&mut self, pane_id: PaneId) {
        for (id, pane) in &mut self.panes {
            pane.is_focused = *id == pane_id;
        }

        if !self.focus_stack.contains(&pane_id) {
            self.focus_stack.push(pane_id);
        }
    }

    pub fn focus_next(&mut self) {
        let current = self.focus_stack.last().copied();
        let mut candidates: Vec<PaneId> = self.panes.keys().cloned().collect();

        if let Some(current) = current {
            candidates.sort_by_key(|id| self.distance_between(current, *id));
            if let Some(next) = candidates.iter().find(|&&id| id != current) {
                self.focus_pane(*next);
            }
        } else if let Some(first) = candidates.first() {
            self.focus_pane(*first);
        }
    }

    pub fn render(&self, fb: &mut Framebuffer) {
        for pane in self.panes.values() {
            if !pane.is_visible {
                continue;
            }

            // Render border
            if pane.border != BorderStyle::None {
                self.render_border(fb, pane);
            }

            // Render title
            if let Some(title) = &pane.title {
                self.render_title(fb, pane, title);
            }

            // Render widget content
            let content_rect = pane.content_rect();
            pane.widget.render_at(content_rect, fb);
        }
    }
}
```

### 10.3 Layout Strategies for Multi-Pane

```rust
pub enum LayoutStrategy {
    // Fixed number of panes in strict grid
    Grid {
        rows: usize,
        cols: usize,
    },
    // Fluid arrangement that adapts
    Flex {
        direction: FlexDirection,
    },
    // User-defined absolute positions
    Absolute,
    // Tabbed interface
    Tabbed {
        tabs: Vec<Tab>,
        active_tab: usize,
    },
    // Stacked (like iTerm2)
    Stacked {
        panes: Vec<StackedPane>,
    },
}

pub struct StackedPane {
    pub id: PaneId,
    pub tab_bar_rect: Rect,
    pub content_rect: Rect,
    pub title: String,
    pub is_active: bool,
}

impl LayoutStrategy {
    pub fn apply(&self,
                 available_rect: Rect,
                 panes: &mut HashMap<PaneId, Pane>) {
        match self {
            LayoutStrategy::Grid { rows, cols } => {
                let pane_width = available_rect.width / cols;
                let pane_height = available_rect.height / rows;

                for (i, (_, pane)) in panes.iter_mut().enumerate() {
                    let col = i % cols;
                    let row = i / cols;
                    pane.rect = Rect::new(
                        available_rect.x + col * pane_width,
                        available_rect.y + row * pane_height,
                        pane_width,
                        pane_height,
                    );
                }
            }
            LayoutStrategy::Flex { direction } => {
                self.apply_flex_layout(available_rect, panes);
            }
            LayoutStrategy::Stacked { panes: stack } => {
                for (i, sp) in stack.iter().enumerate() {
                    if let Some(pane) = panes.get_mut(&sp.id) {
                        pane.rect = sp.content_rect;
                    }
                }
            }
            _ => {}
        }
    }
}
```

### 10.4 Focus Navigation Between Panes

```rust
pub struct FocusNavigator {
    graph: HashMap<PaneId, Vec<PaneId>>,  // adjacency list
    current_focus: Option<PaneId>,
}

impl FocusNavigator {
    pub fn navigate(&mut self, direction: Direction) -> Option<PaneId> {
        if let Some(current) = self.current_focus {
            if let Some(neighbors) = self.graph.get(&current) {
                for &neighbor in neighbors {
                    if self.is_in_direction(neighbor, direction) {
                        self.current_focus = Some(neighbor);
                        return Some(neighbor);
                    }
                }
            }
        }
        None
    }

    fn is_in_direction(&self, pane_id: PaneId, direction: Direction) -> bool {
        // Implement direction-based focus movement
        false  // placeholder
    }
}

pub enum Direction {
    Left,
    Right,
    Up,
    Down,
    Next,
    Previous,
}
```

### 10.5 Tab Management

```rust
pub struct TabBar {
    pub tabs: Vec<Tab>,
    pub active_tab: Option<usize>,
    pub style: TabBarStyle,
}

pub struct Tab {
    pub id: PaneId,
    pub title: String,
    pub icon: Option<char>,
    pub is_dirty: bool,
    pub can_close: bool,
}

impl TabBar {
    pub fn render(&self, fb: &mut Framebuffer) {
        let mut x = 0;
        for (i, tab) in self.tabs.iter().enumerate() {
            let is_active = self.active_tab == Some(i);

            let label = if let Some(icon) = tab.icon {
                format!(" {} {} ", icon, tab.title)
            } else {
                format!(" {} ", tab.title)
            };

            let style = if is_active {
                &self.style.active
            } else {
                &self.style.normal
            };

            fb.write_text(x, 0, &label, style);
            x += measure_width(&label) + 1;
        }

        // Close buttons
        for (i, tab) in self.tabs.iter().enumerate() {
            if tab.can_close {
                let x_pos = /* calculate */;
                fb.write_text(x_pos, 0, "×", &self.style.close_button);
            }
        }
    }
}
```

### 10.6 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Overlapping panes | Content hidden | Use strict layout |
| No minimum sizes | Panes become unusable | Set min_width/min_height |
| No close confirmation | Accidentally close work | Prompt on close |
| Focus loss | Keyboard input goes nowhere | Always track focus |
| No tab overflow | Too many tabs break UI | Add scroll/dropdown |

---

# PART 2: NOVEL CONCEPTS REPORT

## Multi-Pane Workspaces: Untapped Opportunities

### Concept 1: Semantic Pane Relationships

**Idea:** Panes that **intelligently resize** based on semantic relationships between their content.

**How:**
```rust
pub enum PaneRelationship {
    // Master-detail: detail follows master scroll
    MasterDetail { link_field: String },
    // Peer comparison: panes show related data side-by-side
    PeerComparison,
    // Symbiotic: both panes must have enough space to be useful
    Symbiotic { min_each: Size },
    // Hierarchical: parent contains children
    Hierarchical { children: Vec<PaneId> },
}
```

**Novel because:** Current panes are independent. Semantic relationships enable smarter layouts.

**Complexity:** High
**Value:** Medium (better use of space)

---

### Concept 2: Distraction-Free Pane Hiding

**Idea:** Temporarily **collapse panes to minimal indicators** when not in use.

**How:**
```rust
pub enum PaneVisibility {
    Full,       // Normal display
    Minimized,  // Tab bar only
    Iconified,  // Small icon in status bar
    Hidden,     // Completely hidden
}

pub struct FocusAwareVisibility {
    last_focus_time: HashMap<PaneId, Instant>,
    timeout: Duration,
}

impl FocusAwareVisibility {
    pub fn update(&mut self, focused: Option<PaneId>, panes: &mut HashMap<PaneId, Pane>) {
        for (id, pane) in panes.iter_mut() {
            match self.last_focus_time.get(id) {
                Some(&time) if time.elapsed() > self.timeout => {
                    pane.visibility = PaneVisibility::Minimized;
                }
                _ => {
                    pane.visibility = PaneVisibility::Full;
                }
            }
        }
    }
}
```

**Novel because:** TUIs always show all panes equally. Auto-hiding unused panes = decluttered workspace.

**Complexity:** Medium
**Value:** Medium (cleaner UI, less noise)

---

### Concept 3: Pane Morphing (Transformation between Layouts)

**Idea:** Smoothly **animate pane transitions** when layouts change (split, close, resize).

```rust
pub struct PaneMorpher {
    transitions: Vec<PaneTransition>,
}

pub struct PaneTransition {
    pub pane_id: PaneId,
    pub from: Rect,
    pub to: Rect,
    pub duration_ms: u64,
    pub start_time: u64,
}

impl PaneMorpher {
    pub fn record_split(&mut self, pane: PaneId, from: Rect, to_left: Rect, to_right: Rect) {
        let now = current_time_ms();
        self.transitions.push(PaneTransition {
            pane_id: pane,
            from,
            to: to_left,
            duration_ms: 300,
            start_time: now,
        });
        self.transitions.push(PaneTransition {
            pane_id: pane,
            from,
            to: to_right,
            duration_ms: 300,
            start_time: now,
        });
    }
}
```

**Novel because:** TUIs jump between layouts instantly. Smooth morphing = professional feel.

**Complexity:** Medium
**Value:** High (polished, modern UX)

---

**End of Multi-Pane Workspaces Anthology**

---

# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Pane as Independent Rendering Surface: Notcurses Planes

Notcurses' plane system is the closest existing analogue to a pane. Each plane is an independent cell buffer with absolute position, z-order, and per-plane damage tracking.

```c
struct ncplane {
  int absx, absy;       // position
  int lenx, leny;       // dimensions
  int z;                // stacking order
  cell* contents;       // independent buffer
  bool* damaged;        // per-plane damage mask
  struct ncplane* next; // linked list
};
```

Key operations: `ncplane_move_top()`, `ncplane_move_bottom()`, `ncplane_move_above()`, `ncplane_move_below()`.

Mapped to panes:
- **z-order** = pane stacking order (overlay support)
- **damage tracking per plane** = only re-render changed panes, reducing redundant output
- **separate buffers** = independent scrollback, cursor position, and input routing per pane

## 3.2 Sizing Negotiation: Urwid's FLOW/BOX/FIXED Modes

Urwid defines three sizing modes that determine how a widget responds to available space. This is the most principled approach to pane sizing in any TUI framework.

| Mode | Constraint | Use in Pane Systems |
|------|-----------|---------------------|
| **FLOW** | Width given, height computed | Text editors, logs (width-fixed, height from content) |
| **BOX** | Width AND height given | Terminal panes, code viewers (fill allocated rect) |
| **FIXED** | Intrinsic size | Minimap, status badges (size from content, ignore allocation) |

```python
# Urwid sizing contract
widget.render((width,))        # FLOW: returns height
widget.render((width, height)) # BOX: fills given rect
widget.pack()                  # FIXED: returns (width, height)
widget.render(())              # FIXED: renders at intrinsic size
```

For pane systems: compose FLOW widgets inside BOX panes. The pane manager allocates BOX rects, then inner widgets negotiate their own heights via FLOW.

## 3.3 Tiled Layout Distribution: Urwid Columns/Pile + Textual CSS Grid

**Urwid's `Columns`** supports three sizing strategies per column: `fixed` (exact chars), `weight` (proportional), and `pack` (intrinsic). `Pile` does the same vertically.

```python
columns = urwid.Columns([
    ('fixed', 20, sidebar),    # exactly 20 chars
    ('weight', 2, main_pane),  # 2/3 of remaining
    ('weight', 1, aux_pane),   # 1/3 of remaining
], dividechars=1)

pile = urwid.Pile([
    ('fixed', 3, header),
    body_pane,                  # fills remaining (weight=1 default)
    ('fixed', 1, footer),
])
```

**Textual's CSS grid** extends this with fractional units, auto-sizing, and gutter control:

```css
MultiPaneWorkspace {
    layout: grid;
    grid-size: 2 3;              /* 2 columns, 3 rows */
    grid-columns: 1fr 2fr;       /* column ratio 1:2 */
    grid-rows: auto 1fr auto;    /* header/footer auto, body fills */
    grid-gutter: 1;              /* 1-cell gap between panes */
}
```

Textual also supports `dock` for edge-aligned panes and named `layer` for true z-ordering.

**Generic distribution algorithm** (synthesized from both):

```rust
enum PaneSpecKind { Fixed(usize), Weighted(f32), Pack }

fn distribute_space(available: usize, items: &[PaneSpec]) -> Vec<usize> {
    let fixed_total: usize = items.iter()
        .filter_map(|i| match i { PaneSpecKind::Fixed(n) => Some(n), _ => None })
        .sum();
    let remaining = available.saturating_sub(fixed_total + gap_total(items));
    let total_weight: f32 = items.iter()
        .filter_map(|i| match i { PaneSpecKind::Weighted(w) => Some(*w), _ => None })
        .sum();
    items.iter().map(|item| match item {
        PaneSpecKind::Fixed(n) => *n,
        PaneSpecKind::Weighted(w) => (remaining as f32 * w / total_weight) as usize,
        PaneSpecKind::Pack => item.widget.intrinsic_size(remaining),
    }).collect()
}
```

## 3.4 Layered Overlay: Blessed Box Model + Z-Order

Blessed treats widgets as a DOM-like tree with CSS box model. This maps directly to chrome inside a pane.

```javascript
// Box model properties per widget
{
  width: '50%' | 100 | 'half',
  height: '100%' | 25 | 'fill',
  left: 0 | 'center' | '10%',
  top: 0 | 'center',
  padding: { top: 1, right: 2, bottom: 1, left: 2 },
  margin: 'auto' | 2,
  z: 10  // explicit z-order for overlapping
}
```

Relevance to multi-pane: chrome elements (title bars, tab bars, status bars) inside each pane use the same padding/margin/border model. Blessed's percentage-based layout means pane content re-flows automatically on resize.

## 3.5 Overlays and Stacking: Urwid Overlay

`urwid.Overlay` creates a floating pane on top of a base widget — the only framework in the corpus with explicit stacked pane support.

```python
overlay = urwid.Overlay(
    top_widget,      // floating pane
    bottom_widget,   // base widget underneath
    align='center',
    valign='middle',
    width=('relative', 80),
    height=('relative', 50),
)
```

This pattern is the foundation for modals, popups, and tool palettes that float above a split-pane workspace without disturbing the layout.

## 3.6 Panel and Layout Primitives: Rich

Rich's `Layout` provides a recursive split-based pane tree:

```python
layout = Layout()
layout.split(
    Layout(name="header", size=3),
    Layout(name="body"),
    Layout(name="footer", size=3),
)
layout["body"].split_row(              # horizontal split
    Layout(name="sidebar", ratio=1),
    Layout(name="main", ratio=3),      # 75% width
)
layout["sidebar"].split(               # vertical split
    Layout(name="nav"),
    Layout(name="tree"),
)
```

Each named pane is addressable by key. `split()` = vertical, `split_row()` = horizontal. Supports `size` (fixed) and `ratio` (proportional). This is the cleanest expression of recursive binary split pane layout in the corpus.

## 3.7 State Architecture for Pane Managers: Bubble Tea Elm Architecture

Bubble Tea's Model-Update-View pattern is the most principled state management for pane systems. Applied to a `PaneManager`:

```go
type PaneManager struct {
    Panes       map[PaneId]Pane
    FocusStack  []PaneId
    SplitHistory []SplitOperation
    RootLayout  SplitNode
}

type Msg interface{}

type SplitMsg struct {
    PaneId PaneId
    Direction Direction
    Ratio  float32
}

type CloseMsg struct { PaneId PaneId }
type FocusMsg struct { PaneId PaneId }
type ResizeMsg struct { Width, Height int }

func (m PaneManager) Update(msg Msg) (PaneManager, Cmd) {
    switch msg := msg.(type) {
    case SplitMsg:
        return handleSplit(m, msg)
    case FocusMsg:
        return handleFocus(m, msg)
    case CloseMsg:
        return handleClose(m, msg)
    case ResizeMsg:
        return handleResize(m, msg)
    }
    return m, nil
}

func (m PaneManager) View() string {
    // Pure render: traverse RootLayout tree, render each pane
}
```

Why Elm architecture for panes: all state changes go through a single `Update`. No mutations outside the handler. Replay/debugging is deterministic. Undo is just keeping the message history.

## 3.8 Split/Close/Restore Operations

From the full corpus synthesis:

```rust
enum SplitOperation {
    Horizontal { pane_id: PaneId, ratio: f32, new_id: PaneId },
    Vertical   { pane_id: PaneId, ratio: f32, new_id: PaneId },
}

// Every split is recorded for undo/restore
// Closing a pane: grow adjacent sibling to fill space
// Min-size constraints prevent creating unusable panes
```

## 3.9 Focus Navigation Between Panes

From ObjCurses (event dispatch to focused widget) + tcell (event model) + Urwid (container focus chain):

- **Focus stack** ordered by recency (`Tab` = cycle, `Ctrl+W h/j/k/l` = directional)
- **Directional nav** based on pane adjacency graph built from the layout tree
- **Focus ring/highlight** must not leak outside pane bounds (clip rendering at pane edges)
- **Event dispatch**: keyboard events go to the focused pane only; unfocused panes consume no input

```rust
struct FocusNavigator {
    graph: HashMap<PaneId, Vec<PaneId>>,  // adjacency from layout tree
    current_focus: Option<PaneId>,
}

impl FocusNavigator {
    fn navigate(&mut self, d: Direction) -> Option<PaneId> {
        let current = self.current_focus?;
        let neighbors = self.graph.get(&current)?;
        // select neighbor closest to direction vector
    }
}
```

## 3.10 Framework Comparison: Pane-Related Primitives

| Primitive | Notcurses | Urwid | Textual | Blessed | Rich |
|-----------|-----------|-------|---------|---------|------|
| Plane/pane surface | ✅ ncplane | ❌ | ❌ | ❌ | ❌ |
| Z-order paging | ✅ | ❌ | ✅ layer | ✅ z prop | ❌ |
| Split layout | ❌ | ✅ Columns/Pile | ✅ CSS grid | ✅ % layout | ✅ split/split_row |
| Overlay pane | ❌ | ✅ Overlay | ✅ layer | ✅ z-index | ❌ |
| Sizing modes | ❌ | ✅ FLOW/BOX/FIXED | ✅ grid fr/%/auto | ✅ %/fixed | ✅ ratio/size/hide |
| Box model | ❌ | ❌ | ✅ CSS box model | ✅ CSS box model | ❌ |
| Focus management | ❌ | ✅ container chain | ✅ message bubbling | ✅ event bubbling | ❌ |
| Layout tree | ❌ | ✅ nested containers | ✅ compose tree | ✅ widget tree | ✅ split tree |

Key takeaway: no single framework provides all pane primitives. Notcurses has the best plane system. Urwid has the best sizing negotiation. Textual has the best CSS grid. Blessed has the best box model. Rich has the most elegant recursive split tree. A production pane system synthesizes patterns from all five.

## 3.11 Practical Constraints

1. Panes should not overlap unless intentional (use Overlay/named layers for explicit stacking)
2. Tab bars and borders consume space before inner content (account for chrome in layout)
3. Split ratios must be adjustable at runtime, not only at creation
4. Minimum pane sizes prevent unusable layouts (enforce `min_width`/`min_height` on every split)
5. Resize propagation must reach inner widgets (PTY resize for terminal panes, reflow for text editors)
6. Off-screen / non-visible panes should defer expensive rendering (initialize on visibility flip, not on create)
7. Session state should survive close/reopen (serialize split tree + pane contents to JSON)

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Canopy's Split-View Grid

Canopy's `TerminalTabBar` switches between single-column and multi-column layout based on tab count:

```typescript
const handleClick = () => onToggleSplit();
<button className={`split-view-btn ${splitMode ? "active" : ""}`}
        onClick={onToggleSplit}>
  {splitMode ? <SinglePaneSVG /> : <SplitPaneSVG />}
</button>
```

**Tab-reordering primitive:**
```typescript
const handleDragEnter = useCallback((tabId: string) => {
  if (draggingTabId && tabId !== draggingTabId) setDragOverTabId(tabId);
}, [draggingTabId]);

useEffect(() => {
  if (!draggingTabId) return;
  const handleMouseUp = () => {
    if (draggingTabId && dragOverTabId && onReorderTabs)
      onReorderTabs(draggingTabId, dragOverTabId);
    setDraggingTabId(null); setDragOverTabId(null);
  };
  window.addEventListener("mouseup", handleMouseUp);
  return () => window.removeEventListener("mouseup", handleMouseUp);
}, [draggingTabId, dragOverTabId]);
```

Note: Uses pointer/mouse events, not HTML drag-and-drop, to avoid conflict with Tauri's native file-drop handling.

---
