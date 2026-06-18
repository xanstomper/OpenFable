# Animation Study: Dear ImGui + React Spring

## Overview
Two repositories cloned to extract "alive" animation patterns for TUI:
- **Dear ImGui** (`imgui/`) - Immediate-mode GUI with subtle hover/motion feedback
- **React Spring** (`react-spring/`) - Spring physics, staggering, easing curves

**Goal:** Extract patterns for making coding agent TUI feel organic, responsive, and "alive"

---

## Dear ImGui: Subtle UI Motion Patterns

### Core Philosophy
**Immediate Mode** = Perfect for TUIs
- No state management overhead
- Every frame is a complete redraw
- Animation is just interpolation over time
- Hover/active states are computed, not stored

### Key Animation Patterns from ImGui

#### 1. Hover Feedback (Subtle Scale)
```cpp
// From imgui_widgets.cpp pattern
if (IsItemHovered()) {
    // Gentle pulse on hover
    float hoverScale = 1.0f + 0.05f * sin(g.Time * 8.0f);
    RenderButton(label, scale = hoverScale);
}
```

**TUI Adaptation:**
```go
func (m model) View() string {
    if m.hovered {
        // Subtle 5% pulse at 8Hz
        scale := 1.0 + 0.05 * math.Sin(time.Now().UnixNano()/1e8)
        return RenderScaledButton(m.label, scale)
    }
    return RenderButton(m.label, 1.0)
}
```

#### 2. Color Transition (Not Instant)
```cpp
// ImGui stores target + current, interpolates
color.Current = Lerp(color.Current, color.Target, g.Time * 0.1f);
```

**TUI Adaptation:**
```go
type Button struct {
    CurrentColor lipgloss.Color
    TargetColor  lipgloss.Color
}

func (b *Button) Update(dt float64) {
    // Smooth color transition over ~10 seconds
    b.CurrentCulture = LerpColor(b.CurrentCulture, b.TargetColor, dt * 0.1)
}
```

#### 3. Tooltip Delay + Fade
```cpp
// Not instant - feels more natural
if (HoveredTime > g.TooltipDelay) {
    tooltip.Alpha = Min(1.0f, (HoveredTime - g.TooltipDelay) * 4.0f);
}
```

**TUI Adaptation:**
```go
if time.Since(m.hoverStart) > 300*time.Millisecond {
    alpha := math.Min(1.0, time.Since(m.hoverStart).Seconds()*4.0 - 1.2)
    return RenderTooltip(m.tooltip, alpha)
}
```

#### 4. Active State "Press Down"
```cpp
if (IsActive && IsHovered) {
    // Visual "press" feedback
    offset = ImVec2(2, 2);  // Shift content down-right
    scale = 0.97f;          // Slight shrink
}
```

**TUI Adaptation:**
```go
if m.pressed {
    // Shift text 2 cells, scale to 97%
    style := lipgloss.NewStyle().
        Padding(1, 2).  // Simulate offset
        Scale(0.97)
    return style.Render(m.label)
}
```

#### 5. Scrollbar "Settle" Animation
```cpp
// Continues moving slightly after user stops
if (userStoppedScrolling && ScrollVel != 0) {
    ScrollPos += ScrollVel * dt;
    ScrollVel *= 0.95f;  // Decay
    if (abs(ScrollVel) < 0.01f) ScrollVel = 0;
}
```

**TUI Adaptation:**
```go
func (m *Viewport) Update(dt float64) {
    if m.scrolling {
        m.scrollY += m.scrollVel * dt
        m.scrollVel *= 0.95  // Friction
        if math.Abs(m.scrollVel) < 0.01 {
            m.scrollVel = 0
        }
    }
}
```

---

## React Spring: Spring Physics for TUI

### Why Spring Physics > Easing Curves
- **Natural feel** - Mass, tension, damping = real-world motion
- **Interruptible** - Can reverse mid-animation smoothly
- **Composable** - Multiple springs can act on same element
- **Predictable** - Physics are consistent, not arbitrary

