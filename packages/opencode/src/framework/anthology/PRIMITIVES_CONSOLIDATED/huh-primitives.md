# Huh - Terminal Form/Input Primitives

## Overview

Huh is a form library for building interactive terminal prompts and forms. It provides composable field types, validation, and both TUI and accessible (screen-reader friendly) modes.

---

## 1. Core Architecture: Form/Field Pattern

### 1.1 Form Structure

**Primitive:** Forms contain groups, groups contain fields

```
Form
├── Group 1 (Page 1)
│   ├── Field 1 (Input)
│   ├── Field 2 (Select)
│   └── Field 3 (Confirm)
├── Group 2 (Page 2)
│   └── ...
└── Group N
```

**Language-Agnostic Abstraction:**

```python
class Form:
    def __init__(self, *groups: 'Group'):
        self.groups = list(groups)
        self.current_group = 0
        self.results = {}
        self.state = FormState.NORMAL
    
    def run(self) -> dict:
        """Execute the form and return results"""
        while not self.is_complete():
            group = self.groups[self.current_group]
            if not group.run():
                return None  # Aborted
            self.current_group += 1
        return self.results

class Group:
    def __init__(self, *fields: 'Field'):
        self.fields = list(fields)
        self.current_field = 0
    
    def run(self) -> bool:
        """Execute all fields in group"""
        for field in self.fields:
            if not field.run():
                return False
            self.results[field.key] = field.value
        return True
```

### 1.2 Field Interface

**Primitive:** All fields implement a common interface

```go
type Field interface {
    // Bubble Tea Model
    Init() Cmd
    Update(Msg) (Model, Cmd)
    View() string
    
    // Focus handling
    Blur() Cmd
    Focus() Cmd
    
    // Validation
    Error() error
    
    // Execution
    Run() error
    RunAccessible(w io.Writer, r io.Reader) error
    
    // Properties
    Skip() bool
    Zoom() bool
    KeyBinds() []key.Binding
    
    // Configuration
    WithTheme(Theme) Field
    WithKeyMap(*KeyMap) Field
    WithWidth(int) Field
    WithHeight(int) Field
    GetKey() string
    GetValue() any
}
```

**Implementation Pattern:**

```python
from abc import ABC, abstractmethod
from typing import Any, Optional, Callable

class Field(ABC):
    @abstractmethod
    def init(self) -> Optional['Cmd']:
        pass
    
    @abstractmethod
    def update(self, msg: 'Msg') -> tuple['Field', Optional['Cmd']]:
        pass
    
    @abstractmethod
    def view(self) -> str:
        pass
    
    @abstractmethod
    def focus(self) -> Optional['Cmd']:
        """Called when field gains focus"""
        pass
    
    @abstractmethod
    def blur(self) -> Optional['Cmd']:
        """Called when field loses focus"""
        pass
    
    @abstractmethod
    def validate(self, value: Any) -> Optional[str]:
        """Return error message or None"""
        pass
    
    @abstractmethod
    def get_value(self) -> Any:
        pass
    
    def skip(self) -> bool:
        """Return True if field should be skipped"""
        return False
    
    def zoom(self) -> bool:
        """Return True if field should take full height"""
        return False
```

---

## 2. Field Types

### 2.1 Input Field (Text Entry)

**Primitive:** Single-line text input with validation and autocomplete

```python
class InputField(Field):
    def __init__(self):
        self.value = ""
        self.placeholder = ""
        self.title = ""
        self.description = ""
        self.validate: Callable[[str], Optional[str]] = None
        self.suggestions: list[str] = []
        self.echo_mode = EchoMode.NORMAL  # Or PASSWORD
        self.max_length: Optional[int] = None
        self.cursor_position = 0
    
    def update(self, msg: Msg) -> tuple['Field', Optional[Cmd]]:
        if isinstance(msg, KeyMsg):
            if msg.key == "enter":
                return self, self.submit_cmd()
            elif msg.key == "tab" and self.suggestions:
                return self, self.complete_suggestion()
            elif msg.key == "ctrl+h" or msg.key == "backspace":
                # Handle backspace
                ...
            elif len(msg.text) == 1:
                # Insert character
                ...
        return self, None
```

**Features:**
- Character limit
- Password mode (masked input)
- Autocomplete suggestions
- Placeholder text
- Live validation
- Cursor navigation

### 2.2 Text Area (Multi-line)

**Primitive:** Multi-line text editor with viewport

