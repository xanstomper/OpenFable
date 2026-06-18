# Charmbracelet Ecosystem - Terminal Application Primitives Index

## Overview

This index provides a comprehensive mapping of reusable primitives extracted from the Charmbracelet ecosystem repositories. Each primitive is categorized by function and linked to detailed reports.

---

## Report Directory

| Report | Focus | Key Primitives |
|--------|-------|----------------|
| [bubbletea-primitives.md](./bubbletea-primitives.md) | TUI Framework | Elm architecture, event loop, commands, messages |
| [bubbles-primitives.md](./bubbles-primitives.md) | TUI Components | Widgets, state management, composition |
| [lipgloss-primitives.md](./lipgloss-primitives.md) | Terminal Styling | Builder pattern, colors, borders, layout |
| [huh-primitives.md](./huh-primitives.md) | Form/Input | Fields, validation, accessible mode |
| [glamour-primitives.md](./glamour-primitives.md) | Markdown | AST rendering, themes, tables |
| [gum-primitives.md](./gum-primitives.md) | Shell Utilities | CLI primitives, pipelines, composition |
| [wish-wishlist-primitives.md](./wish-wishlist-primitives.md) | SSH/TUI Bridge | Middleware, SSH server, directory |

---

## Primitive Categories

### A. Architectural Patterns

| Pattern | Description | Repositories | Language Portability |
|---------|-------------|--------------|---------------------|
| **Elm Architecture** | Model-Update-View cycle with immutable state | bubbletea, bubbles | ★★★★★ (Universal) |
| **Command Pattern** | Deferred side effects as first-class values | bubbletea | ★★★★☆ (Needs async) |
| **Middleware Chain** | Request processing pipeline | wish | ★★★★★ (Universal) |
| **Builder Pattern** | Fluent, immutable object construction | lipgloss, huh | ★★★★★ (Universal) |
| **Component Composition** | Parent-child model delegation | bubbles, huh | ★★★★☆ (Needs type system) |
| **Accessor Pattern** | Flexible value binding | huh | ★★★★★ (Universal) |
| **Eval Pattern** | Reactive content with dependency tracking | huh | ★★★☆☆ (Complex) |

### B. Input Handling

| Primitive | Description | Implementation | Portability |
|-----------|-------------|----------------|-------------|
| **Keyboard Input** | Key press/release with modifiers | bubbletea/key.go | ★★★★★ |
| **Mouse Input** | Click, drag, scroll events | bubbletea/mouse.go | ★★★★☆ |
| **Text Input** | Single-line with cursor management | bubbles/textinput, huh/input | ★★★★★ |
| **Multi-line Input** | Text editor with viewport | bubbles/textarea, huh/text | ★★★★☆ |
| **Password Input** | Masked character entry | bubbles/textinput | ★★★★★ |
| **Autocomplete** | Suggestion-based completion | bubbles/textinput, huh/input | ★★★★★ |
| **File Picker** | Directory navigation | bubbles/filepicker, huh/file | ★★★★☆ |
| **Date Picker** | Calendar selection | huh/date | ★★★★★ |

### C. Display/Rendering

| Primitive | Description | Implementation | Portability |
|-----------|-------------|----------------|-------------|
| **ANSI Styling** | Colors, attributes, hyperlinks | lipgloss | ★★★★★ |
| **Border Rendering** | 14-part borders with gradients | lipgloss/borders | ★★★★★ |
| **Layout Engine** | Padding, margin, alignment | lipgloss | ★★★★☆ |
| **Word Wrapping** | Unicode-aware text wrapping | glamour | ★★★★☆ |
| **Table Rendering** | Bordered tabular display | glamour, lipgloss | ★★★★★ |
| **List Rendering** | Scrollable item lists | bubbles/list | ★★★★★ |
| **Markdown Rendering** | AST-based ANSI output | glamour | ★★★★☆ |
| **Syntax Highlighting** | Code block highlighting | glamour | ★★★☆☆ |
| **Progress Bar** | Animated progress display | bubbles/progress | ★★★★★ |
| **Spinner** | Loading animation | bubbles/spinner | ★★★★★ |

### D. State Management

| Primitive | Description | Implementation | Portability |
|-----------|-------------|----------------|-------------|
| **Immutable State** | Copy-on-write state updates | bubbletea | ★★★★★ |
| **Message Passing** | Type-safe event communication | bubbletea | ★★★★☆ |
| **Focus Management** | Active element tracking | bubbles, huh | ★★★★★ |
| **Viewport Scrolling** | Large content navigation | bubbles/viewport | ★★★★☆ |
| **Pagination** | Page-based navigation | bubbles/paginator | ★★★★★ |
| **Form State Machine** | Normal → Completed → Aborted | huh/form | ★★★★★ |
| **Session Storage** | Per-connection state | wish | ★★★★☆ |

### E. Theming/Styling

