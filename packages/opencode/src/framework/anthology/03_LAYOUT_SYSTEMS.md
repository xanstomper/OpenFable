# Anthology: Layout Systems

> **Subject:** Layout Systems - positioning, alignment, and responsive design for TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Layout Systems Mastery

### 3.1 The Box Model for TUIs

Every widget in a TUI follows the box model:

```
┌────────────────────────────────────────┐
│           Margin (external)            │
│  ┌──────────────────────────────────┐  │
│  │         Border                   │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │        Padding             │  │  │
│  │  │  ┌──────────────────────┐  │  │  │
│  │  │  │      Content         │  │  │  │
│  │  │  └──────────────────────┘  │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Implementation:**
```rust
pub struct BoxModel {
    pub margin: Spacing,    // Outside space
    pub border: BorderStyle,
    pub padding: Spacing,   // Inside space
    pub content: Content,
}

pub struct Spacing {
    pub top: usize,
    pub right: usize,
    pub bottom: usize,
    pub left: usize,
}

impl Spacing {
    pub fn uniform(value: usize) -> Self {
        Spacing { top: value, right: value, bottom: value, left: value }
    }
    
    pub fn new(top: usize, right: usize, bottom: usize, left: usize) -> Self {
        Spacing { top, right, bottom, left }
    }
}

impl BoxModel {
    pub fn total_width(&self, content_width: usize) -> usize {
        self.margin.left + self.margin.right +
        self.border.width() * 2 +
        self.padding.left + self.padding.right +
        content_width
    }
    
    pub fn total_height(&self, content_height: usize) -> usize {
        self.margin.top + self.margin.bottom +
        self.border.height() * 2 +
        self.padding.top + self.padding.bottom +
        content_height
    }
}
```

### 3.2 Flexbox-Style Layout

**Core concepts:**
- **Container** defines direction (row/column), wrap behavior, alignment
- **Items** define grow, shrink, basis

```rust
pub enum FlexDirection {
    Row,
    Column,
    RowReverse,
    ColumnReverse,
}

pub enum FlexWrap {
    NoWrap,
    Wrap,
    WrapReverse,
}

pub struct FlexContainer {
    pub direction: FlexDirection,
    pub wrap: FlexWrap,
    pub justify_content: FlexAlign,
    pub align_items: FlexAlign,
    pub align_content: FlexAlign,
}

pub enum FlexAlign {
    FlexStart,
    FlexEnd,
    Center,
    SpaceBetween,
    SpaceAround,
    SpaceEvenly,
    Stretch,
}

pub struct FlexItem {
    pub grow: f32,        // How much to grow relative to others
    pub shrink: f32,      // How much to shrink relative to others
    pub basis: usize,     // Initial size before distribution
    pub align_self: Option<FlexAlign>,
}

impl FlexContainer {
    pub fn layout(&self, items: &[FlexItem], available_space: usize) -> Vec<usize> {
        match self.direction {
            FlexDirection::Row => self.layout_row(items, available_space),
            FlexDirection::Column => self.layout_column(items, available_space),
            _ => unimplemented!(),
        }
    }
    
    fn layout_row(&self, items: &[FlexItem], available_width: usize) -> Vec<usize> {
        // Step 1: Calculate total base size
        let total_basis: usize = items.iter().map(|i| i.basis).sum();
        
        // Step 2: Calculate free space
        let free_space = available_width as i32 - total_basis as i32;
        
        // Step 3: Distribute free space based on grow/shrink
        let mut sizes = Vec::new();
        
        if free_space >= 0 {
            // Growing phase
            let total_grow: f32 = items.iter().map(|i| i.grow).sum();
            for item in items {
                let additional = if total_grow > 0.0 {
                    (free_space as f32 * item.grow / total_grow) as usize
                } else {
                    0
                };
                sizes.push(item.basis + additional);
            }
        } else {
            // Shrinking phase
            let total_shrink: f32 = items.iter().map(|i| i.shrink).sum();
            for item in items {
                let reduction = if total_shrink > 0.0 {
                    ((-free_space) as f32 * item.shrink / total_shrink) as usize
                } else {
                    0
                };
                sizes.push(item.basis.saturating_sub(reduction));
            }
        }
        
        sizes
    }
}
```

### 3.3 Grid Layout

**Core concepts:**
- Define explicit grid with rows/columns
- Place items by line numbers or names
- Support span across multiple cells

```rust
pub struct GridLayout {
    pub columns: Vec<GridTrack>,
    pub rows: Vec<GridTrack>,
    pub column_gap: usize,
    pub row_gap: usize,
}