```python
class TextAreaField(Field):
    def __init__(self):
        self.lines: list[str] = [""]
        self.cursor_row = 0
        self.cursor_col = 0
        self.viewport = Viewport()
        self.title = ""
        self.description = ""
        self.char_limit: Optional[int] = None
    
    def insert_char(self, c: str):
        line = self.lines[self.cursor_row]
        self.lines[self.cursor_row] = (
            line[:self.cursor_col] + c + line[self.cursor_col:]
        )
        self.cursor_col += 1
    
    def insert_newline(self):
        line = self.lines[self.cursor_row]
        self.lines.insert(
            self.cursor_row + 1,
            line[self.cursor_col:]
        )
        self.lines[self.cursor_row] = line[:self.cursor_col]
        self.cursor_row += 1
        self.cursor_col = 0
```

### 2.3 Select Field (Single Choice)

**Primitive:** Scrollable option list with search

```python
class SelectField(Field, Generic[T]):
    def __init__(self):
        self.options: list[Option[T]] = []
        self.selected_index = 0
        self.filter_text = ""
        self.filtered_options: list[Option[T]] = []
        self.viewport = Viewport()
        self.title = ""
        self.description = ""
    
    def update(self, msg: Msg) -> tuple['Field', Optional[Cmd]]:
        if isinstance(msg, KeyMsg):
            if msg.key == "up":
                self.selected_index = max(0, self.selected_index - 1)
            elif msg.key == "down":
                self.selected_index = min(
                    len(self.filtered_options) - 1,
                    self.selected_index + 1
                )
            elif msg.key == "enter":
                self.value = self.filtered_options[self.selected_index].value
                return self, self.submit_cmd()
            elif msg.key == "/":
                # Start filtering
                ...
            elif self.filtering:
                self.filter_text += msg.text
                self._apply_filter()
        return self, None
```

**Features:**
- Keyboard navigation (up/down, j/k)
- Filtering/search (/ to search)
- Scrollable viewport for long lists
- Custom option labels

### 2.4 Multi-Select Field

**Primitive:** Multiple option selection with toggle

```python
class MultiSelectField(Field, Generic[T]):
    def __init__(self):
        self.options: list[Option[T]] = []
        self.selected_indices: set[int] = set()
        self.cursor_index = 0
        self.filter_text = ""
        self.title = ""
        self.description = ""
    
    def toggle_selection(self):
        if self.cursor_index in self.selected_indices:
            self.selected_indices.remove(self.cursor_index)
        else:
            self.selected_indices.add(self.cursor_index)
    
    def get_value(self) -> list[T]:
        return [
            self.options[i].value 
            for i in self.selected_indices
        ]
```

### 2.5 Confirm Field (Yes/No)

**Primitive:** Boolean confirmation with keyboard shortcuts

```python
class ConfirmField(Field):
    def __init__(self):
        self.value = False
        self.title = ""
        self.description = ""
        self.default = False  # Default value on Enter
        self.affirmative = "y"  # Keys for yes
        self.negative = "n"     # Keys for no
    
    def update(self, msg: Msg) -> tuple['Field', Optional[Cmd]]:
        if isinstance(msg, KeyMsg):
            if msg.key in self.affirmative or msg.key == "enter":
                self.value = True
                return self, self.submit_cmd()
            elif msg.key in self.negative:
                self.value = False
                return self, self.submit_cmd()
            elif msg.key == "left":
                self.value = False
            elif msg.key == "right":
                self.value = True
        return self, None
    
    def view(self) -> str:
        yes_style = "selected" if self.value else "unselected"
        no_style = "selected" if not self.value else "unselected"
        return f"{self.title} ({yes_style}Yes{no_style}/No)"
```

### 2.6 File Picker Field

**Primitive:** File system navigation and selection

```python
class FilePickerField(Field):
    def __init__(self):
        self.current_dir = os.getcwd()
        self.entries: list[FileEntry] = []
        self.cursor = 0
        self.selected: Optional[str] = None
        self.filter = ""
        self.show_hidden = False
    
    def refresh_entries(self):
        self.entries = []
        # Add ".." for parent directory
        if self.current_dir != "/":
            self.entries.append(FileEntry.parent())
        
        # List directory contents
        for entry in os.scandir(self.current_dir):
            if not self.show_hidden and entry.name.startswith('.'):
                continue
            if self.filter and self.filter not in entry.name:
                continue
            self.entries.append(FileEntry.from_path(entry))
        
        self.entries.sort(key=lambda e: (not e.is_dir, e.name.lower()))
```

**Features:**
- Directory navigation
- File filtering
- Hidden file toggle
- Selection confirmation

### 2.7 Note Field (Read-only Display)

**Primitive:** Informational display without input

```python
class NoteField(Field):
    def __init__(self):
        self.title = ""
        self.description = ""
        self.next_label = "Continue"
    
    def update(self, msg: Msg) -> tuple['Field', Optional[Cmd]]:
        if isinstance(msg, KeyMsg) and msg.key == "enter":
            return self, self.submit_cmd()
        return self, None
    
    def skip(self) -> bool:
        return True  # Skip in navigation
```