| Primitive | Description | Implementation | Portability |
|-----------|-------------|----------------|-------------|
| **Color Profiles** | ASCII → ANSI → 256 → True Color | lipgloss, colorprofile | ★★★★★ |
| **Light/Dark Mode** | Context-aware color selection | lipgloss | ★★★★★ |
| **Theme System** | JSON-based style configuration | glamour, huh | ★★★★★ |
| **Style Inheritance** | Parent-child style propagation | lipgloss | ★★★★★ |
| **Gradient Borders** | Color gradients on borders | lipgloss | ★★★★☆ |
| **Built-in Themes** | Pre-configured style sets | glamour, huh | ★★★★★ |

### F. Accessibility

| Primitive | Description | Implementation | Portability |
|-----------|-------------|----------------|-------------|
| **Screen Reader Mode** | Line-based prompts | huh | ★★★★★ |
| **Keyboard Navigation** | Comprehensive key bindings | bubbles, huh | ★★★★★ |
| **High Contrast** | Color-blind friendly themes | lipgloss | ★★★★★ |
| **Reduced Motion** | Disable animations | bubbles | ★★★★★ |

### G. SSH/Network

| Primitive | Description | Implementation | Portability |
|-----------|-------------|----------------|-------------|
| **SSH Middleware** | Request processing chain | wish | ★★★☆☆ (SSH-specific) |
| **Auth Handlers** | Password/pubkey validation | wish | ★★★☆☆ |
| **Session I/O** | stdin/stdout over SSH | wish | ★★★☆☆ |
| **Host Key Management** | Key generation/loading | wish, keygen | ★★★☆☆ |
| **Service Directory** | Endpoint listing | wishlist | ★★★★☆ |

### H. Shell Integration

| Primitive | Description | Implementation | Portability |
|-----------|-------------|----------------|-------------|
| **CLI Commands** | Standalone utilities | gum | ★★★★★ |
| **Pipeline Composition** | stdin/stdout chaining | gum | ★★★★★ |
| **Return Codes** | Scriptable success/abort | gum | ★★★★★ |
| **Environment Config** | $VAR-based configuration | gum, glamour | ★★★★★ |

---

## Cross-Repository Patterns

### Pattern: Component Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                 Component Lifecycle                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Init()                                                 │
│    ↓                                                    │
│  ┌────────────────────────────────────────────┐        │
│  │              Event Loop                    │        │
│  │  ┌──────────────────────────────────┐     │        │
│  │  │  Receive Message                 │     │        │
│  │  │       ↓                          │     │        │
│  │  │  Update(State, Msg) → (State, Cmd)│    │        │
│  │  │       ↓                          │     │        │
│  │  │  Execute Command → New Message   │     │        │
│  │  │       ↓                          │     │        │
│  │  │  View(State) → Rendered Output   │     │        │
│  │  └──────────────────────────────────┘     │        │
│  └────────────────────────────────────────────┘        │
│    ↓                                                    │
│  Shutdown() / Quit()                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Implements**: bubbles, huh, wish
**Adaptable to**: Any event-driven UI framework

### Pattern: Style Application Pipeline

```
Raw String
    ↓
[Apply Text Attributes] → bold, italic, underline
    ↓
[Apply Colors] → foreground, background
    ↓
[Apply Layout] → padding, margin, alignment
    ↓
[Apply Borders] → edges, corners
    ↓
[Apply Width Constraints] → wrapping, truncation
    ↓
ANSI Output
```

**Implements**: lipgloss, glamour
**Adaptable to**: Any terminal styling system

### Pattern: Form Field Validation

```
User Input
    ↓
[Format Validation] → regex, type check
    ↓
[Business Logic Validation] → rules, constraints
    ↓
[Async Validation] → API calls, database
    ↓
┌──────────────┐
│ Valid?       │
├──────────────┤
│ Yes → Submit │
│ No  → Error  │
└──────────────┘
```

**Implements**: huh
**Adaptable to**: Any form system

---

## Language-Specific Implementation Guides

### Python

| Primitive | Recommended Libraries | Notes |
|-----------|----------------------|-------|
| TUI Framework | `textual`, `blessed`, `urwid` | Textual has Elm-like architecture |
| Styling | `rich`, `colorama` | Rich has lipgloss-like builder |
| Forms | `questionary`, `inquirer` | Similar to huh |
| Markdown | `rich.markdown`, `mistune` | ANSI rendering |
| SSH Server | `asyncssh`, `paramiko` | Middleware possible |
| CLI Utilities | `click`, `typer` | Command composition |

### Rust

| Primitive | Recommended Crates | Notes |
|-----------|-------------------|-------|
| TUI Framework | `ratatui`, `tui-rs` | Ratatui is most mature |
| Styling | `crossterm`, `ansi_term` | Terminal abstraction |
| Forms | `inquire`, `dialoguer` | Prompts and forms |
| Markdown | `comrak`, `pulldown-cmark` | Parsing + custom rendering |
| SSH Server | `russh`, `ssh2` | Async SSH |
| CLI Utilities | `clap`, `dialoguer` | Command-line parsing |

### TypeScript/Node

