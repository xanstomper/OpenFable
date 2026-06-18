# Anthology: Scrolling Systems

> **Subject:** Scrolling Systems - smooth, satisfying scrolling in TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Scrolling Systems Mastery

### 7.1 Scroll State Machine

```rust
pub struct ScrollState {
    pub scroll_y: usize,      // Pixels offset from top
    pub scroll_x: usize,      // Pixels offset from left
    pub target_y: usize,
    pub target_x: usize,
    pub max_y: usize,
    pub max_x: usize,
    pub viewport_height: usize,
    pub viewport_width: usize,
    pub is_dragging: bool,
    pub drag_start_y: usize,
    pub drag_start_scroll: usize,
}

#[derive(Clone, Copy, PartialEq)]
pub enum ScrollDirection {
    Up, Down, Left, Right,
}

impl ScrollState {
    pub fn new(viewport_height: usize, viewport_width: usize) -> Self {
        ScrollState {
            scroll_y: 0,
            scroll_x: 0,
            target_y: 0,
            target_x: 0,
            max_y: usize::MAX,
            max_x: usize::MAX,
            viewport_height,
            viewport_width,
            is_dragging: false,
            drag_start_y: 0,
            drag_start_scroll: 0,
        }
    }

    pub fn scroll_by(&mut self, dy: i32, dx: i32) {
        self.target_y = (self.target_y as i32 + dy).clamp(0, self.max_y as i32) as usize;
        self.target_x = (self.target_x as i32 + dx).clamp(0, self.max_x as i32) as usize;
    }

    pub fn page_up(&mut self) {
        self.target_y = self.scroll_y.saturating_sub(self.viewport_height);
    }

    pub fn page_down(&mut self) {
        self.target_y = (self.scroll_y + self.viewport_height).min(self.max_y);
    }

    pub fn home(&mut self) {
        self.target_y = 0;
    }

    pub fn end(&mut self) {
        self.target_y = self.max_y;
    }

    pub fn update(&mut self, smooth_factor: f32) {
        self.scroll_y = lerp(self.scroll_y, self.target_y, smooth_factor);
        self.scroll_x = lerp(self.scroll_x, self.target_x, smooth_factor);
    }

    pub fn is_at_top(&self) -> bool {
        self.scroll_y == 0
    }

    pub fn is_at_bottom(&self) -> bool {
        self.scroll_y >= self.max_y
    }
}
```

### 7.2 Physical Scroll Physics

```rust
pub struct ScrollPhysics {
    pub scroll_state: ScrollState,
    pub velocity: Vec2,      // Current velocity in pixels/frame
    pub friction: f32,       // Deceleration (0-1)
    pub responsiveness: f32, // Speed of target tracking
    pub snap_to: ScrollSnap,
}

pub enum ScrollSnap {
    None,
    Integer,     // Snap to whole lines
    Half,        // Snap to half lines
    Pixel,       // Free scrolling
}

impl ScrollPhysics {
    pub fn on_mouse_down(&mut self, y: usize) {
        self.scroll_state.is_dragging = true;
        self.scroll_state.drag_start_y = y;
        self.scroll_state.drag_start_scroll = self.scroll_state.scroll_y;
        self.velocity = Vec2::ZERO;
    }

    pub fn on_mouse_drag(&mut self, current_y: usize) {
        if !self.scroll_state.is_dragging {
            return;
        }

        let delta = self.scroll_state.drag_start_y as i32 - current_y as i32;
        self.scroll_state.scroll_y = (self.scroll_state.drag_start_scroll as i32 + delta).clamp(0, self.scroll_state.max_y as i32) as usize;
        self.velocity = Vec2::new(0.0, delta as f32);
    }

    pub fn on_mouse_up(&mut self) {
        self.scroll_state.is_dragging = false;
        // Track momentum from last velocity
    }

    pub fn advance(&mut self, delta_ms: u64) {
        if !self.scroll_state.is_dragging {
            let dt = delta_ms as f32 / 1000.0;
            self.velocity *= self.friction;
            self.scroll_state.target_y = (self.scroll_state.target_y as f32 + self.velocity.y * dt).clamp(0.0, self.scroll_state.max_y as f32) as usize;
        }

        self.scroll_state.update(self.responsiveness);
    }
}
```

### 7.3 Smooth Scrolling Algorithms

