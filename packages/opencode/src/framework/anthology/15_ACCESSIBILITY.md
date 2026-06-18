# Anthology: Accessibility

> **Subject:** Accessibility - making TUIs usable by everyone
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Accessibility Mastery

### 15.1 Screen Reader Support

```rust
pub struct ScreenReaderBridge {
    pub announce_queue: VecDeque<String>,
    pub is_speaking: bool,
    pub speech_rate: u32,
}

impl ScreenReaderBridge {
    pub fn announce(&mut self, text: &str) {
        self.announce_queue.push_back(text.to_string());
        self.process_queue();
    }

    pub fn announce_priority(&mut self, text: &str) {
        self.announce_queue.push_front(text.to_string());
        self.process_queue();
    }

    pub fn process_queue(&mut self) {
        if self.is_speaking || self.announce_queue.is_empty() {
            return;
        }

        let text = self.announce_queue.pop_front().unwrap();
        self.speak(text);
    }

    fn speak(&self, text: String) {
        // Use platform TTS
        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("espeak")
                .args(&["-s", &self.speech_rate.to_string(), &text])
                .spawn();
        }

        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("say")
                .arg(&text)
                .spawn();
        }
    }
}
```

### 15.2 Keyboard Navigation

```rust
pub struct KeyboardNavigator {
    pub focus_order: Vec<WidgetId>,
    pub current_index: Option<usize>,
    pub wrap: bool,
}

impl KeyboardNavigator {
    pub fn focus_next(&mut self) {
        match self.current_index {
            None => {
                self.current_index = Some(0);
                self.focus(self.focus_order[0]);
            }
            Some(i) => {
                let next = (i + 1) % self.focus_order.len();
                self.current_index = Some(next);
                self.focus(self.focus_order[next]);
            }
        }
    }

    pub fn focus_previous(&mut self) {
        match self.current_index {
            None => {
                self.current_index = Some(self.focus_order.len() - 1);
                self.focus(self.focus_order[self.focus_order.len() - 1]);
            }
            Some(i) => {
                let prev = if i > 0 { i - 1 } else { self.focus_order.len() - 1 };
                self.current_index = Some(prev);
                self.focus(self.focus_order[prev]);
            }
        }
    }
}
```

### 15.3 ARIA Roles for TUIs

```rust
pub enum AriaRole {
    Alert,
    AlertDialog,
    Button,
    Checkbox,
    Dialog,
    Grid,
    Link,
    Listbox,
    Menu,
    Menuitem,
    Option,
    Progressbar,
    Radio,
    Slider,
    Spinbutton,
    Status,
    Tab,
    Tablist,
    Textbox,
    Timer,
    Tooltip,
}

pub struct AriaAttributes {
    pub role: AriaRole,
    pub label: Option<String>,
    pub description: Option<String>,
    pub valuenow: Option<f64>,
    pub valuemin: Option<f64>,
    pub valuemax: Option<f64>,
    pub checked: Option<bool>,
    pub disabled: bool,
    pub hidden: bool,
    pub live: Option<LiveRegion>,
}

pub enum LiveRegion {
    Polite,
    Assertive,
    Off,
}
```

### 15.4 High Contrast Mode

```rust
pub struct HighContrastTheme {
    pub colors: ColorPalette,
    pub border_width: u8,
    pub focus_indicator: FocusStyle,
}

impl HighContrastTheme {
    pub fn default() -> Self {
        HighContrastTheme {
            colors: ColorPalette {
                background: Color::BLACK,
                foreground: Color::WHITE,
                primary: Color::YELLOW,
                success: Color::GREEN,
                warning: Color::YELLOW,
                danger: Color::RED,
                neutral: vec![Color::new(60, 60, 60), Color::new(100, 100, 100)]
            },
            border_width: 1,
            focus_indicator: FocusStyle::Underline,
        }
    }
}
```

### 15.5 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| No semantic roles | Screen reader confused | Add ARIA roles |
| Low color contrast | Unreadable for colorblind | Check contrast |
| No keyboard shortcuts | Mouse-only users excluded | Full keyboard nav |
| No announcements | Screen reader users miss updates | Add live regions |
| Auto-playing speech | Disorienting | Allow user control |