| Primitive | Recommended Packages | Notes |
|-----------|---------------------|-------|
| TUI Framework | `blessed`, `ink` | React-like (Ink) or traditional |
| Styling | `chalk`, `ansi-escapes` | Terminal styling |
| Forms | `inquirer`, `prompts` | Interactive prompts |
| Markdown | `marked-terminal`, `cli-markdown` | ANSI rendering |
| SSH Server | `ssh2` | SSH server/client |
| CLI Utilities | `commander`, `yargs` | Command composition |

---

## Quick Start Templates

### Minimal TUI App (Any Language)

```python
# Python example
from textual.app import App

class MyApp(App):
    counter = 0
    
    def on_mount(self):
        self.counter = 0
    
    def on_key(self, event):
        if event.key == "up":
            self.counter += 1
        elif event.key == "down":
            self.counter -= 1
        elif event.key == "ctrl+c":
            self.exit()
    
    def render(self) -> str:
        return f"Counter: {self.counter}"

MyApp().run()
```

### Style Builder (Any Language)

```python
# Python example
class Style:
    def __init__(self, **kwargs):
        self.fg = kwargs.get('fg', None)
        self.bg = kwargs.get('bg', None)
        self.bold = kwargs.get('bold', False)
        self.italic = kwargs.get('italic', False)
    
    def with_fg(self, color):
        return Style(fg=color, bg=self.bg, bold=self.bold, italic=self.italic)
    
    def with_bold(self, value=True):
        return Style(fg=self.fg, bg=self.bg, bold=value, italic=self.italic)
    
    def render(self, text: str) -> str:
        codes = []
        if self.bold:
            codes.append('1')
        if self.italic:
            codes.append('3')
        if self.fg:
            codes.append(f'38;5;{self.fg}')
        if self.bg:
            codes.append(f'48;5;{self.bg}')
        if codes:
            return f'\x1b[{";".join(codes)}m{text}\x1b[0m'
        return text

# Usage
style = Style().with_fg(196).with_bold()
print(style.render("Bold Red Text"))
```

### Form Field (Any Language)

```python
# Python example
class Field(ABC):
    def __init__(self, title: str, key: str):
        self.title = title
        self.key = key
        self.value = None
        self.error = None
    
    @abstractmethod
    def render(self) -> str:
        pass
    
    @abstractmethod
    def handle_input(self, key: str) -> bool:
        """Returns True when field is complete"""
        pass
    
    def validate(self) -> Optional[str]:
        return None

class InputField(Field):
    def render(self) -> str:
        error = f"\n  [red]{self.error}[/]" if self.error else ""
        return f"{self.title}: {self.value or '_'}{error}"
    
    def handle_input(self, key: str) -> bool:
        if key == "enter":
            return self.validate() is None
        elif key == "backspace":
            self.value = (self.value or "")[:-1]
        elif len(key) == 1:
            self.value = (self.value or "") + key
        return False

class Form:
    def __init__(self, *fields: Field):
        self.fields = fields
        self.current = 0
        self.results = {}
    
    def run(self) -> Optional[dict]:
        while self.current < len(self.fields):
            field = self.fields[self.current]
            # Render and handle input
            # ...
        return self.results
```

---

## Best Practices

### 1. Start with Architecture

Before implementing:
- [ ] Define your Model state structure
- [ ] Identify all possible Messages/Events
- [ ] Plan the Update function's message handling
- [ ] Design the View rendering pipeline

### 2. Immutable State

- Always return new state objects
- Never mutate state in place
- Use structural sharing for efficiency

### 3. Command Separation

- Keep side effects in Commands
- Pure update logic
- Testable in isolation

### 4. Theme First

- Define themes before building UI
- Use semantic names (primary, secondary)
- Support light/dark modes

### 5. Accessibility Early

- Keyboard navigation from day one
- Screen reader mode
- High contrast support

### 6. Error Handling

- Validate on every interaction
- Show clear error messages
- Graceful degradation

---

## Further Reading

- [Bubble Tea Tutorial](https://github.com/charmbracelet/bubbletea/tree/master/tutorials)
- [Lip Gloss Examples](https://github.com/charmbracelet/lipgloss/tree/master/examples)
- [Huh Examples](https://github.com/charmbracelet/huh/tree/main/examples)
- [Wish Examples](https://github.com/charmbracelet/wish/tree/main/examples)
- [Gum Documentation](https://github.com/charmbracelet/gum#readme)
- [Glamour Examples](https://github.com/charmbracelet/glamour/tree/main/examples)

---

## Contributing

When extracting new primitives:

1. **Identify the pattern**: What problem does it solve?
2. **Abstract the implementation**: Remove Go-specific details
3. **Document for other languages**: Python, Rust, TypeScript examples
4. **Test in isolation**: Ensure it works standalone
5. **Link to existing patterns**: How does it compose?

---

## License

This analysis is based on the Charmbracelet ecosystem repositories. See original repositories for their respective licenses.

Generated: 2026-05-31
Author: AI Analysis of CharmbraceletEcosystem