# Anthology: Animation Systems

> **Subject:** Animation Systems - bringing TUIs to life with motion, effects, and feedback
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Animation Systems Mastery

### 6.1 The Animation Loop

```rust
pub struct AnimationEngine {
    frame_count: u64,
    last_time_ms: u64,
    target_fps: u32,
    frame_duration_ms: u64,  // 1000 / target_fps
    animations: HashMap<AnimationId, Box<dyn Animation>>,
    tick_sender: Sender<()>,
    render_sender: Sender<Frame>,
}

impl AnimationEngine {
    pub fn new(target_fps: u32) -> Self {
        let frame_duration = 1000 / target_fps;
        AnimationEngine {
            frame_count: 0,
            last_time_ms: 0,
            target_fps,
            frame_duration_ms: frame_duration,
            animations: HashMap::new(),
            tick_sender: Sender::unbounded(),
            render_sender: Sender::unbounded(),
        }
    }

    pub fn start(&mut self) {
        let mut last = Instant::now();
        loop {
            let now = Instant::now();
            let elapsed = now.duration_since(last);

            if elapsed.as_millis() >= self.frame_duration_ms {
                self.tick(elapsed.as_millis() as u64);
                last = now;
            } else {
                sleep((self.frame_duration_ms - elapsed.as_millis() as u64).min(1));
            }
        }
    }

    pub fn tick(&mut self, delta_ms: u64) {
        self.frame_count += 1;
        self.last_time_ms += delta_ms;

        let mut finished = Vec::new();
        for (id, anim) in &mut self.animations {
            anim.advance(delta_ms, self.last_time_ms);
            if anim.is_finished() {
                finished.push(*id);
            }
        }

        for id in finished {
            self.animations.remove(&id);
        }
    }
}
```

### 6.2 Easing Functions

```rust
pub type EasingFn = fn(f64) -> f64;

pub fn linear(t: f64) -> f64 { t }

pub fn ease_in_quad(t: f64) -> f64 { t * t }
pub fn ease_out_quad(t: f64) -> f64 { t * (2.0 - t) }
pub fn ease_in_out_quad(t: f64) -> f64 {
    if t < 0.5 { 2.0 * t * t } else { -1.0 + (4.0 - 2.0 * t) * t }
}

pub fn ease_in_cubic(t: f64) -> f64 { t * t * t }
pub fn ease_out_cubic(t: f64) -> f64 { 1.0 - (1.0 - t).powi(3) }
pub fn ease_in_out_cubic(t: f64) -> f64 {
    if t < 0.5 { 4.0 * t * t * t } else { 1.0 - (-2.0 * t + 2.0).powi(3) / 2.0 }
}

pub fn ease_out_elastic(t: f64) -> f64 {
    let c4 = std::f64::consts::PI / 3.0;
    if t == 0.0 { 0.0 }
    else if t == 1.0 { 1.0 }
    else { -((1.0 - t).powf(2.0) * 10.0).sin() * c4.exp() * t.sin() }
}

pub fn ease_out_bounce(t: f64) -> f64 {
    let n1 = 7.5625;
    let d1 = 2.75;
    if t < 1.0 / d1 { n1 * t * t }
    else if t < 2.0 / d1 { n1 * (t -= 1.5 / d1) * t + 0.75 }
    else if t < 2.5 / d1 { n1 * (t -= 2.25 / d1) * t + 0.9375 }
    else { n1 * (t -= 2.625 / d1) * t + 0.984375 }
}
```

### 6.3 Tweening

```rust
pub trait Tweenable {
    fn lerp(&self, other: &Self, t: f64) -> Self;
}

impl Tweenable for f32 {
    fn lerp(&self, other: &Self, t: f64) -> Self {
        self + (other - self) * t as f32
    }
}

impl Tweenable for Color {
    fn lerp(&self, other: &Self, t: f64) -> Self {
        Color {
            r: self.r.lerp(&other.r, t),
            g: self.g.lerp(&other.g, t),
            b: self.b.lerp(&other.b, t),
        }
    }
}

impl Tweenable for Vec2 {
    fn lerp(&self, other: &Self, t: f64) -> Self {
        Vec2 {
            x: self.x.lerp(&other.x, t),
            y: self.y.lerp(&other.y, t),
        }
    }
}

pub struct Tween<T: Tweenable> {
    start: T,
    end: T,
    duration_ms: u64,
    elapsed_ms: u64,
    easing: EasingFn,
}

impl<T: Tweenable + Clone> Tween<T> {
    pub fn new(start: T, end: T, duration_ms: u64, easing: EasingFn) -> Self {
        Tween { start, end, duration_ms, elapsed_ms: 0, easing }
    }

    pub fn current(&self) -> T {
        let t = self.easing(self.elapsed_ms as f64 / self.duration_ms as f64);
        self.start.lerp(&self.end, t)
    }

    pub fn advance(&mut self, delta_ms: u64) {
        self.elapsed_ms += delta_ms;
    }

    pub fn is_finished(&self) -> bool {
        self.elapsed_ms >= self.duration_ms
    }
}
```

