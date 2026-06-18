# Terminal Emulator Primitives Report: Kitty & WezTerm

## Overview
Modern terminal emulators define what's *actually possible* in 2024 terminals. Kitty and WezTerm are GPU-accelerated terminals with advanced protocols that extend beyond ANSI/VT100.

---

## Kitty Protocol Extensions

### 1. Keyboard Protocol
**Location:** `kitty/docs/keyboard-protocol.rst`

**Problem Solved:** Traditional terminal keyboard handling is broken:
- Only ctrl+alt modifiers reliably work
- Many key combinations map to same escape code
- No press/release/repeat event types
- Escape key ambiguity (single Esc vs. start of escape sequence)

**Kitty's Solution:** Comprehensive keyboard event encoding

**Event Types:**
```
Escape sequence format:
CSI keyCode ; modifierFlags ; unicodeCodePoint eventType

Examples:
- Key press:    CSI 65 ; 2 ; 97 u  (Ctrl+A press)
- Key release:  CSI 65 ; 2 ; 97 ~  (Ctrl+A release)
- Key repeat:   CSI 65 ; 2 ; 97 ^  (Ctrl+A repeat)
```

**Modifier Encoding (bit flags):**
```
0 = none
1 = shift
2 = alt
4 = ctrl  
8 = super (Windows/Command)
16 = hyper
32 = meta
64 = numlock
128 = capslock
```

**Supported Keys:**
- All function keys (F1-F35)
- Media keys (volume, play, mute)
- Navigation (home, end, page up/down)
- Editing (insert, delete, backspace)
- Mouse buttons as keys
- Unicode text input separate from key codes

### 2. Graphics Protocol
**Location:** `kitty/docs/graphics-protocol.rst`

**Goal:** Display pixel graphics without terminal understanding image formats.

**Design Principles:**
- Client handles image decoding
- Terminal just displays pixels
- Individual pixel positioning
- Multiple images on screen
- Animation support

**Protocol Format:**
```
OSC 1337 ; params ; payload BEL

Example: Display base64-encoded image
ESC]1337;Inline=1;width=100;height=50;aQ==BEL
           ↑              ↑
       parameters     base64 data
```

**Parameters:**
- `width`, `height` - Dimensions (pixels or cells)
- `cols`, `rows` - Cell-based sizing
- `preserve_aspect_ratio` - Scale behavior
- `x`, `y` - Position (cell coordinates)
- `z` - Z-index for layering
- `frame_pointer` - For animations

**Commands:**
- `f` - Display image (transmit)
- `t` - Create transmission window
- `C` - Query cursor position
- `P` - Query cell pixel geometry
- `d` - Clear images
- `i` - Query image info

**Features:**
- Multiple format support (PNG, JPEG, GIF)
- Animation frame sequencing
- Image tiling (large images)
- Transparent backgrounds
- Pixel-perfect positioning
- Layered images (z-index)

### 3. Cursor Capabilities
**Features:**
- Shape changes (block, underline, bar)
- Color customization (RGB)
- Blink control
- Different cursor for insert mode

**Escape sequences:**
```
CSI Ps q  - Set cursor style
  1 = blinking block
  2 = steady block
  3 = blinking underline
  4 = steady underline
  5 = blinking bar
  6 = steady bar

OSC 50 ; SetCursorStyle BEL  - Cursor color
```

### 4. Color Management
**Features:**
- True color (24-bit RGB)
- Dynamic palette modification
- Color table queries
- Background opacity
- Color schemes

**ESCapes:**
```
OSC 4 ; color_index ; rgb BEL   - Change palette color
OSC 10 ; rgb BEL                - Change default foreground
OSC 11 ; rgb BEL                - Change default background
OSC 104 ; color_index BEL       - Reset palette color
Pm c  - Query color (response: RGB values)
```

### 5. Window Manipulation
**Features:**
- Title/icon setting
- Size/position queries
- Minimize/maximize
- Tab management
- Clipboard access

**Examples:**
```
OSC 2 ; title BEL           - Set window title
OSC 0 ; icon BEL            - Set icon title
OSC 52 ; c ; base64 BEL     - Set clipboard (c=clipboard)
CSI 18 t                    - Query window size (response: height; width)
```

### 6. Font Handling
**Features:**
- Font size changes
- Font family queries
- Ligature support
- HiDPI/Retina scaling
- Font fallback chains

**Kitty-specific:**
- `kitty +kitten` for font management
- Dynamic font scaling
- Symbol font support

---

## WezTerm Extensions

### 1. Graphics Support
**Similar to Kitty:**
- Sixel graphics support
- iTerm2 inline images
- Custom graphics protocol (in development)

### 2. Multiplexer Support
**Unique Feature:** Built-in multiplexer (like tmux)

**Features:**
- Remote terminal sessions
- Multiple tabs/panes
- Session persistence
- SSH integration

### 3. Lua Configuration
**Unique Feature:** Lua scripting API

```lua
-- .wezterm.lua
local wezterm = require 'wezterm'
return {
  font = wezterm.font 'JetBrains Mono',
  color_scheme = 'Dracula',
  enable_tab_bar = false,
  default_cwd = '/home/user',
}
```

