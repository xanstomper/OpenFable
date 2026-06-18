# Anthology: Input Systems

> **Subject:** Input Systems - keyboard, mouse, and event handling for TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Input Systems Mastery

### 4.1 Terminal Input Modes

**Canonical vs Raw Mode:**

| Mode | Characteristics | Use Case |
|------|----------------|----------|
| Canonical | Line-buffered, edited by shell, ^C/^Z handled by OS | CLI tools, simple prompts |
| Raw | Unbuffered, every keypress delivered to app | Full TUIs, games, editors |

**Switching to raw mode (Rust):**
```rust
use termios::{Termios, ICANON, ECHO, TCSANOW};

pub fn enter_raw_mode() -> Result<(), Error> {
    let mut termios = Termios::from_fd(0)?;
    
    // Disable canonical mode (line buffering)
    termios.c_lflag &= !(ICANON | ECHO);
    
    // Disable special character processing
    termios.c_cc[VMIN] = 1;  // Minimum 1 character
    termios.c_cc[VTIME] = 0; // No timeout
    
    termios.tcsetattr(TCSANOW)?;
    Ok(())
}

pub fn restore_mode(original: Termios) -> Result<(), Error> {
    original.tcsetattr(TCSANOW)?;
    Ok(())
}

// RAII guard for automatic restoration
pub struct RawModeGuard {
    original: Termios,
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        let _ = restore_mode(self.original.clone());
    }
}
```

### 4.2 Keyboard Protocols

**Legacy XTerm Protocol:**
```
Escape sequences for special keys:
- Arrow Up:    \e[A
- Arrow Down:  \e[B
- Arrow Right: \e[C
- Arrow Left:  \e[D
- F1-F4:       \eOP, \eOQ, \eOR, \eOS
- F5-F12:      \e[15~, \e[17~, etc.
```

**Limitations:**
- No distinction between `Tab` and `Ctrl+I` (same code)
- No modifier information for most keys
- No key release events

**Kitty Keyboard Protocol (Modern):**
```rust
// Enable kitty protocol
print!("\x1b[>1u");

// Receive structured key events:
// \e[27;5;3~  = Ctrl+C (27=key, 5=mods, 3=keycode)
// \e[27;2;9~  = Shift+Tab

#[derive(Debug)]
pub struct KittyKeyEvent {
    pub key_code: u32,      // Physical key code
    pub modifiers: Modifiers,
    pub text: Option<String>,  // Unicode text if applicable
    pub event_type: KeyEventType,  // Press, Repeat, Release
}

pub struct Modifiers {
    pub shift: bool,
    pub alt: bool,
    pub ctrl: bool,
    pub super_key: bool,
    pub hyper: bool,
    pub meta: bool,
    pub caps_lock: bool,
    pub num_lock: bool,
}
```

**Implementing Kitty Protocol Parser:**
```rust
pub fn parse_kitty_escape(escape: &[u8]) -> Option<KittyKeyEvent> {
    // \e[27;5;3~ format
    if escape.starts_with(&[0x1b, b'[']) {
        let parts: Vec<&str> = std::str::from_utf8(&escape[2..])
            .ok()?
            .trim_end_matches('~')
            .split(';')
            .collect();
        
        if parts.len() == 3 {
            let key_code = parts[0].parse().ok()?;
            let mod_val = parts[1].parse::<u32>().ok()?;
            let unicode = parts[2].parse::<u32>().ok()?;
            
            let modifiers = Modifiers {
                shift: mod_val & 1 != 0,
                alt: mod_val & 2 != 0,
                ctrl: mod_val & 4 != 0,
                super_key: mod_val & 8 != 0,
                hyper: mod_val & 16 != 0,
                meta: mod_val & 32 != 0,
                caps_lock: false,
                num_lock: false,
            };
            
            return Some(KittyKeyEvent {
                key_code,
                modifiers,
                text: char::from_u32(unicode).map(|c| c.to_string()),
                event_type: KeyEventType::Press,
            });
        }
    }
    None
}
```