**Implementation:**
```rust
pub fn spring_scroll(current: &mut f32, target: f32, stiffness: f32, damping: f32) {
    let displacement = target - *current;
    let accel = displacement * stiffness;

    // Use global velocity variable (must be preserved across calls)
    // velocity += accel; velocity *= damping; current += velocity;
}

pub fn lerp_scroll(current: &mut f32, target: f32, factor: f32) {
    *current += (target - *current) * factor;
}

pub fn overshoot_scroll(current: &mut f32, target: f32, overshoot: f32) {
    let displacement = target - *current;
    let overshoot_amount = displacement * overshoot;

    if displacement.abs() > 1.0 {
        *current += displacement * 0.2 + overshoot_amount * 0.1;
    }
}
```

### 7.4 Virtual vs Fixed Content Regions

```rust
pub struct VirtualViewport {
    content_width: usize,
    content_height: usize,
    scroll_y: usize,
    scroll_x: usize,
    viewport_width: usize,
    viewport_height: usize,
}

impl VirtualViewport {
    pub fn new(content_width: usize, content_height: usize, viewport_width: usize, viewport_height: usize) -> Self {
        VirtualViewport {
            content_width,
            content_height,
            scroll_y: 0,
            scroll_x: 0,
            viewport_width,
            viewport_height,
        }
    }

    pub fn visible_region(&self) -> Rect {
        Rect {
            x: self.scroll_x,
            y: self.scroll_y,
            width: self.viewport_width,
            height: self.viewport_height,
        }
    }

    pub fn content_to_viewport(&self, content_x: usize, content_y: usize) -> Option<(usize, usize)> {
        let viewport_x = content_x as i32 - self.scroll_x as i32;
        let viewport_y = content_y as i32 - self.scroll_y as i32;

        if viewport_x >= 0 && viewport_y >= 0 && viewport_x < self.viewport_width as i32 && viewport_y < self.viewport_height as i32 {
            Some((viewport_x as usize, viewport_y as usize))
        } else {
            None
        }
    }

    pub fn clamp_to_valid(&mut self) {
        self.scroll_y = self.scroll_y.min(self.content_height.saturating_sub(self.viewport_height));
        self.scroll_x = self.scroll_x.min(self.content_width.saturating_sub(self.viewport_width));
    }
}
```

### 7.5 Scroll Anchors and Sticky Elements

```rust
pub struct ScrollAnchor {
    pub id: WidgetId,
    pub offset_from_top: f32,  // 0.0 = top, 1.0 = bottom
    pub is_sticky: bool,
    pub z_index: i32,
    pub widget_rect: Rect,
}

pub struct AnchorSystem {
    anchors: Vec<ScrollAnchor>,
    sticky_widgets: Vec<(WidgetId, Rect)>,
}

impl AnchorSystem {
    pub fn update(&mut self, scroll_y: usize, viewport_height: usize) {
        self.sticky_widgets.clear();

        for anchor in &self.anchors {
            let ideal_top = scroll_y as f32 + anchor.offset_from_top * viewport_height as f32;
            let widget_height = anchor.widget_rect.height;

            if anchor.is_sticky && ideal_top < scroll_y as f32 {
                // Stick to top
                self.sticky_widgets.push((
                    anchor.id,
                    Rect::new(anchor.widget_rect.x, scroll_y, anchor.widget_rect.width, widget_height)
                ));
            }
        }
    }

    pub fn render_sticky(&self, fb: &mut Framebuffer) {
        for (_, rect) in &self.sticky_widgets {
            fb.set_background(rect, Color::softer());
        }
    }
}
```

### 7.6 Overscroll Effects

```rust
pub enum OverscrollEffect {
    Bounce,
    Stretch,
    Glow,
    Elastic,
    None,
}

pub struct OverscrollHandler {
    max_overscroll: f32,
    effect: OverscrollEffect,
}

impl OverscrollHandler {
    pub fn handle(&self, scroll: &mut ScrollState, velocity: Vec2) {
        if scroll.scroll_y == 0 && velocity.y > 0.0 {
            // Overscrolled at top
            let overscroll = velocity.y as f32;
            let clamped = overscroll.min(self.max_overscroll);

            match self.effect {
                OverscrollEffect::Bounce => {
                    // Draw bounce indicator above viewport
                    let alpha = clamped / self.max_overscroll;
                    fb.draw_overscroll_bounce(alpha);
                }
                OverscrollEffect::Stretch => {
                    // Stretch content downward
                    let stretch_factor = clamped / self.max_overscroll;
                    fb.apply_stretch(stretch_factor);
                }
                _ => {}
            }
        }
    }
}
```