### 6.4 Particle Systems

```rust
pub struct Particle {
    position: Vec2,
    velocity: Vec2,
    acceleration: Vec2,
    lifetime_ms: u64,
    max_lifetime_ms: u64,
    color: Color,
    size: f32,
    glyph: char,
}

pub struct ParticleEmitter {
    position: Vec2,
    rate: f32,  // particles per second
    emit_count: usize,
    spawn_pattern: SpawnPattern,
    template: ParticleTemplate,
}

pub enum SpawnPattern {
    Point,
    Circle { radius: f32 },
    Line { start: Vec2, end: Vec2 },
    Burst { count: usize, angle: f32 },
}

pub struct ParticleTemplate {
    velocity_range: (Vec2, Vec2),  // min, max
    lifetime_range: (u64, u64),
    colors: Vec<(f64, Color)>,  // (time_ratio, color)
    size_range: (f32, f32),
    embryo_glyph: char,
}

impl ParticleEmitter {
    pub fn update(&mut self, delta_ms: u64) -> Vec<Particle> {
        let mut spawned = Vec::new();

        let to_spawn = (self.rate * delta_ms as f32 / 1000.0).ceil() as usize;
        for _ in 0..to_spawn {
            let particle = self.spawn();
            spawned.push(particle);
        }

        spawned
    }

    fn spawn(&self) -> Particle {
        let pos = match &self.spawn_pattern {
            SpawnPattern::Point => self.position,
            SpawnPattern::Circle { radius } => {
                let angle = random::<f32>() * std::f32::consts::PI * 2.0;
                self.position + Vec2::new(angle.cos(), angle.sin()) * random::<f32>() * radius
            }
            _ => self.position,
        };

        let vel = self.template.velocity_range.0.clone().lerp(
            &self.template.velocity_range.1,
            random::<f64>()
        );

        let lifetime = random_range(
            self.template.lifetime_range.0,
            self.template.lifetime_range.1
        );

        let size = random_range(self.template.size_range.0, self.template.size_range.1);

        Particle {
            position: pos,
            velocity: vel,
            acceleration: Vec2::ZERO,
            lifetime_ms: 0,
            max_lifetime_ms: lifetime,
            color: self.template.colors.first().map(|(_, c)| c).cloned().unwrap_or(Color::WHITE),
            size,
            glyph: self.template.embryo_glyph,
        }
    }
}
```

### 6.5 Decay and Fade Systems

```rust
pub struct DecaySystem {
    particles: Vec<Particle>,
    gravity: Vec2,
    drag: f32,
    fade_rate: f32,
    shrink_rate: f32,
}

impl DecaySystem {
    pub fn update(&mut self, delta_ms: u64) {
        for p in &mut self.particles {
            let dt = delta_ms as f32 / 1000.0;

            // Apply physics
            p.velocity += self.gravity * dt;
            p.velocity *= 1.0 - self.drag * dt;
            p.position += p.velocity * dt;

            // Decay
            p.lifetime_ms += delta_ms;
            let progress = p.lifetime_ms as f32 / p.max_lifetime_ms as f32;
            p.size *= 1.0 - self.shrink_rate * dt;
        }

        self.particles.retain(|p| {
            p.lifetime_ms < p.max_lifetime_ms && p.size > 0.01
        });
    }

    pub fn render(&self, fb: &mut Framebuffer) {
        for p in &self.particles {
            let progress = p.lifetime_ms as f32 / p.max_lifetime_ms as f32;
            let alpha = 1.0 - progress;

            let color = if alpha < 0.5 {
                // Blend toward background
                p.color.lerp(&Color::BLACK, 1.0 - alpha * 2.0)
            } else {
                p.color
            };

            let cell_x = p.position.x as usize;
            let cell_y = p.position.y as usize;
            fb.set_cell(cell_x, cell_y, Cell::glyph(p.glyph, color));
        }
    }
}
```