### 4.3 Mouse Input

**X10 Mouse (Basic):**
```rust
// \e[M followed by 3 bytes:
// Byte 1: Button encoding (b1 b0 button, +32)
// Byte 2: X position (+32)
// Byte 3: Y position (+32)

pub fn parse_x10_mouse(bytes: [u8; 3]) -> MouseEvent {
    let button_byte = bytes[0] - 32;
    let x = bytes[1] - 32;
    let y = bytes[2] - 32;
    
    let button = match button_byte & 0b11 {
        0 => MouseButton::Left,
        1 => MouseButton::Middle,
        2 => MouseButton::Right,
        3 => MouseButton::None,  // Release
        _ => MouseButton::None,
    };
    
    MouseEvent {
        x,
        y,
        button,
        modifiers: Modifiers::default(),
    }
}
```

**SGR Mouse (Extended, supports >223 positions):**
```rust
// \e[<button;x;yM (press) or \e[<button;x;ym (release)
pub fn parse_sgr_mouse(escape: &str) -> Option<MouseEvent> {
    let caps = regex!(r"\e\[<(\d+);(\d+);(\d+)([Mm])").captures(escape)?;
    
    let button_code = caps.get(1)?.as_str().parse::<u32>().ok()?;
    let x = caps.get(2)?.as_str().parse::<usize>().ok()?;
    let y = caps.get(3)?.as_str().parse::<usize>().ok()?;
    let is_press = caps.get(4)?.as_str() == "M";
    
    Some(MouseEvent {
        x,
        y,
        button: decode_button(button_code),
        is_press,
        ..Default::default()
    })
}
```

**Enabling SGR Mouse:**
```rust
// Enable
print!("\x1b[?1003h");  // Any mouse tracking
print!("\x1b[?1006h");  // SGR format

// Disable
print!("\x1b[?1003l");
print!("\x1b[?1006l");
```

### 4.4 Event Loop Architecture

**Basic Event Loop:**
```rust
pub struct EventLoop {
    receiver: mpsc::Receiver<Event>,
    running: AtomicBool,
}

pub enum Event {
    Key(KeyEvent),
    Mouse(MouseEvent),
    Resize(usize, usize),
    Paste(String),
    FocusGained,
    FocusLost,
    Custom(Box<dyn Any>),
}

impl EventLoop {
    pub fn start(&self) {
        self.running.store(true, Ordering::Relaxed);
        
        while self.running.load(Ordering::Relaxed) {
            // Use poll/select to wait for input with timeout
            let mut fds = [PollFd::new(0, PollFlags::POLLIN)];
            poll(&mut fds, 100)?;  // 100ms timeout
            
            if fds[0].revents().contains(PollFlags::POLLIN) {
                let event = self.read_event()?;
                self.sender.send(event)?;
            } else {
                // Timeout - send tick event for animations
                self.sender.send(Event::Tick)?;
            }
        }
        
        Ok(())
    }
    
    fn read_event(&self) -> Result<Event, Error> {
        let mut buf = [0u8; 32];
        let n = read(0, &mut buf)?;
        
        // Parse escape sequences
        if buf[0] == 0x1b {
            if n > 1 && buf[1] == b'[' {
                // CSI sequence
                return self.parse_csi(&buf[1..n]);
            }
            // Single escape
            return Ok(Event::Key(KeyEvent::Escape));
        }
        
        // Single character
        let text = String::from_utf8_lossy(&buf[..n]).to_string();
        Ok(Event::Key(KeyEvent::Char(text.chars().next().unwrap())))
    }
}
```

### 4.5 Input Focus and Hit Testing