### Core Spring Config (from `react-spring/packages/core/src/types.ts`)

```typescript
interface SpringConfig {
  mass: number;      // Weight (default: 1)
  tension: number;   // Spring tightness (default: 170)
  friction: number;  // Damping (default: 26)
  velocity: number;  // Initial velocity (default: 0)
}

// Common presets
const config = {
  default:   { tension: 170, friction: 26, mass: 1 },
  gentle:    { tension: 100, friction: 20, mass: 1 },
  wobbly:    { tension: 180, friction: 12, mass: 1 },
  stiff:     { tension: 210, friction: 20, mass: 1 },
  slow:      { tension: 280, friction: 60, mass: 1 },
  molasses:  { tension: 280, friction: 130, mass: 1 },
}
```

### Key Patterns to Extract

#### 1. Staggered List Reveal
```typescript
// From react-spring usage
items.map((item, i) => (
  <Spring
    key={item.id}
    from={{ opacity: 0, y: 20 }}
    to={{ opacity: 1, y: 0 }}
    delay={i * 100}  // Stagger by 100ms each
    config={{ tension: 170, friction: 26 }}
  />
))
```

**TUI Adaptation:**
```go
func (m *ListModel) StartReveal() {
    for i, item := range m.items {
        go func(idx int, it *Item) {
            time.Sleep(time.Duration(idx) * 100 * time.Millisecond)
            it.Reveal()  // Animate from hidden to visible
        }(i, item)
    }
}

type Item struct {
    opacity  float64  // 0 → 1
    yOffset  float64  // 20 → 0
    targetOp float64
    targetY  float64
}

func (it *Item) Update(dt float64) {
    // Spring interpolation
    it.opacity += (it.targetOp - it.opacity) * dt * 5
    it.yOffset += (it.targetY - it.yOffset) * dt * 5
}
```

#### 2. Chain Animations (Sequential)
```typescript
useChain([listRef, contentRef], [0, 0.5], 1.5)
// listRef animates first, contentRef starts at 0.5s
```

**TUI Adaptation:**
```go
func (m *Model) AnimateEntrance() tea.Cmd {
    return tea.Batch(
        // Phase 1: Border expands (0-500ms)
        tea.Tick(500*time.Millisecond, func(t time.Time) tea.Msg {
            m.borderScale = 1.0
            return AnimateContentMsg{}
        }),
        // Phase 2: Content fades in (after border done)
    )
}
```

#### 3. Parallax Scrolling
```typescript
// From @react-spring/parallax
<Parallax offset={scroll / 1000}>
  <Layer offset={0} factor={1}>Background (slow)</Layer>
  <Layer offset={0.2} factor={1}>Content (normal)</Layer>
  <Layer offset={0.5} factor={1}>Foreground (fast)</Layer>
</Parallax>
```

**TUI Adaptation:**
```go
func (m *Model) View() string {
    parallax := m.scrollY * 0.3  // Background moves 30%
    
    bg := lipgloss.Place(
        width, height,
        lipgloss.Center, lipgloss.Center,
        m.background,
        lipgloss.WithOffset(parallax, 0),  // Slow
    )
    
    fg := lipgloss.Place(
        width, height,
        lipgloss.Center, lipgloss.Center,
        m.foreground,
        lipgloss.WithOffset(m.scrollY, 0),  // Normal
    )
    
    return lipgloss.JoinVertical(lipgloss.Center, bg, fg)
}
```

#### 4. Gesture-Based Animation
```typescript
// Draggable with spring-back
const [{ x }, drag] = useSpring(() => ({
  x: 0,
  config: { mass: 1, tension: 280, friction: 20 },
}))

// On drag end, spring back to 0
```

**TUI Adaptation (for swipe-to-dismiss):**
```go
func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.MouseMsg:
        if msg.Type == tea.MouseMotion {
            m.dragX = msg.X - m.startX
            // Calculate spring-back force
            m.springVel += (0 - m.dragX) * tension * dt
            m.springVel *= friction
        }
        if msg.Type == tea.MouseRelease {
            // Release with spring-back
            return m, AnimateDragSpringBack
        }
    }
}
```