### 6.6 Spring Physics

```rust
pub struct Spring<T> {
    current: T,
    target: T,
    velocity: T,
    stiffness: f32,
    damping: f32,
    mass: f32,
}

impl Spring<f32> {
    pub fn new(current: f32) -> Self {
        Spring {
            current,
            target: current,
            velocity: 0.0,
            stiffness: 0.1,
            damping: 0.8,
            mass: 1.0,
        }
    }

    pub fn set_target(&mut self, target: f32) {
        self.target = target;
    }

    pub fn advance(&mut self, delta_ms: u64) {
        let dt = delta_ms as f32 / 1000.0;

        let displacement = self.current - self.target;
        let spring_force = -self.stiffness * displacement;
        let damping_force = -self.damping * self.velocity;
        let acceleration = (spring_force + damping_force) / self.mass;

        self.velocity += acceleration * dt;
        self.current += self.velocity * dt;
    }

    pub fn is_at_rest(&self) -> bool {
        self.velocity.abs() < 0.001 && (self.current - self.target).abs() < 0.001
    }
}

// Usage: Smooth follow of cursor or scroll position
let mut scroll_pos = Spring::new(0.0);
scroll_pos.set_target(50.0);
// On each frame:
scroll_pos.advance(16);
let current = scroll_pos.current;  // Smoothly interpolates to 50.0
```

### 6.7 Special Effects

```rust
// Glow effect
pub struct GlowEffect {
    center: Vec2,
    radius: f32,
    intensity: f32,
    color: Color,
}

impl GlowEffect {
    pub fn render(&self, fb: &mut Framebuffer) {
        for y in 0..fb.height {
            for x in 0..fb.width {
                let dist = Vec2::new(x as f32, y as f32).distance(self.center);
                if dist < self.radius {
                    let strength = 1.0 - dist / self.radius;
                    let alpha = strength * self.intensity;
                    let blended = Color::lerp(&Color::BLACK, &self.color, alpha);
                    fb.set_cell(x, y, Cell::bg(blended));
                }
            }
        }
    }
}

// Scanline effect
pub struct ScanlineEffect {
    position: f32,
    speed: f32,
    height: f32,
    color: Color,
    opacity: f32,
}

impl ScanlineEffect {
    pub fn update(&mut self, delta_ms: u64) {
        self.position += self.speed * delta_ms as f32 / 1000.0;
        if self.position > fb.height as f32 {
            self.position = 0.0;
        }
    }

    pub fn render(&self, fb: &mut Framebuffer) {
        for y in (self.position as usize)..((self.position + self.height) as usize) {
            if y < fb.height {
                for x in 0..fb.offset.x {
                    let existing = fb.get_cell(x, y).unwrap_or_default();
                    let blended = Color::lerp(&existing.fg, &self.color, self.opacity);
                    fb.set_cell(x, y, Cell::fg(blended));
                }
            }
        }
    }
}

// Chromatic aberration
pub struct ChromaticAberration {
    offset_r: Vec2,
    offset_g: Vec2,
    offset_b: Vec2,
    intensity: f32,
}

impl ChromaticAberration {
    pub fn render(&self, source: &Framebuffer, target: &mut Framebuffer) {
        for y in 0..target.height {
            for x in 0..target.width {
                let r = source.get_cell(
                    (x as f32 + self.offset_r.x) as usize,
                    (y as f32 + self.offset_r.y) as usize,
                );
                let g = source.get_cell(
                    (x as f32 + self.offset_g.x) as usize,
                    (y as f32 + self.offset_g.y) as usize,
                );
                let b = source.get_cell(
                    (x as f32 + self.offset_b.x) as usize,
                    (y as f32 + self.offset_b.y) as usize,
                );

                target.set_cell(x, y, Cell::rgb(
                    r.map(|c| c.fg.r).unwrap_or(0),
                    g.map(|c| c.fg.g).unwrap_or(0),
                    b.map(|c| c.fg.b).unwrap_or(0),
                ));
            }
        }
    }
}
```

### 6.8 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Animating at uncapped fps | High CPU, tearing | Use frame limiting |
| No dirty tracking | Full redraw every frame | Mark cells dirty |
| Blocking on animation | Unresponsive UI | Use async tick |
| Wrong easing curve | Jerky motion | Profile easing curves |
| No decay | Cluttered screen | Always add fade-out |