pub enum GridTrack {
    Fixed(usize),
    Fractional(f32),  // 1fr, 2fr, etc.
    Auto,
    MinMax(usize, usize),
}

pub struct GridItem {
    pub column_start: GridLine,
    pub column_end: GridLine,
    pub row_start: GridLine,
    pub row_end: GridLine,
}

pub enum GridLine {
    Line(usize),      // Line 1, 2, 3...
    Span(usize),      // span 2 = cross 2 cells
    Name(String),     // Named lines
}

impl GridLayout {
    pub fn compute_track_sizes(&self, available_space: usize, is_column: bool) -> Vec<usize> {
        let tracks = if is_column { &self.columns } else { &self.rows };
        let gaps = if is_column { self.column_gap } else { self.row_gap };
        
        let total_gap = gaps * (tracks.len().saturating_sub(1));
        let space_for_tracks = available_space.saturating_sub(total_gap);
        
        // Step 1: Resolve fixed tracks
        let mut remaining_space = space_for_tracks;
        let mut track_sizes = Vec::new();
        
        for track in tracks {
            match track {
                GridTrack::Fixed(size) => {
                    track_sizes.push(*size);
                    remaining_space = remaining_space.saturating_sub(*size);
                }
                _ => track_sizes.push(0),  // Placeholder
            }
        }
        
        // Step 2: Distribute remaining space to fractional tracks
        let total_fr: f32 = tracks.iter().enumerate()
            .filter(|(i, t)| matches!(t, GridTrack::Fractional(_)) && track_sizes[*i] == 0)
            .map(|(_, t)| {
                if let GridTrack::Fractional(fr) = t { *fr } else { 0.0 }
            })
            .sum();
        
        if total_fr > 0.0 {
            for (i, track) in tracks.iter().enumerate() {
                if let GridTrack::Fractional(fr) = track {
                    let size = ((remaining_space as f32 * fr) / total_fr) as usize;
                    track_sizes[i] = size;
                }
            }
        }
        
        // Step 3: Auto tracks get remaining space or content size
        for (i, track) in tracks.iter().enumerate() {
            if matches!(track, GridTrack::Auto) && track_sizes[i] == 0 {
                track_sizes[i] = remaining_space / tracks.iter()
                    .filter(|t| matches!(t, GridTrack::Auto))
                    .count();
            }
        }
        
        track_sizes
    }
}
```

### 3.4 Constraint-Based Layout

**Core concepts:**
- Define constraints (relations between dimensions)
- Solver finds optimal solution
- Handles conflicting constraints gracefully

```rust
pub enum Constraint {
    Equal(usize),
    Min(usize),
    Max(usize),
    Ratio(f32),  // This widget is 0.3x the width of that widget
    Align(Alignment),
}

pub struct ConstraintSolver {
    constraints: Vec<WidgetConstraint>,
}

pub struct WidgetConstraint {
    pub widget_id: WidgetId,
    pub dimension: Dimension,  // Width or Height
    pub constraint: Constraint,
    pub priority: u32,  // Higher = more important
}

impl ConstraintSolver {
    pub fn solve(&self, available_space: usize) -> HashMap<WidgetId, Rect> {
        // Use Cassowary algorithm or simple iterative solver
        let mut solution = HashMap::new();
        
        // Priority-based constraint satisfaction
        let mut sorted_constraints = self.constraints.clone();
        sorted_constraints.sort_by_key(|c| c.priority);
        
        for constraint in sorted_constraints {
            self.apply_constraint(constraint, &mut solution, available_space);
        }
        
        solution
    }
    