---

## 3. Accessor Pattern

### 3.1 Value Binding

**Primitive:** Flexible value storage and retrieval

```go
type Accessor[T any] interface {
    Get() T
    Set(T)
}
```

**Implementations:**

```python
class PointerAccessor(Generic[T]):
    """Bind to external variable"""
    def __init__(self, ref: list[T]):
        self.ref = ref  # Use list for mutability
    
    def get(self) -> T:
        return self.ref[0]
    
    def set(self, value: T):
        self.ref[0] = value

class EmbeddedAccessor(Generic[T]):
    """Store value internally"""
    def __init__(self):
        self._value: Optional[T] = None
    
    def get(self) -> T:
        return self._value
    
    def set(self, value: T):
        self._value = value

class MapAccessor(Generic[T]):
    """Store in dictionary by key"""
    def __init__(self, map: dict, key: str):
        self.map = map
        self.key = key
    
    def get(self) -> T:
        return self.map.get(self.key)
    
    def set(self, value: T):
        self.map[self.key] = value
```

**Usage:**

```python
# External binding
result = {}
form = Form(
    Group(
        Input().accessor(MapAccessor(result, "username")),
        Input().accessor(MapAccessor(result, "email")),
    )
)
form.run()
# result now contains {"username": "...", "email": "..."}

# Internal storage
field = Input().value(my_var)  # Binds to my_var
```

---

## 4. Dynamic Content (Eval Pattern)

### 4.1 Reactive Fields

**Primitive:** Re-evaluate content when dependencies change

```go
type Eval[T any] struct {
    val  T
    fn   func() T
    bindings any  // Object to watch for changes
    cache map[uint64]T
}
```

**Pattern:**

```python
class Eval(Generic[T]):
    def __init__(self, fn: Optional[Callable[[], T]] = None, bindings: Any = None):
        self.fn = fn
        self.bindings = bindings
        self._cache: Optional[T] = None
        self._old_bindings_hash: Optional[int] = None
    
    def get(self) -> T:
        if self.fn is None:
            return self._cache
        
        # Check if bindings changed
        current_hash = hash(self.bindings)
        if current_hash != self._old_bindings_hash:
            self._cache = self.fn()
            self._old_bindings_hash = current_hash
        
        return self._cache

# Usage
def get_title():
    return f"Welcome, {username}!"

field = Input().title_func(get_title, bindings=username)
# Title re-evaluates whenever username changes
```

---

## 5. Validation System

### 5.1 Validation Functions

**Primitive:** Synchronous validation with error return

```python
Validator = Callable[[Any], Optional[str]]

def validate_email(value: str) -> Optional[str]:
    if '@' not in value:
        return "Please enter a valid email"
    return None

def validate_min_length(n: int) -> Validator[str]:
    def validate(value: str) -> Optional[str]:
        if len(value) < n:
            return f"Must be at least {n} characters"
        return None
    return validate

# Usage
field = Input().validate(validate_email)
field = Input().validate(validate_min_length(8))
```

### 5.2 Error Display

**Primitive:** Inline error rendering

```python
class Field:
    def __init__(self):
        self.error: Optional[str] = None
        self.validate: Validator = lambda v: None
    
    def submit(self) -> bool:
        self.error = self.validate(self.get_value())
        return self.error is None
    
    def view(self) -> str:
        error_style = Style(fg=red, bold=True)
        error_text = ""
        if self.error:
            error_text = f"\n{error_style.render(self.error)}"
        return f"{self.title}: {self.value}{error_text}"
```

---

## 6. Theming System

### 6.1 Theme Structure

**Primitive:** Centralized style configuration

```python
@dataclass
class Theme:
    # Field styles
    title: Style
    description: Style
    error: Style
    
    # Input styles
    cursor: Style
    placeholder: Style
    selected: Style
    unselected: Style
    
    # Button styles
    button: Style
    button_text: Style
    focused_button: Style
    
    # Layout
    base: Style
    group: Style
```

**Usage:**

```python
theme = Theme(
    title=lipgloss.Style().bold(True).foreground(Color("#fff")),
    description=lipgloss.Style().foreground(Color("#888")),
    error=lipgloss.Style().foreground(Color("#f00")),
)

form = Form().with_theme(theme)
```

---

## 7. Accessible Mode

### 7.1 Screen Reader Support

**Primitive:** Alternative rendering for accessibility