---

# PART 2: NOVEL CONCEPTS REPORT

## Accessibility: Untapped Opportunities

### Concept 1: Haptic Feedback for Screen Reader Users

**Idea:** Use **haptic patterns** to convey UI state to blind users.

```rust
pub enum HapticPattern {
    Pulse { intensity: u8, duration_ms: u16 },
    Tap { location: ScreenLocation },
    Wave { direction: Direction },
    Presence { intensity: u8 },
}

pub struct HapticFeedback {
    device: HapticDevice,
}

impl HapticFeedback {
    pub fn notify_cursor_move(&self, from: (usize, usize), to: (usize, usize)) {
        let direction = match (to.0 as i32 - from.0 as i32, to.1 as i32 - from.1 as i32) {
            (0, 1) => Direction::Down,
            (0, -1) => Direction::Up,
            (1, 0) => Direction::Right,
            (-1, 0) => Direction::Left,
            _ => Direction::None,
        };

        self.device.send_pattern(HapticPattern::Wave { direction });
    }
}
```

**Novel because:** TUIs provide no haptic feedback whatsoever.

**Complexity:** Medium
**Value:** High (accessibility breakthrough)

---

**End of Accessibility Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Unicode Width, CJK Handling, and Text Layout for Internationalization

Unicode width correctness is the foundation of accessible TUI text rendering. Three frameworks provide battle-tested implementations:

**Urwid** (`urwid/str_util.py`): 20 years of CJK text handling (big5, gb2312, cp437, UTF-8). `calc_width()` uses `wcwidth()` per-character, not `len()`. `str_util.trim()` correctly truncates to display width preserving grapheme clusters. Supports CJK encoding detection and fallback characters. Wrap modes (`space`, `any`, `clip`, `ellipsis`) all operate on display width, not byte count. Reference implementation for any language.

**Blessed** (`lib/unicode.js`): Wide character detection (CJK), emoji width handling, grapheme cluster awareness, astral plane support (U+10000+). Integrated into Blessed's damage-buffer rendering pipeline — cell occupancy is tracked per-character so cursor movement skips wide-char second cells automatically.

**Tcell** (`cell.go`, `tscreen.go`): Each `Cell` struct carries `Width int` field for CJK. `Put(x, y, str, style)` writes the first grapheme cluster and returns the remainder + width consumed, enabling correct iteration over combining sequences. `GetWidestRawWidth()` handles wide-char cursor movement. Combining characters occupy zero cells.

**WCAG compliance**: Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text. Never rely on color alone for state — use shape, position, or text alongside color.

```rust
// Correct: per-character width accumulation
let display_width: usize = text.chars()
    .map(|c| unicode_width::UnicodeWidthChar::width(c).unwrap_or(0))
    .sum();

// Wrong: byte length ≠ display width
let wrong = text.len();          // bytes
let also_wrong = text.chars().count(); // codepoints (still wrong for combining chars)
```

## 3.2 Keyboard Navigation and Focus Management

**Urwid container focus**: Urwid's `Columns`, `Pile`, `GridFlow`, and `Overlay` widgets each maintain a `focus_index` identifying which child has focus. Focus traversal is explicit — the container tracks position and dispatches input to the focused child. This is the model to replicate: a `focus_order: Vec<WidgetId>` with `current_index: Option<usize>` wrapping at boundaries.

**Blessed event bubbling**: Keyboard events bubble from child → parent → screen root. This enables clean separation: individual widgets handle their own keybindings while parents handle navigation (`focus`/`blur` events). The `lib/keys.js` module maps raw keycodes to termcap-style names (`escape`, `tab`, `enter`, `up`, `down`), normalizing across terminals.