**Hit Testing for Mouse Events:**
```rust
pub struct HitTestResult {
    pub widget_id: WidgetId,
    pub local_x: usize,
    pub local_y: usize,
    pub region: WidgetRegion,  // Header, Content, Border, etc.
}

pub trait HitTestable {
    fn hit_test(&self, global_x: usize, global_y: usize) -> Option<HitTestResult>;
}

impl HitTestable for Widget {
    fn hit_test(&self, global_x: usize, global_y: usize) -> Option<HitTestResult> {
        if !self.rect.contains(global_x, global_y) {
            return None;
        }
        
        let local_x = global_x - self.rect.x;
        let local_y = global_y - self.rect.y;
        
        // Check regions
        if local_y < self.header_height {
            Some(HitTestResult {
                widget_id: self.id,
                local_x,
                local_y,
                region: WidgetRegion::Header,
            })
        } else if local_x < self.border_width || local_x >= self.rect.width - self.border_width {
            Some(HitTestResult {
                widget_id: self.id,
                local_x,
                local_y,
                region: WidgetRegion::Border,
            })
        } else {
            Some(HitTestResult {
                widget_id: self.id,
                local_x,
                local_y,
                region: WidgetRegion::Content,
            })
        }
    }
}
```

**Focus Management:**
```rust
pub struct FocusManager {
    focused_widget: Option<WidgetId>,
    focus_order: Vec<WidgetId>,
    focusable_widgets: HashMap<WidgetId, FocusProperties>,
}

pub struct FocusProperties {
    pub tab_order: i32,
    pub can_focus: bool,
    pub focus_style: FocusStyle,
}

impl FocusManager {
    pub fn focus_next(&mut self) {
        let current_idx = self.focused_widget
            .and_then(|id| self.focus_order.iter().position(|&x| x == id))
            .unwrap_or(usize::MAX);
        
        // Find next focusable widget
        for &widget_id in self.focus_order.iter().skip(current_idx + 1) {
            if self.focusable_widgets.get(&widget_id).map(|p| p.can_focus).unwrap_or(false) {
                self.set_focus(widget_id);
                return;
            }
        }
        
        // Wrap to beginning
        if let Some(&first) = self.focus_order.first() {
            self.set_focus(first);
        }
    }
    
    pub fn set_focus(&mut self, widget_id: WidgetId) {
        // Notify old widget of blur
        if let Some(old) = self.focused_widget {
            self.send_event(old, WidgetEvent::Blur);
        }
        
        self.focused_widget = Some(widget_id);
        
        // Notify new widget of focus
        self.send_event(widget_id, WidgetEvent::Focus);
    }
}
```

### 4.6 Paste Detection

**Bracketed Paste Mode:**
```rust
// Enable: \e[?2004h
// Paste starts: \e[200~
// Paste ends: \e[201~

pub struct PasteHandler {
    in_paste: bool,
    paste_buffer: String,
}

impl PasteHandler {
    pub fn handle_bytes(&mut self, bytes: &[u8]) -> Option<PasteEvent> {
        let text = String::from_utf8_lossy(bytes);
        
        if text.contains("\x1b[200~") {
            self.in_paste = true;
            self.paste_buffer.clear();
            // Remove the start sequence
            let after_start = text.split("\x1b[200~").nth(1).unwrap_or("");
            self.paste_buffer.push_str(after_start);
            return None;
        }
        
        if text.contains("\x1b[201~") {
            self.in_paste = false;
            // Remove the end sequence
            let before_end = text.split("\x1b[201~").next().unwrap_or("");
            self.paste_buffer.push_str(before_end);
            
            let paste = std::mem::take(&mut self.paste_buffer);
            return Some(PasteEvent { text: paste });
        }
        
        if self.in_paste {
            self.paste_buffer.push_str(&text);
        }
        
        None
    }
}
```

### 4.7 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Not restoring terminal | Terminal broken after crash | Use RAII guard |
| Assuming 8-bit input | Unicode input breaks | Use UTF-8 parser |
| Ignoring paste mode | Pasted^C exits app | Enable bracketed paste |
| No mouse coordinates | Mouse demos broken | Enable宣传工作 SGR mouse |
| Blocking reads | UI freezes on slow input | Use poll/select with timeout |

---

# PART 2: NOVEL CONCEPTS REPORT

## Input Systems: Untapped Opportunities