```python
class Field:
    def run_accessible(self, w: io.Writer, r: io.Reader) -> Any:
        """Simple prompt-based interaction"""
        w.write(f"{self.title}: ")
        w.flush()
        value = r.readline().strip()
        self.set_value(value)
        return self.get_value()

class Form:
    def run(self, accessible: bool = False) -> dict:
        if accessible:
            return self._run_accessible()
        return self._run_tui()
    
    def _run_accessible(self) -> dict:
        results = {}
        for group in self.groups:
            for field in group.fields:
                if field.skip():
                    continue
                results[field.key] = field.run_accessible(
                    self.output, self.input
                )
        return results
```

**Key Considerations:**
- No ANSI codes in accessible mode
- Clear prompt messages
- Simple line-based input
- Explicit success/failure messages
- No time-based interactions

---

## 8. Keyboard Navigation

### 8.1 Common Key Bindings

| Action | Keys |
|--------|------|
| Next field | Tab, Enter, j, Down |
| Previous field | Shift+Tab, k, Up |
| Submit form | Ctrl+Enter, Ctrl+S |
| Abort form | Ctrl+C, Escape, Ctrl+Q |
| Help | ? |
| Undo | Ctrl+Z |

### 8.2 KeyMap Configuration

```python
@dataclass
class KeyMap:
    # Navigation
    next: KeyBinding = KeyBinding(keys=["tab", "enter"], help="next")
    prev: KeyBinding = KeyBinding(keys=["shift+tab"], help="previous")
    
    # Submission
    submit: KeyBinding = KeyBinding(keys=["ctrl+enter"], help="submit")
    abort: KeyBinding = KeyBinding(keys=["ctrl+c"], help="quit")
    
    # Help
    help: KeyBinding = KeyBinding(keys=["?"], help="help")
```

---

## 9. Form State Machine

```python
class FormState(Enum):
    NORMAL = 0      # User is completing form
    COMPLETED = 1   # Form submitted successfully
    ABORTED = 2     # User cancelled

class Form:
    def __init__(self):
        self.state = FormState.NORMAL
    
    def update(self, msg: Msg) -> tuple['Form', Optional[Cmd]]:
        if self.state != FormState.NORMAL:
            return self, None  # Form is done
        
        if isinstance(msg, QuitMsg):
            self.state = FormState.ABORTED
            self.aborted = True
            return self, self.cancel_cmd
        
        if self.is_complete():
            self.state = FormState.COMPLETED
            return self, self.submit_cmd
        
        # Normal update logic
        ...
```

---

## 10. Layout System

### 10.1 Layout Strategies

```python
class Layout(ABC):
    @abstractmethod
    def render(self, group: Group, fields: list[Field]) -> str:
        pass

class LayoutDefault(Layout):
    """Stack fields vertically"""
    def render(self, group, fields):
        return "\n\n".join(f.view() for f in fields)

class LayoutStack(Layout):
    """Compact vertical stack"""
    def render(self, group, fields):
        return "\n".join(f.view() for f in fields)

class LayoutGrid(Layout):
    """Arrange fields in grid"""
    def __init__(self, columns: int):
        self.columns = columns
    
    def render(self, group, fields):
        # Group fields into rows
        rows = []
        for i in range(0, len(fields), self.columns):
            row_fields = fields[i:i + self.columns]
            row = "  ".join(f.view() for f in row_fields)
            rows.append(row)
        return "\n".join(rows)
```

---

## 11. Implementation Checklist

### Core Requirements

- [ ] Form/Group/Field hierarchy
- [ ] Field interface (init, update, view, focus, blur)
- [ ] Input field (text entry)
- [ ] Select field (single choice)
- [ ] Confirm field (yes/no)
- [ ] Text area (multi-line)
- [ ] Validation system
- [ ] Accessor pattern for value binding
- [ ] Accessible mode (screen reader)
- [ ] Keyboard navigation

### Advanced Features

- [ ] Multi-select field
- [ ] File picker field
- [ ] Note field (read-only)
- [ ] Dynamic content (Eval pattern)
- [ ] Autocomplete/suggestions
- [ ] Filtering in selects
- [ ] Viewport for scrolling
- [ ] Custom themes
- [ ] Custom keymaps
- [ ] Layout strategies
- [ ] Form state machine
- [ ] Timeout support

---

## Summary

Huh provides a comprehensive form library with:

1. **Composable Architecture**: Form → Group → Field hierarchy
2. **Multiple Field Types**: Input, Select, MultiSelect, Confirm, Text, FilePicker, Note
3. **Flexible Binding**: Accessor pattern for value storage
4. **Validation**: Synchronous validators with error display
5. **Accessibility**: Screen reader compatible mode
6. **Theming**: Centralized style configuration
7. **Dynamic Content**: Reactive fields with Eval pattern
8. **Keyboard Navigation**: Comprehensive key bindings

The patterns are applicable to any language with async/event loop support and can be adapted for web, mobile, or other UI frameworks.