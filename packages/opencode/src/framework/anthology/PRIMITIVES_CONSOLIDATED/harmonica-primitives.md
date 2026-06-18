# Harmonica Primitives Analysis

## Overview
**Harmonica** is a **spring animation library** for Go that provides **smooth, natural motion** using damped harmonic oscillators. It’s **framework-agnostic** and works in **2D/3D contexts**, including **terminal UIs** (TUIs) and **OpenGL applications**. Harmonica is ideal for adding **fluid animations** to TUIs (e.g., sliding menus, bouncing notifications, smooth transitions).

**Purpose**: Spring-based animations for smooth, natural motion.
**Language**: Go.
**Maturity**: Production.
**Dependencies**: None (pure Go).

---

## Core Primitives

### 1. **Spring Physics**
**Purpose**: Simulate a damped harmonic oscillator for natural motion.

**Primitives**:
- **`NewSpring(fps, angularFreq, damping)`**: Initialize a spring with:
  - `fps`: Framerate (or time delta between updates).
  - `angularFreq`: Angular frequency (controls speed).
  - `damping`: Damping ratio (controls springiness).

**Spring Equation**:
Harmonica implements a **damped simple harmonic oscillator** based on [Ryan Juckett’s C++ implementation](https://www.ryanjuckett.com/damped-springs/). The equation for a spring is:
```
F = -k * x - c * v
```
Where:
- `F` = Force
- `k` = Spring constant (stiffness)
- `x` = Displacement from equilibrium
- `c` = Damping coefficient
- `v` = Velocity

Harmonica abstracts this into **angular frequency** and **damping ratio** for easier tuning.

**Example**:
```go
import "github.com/charmbracelet/harmonica"

// Initialize a spring for 60 FPS, medium speed, slightly springy
spring := harmonica.NewSpring(harmonica.FPS(60), 6.0, 0.5)
```

---

### 2. **Update Method**
**Purpose**: Advance the spring simulation and compute new position/velocity.

**Primitives**:
- **`spring.Update(currentPos, currentVel, targetPos)`**: Returns `(newPos, newVel)` after one time step.

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| `currentPos` | Current position of the object. |
| `currentVel` | Current velocity of the object. |
| `targetPos` | Target position the spring is moving toward. |

**Returns**:
- `newPos`: Updated position after the time step.
- `newVel`: Updated velocity after the time step.

**Example**:
```go
// Animate a sprite toward (100, 200)
spriteX, spriteY := 0.0, 0.0
spriteVelX, spriteVelY := 0.0, 0.0

for {
    // Update X and Y independently
    spriteX, spriteVelX = spring.Update(spriteX, spriteVelX, 100.0)
    spriteY, spriteVelY = spring.Update(spriteY, spriteVelY, 200.0)
    
    // Render sprite at (spriteX, spriteY)
    time.Sleep(time.Second / 60) // 60 FPS
}
```

---

### 3. **Damping Ratios**
**Purpose**: Control the behavior of the spring (overshooting, oscillation, or smooth settling).

**Primitives**:
Harmonica supports three damping modes, controlled by the **damping ratio** (`ζ`):

| Damping Ratio | Behavior | Description |
|---------------|----------|-------------|
| `ζ < 1.0` | **Under-Damped** | Fastest to equilibrium but **overshoots** and oscillates. |
| `ζ = 1.0` | **Critically Damped** | Reaches equilibrium **as fast as possible without oscillating**. |
| `ζ > 1.0` | **Over-Damped** | **No oscillation**, but slower to reach equilibrium than critical damping. |

**Visual Comparison**:
- **Under-Damped (`ζ = 0.1`)**:
  ![Under-Damped](https://stuff.charm.sh/harmonica/under-damped.gif)
  *Overshoots target, oscillates, settles slowly.*

- **Critically Damped (`ζ = 1.0`)**:
  ![Critically Damped](https://stuff.charm.sh/harmonica/critically-damped.gif)
  *Smooth, no overshoot, fastest settlement.*

- **Over-Damped (`ζ = 2.0`)**:
  ![Over-Damped](https://stuff.charm.sh/harmonica/over-damped.gif)
  *Slow, no overshoot, feels "heavy".*

**Example Tuning**:
```go
// Under-damped: Bouncy (ζ = 0.2)
bouncySpring := harmonica.NewSpring(harmonica.FPS(60), 8.0, 0.2)

// Critically damped: Smooth (ζ = 1.0)
smoothSpring := harmonica.NewSpring(harmonica.FPS(60), 6.0, 1.0)

// Over-damped: Heavy (ζ = 2.0)
heavySpring := harmonica.NewSpring(harmonica.FPS(60), 4.0, 2.0)
```

---

### 4. **Angular Frequency**
**Purpose**: Control the **speed** of the spring animation.

**Primitives**:
- **Angular Frequency (`ω`)**: Higher values = faster motion.
  - Typical range: `1.0` (slow) to `10.0` (very fast).
  - Default: `6.0` (moderate speed).

**How It Works**:
- Angular frequency determines how **quickly** the spring oscillates.
- Combined with damping, it controls the **feel** of the animation.

**Example**:
```go
// Slow spring (ω = 2.0)
slowSpring := harmonica.NewSpring(harmonica.FPS(60), 2.0, 0.5)

// Fast spring (ω = 10.0)
fastSpring := harmonica.NewSpring(harmonica.FPS(60), 10.0, 0.5)
```

---

### 5. **FPS Utility**
**Purpose**: Convert a target framerate into a time delta.

**Primitives**:
- **`harmonica.FPS(int)`**: Returns a time delta for the given FPS.

**Example**:
```go
// 30 FPS
spring := harmonica.NewSpring(harmonica.FPS(30), 6.0, 0.5)

// 120 FPS (for high-refresh terminals)
spring := harmonica.NewSpring(harmonica.FPS(120), 6.0, 0.5)
```

**Custom Time Delta**:
If you have a variable framerate (e.g., from a game engine), pass the actual time delta:
```go
// In a game loop with variable delta time
deltaTime := time.Since(lastFrame).Seconds()
spring := harmonica.NewSpring(deltaTime, 6.0, 0.5)
```

---

## Technical Insights

### **How Springs Work**
Harmonica’s springs are based on **damped harmonic motion**, which combines:
1. **Hooke’s Law** (`F = -k * x`): The restoring force of a spring (proportional to displacement).
2. **Damping Force** (`F = -c * v`): A force opposing motion (proportional to velocity).

The **damping ratio** (`ζ`) and **angular frequency** (`ω`) are derived from:
- `ζ = c / (2 * sqrt(k * m))` (where `m` = mass, `c` = damping coefficient, `k` = spring constant).
- `ω = sqrt(k / m)` (natural frequency of the undamped system).

Harmonica simplifies this by letting you **directly set `ω` and `ζ`** instead of `k`, `c`, and `m`.

### **Performance**
- **Zero Allocations**: The `Update` method is allocation-free (important for high-FPS TUIs).
- **Deterministic**: Same inputs → same outputs (reproducible animations).
- **Low CPU Usage**: Simple math (no trigonometry, just addition/multiplication).

### **Numerical Stability**
- Uses **implicit integration** (Euler method) for stability.
- Works well for **real-time applications** (e.g., TUIs, games).
- Avoids **exploding values** (unlike naive implementations).

---

## Integration Patterns

### **1. Basic TUI Animation**
```go
package main

import (
    "fmt"
    "time"
    "github.com/charmbracelet/harmonica"
)

func main() {
    // Initialize spring for 30 FPS, medium speed, slightly springy
    spring := harmonica.NewSpring(harmonica.FPS(30), 6.0, 0.3)
    
    // Animate a progress bar
    current := 0.0
    velocity := 0.0
    target := 100.0
    
    for i := 0; i < 60; i++ {
        current, velocity = spring.Update(current, velocity, target)
        fmt.Printf("\rProgress: [%3d%%]", int(current))
        time.Sleep(time.Second / 30)
    }
    fmt.Println()
}
```

### **2. Bubble Tea Integration**
```go
package main

import (
    "time"
    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/harmonica"
)

type Model struct {
    spring   *harmonica.Spring
    position float64
    velocity float64
    target   float64
}

func NewModel() Model {
    return Model{
        spring:   harmonica.NewSpring(harmonica.FPS(60), 5.0, 0.5),
        target:   20.0,
    }
}

func (m Model) Init() tea.Cmd {
    return tea.Tick(time.Second/60, func(t time.Time) tea.Msg {
        return tickMsg{}
    })
}

type tickMsg struct{}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tickMsg:
        m.position, m.velocity = m.spring.Update(m.position, m.velocity, m.target)
        if abs(m.position - m.target) < 0.1 {
            m.target = 0.0 // Bounce back
        }
    }
    return m, nil
}

func (m Model) View() string {
    bar := "[" + strings.Repeat("#", int(m.position)) + strings.Repeat(" ", 20-int(m.position)) + "]"
    return bar + "\nPosition: " + fmt.Sprintf("%.1f", m.position)
}

func abs(x float64) float64 {
    if x < 0 { return -x }
    return x
}

func main() {
    p := tea.NewProgram(NewModel())
    p.Start()
}
```

### **3. Multi-Spring Animation (2D)**
```go
package main

import (
    "fmt"
    "time"
    "github.com/charmbracelet/harmonica"
)

func main() {
    spring := harmonica.NewSpring(harmonica.FPS(60), 6.0, 0.5)
    
    x, vx := 0.0, 0.0
    y, vy := 0.0, 0.0
    
    for i := 0; i < 100; i++ {
        // Animate to (100, 50)
        x, vx = spring.Update(x, vx, 100.0)
        y, vy = spring.Update(y, vy, 50.0)
        
        fmt.Printf("\rPosition: (%.1f, %.1f)", x, y)
        time.Sleep(time.Second / 60)
    }
}
```

### **4. Chaining Springs (Sequential Animations)**
```go
package main

import (
    "fmt"
    "time"
    "github.com/charmbracelet/harmonica"
)

func main() {
    spring := harmonica.NewSpring(harmonica.FPS(60), 8.0, 0.5)
    
    // Animate to 100, then to 0, then to 50
    targets := []float64{100.0, 0.0, 50.0}
    targetIndex := 0
    current, velocity := 0.0, 0.0
    
    for i := 0; i < 300; i++ {
        target := targets[targetIndex]
        current, velocity = spring.Update(current, velocity, target)
        
        // Switch to next target when close enough
        if abs(current - target) < 0.1 && targetIndex < len(targets)-1 {
            targetIndex++
        }
        
        fmt.Printf("\rValue: %.1f", current)
        time.Sleep(time.Second / 60)
    }
}
```

### **5. Spring with External Forces**
```go
package main

import (
    "fmt"
    "time"
    "github.com/charmbracelet/harmonica"
)

func main() {
    spring := harmonica.NewSpring(harmonica.FPS(60), 5.0, 0.8)
    
    current, velocity := 0.0, 0.0
    target := 50.0
    
    for i := 0; i < 100; i++ {
        // Apply external force (e.g., user drag)
        externalForce := 0.0
        if i == 30 {
            externalForce = -20.0 // Push left at frame 30
        }
        
        // Update with external force
        current, velocity = spring.Update(current, velocity, target)
        current += externalForce // Apply force
        
        fmt.Printf("\rPosition: %.1f", current)
        time.Sleep(time.Second / 60)
    }
}
```

---

## Use Cases
1. **Smooth UI Transitions**: Animate menu sliding, window resizing, or element fading.
2. **Bouncing Notifications**: Make notifications appear with a springy bounce.
3. **Progress Indicators**: Smoothly interpolate progress bars or spinners.
4. **Drag-and-Drop Effects**: Add spring physics to dragged elements.
5. **Game Physics**: Simulate spring-based motion (e.g., bouncing balls, UI elements).
6. **Scrolling Animations**: Smoothly scroll to a target position.
7. **Loading Animations**: Animate loading indicators with natural motion.

---

## Comparison to Alternatives
| Feature | Harmonica | [github.com/mbordihn/anim](https://github.com/mbordihn/anim) | [github.com/ungerik/go-cairo](https://github.com/ungerik/go-cairo) | Custom (Manual) |
|---------|-----------|---------------------------------------------------------------|-------------------------------------------------------------------|-----------------|
| **Spring Physics** | ✅ Yes | ❌ No (linear only) | ❌ No | ✅ Possible |
| **Damping Control** | ✅ Yes | ❌ No | ❌ No | ✅ Possible |
| **Framework-Agnostic** | ✅ Yes | ✅ Yes | ❌ No (cairo) | ✅ Yes |
| **Zero Allocations** | ✅ Yes | ✅ Yes | ❌ No | ✅ Possible |
| **TUI-Friendly** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Easy Tuning** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Documentation** | ✅ Good | ✅ Good | ✅ Good | ❌ Varies |

**Key Differentiators**:
- **Spring Physics**: Only Harmonica provides **damped harmonic oscillators** out of the box.
- **TUI-Optimized**: Designed for **terminal UIs** (low CPU, no allocations).
- **Easy to Use**: Simple API (`NewSpring` + `Update`).
- **Well-Documented**: Clear examples and tuning guides.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/spring.go` | Core `Spring` struct and `Update` method. |
| `/fps.go` | `FPS` utility function. |

---

## Presets for Common Effects

### **1. Bouncy Animation**
```go
spring := harmonica.NewSpring(harmonica.FPS(60), 8.0, 0.2)
```
- **Use Case**: Notifications, playful UI elements.
- **Behavior**: Overshoots target, bounces a few times, settles.

### **2. Smooth Transition**
```go
spring := harmonica.NewSpring(harmonica.FPS(60), 6.0, 1.0)
```
- **Use Case**: Menu sliding, window resizing.
- **Behavior**: No overshoot, smooth settlement.

### **3. Heavy/Damped Motion**
```go
spring := harmonica.NewSpring(harmonica.FPS(60), 4.0, 2.0)
```
- **Use Case**: Dragging heavy objects, slow transitions.
- **Behavior**: No overshoot, slow to settle.

### **4. Fast Snap**
```go
spring := harmonica.NewSpring(harmonica.FPS(60), 10.0, 0.8)
```
- **Use Case**: Quick UI feedback (e.g., button presses).
- **Behavior**: Fast, minimal overshoot.

---

## Summary
Harmonica is a **lightweight, framework-agnostic spring animation library** for Go, providing:

1. **Spring Physics**: Damped harmonic oscillators for natural motion.
2. **Easy Tuning**: Control speed (`angular frequency`) and behavior (`damping ratio`).
3. **TUI-Optimized**: Zero allocations, low CPU, deterministic.
4. **Framework-Agnostic**: Works with Bubble Tea, Ebiten, or raw terminal I/O.
5. **Well-Documented**: Clear examples for TUIs, games, and OpenGL.

**Best For**: Adding **smooth, natural animations** to TUIs, games, or any Go application.
**Avoid If**: You need **complex physics** (use a full physics engine like [Chipmunk2D](https://github.com/go-physics/chipmunk) instead).