### Concept 1: Intent-Based Input Interpretation

**Idea:** Input interpretation that considers **user intent** based on context, not just raw key codes.

**How:**
```rust
pub enum InputIntent {
    Navigation,      // Moving around
    Selection,       // Selecting text/items
    Command,         // Executing commands
    TextEntry,       // Typing text
    Shortcut,        // Triggering actions
}

pub struct IntentAwareInput {
    current_context: InputContext,
    intent_detectors: Vec<Box<dyn IntentDetector>>,
}

pub struct InputContext {
    pub focused_widget_type: WidgetType,
    pub modifier_state: Modifiers,
    pub recent_inputs: Vec<InputEvent>,
    pub application_mode: AppMode,
}

impl IntentAwareInput {
    pub fn interpret(&self, event: RawKeyEvent) -> InterpretedAction {
        // Gather intent signals
        let mut scores = HashMap::new();
        
        for detector in &self.intent_detectors {
            if let Some(intent) = detector.detect(&event, &self.current_context) {
                *scores.entry(intent).or_insert(0) += 1;
            }
        }
        
        // Select highest-scoring intent
        let best_intent = scores.iter()
            .max_by_key(|(_, score)| *score)
            .map(|(intent, _)| *intent)
            .unwrap_or(InputIntent::Navigation);
        
        // Map to action based on intent
        self.intent_to_action(best_intent, event)
    }
}

// Example: 'j' key has different meanings based on context
pub struct ContextualJDetector;
impl IntentDetector for ContextualJDetector {
    fn detect(&self, event: &RawKeyEvent, ctx: &InputContext) -> Option<InputIntent> {
        if event.key == 'j' {
            match ctx.focused_widget_type {
                WidgetType::List => Some(InputIntent::Navigation),  // Move down
                WidgetType::Editor => Some(InputIntent::TextEntry), // Type 'j'
                WidgetType::Terminal => Some(InputIntent::Command), // Maybe vim command
                _ => None,
            }
        } else {
            None
        }
    }
}
```

**Novel because:** Current input systems are purely mechanical (key=X means action=Y). Intent-aware interpretation enables smarter, context-sensitive input.

**Complexity:** High
**Value:** High (more intuitive, fewer accidental triggers)

---

### Concept 2: Predictive Input Preloading

**Idea:** **Preload likely next inputs** based on user behavior patterns, reducing perceived latency.

**How:**
```rust
pub struct PredictiveInput {
    history: Vec<InputSequence>,
    prediction_model: MarkovModel,
    preload_buffer: Vec<PredictedAction>,
}

pub struct InputSequence {
    pub inputs: Vec<InputEvent>,
    pub timestamp: u64,
    pub context: InputContext,
}

impl PredictiveInput {
    pub fn record_input(&mut self, event: InputEvent, context: InputContext) {
        // Add to recent history
        self.history.push(InputSequence {
            inputs: vec![event],
            timestamp: current_time_ms(),
            context,
        });
        
        // Update prediction model
        if let Some(prediction) = self.prediction_model.predict(&context) {
            self.preload_buffer.push(prediction);
            
            // Pre-execute non-destructive actions
            if prediction.is_safe_to_preload() {
                self.execute_preliminary(prediction);
            }
        }
    }
    
    pub fn get_next_input(&self) -> Option<InputEvent> {
        // If user input matches prediction, return preloaded result faster
        if let Some(preload) = self.preload_buffer.first() {
            if preload.matches_expected_pattern() {
                return Some(preload.to_input_event());
            }
        }
        None
    }
}

// Example: User typically types ":wq" after editing
// System preloads file save operation
```

**Novel because:** Input systems are reactive (wait for input, then act). Predictive preloading makes frequent patterns feel instant.

**Complexity:** Medium-High
**Value:** Medium (noticeable speedup for power users with consistent patterns)

---

### Concept 3: Multimodal Input Fusion

**Idea:** Combine **keyboard + mouse + voice + gesture** into unified input stream.