    fn apply_constraint(&self, constraint: WidgetConstraint, solution: &mut HashMap<WidgetId, Rect>, available: usize) {
        match constraint.constraint {
            Constraint::Min(min) => {
                let rect = solution.entry(constraint.widget_id).or_insert(Rect::default());
                if constraint.dimension == Dimension::Width && rect.width < min {
                    rect.width = min;
                }
            }
            Constraint::Max(max) => {
                let rect = solution.entry(constraint.widget_id).or_insert(Rect::default());
                if constraint.dimension == Dimension::Width && rect.width > max {
                    rect.width = max;
                }
            }
            // ... handle other constraints
            _ => {}
        }
    }
}
```

### 3.5 Responsive Layout Patterns

**Pattern 1: Breakpoint-Based**
```rust
pub enum Breakpoint {
    Small,    // < 60 cells
    Medium,   // 60-120 cells
    Large,    // > 120 cells
}

impl Layout {
    pub fn responsive_layout(&self, width: usize) -> LayoutConfig {
        match self.get_breakpoint(width) {
            Breakpoint::Small => LayoutConfig::single_column(),
            Breakpoint::Medium => LayoutConfig::two_column(),
            Breakpoint::Large => LayoutConfig::three_column(),
        }
    }
}
```

**Pattern 2: Progressive Enhancement**
```rust
// Start with minimal layout, add features as space allows
pub fn progressive_layout(available: usize) -> Vec<Widget> {
    let mut widgets = vec![Widget::essential_content()];
    
    if available > 60 {
        widgets.push(Widget::sidebar());
    }
    if available > 100 {
        widgets.push(Widget::status_bar());
    }
    if available > 140 {
        widgets.push(Widget::preview_pane());
    }
    
    widgets
}
```

### 3.6 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Fixed-width layouts | Break on small/large terminals | Use flex/grid with fractional units |
| No minimum sizes | Content gets crushed | Add `min-width` constraints |
| Ignoring text width | Wrapping breaks layout | Measure text before layout |
| No gap handling | Widgets touch awkwardly | Add consistent gaps |

---

# PART 2: NOVEL CONCEPTS REPORT

## Layout Systems: Untapped Opportunities

### Concept 1: Content-Aware Layout with Semantic Priorities

**Idea:** Layout engine that **understands content semantics** to make intelligent truncation/priority decisions.

**How:**
```rust
enum ContentSemantic {
    Critical,    // Never truncate (error messages, active input)
    Important,   // Truncate only if necessary (current file name)
    Contextual,  // Can abbreviate (paths, function names)
    Decorative,  // Can hide entirely (icons, watermarks)
}

pub struct SemanticLayout {
    items: Vec<SemanticItem>,
}

pub struct SemanticItem {
    pub content: String,
    pub semantic: ContentSemantic,
    pub min_width: usize,
    pub ideal_width: usize,
    pub abbreviations: Vec<String>,  // Progressive abbreviations
}

impl SemanticLayout {
    pub fn layout_constrained(&self, available: usize) -> Vec<LayoutItem> {
        let mut result = Vec::new();
        let mut remaining = available;
        
        // Sort by priority
        let mut sorted: Vec<_> = self.items.iter().collect();
        sorted.sort_by_key(|i| match i.semantic {
            ContentSemantic::Critical => 0,
            ContentSemantic::Important => 1,
            ContentSemantic::Contextual => 2,
            ContentSemantic::Decorative => 3,
        });
        
        // Allocate space in priority order
        for item in sorted {
            let allocated = if remaining >= item.ideal_width {
                item.ideal_width
            } else if remaining >= item.min_width {
                remaining
            } else {
                // Use progressive abbreviation
                self.find_best_abbreviation(item, remaining)
            };
            
            result.push(LayoutItem {
                content: self.truncate_to(item, allocated),
                width: allocated,
            });
            remaining = remaining.saturating_sub(allocated);
        }
        
        result
    }
}
```

**Novel because:** Current layout engines treat all content equally. Semantic awareness enables intelligent degradation.

**Complexity:** Medium
**Value:** High (graceful degradation on any terminal size)

---

### Concept 2: Temporal Layout with Animation Scheduling

**Idea:** Layout that **plans animations** when content changes, not just instant jumps.

**How:**
```rust
pub struct TemporalLayout {
    current_state: LayoutState,
    target_state: LayoutState,
    animation_queue: Vec<LayoutAnimation>,
}