**Textual BINDINGS system** (`app.py`):
```python
class MyApp(App):
    BINDINGS = [
        ("ctrl+q", "quit", "Quit"),
        ("d", "toggle_dark", "Theme"),
        Binding("f1", "help", "Help", show=False),
    ]
    # Actions: `action_quit`, `action_toggle_dark`, `action_help`
```
Key features: shorthand string keys (`"ctrl+q"` auto-parsed), `Binding` objects with `show=False` for hidden shortcuts, `priority=True` for override precedence, and namespaces (`app.action_quit` vs widget-level). The `show` parameter controls whether the binding appears in the footer hint bar — critical for compact mode.

**Tcell input model** (`event.go`): `EventKey` carries `key Key`, `mod ModMask`, `rune rune`. Modifier mask supports `ModShift|ModCtrl|ModAlt|ModMeta`. Key constants: `KeyRune`, `KeyEnter`, `KeyBackspace`, `KeyTab`, `KeyEsc`, `KeyUp`/`KeyDown`/`KeyLeft`/`KeyRight`, `Home`, `End`, `PgUp`, `PgDn`, `Insert`, `Delete`, `KeyF1`–`KeyF64`. `EventFocus` signals focus gain/loss. `EventPaste` (bracketed paste) distinguishes typed vs pasted input — prevents auto-indent on paste, avoids triggering completions.