### 4. Cell Overflow Rendering
**Features:**
- Characters wider than cell
- Font ligatures spanning cells
- TrueType font shaping
- Emoji presentation

---

## Reusable Patterns for TUI Development

### 1. Capability Detection Pattern
```python
class TerminalCapabilities:
    def __init__(self):
        self.true_color = False
        self.kitty_keyboard = False
        self.kitty_graphics = False
        self.sixel = False
        self.detect()
    
    def detect(self):
        # Send query sequences
        # Parse responses from terminal
        pass
    
    def query_kitty(self):
        sys.stdout.write('\x1b_Gi=1\x07')  # Query graphics
        sys.stdout.write('\x1b[?u')        # Query keyboard protocol
    
    def parse_response(self, response):
        # Handle OSC responses
        pass
```

### 2. Progressive Enhancement Pattern
```python
def render_image(img, caps):
    if caps.kitty_graphics:
        return kitty_encode(img)
    elif caps.sixel:
        return sixel_encode(img)
    elif caps.true_color and caps.braille:
        return braille_render(img)
    else:
        return ascii_render(img)
```

### 3. Keyboard Event Parser
```python
import re

KITTY_KEY_PATTERN = re.compile(
    r'\x1b\[(\d+);(\d+);(\d+)([u~^])'
)

def parse_kitty_key(escape_seq):
    match = KITTY_KEY_PATTERN.match(escape_seq)
    if not match:
        return None
    
    key_code, modifiers, unicode_cp, event_type = match.groups()
    
    return {
        'key_code': int(key_code),
        'modifiers': decode_modifiers(int(modifiers)),
        'unicode': chr(int(unicode_cp)),
        'type': {'u': 'press', '~': 'release', '^': 'repeat'}[event_type]
    }

def decode_modifiers(flags):
    return {
        'shift': bool(flags & 1),
        'alt': bool(flags & 2),
        'ctrl': bool(flags & 4),
        'super': bool(flags & 8),
    }
```

### 4. Kitty Graphics Encoder
```python
import base64
import zlib

def kitty_encode_image(image_path):
    with open(image_path, 'rb') as f:
        data = f.read()
    
    # Optional: compress
    compressed = zlib.compress(data)
    
    # Base64 encode
    b64 = base64.b64encode(compressed).decode('ascii')
    
    # Split into chunks (max 4096 bytes each)
    chunks = [b64[i:i+4096] for i in range(0, len(b64), 4096)]
    
    # Build escape sequences
    result = []
    m = 1  # More data coming flag
    for i, chunk in enumerate(chunks):
        if i == len(chunks) - 1:
            m = 0  # Last chunk
        
        params = f'a=1,m={m},s={len(chunk)},i=1'
        result.append(f'\x1b_G{params};{chunk}\x07')
    
    return ''.join(result)
```

---

## Files of Interest

### Kitty Protocol Specs
- `kitty/docs/keyboard-protocol.rst` - Comprehensive keyboard handling
- `kitty/docs/graphics-protocol.rst` - Image/graphics protocol
- `kitty/docs/clipboard-control/` - Clipboard integration
- `kitty/docs/color-protocol/` - Color management

### WezTerm Features
- `wezterm/src/term/` - Terminal emulation
- `wezterm/src/render/` - GPU rendering
- `wezterm/docs/` - Feature documentation

---

## Key Takeaways for TUI Developers

### From Kitty Keyboard Protocol:
1. **Proper modifier handling** - All combinations work reliably
2. **Press/release/repeat** - Full keyboard event types
3. **Unicode separation** - Text input vs key codes
4. **Fix Esc ambiguity** - Protocol distinguishes Esc from escape sequences
5. **Media keys** - Modern keyboard support

### From Kitty Graphics Protocol:
1. **Separation of concerns** - Client decodes, terminal displays
2. **Base64 encoding** - No binary in escape sequences
3. **Chunked transmission** - Handle large images
4. **Pixel positioning** - Fine-grained control
5. **Z-index layering** - Overlapping graphics

### From Both Emulators:
1. **Query before assume** - Detect capabilities at runtime
2. **Progressive enhancement** - Best available, graceful fallback
3. **GPU acceleration** - 60fps rendering possible
4. **Ligature support** - Font shaping for programming symbols
5. **Hyperlinks** - Clickable URLs in terminal
6. **True color standard** - 24-bit RGB widely available

---

## What This Means for TUI Frameworks

### Must Support:
- True color (24-bit RGB)
- Cursor shape/color control
- Clickable hyperlinks
- Mouse wheel scrolling
- Modern key protocols (kitty/tmux)

### Should Support:
- Kitty graphics protocol
- Sixel graphics
- Background opacity
- Bracketed paste
- Focus reporting

### Future-Forward:
- GPU-accelerated rendering
- Multiplexer integration
- Remote session support
- Font shaping
- Emoji presentation

---

## Implementation Priority

### Phase 1: Basics
1. True color + 256-color fallback
2. Cursor control (shape, hide/show)
3. Mouse support (motion, wheel)
4. Modern key bindings

### Phase 2: Advanced
5. Kitty keyboard protocol
6. Kitty graphics / Sixel
7. Cl ipboard integration
8. Hyperlinks

### Phase 3: Polish
9. GPU rendering
10. Font shaping
11. Multiplexer support
12. Remote sessions