pub struct LayoutAnimation {
    pub widget_id: WidgetId,
    pub from: Rect,
    pub to: Rect,
    pub duration_ms: u64,
    pub easing: EasingFn,
    pub start_time: u64,
}

impl TemporalLayout {
    pub fn request_layout_change(&mut self, new_state: LayoutState) {
        // Compute diff between current and target
        let changes = self.compute_changes(&new_state);
        
        // Schedule animations for each change
        for change in changes {
            let anim = LayoutAnimation {
                widget_id: change.widget_id,
                from: self.current_state.get_rect(change.widget_id),
                to: new_state.get_rect(change.widget_id),
                duration_ms: 300,
                easing: EasingFn::EaseOutCubic,
                start_time: current_time_ms(),
            };
            self.animation_queue.push(anim);
        }
        
        self.target_state = new_state;
    }
    
    pub fn render_frame(&mut self, current_time: u64) -> Framebuffer {
        let mut fb = Framebuffer::new(self.width, self.height);
        
        // Animate all pending animations
        for anim in &mut self.animation_queue {
            let progress = ((current_time - anim.start_time) as f32 / anim.duration_ms as f32).min(1.0);
            let eased = anim.easing.apply(progress);
            
            let current_rect = Rect::lerp(&anim.from, &anim.to, eased);
            // Render widget at interpolated position
        }
        
        // Remove completed animations
        self.animation_queue.retain(|a| current_time < a.start_time + a.duration_ms);
        
        fb
    }
}
```

**Novel because:** TUIs jump instantly between layouts. This enables smooth transitions like GUI frameworks.

**Complexity:** Medium
**Value:** High (professional, polished feel)

---

### Concept 3: Bidirectional Layout with Content Negotiation

**Idea:** Layout as a **negotiation** between container constraints and content preferences.

**How:**
```rust
pub trait LayoutNegotiator {
    fn preferred_size(&self, available: Rect) -> SizeRequest;
    fn accept_size(&mut self, proposed: Rect) -> Acceptance;
    fn render_at(&self, rect: Rect) -> Framebuffer;
}

pub struct SizeRequest {
    pub min: Size,
    pub ideal: Size,
    pub max: Size,
    pub grow_priority: f32,
    pub shrink_priority: f32,
}

pub enum Acceptance {
    Accepted,
    AcceptedWithAdjustments(Rect),
    Rejected(Suggestion),
}

pub struct NegotiatingContainer {
    children: Vec<Box<dyn LayoutNegotiator>>,
}