---

# PART 2: NOVEL CONCEPTS REPORT

## Animation Systems: Untapped Opportunities

### Concept 1: Emotional Animation Curves

**Idea:** Animations driven by **emotional affect models**, not just physical easing.

**How:**
```rust
pub enum AffectiveState {
    Neutral,
    Happy,
    Excited,
    Anxious,
    Confused,
    Confident,
}

pub struct EmotionalEasing {
    state: AffectiveState,
    intensity: f32,
}

impl EmotionalEasing {
    pub fn get_curve(&self) -> EasingFn {
        match self.state {
            AffectiveState::Neutral => ease_in_out_quad,
            AffectiveState::Happy => |t| ease_out_back(t) * self.intensity + t * (1.0 - self.intensity),
            AffectiveState::Excited => ease_out_elastic,
            AffectiveState::Anxious => |t| t * t * (3.0 - 2.0 * t) * self.intensity + ease_in_quad(t) * (1.0 - self.intensity),
            AffectiveState::Confused => |t| {
                let wobble = (t * 10.0).sin() * 0.05 * self.intensity;
                t + wobble
            },
            AffectiveState::Confident => ease_out_cubic,
        }
    }
}
```

**Novel because:** TUIs use one generic easing curve. This ties animation to emotional context.

**Complexity:** Medium
**Value:** Medium-High (animations feel "right" for each context)

---

### Concept 2: Blur-and-Subpixel Motion Blur

**Idea:** Render **motion blur** using sub-cell translations during motion, not post-processing.

**How:**
```rust
pub struct MotionBlurRenderer {
    velocity_history: Vec<(f32, f32)>,  // Recent positions
    max_velocity: usize,  // Max distance to blur
}

impl MotionBlurRenderer {
    pub fn render_motion_blur(&self, fb: &mut Framebuffer, current_pos: Vec2) {
        for (i, (prev_x, prev_y)) in self.velocity_history.iter().rev().enumerate() {
            let alpha = 1.0 - (i as f32 / self.velocity_history.len() as f32);
            let blended = Color::WHITE.with_alpha(alpha * 0.3);
            let x = (prev_x + (current_pos.x - prev_x) * (i as f32 / self.velocity_history.len() as f32)) as usize;
            let y = (prev_y + (current_pos.y - prev_y) * (i as f32 / self.velocity_history.len() as f32)) as usize;
            fb.set_cell(x, y, Cell::glyph('·', blended));
        }
    }
}
```

**Novel because:** TUIs assume crisp, static rendering. Motion blur = cinematic feel.

**Complexity:** Medium
**Value:** Medium (polished feel for scrolling/panning)

---

### Concept 3: Time-Domain Texture Synthesis

**Idea:** Generate **animated textures** (noise, patterns) using procedural functions of time, not static images.

**How:**
```rust
pub struct TimeTexture {
    seed: u32,
    function: fn(f64, Vec2) -> f64,
    scale: f32,
}

impl TimeTexture {
    pub fn sample(&self, x: usize, y: usize, time_ms: u64) -> Color {
        let u = x as f64 * self.scale as f64;
        let v = y as f64 * self.scale as f64;
        let t = time_ms as f64 * 0.001;

        let value = (self.function)(t, Vec2::new(u, v));

        // Map value to color
        Color::lerp(&Color::BLACK, &Color::DARK_BLUE, value.clamp(0.0, 1.0) as f32)
    }
}

// Example: Animated smoke
fn smoke_noise(t: f64, p: Vec2) -> f64 {
    let n1 = perlin_noise(t * 0.1, p.x, p.y);
    let n2 = perlin_noise(t * 0.15 + 100.0, p.y, p.x);
    let n3 = perlin_noise(t * 0.2 + 200.0, p.x * 2.0, p.y * 2.0);
    (n1 + n2 + n3) / 3.0
}
```

**Novel because:** No TUI generates animated procedural textures. All use static backgrounds or colors.

**Complexity:** Medium
**Value:** Medium (unique aesthetic, strong brand identity)

---

**End of Animation Systems Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Effect State Machine from TerminalTextEffects