**How:**
```rust
pub enum InputModality {
    Keyboard(KeyEvent),
    Mouse(MouseEvent),
    Voice(VoiceCommand),
    Gesture(TouchGesture),
    EyeTracking(GazePoint),
}

pub struct MultimodalFusion {
    modalities: HashMap<InputModality, InputSource>,
    fusion_strategy: FusionStrategy,
    confidence_threshold: f32,
}

pub enum FusionStrategy {
    Complementary,  // Different modalities for different tasks
    Redundant,      // Same intent via multiple modalities (higher confidence)
    Sequential,     // One modality refines another
}

impl MultimodalFusion {
    pub fn fuse(&self, inputs: Vec<InputModality>) -> FusedCommand {
        let intents: Vec<_> = inputs.iter()
            .map(|i| self.modality_to_intent(i))
            .collect();
        
        match self.fusion_strategy {
            FusionStrategy::Redundant => {
                // If multiple modalities express same intent, boost confidence
                let intent_counts = count_intents(&intents);
                let (best_intent, count) = intent_counts.iter()
                    .max_by_key(|(_, c)| *c)
                    .unwrap();
                
                let confidence = *count as f32 / inputs.len() as f32;
                
                if confidence >= self.confidence_threshold {
                    FusedCommand {
                        intent: *best_intent,
                        confidence,
                        source_modalities: inputs.iter().map(|i| i.type_name()).collect(),
                    }
                } else {
                    FusedCommand::uncertain()
                }
            }
            FusionStrategy::Sequential => {
                // First modality sets coarse目标，second refines
                let (coarse, refinement) = (intents[0], intents.get(1).copied());
                self.sequential_fuse(coarse, refinement)
            }
            _ => self.complementary_fuse(&intents),
        }
    }
}

// Example: Voice says "select that file" + Gaze points to file
// Fused: Select file at gaze position
```

**Novel because:** TUIs are keyboard-only (sometimes + mouse). Multimodal fusion enables accessibility and new interaction paradigms.

**Complexity:** Very High
**Value:** High (accessibility, power user shortcuts, future-proofing)

---

**End of Input Systems Anthology**

---



## 3.1 Keyboard Protocol Landscape

The corpus reveals a clear evolution from legacy xterm escape sequences to modern structured protocols. Three layers exist:

**Layer 1 — Legacy XTerm (universal, limited):**
- Arrow keys: `\e[A` through `\e[D`
- Function keys: `\eOP`–`\eOS` (F1–F4), `\e[15~`–`\e[24~` (F5–F12)
- Fatal limitation: `Tab` and `Ctrl+I` are indistinguishable; no modifier info; no release events

**Layer 2 — Kitty Keyboard Protocol (modern, increasingly adopted):**
The most complete keyboard primitive in the corpus. Format: `CSI keyCode;modifierFlags;unicodeCodePoint eventType`

Event type suffixes:
| Suffix | Meaning |
|--------|---------|
| `u` | Key press |
| `~` | Key release |
| `^` | Key repeat |

Modifier bit flags: `1=Shift, 2=Alt, 4=Ctrl, 8=Super, 16=Hyper, 32=Meta, 64=NumLock, 128=CapsLock`

This resolves the Esc ambiguity problem: a standalone Esc press generates `CSI 27;1;27u`, distinct from the start of an escape sequence. It also distinguishes `Ctrl+I` from `Tab`, `Shift+Enter` from `Enter`, and provides F1–F35 plus media keys.

`x/input` provides a complete Go implementation with `KeyEvent` carrying `Rune`, `Key`, and `ModMask` fields, supporting both legacy parsing and Kitty protocol natively.

**Layer 3 — Bubble Tea's `Key` struct (framework-level abstraction):**
Bubble Tea wraps the driver layer into a higher-level `Key` type with `Text`, `Mod`, `Code`, `ShiftedCode`, `BaseCode`, and `IsRepeat`. This is the portability model: application code never parses escape sequences directly; the framework normalizes across terminals.