impl NegotiatingContainer {
    pub fn layout(&mut self, available: Rect) -> Rect {
        // Phase 1: Collect preferences from all children
        let requests: Vec<_> = self.children.iter()
            .map(|c| c.preferred_size(available))
            .collect();
        
        // Phase 2: Propose initial sizes
        let proposals = self.distribute_space(&requests, available);
        
        // Phase 3: Negotiate (children can reject and suggest alternatives)
        let mut final_sizes = Vec::new();
        for (child, proposal) in self.children.iter_mut().zip(proposals) {
            match child.accept_size(proposal) {
                Acceptance::Accepted => final_sizes.push(proposal),
                Acceptance::AcceptedWithAdjustments(adjusted) => final_sizes.push(adjusted),
                Acceptance::Rejected(suggestion) => {
                    // Re-negotiate with suggestion
                    let revised = self.apply_suggestion(suggestion, available);
                    final_sizes.push(revised);
                }
            }
        }
        
        // Phase 4: Render at negotiated sizes
        self.render_all(&final_sizes)
    }
}
```

**Novel because:** Current layout is top-down dictatorship. Bidirectional negotiation enables smarter content-aware layouts.

**Complexity:** High
**Value:** Medium (better handling of complex/variable content)

For any serious text-heavy TUI, Urwid's text layout engine is the gold standard to emulate.

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Container Widget Hierarchies and Composition Models

Four frameworks in the corpus implement fundamentally different container composition models. Understanding all four is essential for choosing the right layout architecture.

**Urwid (Python)** — Token-based proportional allocation:

```python
# Three sizing tokens for Columns and Pile containers
urwid.Columns([
    ('fixed', 20, sidebar),    # Exactly 20 columns
    ('weight', 2, main_area),  # 2 shares of remaining space
    ('weight', 1, aux),        # 1 share of remaining space
    ('pack', status_bar),      # Intrinsic size
], dividechars=1)

# Pile = vertical equivalent
urwid.Pile([
    ('fixed', 3, header),
    body,                       # Fills remaining
    ('fixed', 1, footer),
])

# Overlay = CSS absolute positioning
urwid.Overlay(
    top_w=popup, bottom_w=main,
    align='center', width=('relative', 80),
    valign='middle', height=('relative', 60),
)

# GridFlow = auto-wrapping grid
urwid.GridFlow(
    cells=[button1, button2, ...],
    cell_width=20, h_sep=2, v_sep=1, align='center',
)
```

Sizing algorithm: resolve all `fixed` and `pack` tokens first, sum them, subtract from available space, distribute remainder by weight ratio. If space is insufficient, widgets render at minimum size and overflow is clipped.

**Blessed (JavaScript)** — CSS-superset box model:

```javascript
// Every widget accepts CSS-like layout properties
blessed.box({
  width: '50%',       // Percentage of parent
  height: 'fill',     // Fill remaining
  left: 'center',     // Horizontal position
  top: 'center',
  padding: { top: 1, right: 2, bottom: 1, left: 2 },
  margin: 'auto',     // Auto-centering
  border: { type: 'line' },
})

// Size keywords: '10%', 'half', 'fill', N (absolute cells)
// Position keywords: 'center', '10%', '50%', N (absolute cells)
```

Blessed calculates layout top-down: parent determines child position from `left`/`top`/`width`/`height`, then offsets by margin → border → padding before rendering content. This matches CSS `box-sizing: border-box` behavior.

**Textual (Python)** — CSS Grid + Flexbox hybrid:

```css
/* Declarative layout via CSS */
MyWidget {
    layout: grid;
    grid-size: 3 2;              /* 3 columns × 2 rows */
    grid-columns: 1fr 2fr 1fr;   /* Proportional columns */
    grid-rows: auto 1fr;         /* Auto-fit first row, fill rest */
    grid-gutter: 1;              /* Gap between cells */
}

/* Or flexbox-style */
Horizontal {                    /* Row layout */
    height: auto;
}
Vertical {                     /* Column layout */
    width: 100%;
}
```

Textual supports four layout modes: `vertical` (column flex), `horizontal` (row flex), `grid` (CSS Grid), and `none` (absolute positioning). The `layout` property selects the algorithm. Children use standard CSS properties: `width`, `height`, `margin`, `padding`, `overflow`.

**Notcurses (C)** — Plane-based absolute positioning:

```c
// Each plane has absolute coordinates and z-order
struct ncplane* n = ncplane_new(stdplane, rows, cols, y, x, NULL);
ncplane_putstr(n, "content");
ncplane_move_top(n);     // Bring to front
ncplane_move_bottom(n);  // Send to back
ncplane_move_above(n, other);  // Relative z-ordering

// Box drawing with styles
cell ul = {}, ur = {}, ll = {}, lr = {};  // Corner cells
cell hl = {}, vl = {};                     // Horizontal/vertical lines
ncplane_box(n, &ul, &ur, &ll, &lr, &hl, &vl, ystop, xstop);