TerminalTextEffects' effect system formalizes animation as a state machine with four stages: `Initialize → Update(frame) → Render → Complete?`. The `Effect` base class (`self.frame`, `self.complete`) carries per-animation state. `CharState` tracks per-character position (`x, y`), target (`target_x, target_y`), reveal status, and color. `EffectChain` sequences effects: when current effect completes, advance to next. `Effect` types with parallel execution via `EffectGroup`. This maps directly to any TUI animation: tool-tool call animations, loading spinners, state-transition effects, background ambient motion. The per-character state pattern is reusable for any grid-based animation — not just text effects.

## 3.2 Easing Functions and Physics

TerminalTextEffects provides the full set: linear, ease-in/out quad/cubic/quart/quint, elastic, bounce, back (overshoot), circ. In formula form:
```python
def ease_in_out_quad(t):
    return t < 0.5 and 2*t*t or 1 - pow(-2*t + 2, 2) / 2
```
For spring animations: compute from velocity + damping ratio rather than easing. The wave pattern `math.sin((index/wavelength) + (frame*speed))` produces smooth periodic motion with tunable frequency and phase. Particle systems add position, velocity, acceleration, and lifetime — useful for scattered-reveal effects. HSV color cycling (`hue = (frame/total_frames) % 1.0`) produces smooth rainbow transitions.

## 3.3 Animation Timing Primitives

Delta time accumulation is the only correct timing primitive. Fixed `sleep(16ms)` breaks on variable-load hardware. Use: `frame_duration = 1.0 / fps`, `elapsed = now - last_frame`, `if elapsed < frame_duration: sleep(frame_duration - elapsed)`. This pattern appears in Termflix (video frame timing), TerminalTextEffects (`AnimationTimer`), and Termflix's `maintain_framerate()`. Termflix's frame-skip logic (`if lagging > threshold: skip frame`) prevents cascading slowdown. Cache ANSI string builds; emit character runs not individual cells; batch writes avoiding flushes per cell.


---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Canopy's Idle Timer + Attention Animation

Canopy implements two lightweight animation hooks for interactive terminals:

**Idle timer:**
```typescript
idleTimerRef.current = setTimeout(() => emitStatus("idle"), IDLE_THRESHOLD_MS);
```
Reset on every output event. Cleared on exit or attention event.

**Attention cooldown (5s):**
After the attention-pattern matcher fires, further matches are suppressed for ATTENTION_COOLDOWN ms. Prevents flickering status toggles when the same prompt emits repeatedly.

**Font zoom state machine:**
delta is clamped to [8, 24]; reset value is 13. After font change:
1. `xtermRef.current.options.fontSize = next`
2. `fitAddonRef.current.fit()` — refit DOM
3. `resizeTerminal(termId, xterm.rows, xterm.cols)` — notify backend

This triple-update is required. Skipping the PTY resize leaves subprocesses (vim, less, etc.) with stale dimensions.

---

# PART 5: ADVANCED ANIMATION PATTERNS FROM CROSS-CORPUS ANALYSIS

## 5.1 Column-Based Trail Animation (CMatrix)

CMatrix demonstrates the foundational "Matrix rain" pattern in a single 26KB C file using ncurses. Its architecture maps directly to any terminal particle/ambient effect:

**Column-independent animation state:**
```c
// Each column tracks its own head position and speed
int head[MAX_COLS];        // Current y-position of lead char
int length[MAX_COLS];      // Trail length
int speed[MAX_COLS];       // Drop speed (chars/frame)
```

**Trail rendering with color gradient:**
```c
// Head: bright white, trail: fading green, tail: dark
attron(COLOR_PAIR(1) | A_BOLD);     // Bright head
addch(random_char());
attroff(A_BOLD);
attron(COLOR_PAIR(2));               // Medium trail
// Tail fades via COLOR_PAIR(3..6) decreasing intensity
```

**Universal animation loop pattern:**
```
setup_terminal() → raw mode, hide cursor, init colors
loop:
  check_input()   → non-blocking getch()
  update_state() → move each column's head down
  draw_frame()    → render all columns with trail fade
  refresh()       → flush to terminal
  napms(delay)    → frame timing
cleanup()         → restore terminal
```

**Key reusable patterns:**
1. **Per-column independence** — each column has separate timing; non-uniform speeds create organic motion
2. **Trail persistence** — store N historic positions per column, fade color/character by age
3. **Graceful resize** — detect KEY_RESIZE → endwin()/refresh() to re-query dimensions → reallocate arrays → preserve animation state
4. **Frame timing via napms()** — adjustable speed via CLI flag; balance smoothness vs CPU