**Corollary:** Your input layer should support both protocols simultaneously. Start with legacy xterm parsing for compatibility, layer Kitty protocol detection on top, and expose a unified `KeyEvent` type that carries modifiers, event type, and Unicode text separately from physical key codes.

### 3.2 Mouse Input: Protocol Stack and State Machine

All mature frameworks in the corpus converge on the same four-event mouse vocabulary: **Press**, **Release**, **Move** (with drag detection), and **Wheel** (scroll). The variation is in transport encoding:

| Protocol | Escape Sequence | Max Positions | Drag | Modifiers |
|----------|----------------|---------------|------|-----------|
| X10 | `\e[M` + 3 bytes | 223×223 | ✗ | ✗ |
| VT200 (1000) | `\e[M` + 3 bytes | 223×223 | ✓ | ✗ |
| SGR (1006) | `\e[<btn;x;y{M/m}` | Unlimited | ✓ | ✗ |
| Kitty (1015) | Extended | Unlimited | ✓ | ✓ |

**Critical implementation rules extracted across frameworks:**
1. Always fire a synthetic `Release` event when the mouse leaves the window during a press. Bubbles components rely on press/release pairing.
2. Track drag state internally: a `Move` event with a button held is a `Drag`, not a plain `Move`.
3. Support scroll-wheel without click — WheelUp/WheelDown events must fire independently of button state.
4. Normalize coordinates to 1-based (matching terminal convention) at the driver boundary, 0-based internally.
5. `x/input`'s `MouseEvent` carries `X`, `Y`, `Button`, `Modifiers`, `Drag`, and `Scroll` — this is the minimal complete struct.

`bubbletea/mouse.go` shows three mouse modes: `None`, `CellMotion` (clicks + drag), and `AllMotion` (every movement event). Most TUIs want `CellMotion`.

### 3.3 Text Input: The Rune-Based Imperative

The bubbles `textinput` component makes a decision that all input systems should follow: **store text as `[]rune`, not `[]byte` or `string`**. This is the single most important implementation detail for correct cursor movement, backspace behavior, and truncation in the presence of multi-byte Unicode.

Key patterns from `bubbles/textinput`:
- **Cursor position is a rune index**, not byte offset
- **Viewport scrolling**: when the value exceeds the visible width, maintain a scroll offset so the cursor stays visible
- **Echo modes**: `EchoNormal`, `EchoPassword` (mask with `*`), `EchoNone` (silent — for capture without display)
- **Character limit in runes**, not bytes
- **Pluggable validation**: `ValidateFunc` runs on every mutation, returns `error` or nil
- **Focus guard**: input events are ignored unless `focus == true` — blur cancels cursor blink

`huh`'s `InputField` extends this with: placeholder text, autocomplete suggestions (Tab to complete), password mode (masked character entry), and live validation with inline error rendering.

### 3.4 Form-Level Input Architecture (Huh Pattern)

`huh` demonstrates that input at the form level is a different problem than raw key handling. The architecture:

```
Form (state machine: NORMAL → COMPLETED → ABORTED)
  └─ Group (page of fields, sequential)
       └─ Field (Init, Update, View, Focus, Blur, Validate, Run)
```

**Form state machine**: `NORMAL` (active), `COMPLETED` (submitted), `ABORTED` (cancelled). Once terminal state is reached, all input is ignored.

**Field interface** (language-agnostic):
```
Init() → Cmd
Update(Msg) → (Field, Cmd)
View() → string
Focus() → Cmd     // starts cursor blink
Blur() → Cmd      // stops cursor blink
Error() → error
Validate(value) → error
Run() → error
RunAccessible(w, r) → value  // screen-reader mode
```

**Key bindings** use a `KeyMap` with `KeyBinding` objects that map multiple physical keys to one action plus help text. This is superior to hardcoding keys because: rebinding is configuration, help is auto-generated, and multiple keys per action (e.g., both `→` and `Ctrl+F`) work.

**Navigation keys**: Tab/Enter/j/Down → next field; Shift+Tab/k/Up → previous; Ctrl+C/Escape → abort.