// Subplanes: create plane at offset within parent
struct ncplane* sub = ncplane_create(parent, &nopts);
// sub->absx, sub->absy = absolute position on terminal
```

Notcurses planes are the most flexible but lowest-level approach: no automatic sizing or alignment. You calculate positions manually but get pixel-level (cell-level) control with automatic compositing and z-ordering.

**Comparison matrix:**

| Feature | Urwid | Blessed | Textual | Notcurses |
|---------|-------|---------|---------|-----------|
| Sizing model | Token (fixed/weight/pack) | CSS %/fill/keyword | CSS Grid + Flex | Manual absolute |
| Auto-wrap | GridFlow widget | None built-in | Grid auto-flow | None |
| Overlay | Overlay widget | None (manual) | `layer` CSS property | Z-order planes |
| Gaps | `dividechars` parameter | `margin` on children | `grid-gutter` | Manual |
| Box model | Minimal | Full CSS | Full CSS | None |
| Layout recursion | Yes (nested containers) | Yes (widget tree) | Yes (CSS cascade) | Yes (subplanes) |

## 3.2 Size Negotiation and Measurement

The corpus reveals three distinct size negotiation protocols:

**Protocol A: Urwid's Three-Mode System (most formal)**

Urwid defines three sizing modes per widget, declared via `sizing = frozenset([FLOW, BOX, FIXED)]`:

```python
FLOW  → render((width,))       # Width given, height computed via rows()
BOX   → render((width, height)) # Both given, must use exactly this
FIXED → render(())              # No args, pack() gives intrinsic size
```

Container behavior: `Pile` and `Columns` resolve `FIXED` and `fixed`-token widgets first, then distribute remaining space to `FLOW` and `weight`-token widgets. Urwid's Flow/Box/Fixed sizing (est. 2002, before CSS Flexbox) was the first proportional layout system in any TUI framework.

**Protocol B: Textual's Percentage + Intrinsic System**

Textual maps CSS units to layout behavior:
- `width: N` (cells) → fixed BOX behavior
- `width: N%` → percentage of parent allocation
- `width: auto` → FIT content (FIXED equivalent)
- `width: 100%` → fill remaining

Textual's `Scalar` value system (`scalar.py`) supports `%`, `vw`, `vh`, `em`, and cell units. The scalar animation system (`scalar_animation.py`) can interpolate between values for animated layout transitions.

**Protocol C: Notcurses' Plane Geometry**

Notcurses has no negotiation protocol — but provides the building blocks:

```c
// Manual size calculation pattern
int rows, cols;
ncplane_dim_yx(parent, &rows, &cols);

// Create plane at percentage of parent
int sub_h = rows * 60 / 100;  // 60% height
int sub_w = cols * 80 / 100;  // 80% width
struct ncplane* n = ncplane_new(stdplane, sub_h, sub_w, y_offset, x_offset, NULL);

// Dynamic resize: rasterize blocks to handle reflow
ncplane_resize_realign(n);  // Re-align content after resize
```

**Practical recommendation:** Use Urwid's three-mode protocol as the internal engine — it maps to all three use cases (FLOW=variable height content, BOX=fixed regions, FIXED=intrinsic-size widgets). Expose Textual's percentage syntax at the user API level. Use Notcurses-style plane composition for the rendering layer.

## 3.3 Text Layout Integration with Box Model

Layout systems fail when they don't account for text measurement. The corpus provides three approaches:

**Urwid's Text Layout Engine (`text_layout.py`, 643 lines)**

Urwid's `StandardTextLayout` provides the most sophisticated Unicode-aware text layout:

```python
layout = urwid.StandardTextLayout()
lines = layout.layout(
    text="Hello 世界",
    width=20,
    align='center',      # left, center, right
    wrap='space',        # 'space', 'any', 'clip', 'ellipsis'
    trim=0,
)
# Returns: [(encoded_bytes, byte_start, byte_end), ...]

