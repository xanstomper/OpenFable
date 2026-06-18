# TerminalTextEffects Terminal Primitives Report

## Overview
TerminalTextEffects is a framework for creating animated text effects in the terminal. It provides a library of pre-built effects and a system for creating custom animations.

## Root Primitives

### 1. Effect System
**Location:** `effect_archive/`

**Pattern:**
- Effect as a state machine
- Frame-based animation
- Configurable parameters
- Composable effects

**Effect Lifecycle:**
```
Initialize → Update(frame) → Render → Complete?
```

### 2. Character Animation
**Features:**
- Per-character positioning
- Character timing offsets
- Wave patterns
- Randomized timing
- Staggered reveals

**Pattern:**
```python
for i, char in enumerate(text):
    delay = i * step_delay
    schedule(char.render, delay)
```

### 3. Color Animation
**Features:**
- RGB color cycling
- Gradient generation
- Rainbow effects
- Fade in/out
- Color waves

**Pattern:**
```python
def hsv_cycle(frame, total_frames):
    hue = (frame / total_frames) % 1.0
    return hsv_to_rgb(hue, 1.0, 1.0)
```

### 4. Movement/Position Effects
**Types:**
- Typewriter (sequential reveal)
- Scatter (random positions → center)
- Wave (sine wave motion)
- Fall (gravity simulation)
- Slide (directional entry)
- Zoom (scale from center)

### 5. Easing Functions
**Standard Easings:**
- Linear
- Ease In/Out
- Bounce
- Elastic
- Back (overshoot)
- Circ, Cubic, Quad, Quart, Quint

**Pattern:**
```python
def ease_in_out_quad(t):
    return t < 0.5 and 2*t*t or 1 - pow(-2*t + 2, 2) / 2
```

### 6. Particle System
**Features:**
- Character particles
- Velocity/acceleration
- Gravity simulation
- Collision detection (optional)
- Lifetime management

### 7. Frame Buffer
**Pattern:**
- Off-screen buffer per frame
- Dirty region tracking
- Double-buffered output
- Batch escape sequences

### 8. Timing System
**Features:**
- Frame rate control
- Delta time calculation
- Animation duration
- Pause/resume support
- Speed multiplier

### 9. Effect Composition
**Pattern:**
- Chain multiple effects
- Parallel effect execution
- Effect groups
- Nested animations

### 10. Output Optimization
**Techniques:**
- Minimize cursor moves
- Batch character output
- Cache ANSI codes
- Reuse style definitions

## Directory Structure
CHANGELOG.md
default.nix
docs
effect_archive
flake.lock
flake.nix
LICENSE
mkdocs.yml
pyproject.toml
README.md
terminaltexteffects
tests
tools
tox.ini
uv.lock

## Effects Archive
effect_dev_spaceflight.py
effect_dev_tesselated.py
effect_dev_worm.py

## Documentation
appguide.md
changeblog
cookbook.md
effectguide
effects
engine
img
index.md
installation.md
libguide.md
performance.md
showroom.md

## Reusable Patterns

### 1. Effect Base Class
```python
class Effect:
    def __init__(self, text, **kwargs):
        self.text = text
        self.frame = 0
        self.complete = False
        
    def update(self):
        self.frame += 1
        # Update animation state
        
    def render(self) -> str:
        # Return ANSI string for current frame
        pass
        
    def is_complete(self) -> bool:
        return self.frame >= self.max_frames
```

### 2. Character State
```python
class CharState:
    def __init__(self, char, x, y):
        self.char = char
        self.x = x  # Current position
        self.y = y
        self.target_x = x
        self.target_y = y
        self.revealed = False
        self.color = WHITE
        
    def update(self, easing_fn, progress):
        self.x = lerp(self.x, self.target_x, easing_fn(progress))
        self.y = lerp(self.y, self.target_y, easing_fn(progress))
```

### 3. Color Gradient
```python
def generate_gradient(start, end, steps):
    return [
        Color(
            lerp(start.r, end.r, i/steps),
            lerp(start.g, end.g, i/steps),
            lerp(start.b, end.b, i/steps),
        )
        for i in range(steps)
    ]
```

### 4. Wave Animation
```python
import math

def wave_offset(index, frame, wavelength, speed):
    return math.sin((index / wavelength) + (frame * speed))
```

### 5. Effect Chain
```python
class EffectChain:
    def __init__(self, *effects):
        self.effects = list(effects)
        self.current = 0
        
    def update(self):
        if self.effects[self.current].is_complete():
            self.current += 1
        if self.current < len(self.effects):
            self.effects[self.current].update()
            
    def render(self):
        return self.effects[self.current].render()
```

### 6. Timing Control
```python
class AnimationTimer:
    def __init__(self, fps=60):
        self.fps = fps
        self.frame_time = 1.0 / fps
        self.last_frame = time.time()
        
    def wait_for_next_frame(self):
        elapsed = time.time() - self.last_frame
        if elapsed < self.frame_time:
            sleep(self.frame_time - elapsed)
        self.last_frame = time.time()
```

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Effect System | 5/5 | Universal | State machine pattern |
| Character Anim | 5/5 | Universal | Per-char state |
| Color Cycling | 5/5 | Universal | HSV/RGB math |
| Movement | 5/5 | Universal | Vector math |
| Easing Functions | 5/5 | Universal | Pure math formulas |
| Particle System | 4/5 | Universal | Physics simulation |
| Frame Buffer | 5/5 | Universal | Double-buffer |
| Timing | 5/5 | Universal | Delta time pattern |
| Effect Chain | 5/5 | Universal | Composition pattern |

## Implementation Recommendations

### For Rust:
- Trait for Effect
- Struct for CharState
- Iterator-based character processing
- rayon for parallel effects

### For Go:
- Interface for Effect
- Struct for CharState
- goroutines for parallel effects
- time.Ticker for frame timing

### For Python:
- ABC for Effect base
- Dataclass for CharState
- asyncio for concurrent effects
- threading for timing

## Files of Interest
- terminaltexteffects/effect_archive/ - Pre-built effects
- terminaltexteffects/docs/ - Documentation

## Lessons for TUI Development
1. Effects are state machines with frame-based updates
2. Per-character state enables rich animations
3. Easing functions make motion feel natural
4. Composition (chains, groups) enables complexity
5. Frame timing is critical for smooth animation
6. Dirty tracking essential for performance
7. Cache ANSI codes to reduce string formatting
8. Delta time > fixed delays for consistent speed