### 3.5 Input Accessor Pattern (Value Binding)

`huh`'s Accessor pattern solves the problem of where input values live. Three implementations:

1. **PointerAccessor** — binds to an external variable (pass-by-reference)
2. **EmbeddedAccessor** — stores internally within the field
3. **MapAccessor** — stores in a dictionary by key

This decouples input widgets from data storage. The form doesn't care whether a value lives in a struct field, a map, a database, or a channel. The accessor is a two-method interface: `Get() T` and `Set(T)`.

### 3.6 Bracketed Paste: The Non-Negotiable

Every framework in the corpus implements bracketed paste mode. This is not optional for a production TUI:

- Enable: `\x1b[?2004h`
- Paste start: `\x1b[200~`
- Paste end: `\x1b[201~`

Without bracketed paste, pasted text is indistinguishable from typed keystrokes. This means `Ctrl+C` inside pasted text can kill the app, and multi-line paste triggers per-line processing instead of atomic submission.

**Implementation note from bubbles `textinput`:** The paste message is a custom internal type (`pasteMsg string`). This keeps paste handling outside the key-processing pipeline, preventing paste content from being interpreted as individual key events.

### 3.7 Focus + Hit Testing Integration

The corpus shows two focus paradigms:

**Widget-level focus** (bubbles/tea): Each component tracks its own `focus` bool. `Focus()` returns a Cmd (typically starting cursor blink). `Blur()` stops it. If not focused, `Update()` returns early — no input processing.

**Focus manager** (report 04 section 4.5): A centralized system with `focus_order: Vec<WidgetId>` for Tab-key traversal. `focus_next()` wraps around. `set_focus()` sends `Blur` to old widget, `Focus` to new widget.

**Hit testing** routes mouse events to widgets. The spatial query is: given `(global_x, global_y)`, find the widget whose rect contains that point, compute local coordinates, and identify the region (header, content, border, scrollbar). This is essential for composited UIs where multiple widgets overlap.

### 3.8 Input Pipeline Architecture

Synthesizing the corpus into a complete input pipeline:

```
Terminal bytes
    ↓
Driver (x/input) — raw → Event structs
    ↓
Parser — escape sequence disambiguation, UTF-8 validation
    ↓
Focus Manager — route to correct widget OR system-level handling
    ↓
Hit Test — mouse events → target widget + local coords
    ↓
Widget Update — KeyEvent/MouseEvent/PasteEvent/FocusEvent
    ↓
Field-level processing — cursor movement, text mutation, validation
    ↓
Accessor → store value
    ↓
View() re-render
```