# Wrap modes:
# 'space'    → word-wrap at spaces (normal)
# 'any'      → break anywhere (for CJK text)
# 'clip'     → no wrapping, clip to width
# 'ellipsis' → truncate with '…'
```

The engine handles CJK wide characters (2 cells per glyph), combining characters, and grapheme clusters. It computes `text_width(text)` before layout to know how many physical cells occupy.

**Lip Gloss Border Rendering**

Lip Gloss demonstrates a complete 14-part border system that interacts with text layout:

```go
type Border struct {
    Top, Bottom, Left, Right string
    TopLeft, TopRight, BottomLeft, BottomRight string
    MiddleLeft, MiddleRight, Middle string
    MiddleTop, MiddleBottom string
}
// Plus per-side enable/disable flags
// And gradient color support across border perimeter
```

Width calculation must account for: content width + left padding + right padding + left border (1 cell) + right border (1 cell). Lip Gloss builds borders by constructing the top row (`TopLeft + Top*width + TopRight`), middle rows (`Left + content + Right`), and bottom row.

**Notcurses Multiline Text**

```c
// Word wrap with alignment
ncplane_puttext(plane, y, NCALIGN_LEFT, text, &bytes_written);
ncplane_puttext(plane, y, NCALIGN_CENTER, text, &bytes_written);

// Box with title
ncplane_box_sized(plane, &ul, &ur, &ll, &lr,
                  &hline, &vline,
                  ystop, xstop,
                  NCBOXGRAD_TOP | NCBOXGRAD_LEFT);  // Gradient borders
```

**Integration rule:** Always measure text before allocating layout space. Use `wcwidth()` or equivalent for Unicode width. Account for border + padding in total cell budget. Urwid's `text_layout.py` is the reference implementation for this.

## 3.4 Responsive Layout and Terminal Resize Handling

**Breakpoint patterns from the corpus:**

Blessed implements percentage-based responsive layout natively — every widget's `width: '50%'` recalculates on resize. The `screen.render()` call re-renders the full widget tree with new dimensions.

Textual handles resize via the `on_resize` lifecycle hook:

```python
def on_resize(self, event: Resize) -> None:
    # event.size = (width, height) in cells
    self.layout_columns = 3 if event.size.width > 120 else 2 if event.size.width > 60 else 1
```

Notcurses provides resize events via `NCKEY_RESIZE` and the `ncplane_resize_realign()` function for reflow.

**Canopy's resize gate pattern (from supplementary corpus):**

```typescript
// Only fit when dimensions are non-zero
const doFit = () => {
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) {
        setTimeout(doFit, 50);  // retry — layout hasn't settled
        return;
    }
    fitAddon.fit();
    resizeTerminal(terminalId, xterm.rows, xterm.cols);
};
requestAnimationFrame(doFit);
```

**Urwid's resize handling:**

```python
# Urwid handles resize via the event loop
def handle_resize(key):
    if key == 'window resize':
        # Event loop calls widget.render() with new dimensions
        # All containers re-negotiate sizes
        pass
