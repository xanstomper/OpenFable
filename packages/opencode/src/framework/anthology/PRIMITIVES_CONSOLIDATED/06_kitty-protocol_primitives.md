# Kitty Protocol Terminal Primitives Report

## Overview
The Kitty terminal protocol is an advanced terminal escape sequence protocol that extends beyond standard ANSI/VT100. It provides enhanced graphics, keyboard, and clipboard capabilities.

## Root Primitives

### 1. Graphics Protocol
**Key Features:**
- Inline image display
- Unicode placeholder system
- Transmitted via escape sequences
- Supports PNG, JPEG, GIF, etc.

**Escape Sequence Pattern:**
```
ESC_P!165;params;dataBEL
```

### 2. Keyboard Protocol
**Enhancements:**
- Full key event reporting (press, release, repeat)
- Modifier key tracking
- Function key extensions
- Unicode key encoding
- Mouse event extensions

**Sequence Format:**
```
ESC[params;mods;keyCode;unicode:u
```

### 3. Clipboard Protocol
**Features:**
- Read/write system clipboard
- Multiple clipboard selections
- Base64 encoding for binary
- Size-limited transfers

### 4. Terminal Caps Query
**Pattern:**
- Query terminal capabilities
- Feature detection before use
- Graceful degradation

**DA1/XTVERSION style queries**

### 5. Cursor Styling
- Configurable cursor shapes (block, underline, bar)
- Cursor color changes
- Blink control

### 6. Color Management
- True color (24-bit RGB)
- Dynamic palette changes
- Color table queries
- Background opacity

### 7. Font Handling
- Font size queries
- Cell size detection
- HiDPI/Retina support

### 8. Window Manipulation
- Title setting
- Icon setting
- Size/position queries (where supported)
- Tab management

## Reusable Patterns for TUI Development

### 1. Capability Detection
Always query before using advanced features:
```
Request: ESC[>0q
Response: ESC[>terminal_version;c
```

### 2. Progressive Enhancement
- Start with basic ANSI
- Detect capabilities
- Enable features progressively
- Always have fallback

### 3. Escape Sequence Formatting
Standard pattern:
```
CSI = ESC[    (Control Sequence Introducer)
OSC = ESC]    (Operating System Command)
APC = ESC_    (Application Program Command)
PM  = ESC^    (Privacy Message)
SOS = ESCX    (Start of String)
```

### 4. Keyboard Event Parsing
Extended keyboard format:
```
CSI 1 ; modifier ; keycode ~
```

Modifiers encoded as bit flags:
- 1 = Shift
- 2 = Alt
- 4 = Ctrl
- 8 = Super

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Graphics Protocol | 4/5 | High | Kitty/iTerm2 support |
| Keyboard Protocol | 5/5 | High | Many terminals support |
| Clipboard | 4/5 | Medium | Varies by terminal |
| Caps Query | 5/5 | Universal | Standard pattern |
| Cursor Styling | 5/5 | High | Widely supported |
| True Color | 5/5 | High | Modern standard |

## Implementation Recommendations

### 1. Capability Detection Class
```python
class TerminalCaps:
    def __init__(self):
        self.true_color = False
        self.kitty_keyboard = False
        self.sixel = False
        self.detect()
    
    def detect(self):
        # Send query sequences
        # Parse responses
        pass
```

### 2. Escape Sequence Builder
```python
def esc(seq):
    return f"[{seq}"

def set_cursor_shape(shape):
    return f"[{shape} q"
```

### 3. Keyboard Parser
Parse extended sequences into structured events:
```
{type: 'key', code: 'F1', modifiers: ['ctrl'], unicode: None}
```

## Files of Interest
- kitty-protocol/kitty-protocol.md - Protocol specification

## Integration Notes

For terminal applications:
1. Always start with capability detection
2. Use progressive enhancement
3. Test against multiple terminals
4. Document required capabilities
5. Provide fallback modes

## Related Protocols
- xterm control sequences
- iTerm2 inline images
- Sixel graphics
- VTE extensions