**Cross-language ports:** Rust (crossterm `terminal.draw()` + `thread::sleep`), Go (tcell `screen.Init/Clear/Show` in loop), Python (curses `wrapper(main)`, `stdscr.refresh()`).

## 5.2 Plane-Based Compositing for Animation (Notcurses)

Notcurses' plane system provides the optimal animation architecture for TUIs: each animated element gets its own off-screen buffer (plane). The render cycle composites all planes z-ordered into terminal output.

**Plane struct for animation:**
```c
struct ncplane {
    int absx, absy;        // Position (animated via move_*)  
    int lenx, leny;        // Dimensions
    int z;                 // Z-order for layering
    cell* contents;        // Per-cell RGBA buffer
    bool* damaged;         // Dirty region tracking
    struct ncplane* next;  // Linked list for stacking
};
```

**Animation-relevant plane operations:**
| Operation | Use Case |
|-----------|----------|
| `ncplane_move_top/below()` | Dynamic z-reordering on focus change |
| `ncplane_move_above/below()` | Animated layer transitions |
| `ncplane_set_base()` | Set transparent bg for compositing |
| `ncplane_box()` | Animated border with rounded/double styles |
| `ncplane_putstr()` | Text content update (triggers dirty) |
| `ncrender()` | Composite all planes → terminal output |

**Dirty tracking for animation performance:**
- Each plane tracks its own damaged regions
- `ncrender()` only writes changed cells
- Double-buffered: off-screen plane → compose → single write
- Essential when multiple planes animate simultaneously

**Cell structure for per-character animation:**
```c
typedef struct cell {
    uint32_t channels;      // Packed FG/BG RGBA
    uint32_t gcluster;      // Unicode grapme cluster
    char* gcluster_scratch; // Overflow for long EGCs
} cell;
```
Cells store full 24-bit RGBA, enabling per-character alpha blending for fade animations.

**The notcurses render cycle for animation:**
```
for each plane (z-sorted):
  if plane->damaged:
    rasterize changed cells to optimal escape sequences
write all sequences in single syscall
```
This minimizes terminal round-trips — critical when 5+ planes animate at 30fps.

## 5.3 Immediate-Mode UI Animation Patterns (Dear ImGui)

Dear ImGui's animation approach: no persistent state, compute everything from time + input each frame. This is directly applicable to TUI animation because TUIs already redraw every frame.

**Five patterns extracted from ImGui's source:**

**Pattern 1 — Subtle Hover Pulse:**
```cpp
// 5% scale pulse at 8Hz when hovered
float hoverScale = 1.0f + 0.05f * sin(g.Time * 8.0f);
RenderButton(label, scale = hoverScale);
```
TUI equivalent: alternate between bold/normal, or cycle 2-3 color shades at 4-8Hz.

**Pattern 2 — Color Transition (not instant):**
```cpp
// Store current + target, each frame lerp toward target
color.Current = Lerp(color.Current, color.Target, g.DeltaTime * speed);
```
Speed 0.1 = ~10 seconds to fully transition. For status indicators, focus changes, theme switches — never snap colors instantaneously.

**Pattern 3 — Press-Down Feedback:**
```cpp
if (IsActive && IsHovered) {
    offset = ImVec2(2, 2);  // Shift content down-right 2px
    scale = 0.97f;          // 3% shrink
}
```
TUI equivalent: when a button is active, shift content 1 cell right via padding, or use dim attribute to simulate "pressed in."

**Pattern 4 — Tooltip Delay + Fade:**
```cpp
if (HoveredTime > TooltipDelay) {
    tooltip.Alpha = Min(1.0f, (HoveredTime - TooltipDelay) * 4.0f);
}
```
300ms delay before tooltip begins appearing, then fade in over 250ms. Eliminates flicker from cursor passing over elements.

**Pattern 5 — Scrollbar Settle (inertial decay):**
```cpp
if (userStoppedScrolling && ScrollVel != 0) {
    ScrollPos += ScrollVel * dt;
    ScrollVel *= 0.95f;    // 5% friction per frame
    if (abs(ScrollVel) < 0.01f) ScrollVel = 0;
}
```
Velocity-based scroll with exponential decay (0.95 coefficient). Content drifts to rest naturally instead of stopping dead.

**Core insight:** In immediate-mode, animation is just `value += (target - value) * speed * dt`. No animation object, no tween library — just interpolation in the update function.