```

**Responsive layout checklist:**
1. Listen for `SIGWINCH` / resize events
2. Re-measure terminal dimensions (cols × rows)
3. Re-run layout algorithm top-down
4. Invalidate all canvases / mark all planes dirty
5. Re-render with new allocations
6. Gate on non-zero dimensions (prevents zero-division during transitions)

## 3.5 Grid Layout Algorithms

Three frameworks implement grid layout differently:

**Textual's CSS Grid** (most complete):

```css
GridLayout {
    layout: grid;
    grid-size: 3 2;                    /* 3 cols, 2 rows */
    grid-columns: 2fr 1fr 1fr;         /* First column gets 50% */
    grid-rows: auto 1fr;               /* First row fits content */
    grid-gutter: 1 2;                  /* row-gap col-gap */
}
```

Algorithm: resolve `auto` tracks first (measure content), then distribute remaining space to `fr` tracks proportionally. Gutter space is subtracted before distribution.

**Urwid's GridFlow** (auto-wrapping):

```python
# Fixed cell width, auto-wraps to next row
urwid.GridFlow(
    cells=widgets,
    cell_width=20,     # Each cell is exactly 20 cols
    h_sep=2,           # Horizontal gap
    v_sep=1,           # Vertical gap
    align='center',    # Alignment within cell
)
```

Algorithm: place cells left-to-right, wrap to next row when `cell_width + h_sep` exceeds available width. No row height negotiation — all cells in a row get the height of the tallest cell.

**Notcurses manual grid** (via plane positioning):

```c
// Calculate cell positions manually
int cell_w = (total_width - (cols - 1) * gap) / cols;
int cell_h = (total_height - (rows - 1) * gap) / rows;
for (int row = 0; row < rows; row++) {
    for (int col = 0; col < cols; col++) {
        int y = row * (cell_h + gap);
        int x = col * (cell_w + gap);
        struct ncplane* cell = ncplane_new(stdplane, cell_h, cell_w, y, x, NULL);
    }
}
```

**Recommendation:** Implement Textual's CSS Grid algorithm as the primary grid system (most flexible), with Urwid's GridFlow as a convenience wrapper for equal-width auto-wrapping grids.

## 3.6 Z-Ordering and Overlay Composition

**Notcurses plane stacking** (most explicit):

```c
// Z-order manipulation
ncplane_move_top(plane);        // Front
ncplane_move_bottom(plane);     // Back
ncplane_move_above(plane, ref); // Above reference
ncplane_move_below(plane, ref); // Below reference

// During render, planes are composited back-to-front
// Each cell's alpha channel determines occlusion
```

**Textual's layer system:**

```css
ModalDialog {
    layer: overlay;     /* Named layer */
    z-index: 100;       /* Within layer */
}
Tooltip {
    layer: overlay;
    z-index: 200;
}
```

**Urwid's Overlay widget:**

```python
urwid.Overlay(
    top_w=modal, bottom_w=background,
    align=('relative', 50), width=('relative', 80),
    valign=('relative', 50), height=('relative', 60),
    min_width=40, min_height=10,
)
```

**Blessed's painter's algorithm:**

Widgets render front-to-back (children after parents). Later-rendered widgets overwrite earlier ones at overlapping cells. No explicit z-index — order in the widget tree determines stacking.

**Rule:** Use Notcurses-style explicit z-order for the rendering layer (planes with integer z-values). Use Textual's named layers for the user API (logical grouping: `background`, `content`, `overlay`, `tooltip`, `modal`).

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Three-Region App Shell Layout

Canopy's `AppLayout` implements a fixed scaffold driving the content region:

```tsx
<div className="app-layout">
  <TitleBar onGoHome={onGoHome} />
  <div className="app-content">
    <aside className="app-sidebar">{sidebar}</aside>
    <main className="app-main">{main}</main>
    <ActivityBar projectPath={projectPath} onRunSkill={onRunSkill} ... />
  </div>
</div>
```

**Layout invariants:**
- `TitleBar`: row, fixed height, non-scrollable
- `app-content`: row, flex-grow (fills remaining height)
- `app-sidebar`: aside, fixed width from props
- `app-main`: main, flex-grow, scrollable, content-agnostic
- `ActivityBar`: docked to the right edge (vertical rail)

**Responsive split pane mode:**
Canopy's `TerminalTabBar` exposes a split toggle that adjusts tab grid columns. The `TerminalView` handles the re-fit:

```typescript
useEffect(() => {
  if (isVisible && fitAddonRef.current && xtermRef.current) {
    const doFit = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) {
        setTimeout(doFit, 50);  // retry — layout hasn't settled
        return;
      }
      fitAddon.fit();
      resizeTerminal(terminalId, xterm.rows, xterm.cols);
    };
    requestAnimationFrame(doFit);
  }
}, [isVisible, splitMode]);
```

**Key primitive:** A layout gate that waits for non-zero dimensions before fitting.

---

**End of Layout Systems Anthology**