#### 5. Trail/Stagger on Filter
```typescript
// When filtering a list, staggers out
items.filter(...).map((item, i) => (
  <AnimatedItem
    key={item.id}
    from={{ scale: 0.8, opacity: 0 }}
    to={{ scale: 1, opacity: 1 }}
    delay={i * 50}
  />
))
```

**TUI Adaptation:**
```go
func (m *Model) ApplyFilter(query string) {
    m.filtered = filter(m.items, query)
    for i, item := range m.filtered {
        item.scale = 0.8
        item.opacity = 0
        go func(idx int, it *Item) {
            time.Sleep(time.Duration(idx) * 50 * time.Millisecond)
            it.scale = 1.0
            it.opacity = 1.0
        }(i, item)
    }
}
```

---

## "Alive" TUI Effects Implementation Guide

### Effect 1: Breathing Border (Ambient Motion)
```go
type BreathingBorder struct {
    phase      float64  // 0 to 2π
    speed      float64  // Radians per second
    minOpacity float64
    maxOpacity float64
}

func (b *BreathingBorder) Update(dt float64) {
    b.phase += b.speed * dt
    if b.phase > 2*math.Pi {
        b.phase -= 2 * math.Pi
    }
}

func (b *BreathingBorder) Color() lipgloss.Color {
    // Sine wave oscillation
    intensity := 0.5 + 0.5*math.Sin(b.phase)
    opacity := b.minOpacity + (b.maxOpacity-b.minOpacity)*intensity
    return lipgloss.Color(fmt.Sprintf("rgba(124, 58, 237, %.2f)", opacity))
}

// Usage:
border := BreathingBorder{speed: 2.0, minOpacity: 0.3, maxOpacity: 0.8}
style := lipgloss.NewStyle().BorderForeground(border.Color())
```

### Effect 2: Staggered Reveal on Load
```go
func (m *Model) LoadData(items []Item) tea.Cmd {
    m.items = make([]Item, len(items))
    
    // Stagger each item's entrance
    cmds := []tea.Cmd{}
    for i := range items {
        idx := i
        cmd := tea.Tick(time.Duration(i)*80*time.Millisecond, func(t time.Time) tea.Msg {
            return ItemRevealMsg{Index: idx}
        })
        cmds = append(cmds, cmd)
    }
    
    return tea.Batch(cmds...)
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    case ItemRevealMsg:
        m.items[msg.Index].Revealed = true
        // Item will animate from hidden → visible with spring
        return m, StartItemSpring(msg.Index)
}
```

### Effect 3: Particle Trail on Cursor/Selection
```go
type Particle struct {
    X, Y    float64
    VX, VY  float64
    Life    float64  // 0 to 1
    MaxLife float64
    Char    rune
    Color   lipgloss.Color
}

type ParticleSystem struct {
    particles []Particle
}

func (ps *ParticleSystem) Spawn(x, y float64, char rune, color lipgloss.Color) {
    ps.particles = append(ps.particles, Particle{
        X: x, Y: y,
        VX: (rand.Float64() - 0.5) * 2,  // Random spread
        VY: (rand.Float64() - 0.5) * 2,
        Life:    1.0,
        MaxLife: 0.5,  // 500ms
        Char:    char,
        Color:   color,
    })
}

func (ps *ParticleSystem) Update(dt float64) {
    for i := len(ps.particles) - 1; i >= 0; i-- {
        p := &ps.particles[i]
        p.X += p.VX * dt
        p.Y += p.VY * dt
        p.VY += 0.5 * dt  // Gravity
        p.Life -= dt / p.MaxLife
        
        if p.Life <= 0 {
            ps.particles = append(ps.particles[:i], ps.particles[i+1:]...)
        }
    }
}

func (ps *ParticleSystem) Render(width, height int) string {
    // Render particles as overlay
    // Fade based on life
}
```