## 5.4 Spring Physics Presets and Stagger Patterns (React Spring)

React Spring defines six standard spring configurations that produce distinct motion personalities. These translate directly to any TUI animation system using Hooke's law integration:

**Preset spring configs:**

| Preset | Tension | Friction | Mass | Character |
|--------|---------|----------|------|-----------|
| `default` | 170 | 26 | 1 | Balanced, smooth |
| `gentle` | 100 | 20 | 1 | Slow, soft landing |
| `wobbly` | 180 | 12 | 1 | Overshoots, oscillates |
| `stiff` | 210 | 20 | 1 | Quick, minimal overshoot |
| `slow` | 280 | 60 | 1 | Very gradual |
| `molasses` | 280 | 130 | 1 | Heavily damped, no bounce |

**Spring integration (already in PART 1, repeated for completeness):**
```go
func (s *Spring) Update(dt float64) {
    displacement := s.position - s.target
    acceleration := -s.tension * displacement / s.mass
    s.velocity += acceleration * dt
    s.velocity *= s.friction       // Damping
    s.position += s.velocity * dt
}
```

**Staggered list reveal:**
```
items[i].delay = i * 100ms     // Each item starts 100ms after previous
from: { opacity: 0, y: 20 }
to:   { opacity: 1, y: 0 }
config: { tension: 170, friction: 26 }
```
Creates a waterfall entrance effect. For agent output streams, file listings, search results — any dynamically loaded list.

**Trail/stagger on filter:**
When a filtered list changes, animate OUT removed items (scale 1→0.8, opacity 1→0) then animate IN new items with 50ms stagger per index. Combined effect: content appears to reorganize itself fluidly.

**Gesture-based animation (swipe-to-dismiss pattern):**
```
on_drag:   position = drag_x
on_release: spring.target = 0 (or dismiss_threshold)
spring backs to origin with gentle preset if not past threshold
```
TUI mapping: mouse-drag to reorder list items, release snaps into place.

**Parallax scrolling for layered TUIs:**
```
background_layer:  scroll * 0.3   // Moves 30% of scroll distance
content_layer:     scroll * 1.0   // Normal speed
foreground_layer:  scroll * 1.5   // Moves 1.5x (faster)
```
Creates depth illusion. Status bars, side panels, and background textures move at different rates.

---

# PART 6: DEEP TERMINALTEXTEFFECTS PATTERNS

## 6.1 Per-Character State for Grid Animation

```python
class CharState:
    def __init__(self, char, x, y):
        self.char = char
        self.x = x          # Current position (float for sub-cell)
        self.y = y
        self.target_x = x   # Target position
        self.target_y = y
        self.revealed = False
        self.color = WHITE

    def update(self, easing_fn, progress):
        self.x = lerp(self.x, self.target_x, easing_fn(progress))
        self.y = lerp(self.y, self.target_y, easing_fn(progress))
```

This pattern enables: typewriter reveals, scatter-to-assemble, wave motion, gravity falls, directional slides, zoom effects — all from the same per-character state + easing function.

## 6.2 Effect Composition Patterns

**EffectChain** (sequential): When current effect completes, advance to next. Use for: load → process → display sequences.

**EffectGroup** (parallel): Multiple effects run simultaneously on the same or different targets. Use for: background animation + foreground content animation.

**Nested effects:** An EffectGroup containing EffectChains that themselves contain EffectGroups — arbitrary nesting depth for complex multi-phase animations.

## 6.3 Effect Types Catalog

| Effect Category | Specific Effects | Animation Approach |
|----------------|-----------------|-------------------|
| Reveal | Typewriter, scatter, slide | Per-char position lerp over time |
| Motion | Wave, fall, zoom | Per-char path function of frame |
| Color | HSV cycle, gradient, rainbow | Color interpolation per frame |
| Combined | Gravity + fade + color shift | Multiple state dimensions animated in parallel |

## 6.4 SVG/Path-Based Animation (Ronin)

Ronin (web-based vector tool) provides SVG path patterns adaptable to terminal animation:

```python
# SVG path → terminal grid rasterization
def rasterize_path(path, width, height):
    for y in range(height):
        for x in range(width):
            if point_in_path(x, y, path):
                set_cell(x, y, Cell('█', Color))
```
Use for: animated logos, vector-based transitions, procedural art backgrounds. The vector path defines a region that can be animated (scale, rotate, morph) before rasterization to the character grid.

---