**The Tick event** (from the event loop's poll timeout) deserves special mention: it drives cursor blink, animations, and status timeouts. This is why the event loop must not block indefinitely — even with no input, the app needs periodic wakeups at 100ms intervals minimum.

### 3.9 Accessibility in Input Systems

`huh` implements a dual-mode architecture: `Run()` for TUI mode (ANSI, cursor control, styled rendering) and `RunAccessible(w, r)` for screen-reader mode (plain text prompts, line-based input). This is the accessibility primitive: the same form definition runs in both modes.

Principles extracted:
- No ANSI escape codes in accessible mode
- Clear, explicit prompt messages (not just visual cues)
- Simple line-based input (no cursor magic, no time-based interactions)
- Explicit success/failure confirmation messages
- Keyboard-only navigation must be complete (no mouse-required interactions)

### 3.10 Primitives Missing From the Current Report

The existing report sections 4.1–4.7 cover the foundations well. But the corpus reveals several primitives that should be part of any input system design:

| Primitive | Source | Gap |
|-----------|--------|-----|
| Rune-based text storage | bubbles/textinput | Only mentions UTF-8 at the byte level |
| Paste as atomic event | bubbles/textinput, x/input | Bracketed paste covered, but not the custom message type pattern |
| Mouse drag state machine | x/input, bubbletea | Mouse covered but drag state tracking not detailed |
| Focus guard pattern | bubbles components | FocusManager covers centralized routing, but not per-component focus bool |
| Echo modes (password/none) | bubbles/textinput | Not mentioned |
| Form state machine (Normal/Completed/Aborted) | huh | Not mentioned |
| Accessor pattern | huh | Not mentioned |
| Accessible mode dual rendering | huh | Not mentioned |
| KeyMap with help text integration | bubbles/key, huh | Hardcoded keys in current report |
| Predictive input (Concept 2 in Part 2) | Current report's own novel concept | Valid but needs framing as advanced pattern |

---

# PART 4: CONSOLIDATED INPUT PRIMITIVE REFERENCE

## Complete Event Type Summary

| Event | Struct | Fields | Source |
|-------|--------|--------|--------|
| Key | `KeyEvent` | `rune, key, modifiers, is_repeat` | x/input, bubbletea |
| Mouse | `MouseEvent` | `x, y, button, modifiers, drag, scroll` | x/input, bubbletea |
| Paste | `PasteEvent` | `text` | x/input, bubbletea |
| Resize | `WindowSizeEvent` | `width, height` | x/input, bubbletea |
| Focus | `FocusEvent` | `focused` | x/input, bubbletea |
| Tick | `TickMsg` | `time, id, tag` | bubbletea (internal) |
| Unknown | `UnknownEvent` | raw bytes | x/input |
| Multi | `MultiEvent` | `[]Event` | x/input |

## Terminal Initialization Sequence

For a complete input-enabled TUI, the initialization sequence is:

```
1. Save terminal state
2. Enter raw mode (disable canonical, echo, signals)
3. Enter alternate screen buffer
4. Enable keyboard protocol:  \x1b[>1u        (Kitty) or \x1b[>4;1m  (modifyOtherKeys)
5. Enable SGR mouse:          \x1b[?1000h \x1b[?1002h \x1b[?1006h
6. Enable bracketed paste:    \x1b[?2004h
7. Enable focus reporting:     \x1b[?1004h
8. Hide cursor (optional):     \x1b[?25l
9. Query termcap/RGB support (optional)
```

Shutdown reverses the enable/disable pairs and restores terminal state. Every step must be in a `defer` or `Drop` implementation — if the process crashes mid-TUI, the user's shell must not be left in raw mode.

## Complete Escape Sequence Reference

| Capability | Enable | Disable | Protocol |
|------------|--------|---------|----------|
| X10 mouse | `\e[?9h` | `\e[?9l` | `\e[M` + 3 bytes |
| VT200 mouse | `\e[?1000h` | `\e[?1000l` | `\e[M` + 3 bytes |
| Button-event mouse | `\e[?1002h` | `\e[?1002l` | `\e[M` + 3 bytes |
| Any-event mouse | `\e[?1003h` | `\e[?1003l` | `\e[M` + 3 bytes |
| Focus reporting | `\e[?1004h` | `\e[?1004l` | `\e[I` / `\e[O` |
| SGR mouse | `\e[?1006h` | `\e[?1006l` | `\e[<btn;x;y{M/m}` |
| Kitty keyboard | `\e[>1u` | `\e[<u` | `CSI key;mod;code type` |
| Bracketed paste | `\e[?2004h` | `\e[?2004l` | `\e[200~` ... `\e[201~` |
| Alternate screen | `\e[?1049h` | `\e[?1049l` | — |
| Sync output (2026) | `\e[?2026h` | `\e[?2026l` | — |

---

*This enhancement was synthesized from: x/input-primitives.md (event types, driver, parser, modes), bubbletea-primitives.md (Elm architecture, Key/Mouse structs, mouse modes, event loop), bubbles-primitives.md (text input, focus guard, key binding, custom messages), huh-primitives.md (form/field architecture, accessor pattern, validation, accessible mode, keyboard navigation, form state machine), kitty_wezterm_primitives.md (keyboard protocol spec), and CANOPY_PRIMITIVES.md (attention pattern detection).*