### Effect 4: Spring-Back on Selection Change
```go
type SpringBack struct {
    position   float64
    target     float64
    velocity   float64
    mass       float64
    tension    float64
    friction   float64
}

func (s *SpringBack) Update(dt float64) {
    // Hooke's Law: F = -kx
    acceleration := -s.tension * (s.position - s.target) / s.mass
    s.velocity += acceleration * dt
    s.velocity *= s.friction  // Damping
    s.position += s.velocity * dt
}

func (s *SpringBack) SnapTo(target float64) {
    s.target = target
    // Optional: add initial velocity for overshoot
    s.velocity = 5.0  // "Flick" effect
}

// Usage for list selection:
selection := SpringBack{
    mass: 1.0, tension: 170, friction: 0.92,
}

case KeyMsg:
    if msg.Type == tea.KeyDown {
        selection.SnapTo(float64(m.selectedIndex))
    }
```

### Effect 5: Gradient Flow (Ambient Background)
```go
type FlowingGradient struct {
    hue        float64
    speed      float64  // Degrees per second
    direction  int      // 1 or -1
}

func (g *FlowingGradient) Update(dt float64) {
    g.hue += g.speed * dt * float64(g.direction)
    if g.hue > 360 {
        g.hue -= 360
    }
}

func (g *FlowingGradient) Colors() (lipgloss.Color, lipgloss.Color) {
    // Shift hue over time
    c1 := hslToRGB(g.hue, 0.7, 0.5)
    c2 := hslToRGB((g.hue+60)%360, 0.7, 0.5)
    return c1, c2
}

// Usage:
gradient := FlowingGradient{speed: 10, direction: 1}  // 10°/sec
bg := lipgloss.NewStyle().Background(gradient.Colors()[0])
```

---

## Files to Study

### Dear ImGui:
- `imgui.cpp` - Core animation logic (search for `Lerp`, `HoveredTime`)
- `imgui_widgets.cpp` - Button/hover states (search for `IsItemHovered`)
- `imgui_draw.cpp` - Color interpolation
- `examples/example_glfw_opengl3/` - See complete usage

### React Spring:
- `packages/core/src/SpringValue.ts` - Spring physics engine
- `packages/core/src/hooks/useSpring.ts` - Hook patterns
- `packages/core/src/ animated.ts` - Animated component
- `packages/parallax/src/Parallax.tsx` - Parallax patterns
- `demo/src/` - Live examples of all patterns
- `tests/` - Unit tests show edge cases

---

## Key Takeaways for "Alive" TUI

### From Dear ImGui:
1. **Nothing is instant** - Colors fade, tooltips delay, presses offset
2. **Hover is subtle** - 5% scale, slight pulse, not garish
3. **Idle isn't still** - Scroll continues settling, colors drift slightly
4. **Feedback is physical** - Press moves down-right, not just color change

### From React Spring:
1. **Stagger everything** - Lists reveal item by item, not all at once
2. **Springs > eases** - Mass/tension/friction feels more natural
3. **Chain animations** - Border first, then content, then text
4. **Parallax adds depth** - Background/surface layers move at different speeds
5. **Gesture integration** - Drag affects spring velocity for natural throw

### Implementation Priority:
1. **Week 1:** Breathing border + hover scale (ImGui patterns)
2. **Week 2:** Staggered list reveal (React Spring patterns)
3. **Week 3:** Spring-back selection + particle trails
4. **Week 4:** Gradient flow + parallax scrolling
5. **Week 5:** Polish - timing adjustments, add trail effects

---

## Why These Repos Matter

**Dear ImGui** teaches: Immediate-mode efficiency. Every frame recalculates animation state from time, not stored state. Perfect for TUIs where rendering is already per-frame.

**React Spring** teaches: Spring physics over preset curves. Real mass/tension/friction creates believable motion. Interruptible (user can act mid-animation) without jarring jumps.

**Together they give you:**
- Subtle, continuous ambient motion (ImGui)
- Physical, interruptible state transitions (React Spring)
- Patterns proven in millions of lines of production UI code
- Zero DOM overhead thinking (ImGui is immediate-mode like TUIs)

**This is the "alive" toolkit.**