### 7.7 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| No momentum | Scrolling feels dead | Add velocity tracking |
| No snapping | Hard landing feels rough | Add pixel snap |
| Too sensitive | Crazy scrolling | Add dead zone |
| No overscroll | Feels cramped | Add bounce effect |

---

# PART 2: NOVEL CONCEPTS REPORT

## Scrolling Systems: Untapped Opportunities

### Concept 1: Semantic Scroll Anchors

**Idea:** Scroll anchors based on **semantic content boundaries**, not just pixel positions.

**How:**
```rust
pub enum SemanticAnchor {
    Function { start_line: usize, end_line: usize, name: String },
    Paragraph { start_line: usize },
    Section { level: usize, title: String },
    Error { line: usize, message: String },
    Cursor { line: usize, column: usize },
}

impl SemanticAnchor {
    pub fn distance_to(&self, scroll_y: usize, content_height: usize) -> f32 {
        match self {
            SemanticAnchor::Function { start_line, .. } => {
                let line_pixel = start_line * LINE_HEIGHT;
                (line_pixel as f32 - scroll_y as f32).abs() / content_height as f32
            }
            _ => 1.0,
        }
    }
}
```

**Novel because:** Current scroll anchors are purely positional. Semantic anchors enable scroll-by-concept.

**Complexity:** Medium
**Value:** High (faster navigation in code/tree-heavy TUIs)

---

### Concept 2: Predictive Scroll Position

**Idea:** Predict **future scroll position** based on velocity and content patterns.

**How:**
```rust
pub struct PredictiveScroll {
    velocity_history: Vec<f32>,
    content_density: Vec<f32>,  // How much content in each region
}

impl PredictiveScroll {
    pub fn predict(&self, current_velocity: f32) -> Option<usize> {
        let future_pos = self.extrapolate(current_velocity, 0.1);  // 100ms ahead

        // Check if future position has high-density content
        if self.content_density.get(future_pos).copied().unwrap_or(0.0) > 0.8 {
            Some(future_pos)
        } else {
            None
        }
    }

    pub fn extrapolate(&self, velocity: f32, time_ahead: f32) -> usize {
        let avg_velocity = self.velocity_history.iter().sum::<f32>() / self.velocity_history.len() as f32;
        let extrapolated = (avg_velocity * time_ahead) as usize;
        extrapolated.min(self.max_scroll)
    }
}
```

**Novel because:** TUIs always render exactly at current scroll. Predicting enables preloading.

**Complexity:** Medium
**Value:** Medium (smoother long-scroll experience)

---

**End of Scrolling Systems Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Scrolling as Render Optimization

Scrolling is fundamentally a dirty-tracking + offset translation problem, not a data structure problem. Blessed's `ScrollableBox` and `ScrollableText` widgets manage a viewport offset and re-render only the visible rows. Termflix's per-cell dirty tracking (`dirty: Vec<bool>`) applied to scrolling: only the cells that changed position need updating. The rule: `Only redraw the changed viewport rows` — keep a single source of truth as `scroll_state { offset, max_offset, viewport_height }`, and translate rendered content by offset before writing to the back buffer.

## 3.2 Virtualized Rendering for Large Documents

For documents larger than viewport: compute only the visible window. UnicodePlots' `scale_to_grid()` maps continuous data to pixel rows; the inverse `unscale_from_grid()` maps scroll offset back to data index — the same primitive applies to document content. LibTCOD's `Map` + `FOV` computation pattern (compute once, query many times) applies to rendered line metrics: compute line heights once, cache layout, only re-layout when content changes. Urwid's `CacheCanvas` memoizes expensive renders — apply to stable document bodies. For large lists/directories: compute visible-region neighbors on-demand rather than materializing the full DOM.


---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Terminal Scrollback Handling

Canopy uses xterm.js's built-in scrollback (default 1000 lines). For long agent sessions, this is typically insufficient. Production options:

**Scrollback configuration:**
```typescript
const xterm = new Terminal({ ..., scrollback: 5000 });
```

**Off-screen DOM pattern in Canopy:**
`TerminalView` uses `display: block/none` for visibility toggling rather than stripping the DOM node. This preserves scrollback state and avoids PTY resets.

**ResizeObserver refit:**
```typescript
const ro = new ResizeObserver(() => {
  if (container) {
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    fitAddon.fit();
    resizeTerminal(termId, xterm.rows, xterm.cols);
  }
});
```
Skipping the zero-dimension check causes scrollbar jitter and incorrect PTY dimensions during layout transitions.

---