Must-follow keyboard rules:
- **Never require mouse-only workflows**: every action reachable via keyboard
- **Expose discoverable shortcuts**: show keybindings in footer/hint bar (Textual's `show=True` default)
- **Provide escape hatches**: `ESC` cancels dialogs, modals, search; `ctrl+c` interrupts
- **Support custom keybinding remapping**: power users with motor impairments

## 3.3 Semantic Structure and Screen Reader Integration

**Blessed's DOM-like widget tree** (`lib/widget.js` → `lib/widgets/`): 35+ widget types with semantic names (`button`, `checkbox`, `input`, `radiobutton`, `list`, `progressbar`, `log`, `message`). The inheritance chain `Node → Element → Box → specific widgets` mirrors HTML semantics. This is the model for ARIA-like role mapping in TUIs:

| Blessed Widget | ARIA Equivalent | Notes |
|---|---|---|
| `button` | `role="button"` | Triggers `select` event |
| `checkbox` | `role="checkbox"` | Carries `checked` state |
| `radiobutton` | `role="radio"` | Group via `radioset` |
| `textbox`/`textarea` | `role="textbox"` | Editable text |
| `list` | `role="list"` | Navigable items |
| `listbar` | `role="menubar"` | Command shortcuts |
| `progressbar` | `role="progressbar"` | Value 0–100 |
| `log` | `role="log"` | Auto-scrolling, `aria-live="polite"` |

**Live region pattern**: Map `aria-live="polite"` to a message/status widget that screen readers poll. Map `aria-live="assertive"` to modal alerts that interrupt. The Blessed `log` widget (auto-scrolling text output) is the `polite` region. The `message`/`alert` widgets are `assertive` regions.

**Urwid's `notify()` equivalent**: Urwid signals (`urwid/connect_signal`) carry typed data. A screen reader bridge should hook into widget `change` signals and announce new values.

## 3.4 High Contrast, Reduced Motion, and Visual Accessibility

**Textual CSS opacity and transitions**: Textual supports `opacity: 0.0–1.0` and `transition: background 0.5s`. For reduced motion (vestibular disorders), allow users to disable all transitions:
```css
/* Reduced motion: disable all animations */
@media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0s !important; animation-duration: 0s !important; }
}
```
In Textual's Python API: `self.animate("opacity", 1.0, duration=0)` to skip animation entirely.

**Textual `prefers-color-scheme` dark mode**: `self.theme = "dark" if self.theme == "light" else "light"` via action binding. Expose a toggle. Terminal-level dark mode detection is unreliable — always provide an explicit user toggle.

**Tcell color fallback chain**: `ColorDefault` → `Color{16}` → `Color{256}` → `ColorRGB`. True color (24-bit) degrades to 256-color palette, then to 16-color. High contrast themes must specify colors at the 16-color level minimum to guarantee visibility on all terminals. Bold (`AttrBold`) + `AttrReverse` are the most reliable accessible emphasis mechanisms.

**Chafa Braille output** (`CHAFA_SYMBOL_MODE_BRAILLE`): Chafa converts images to Braille dot patterns (2×2 pixel blocks → 1 Braille cell with 8 dots). While designed for image rendering, the Braille output mode is directly applicable to rendering charts, diagrams, and iconography for Braille display users. Pipeline: image → scale → Braille symbol mapping → Unicode Braille characters (U+2800–U+28FF). Each Braille cell encodes 4 vertical pixels × 2 horizontal pixels = 8 bits.

## 3.5 Motor Accessibility and Input Adaptation

**Tcell bracketed paste** (`EventPaste`): Modern terminals wrap pasted text in `\x1b[200~...\x1b[201~`. `EventPaste` fires separately from `EventKey`, allowing the app to handle bulk text insertion differently from keystroke-by-keystroke input. Critical for users who rely on on-screen keyboards, switch devices, or voice-to-text — these input methods often simulate paste rather than individual keypresses.

**Blessed double-buffering for flicker reduction**: Flickering triggers photosensitive epilepsy. Blessed's damage buffer (front/back `Vec<Cell>` comparison → minimal diff output) minimizes screen redraws. Only changed cells are output via a single `write()` to stdout. This is essential for users with photosensitive conditions — avoid full-screen clears (`\x1b[2J`) on every render.

**Focus indicator design**: Minimum 2px-equivalent (1 cell) visible focus border. Blessed's `border` property supports `focus` style variants:
```javascript
{
  border: { type: 'line' },
  style: {
    border: { fg: 'default' },
    focus: { border: { fg: 'white' } }  // Highlight on focus
  }
}
```
Urwid's `render(size, focus=False)` passes a `focus` flag so widgets change appearance when focused. Replicate this pattern: every focusable widget must look different when focused.

## 3.6 Accessibility Anti-Patterns Compendium

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Using `len()` for display width | CJK text misaligned, overflow | Use `wcwidth()` per character |
| Color-only state indication | Colorblind users miss state | Add icons, text labels, or shape changes |
| No focus indicator on active element | Keyboard-only user lost | Visible border/underline/background change |
| Full-screen redraw every frame | Flickering, photosensitive triggers | Damage-buffer diffing (double buffer) |
| Mouse-only drag interactions | Motor-impaired users excluded | Provide keyboard alternative |
| Auto-playing animations (no disable) | Vestibular disorders triggered | Honor `prefers-reduced-motion`; include instant mode |
| Small fixed font size | Low-vision users cannot read | Font zoom with PTY resize propagation |
| No semantic widget roles | Screen readers announce "unknown" | Map widgets to ARIA-equivalent roles |
| ESC doesn't close modals | Keyboard users trapped | Global escape handler at screen level |
| Ignoring combining characters | Accented text garbled | Use grapheme cluster iteration, not char iteration |
| PTY resize not propagating after font change | CLI tools (vim/less) render corrupted | After `fontSize = N`: `fit()` → `resize(rows, cols)` |


---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Keyboard Accessibility Patterns in Canopy

Canopy implements keyboard shortcuts at the `TerminalView` level via `useEffect` keydown listeners:

**Cmd+Ctrl+F — Open search bar:**
```typescript
if ((e.metaKey || e.ctrlKey) && e.key === "f") {
  e.preventDefault();
  setSearchOpen(true);
  setTimeout(() => searchInputRef.current?.focus(), 0);
}
```

**Cmd+Plus/Cmd+Minus/Cmd+0 — Font zoom:**
- Clamp delta: 8pt minimum, 24pt maximum, reset at 13pt.
- After font change: xterm.options.fontSize = next → fit() → resizeTerminal()
- On _ESC_ from search: `closeSearch(); xtermRef.current?.focus();`

**Accessibility gaps in Canopy:**
- Tab bar buttons lack `aria-label` attributes (title only — insufficient for screen readers)
- No `role="tablist"` / `role="tab"` on tab UI (all div-based)
- No keyboard reorder (pointer-only drag)
- No `aria-live` region for status changes (running, waiting, done)

---
