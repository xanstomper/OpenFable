# Pop Primitives Analysis

## Overview
**Pop** is a **terminal-based email client** built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) and [Bubbles](https://github.com/charmbracelet/bubbles). While Pop itself is an application, it **demonstrates reusable TUI primitives and patterns** for building **form-heavy terminal applications**, including:
- **Multi-field form handling** (text inputs, text areas, file pickers).
- **State-driven focus management** (tab navigation between fields).
- **Context-sensitive keybindings** (enable/disable actions based on UI state).
- **Input validation** (disable actions until required fields are filled).
- **Error handling** (temporary error messages).
- **Styling themes** (active/inactive states with Lip Gloss).

**Purpose**: Form-based TUI patterns for data entry workflows.
**Language**: Go.
**Maturity**: Production.
**Dependencies**: Bubble Tea, Bubbles, Lip Gloss.

---

## Core Primitives

### 1. **State Management**
**Purpose**: Track the current focus and mode of the TUI.

**Primitives**:
- **`State` enum**: Defines the active UI state (e.g., which input field is focused).
  ```go
  type State int
  const (
      editingFrom State = iota
      editingTo
      editingCc
      editingBcc
      editingSubject
      editingBody
      editingAttachments
      hoveringSendButton
      pickingFile
      sendingEmail
  )
  ```

**Key Features**:
- **Explicit States**: Each state represents a distinct UI mode (e.g., editing a field, picking a file).
- **Focus Tracking**: The state determines which input component is currently active.
- **Transition Logic**: States change via keybindings (e.g., `Tab` to move to the next field).

**State Transitions**:
| Current State | Keybinding | Next State |
|---------------|------------|------------|
| `editingFrom` | `Tab` | `editingTo` |
| `editingTo` | `Tab` | `editingSubject` (or `editingCc` if CC is visible) |
| `editingSubject` | `Tab` | `editingBody` |
| `editingBody` | `Tab` | `editingAttachments` |
| `editingAttachments` | `Tab` | `hoveringSendButton` |
| Any | `Shift+Tab` | Previous field |
| Any | `Esc` | `editingAttachments` (back) |

---

### 2. **Form Input Components**
**Purpose**: Handle user input for email fields (from, to, subject, body, attachments).

**Primitives (from Bubbles)**:
| Component | Purpose | Features |
|-----------|---------|----------|
| `textinput.Model` | Single-line text input | Placeholder, validation, styling |
| `textarea.Model` | Multi-line text input | Word wrapping, line numbers, character limit |
| `filepicker.Model` | File selection dialog | Directory navigation, file selection |
| `list.Model` | List of attachments | Item selection, removal, styling |

**Example Initialization**:
```go
// Single-line input (e.g., "From" field)
from := textinput.New()
from.Prompt = "From "
from.Placeholder = "me@example.com"
from.PromptStyle = labelStyle
from.TextStyle = textStyle
from.Cursor.Style = cursorStyle
from.PlaceholderStyle = placeholderStyle

// Multi-line input (e.g., "Body" field)
body := textarea.New()
body.Placeholder = "# Email"
body.ShowLineNumbers = false
body.CharLimit = 4000
body.FocusedStyle.CursorLine = activeTextStyle
body.BlurredStyle.Text = textStyle
```

**Focus Management**:
- **`Focus()`**: Activate an input field (shows cursor, applies active styles).
- **`Blur()`**: Deactivate an input field (hides cursor, applies inactive styles).
- **`CursorEnd()`**: Move cursor to the end of the input.

---

### 3. **Context-Sensitive Keybindings**
**Purpose**: Enable/disable keybindings based on the current UI state.

**Primitives**:
- **`KeyMap` struct**: Groups all keybindings for the application.
  ```go
  type KeyMap struct {
      NextInput  key.Binding  // Tab: Move to next field
      PrevInput  key.Binding  // Shift+Tab: Move to previous field
      Send       key.Binding  // Enter: Send email
      Attach     key.Binding  // Enter: Attach file (when in attachments list)
      Unattach   key.Binding  // x: Remove attachment
      Back       key.Binding  // Esc: Go back
      Quit       key.Binding  // Ctrl+C: Quit
  }
  ```

**Dynamic Enabling/Disabling**:
```go
func (m *Model) updateKeymap() {
    // Enable "Attach" only when editing attachments
    m.keymap.Attach.SetEnabled(m.state == editingAttachments)
    
    // Enable "Send" only when hovering over the button AND all fields are filled
    m.keymap.Send.SetEnabled(m.canSend() && m.state == hoveringSendButton)
    
    // Enable "Unattach" only when editing attachments AND there are items
    m.keymap.Unattach.SetEnabled(m.state == editingAttachments && len(m.Attachments.Items()) > 0)
    
    // Enable filepicker keys only when picking a file
    m.filepicker.KeyMap.Up.SetEnabled(m.state == pickingFile)
    m.filepicker.KeyMap.Down.SetEnabled(m.state == pickingFile)
    // ...
}
```

**Keybinding Definition**:
```go
func DefaultKeybinds() KeyMap {
    return KeyMap{
        NextInput: key.NewBinding(
            key.WithKeys("tab"),
            key.WithHelp("tab", "next"),
        ),
        PrevInput: key.NewBinding(
            key.WithKeys("shift+tab"),
        ),
        Send: key.NewBinding(
            key.WithKeys("ctrl+d", "enter"),
            key.WithHelp("enter", "send"),
            key.WithDisabled(), // Initially disabled
        ),
        // ...
    }
}
```

---

### 4. **Input Validation**
**Purpose**: Prevent actions (e.g., sending email) until required fields are filled.

**Primitives**:
- **`canSend()`**: Checks if all required fields have values.
  ```go
  func (m Model) canSend() bool {
      return m.From.Value() != "" && 
             m.To.Value() != "" && 
             m.Subject.Value() != "" && 
             m.Body.Value() != ""
  }
  ```

**Integration with Keybindings**:
- The `Send` keybinding is **disabled** unless `canSend()` returns `true` **and** the current state is `hoveringSendButton`.

---

### 5. **Error Handling**
**Purpose**: Display temporary error messages to the user.

**Primitives**:
- **`err` field**: Stores the current error (if any).
- **`clearErrAfter()`**: Clears the error after a timeout.
  ```go
  type clearErrMsg struct{}
  
  func clearErrAfter(d time.Duration) tea.Cmd {
      return tea.Tick(d, func(_ time.Time) tea.Msg {
          return clearErrMsg{}
      })
  }
  ```

**Usage**:
```go
// In Update():
case sendEmailFailureMsg:
    m.err = msg  // Show error
    return m, clearErrAfter(10 * time.Second)  // Clear after 10s

case clearErrMsg:
    m.err = nil  // Clear the error
```

**Rendering Errors**:
```go
if m.err != nil {
    s.WriteString("\n\n")
    s.WriteString(errorStyle.Render(m.err.Error()))
}
```

---

### 6. **Styling with Lip Gloss**
**Purpose**: Apply consistent theming to UI elements.

**Primitives**:
- **Color Constants**: Predefined colors for the theme.
  ```go
  const (
      accentColor     = lipgloss.Color("99")      // Purple
      yellowColor     = lipgloss.Color("#ECFD66") // Yellow
      whiteColor      = lipgloss.Color("255")     // White
      grayColor       = lipgloss.Color("241")     // Light gray
      darkGrayColor   = lipgloss.Color("236")     // Dark gray
      lightGrayColor  = lipgloss.Color("247")     // Lighter gray
  )
  ```

- **Style Definitions**: Reusable styles for different UI states.
  ```go
  var (
      // Active/inactive text styles
      activeTextStyle = lipgloss.NewStyle().Foreground(whiteColor)
      textStyle        = lipgloss.NewStyle().Foreground(lightGrayColor)
      
      // Active/inactive label styles
      activeLabelStyle = lipgloss.NewStyle().Foreground(accentColor)
      labelStyle        = lipgloss.NewStyle().Foreground(grayColor)
      
      // Placeholder and cursor styles
      placeholderStyle = lipgloss.NewStyle().Foreground(darkGrayColor)
      cursorStyle       = lipgloss.NewStyle().Foreground(whiteColor)
      
      // Button styles (3 states)
      sendButtonActiveStyle   = lipgloss.NewStyle().Background(accentColor).Foreground(yellowColor).Padding(0, 2)
      sendButtonInactiveStyle = lipgloss.NewStyle().Background(darkGrayColor).Foreground(lightGrayColor).Padding(0, 2)
      sendButtonStyle         = lipgloss.NewStyle().Background(darkGrayColor).Foreground(grayColor).Padding(0, 2)
      
      // Error and link styles
      errorStyle       = lipgloss.NewStyle().Foreground(lipgloss.Color("#FF5F87"))
      errorHeaderStyle = lipgloss.NewStyle().Foreground("#F1F1F1").Background("#FF5F87").Bold(true).Padding(0, 1).SetString("ERROR")
      linkStyle        = lipgloss.NewStyle().Foreground("#00AF87").Underline(true)
      commentStyle     = lipgloss.NewStyle().Foreground("#757575").PaddingLeft(1)
      paddedStyle      = lipgloss.NewStyle().Padding(1)
  )
  ```

**Dynamic Styling**:
- Input fields change styles based on focus:
  ```go
  // When focused:
  m.From.PromptStyle = activeLabelStyle
  m.From.TextStyle = activeTextStyle
  
  // When blurred:
  m.From.PromptStyle = labelStyle
  m.From.TextStyle = textStyle
  ```

---

### 7. **Focus Management**
**Purpose**: Handle focus changes between input fields.

**Primitives**:
- **`blurInputs()`**: Deactivate all input fields.
  ```go
  func (m *Model) blurInputs() {
      m.From.Blur()
      m.To.Blur()
      m.Subject.Blur()
      m.Body.Blur()
      // ...
      m.From.PromptStyle = labelStyle
      m.To.PromptStyle = labelStyle
      // ...
  }
  ```

- **`focusActiveInput()`**: Activate the input field corresponding to the current state.
  ```go
  func (m *Model) focusActiveInput() {
      switch m.state {
      case editingFrom:
          m.From.PromptStyle = activeLabelStyle
          m.From.TextStyle = activeTextStyle
          m.From.Focus()
          m.From.CursorEnd()
      case editingTo:
          m.To.PromptStyle = activeLabelStyle
          m.To.TextStyle = activeTextStyle
          m.To.Focus()
          m.To.CursorEnd()
      // ...
      }
  }
  ```

---

### 8. **Form Submission**
**Purpose**: Handle sending the email (or any form submission).

**Primitives**:
- **`sendEmailCmd()`**: Returns a `tea.Cmd` to send the email asynchronously.
- **`sendingEmail` state**: Shows a loading spinner while the email is being sent.
- **`sendEmailSuccessMsg`/`sendEmailFailureMsg`**: Messages to handle the result.

**Example**:
```go
case key.Matches(msg, m.keymap.Send):
    m.state = sendingEmail
    return m, tea.Batch(
        m.loadingSpinner.Tick,  // Start spinner
        m.sendEmailCmd(),       // Send email
    )
```

---

### 9. **File Attachments**
**Purpose**: Manage a list of file attachments.

**Primitives**:
- **`list.Model`**: Renders the list of attachments.
- **`filepicker.Model`**: Allows selecting files to attach.
- **`attachment` type**: Represents a file attachment (implements `list.Item`).

**Example**:
```go
// Initialize attachments list
attachments := list.New([]list.Item{}, attachmentDelegate{}, 0, 3)
attachments.DisableQuitKeybindings()
attachments.SetShowTitle(true)
attachments.Title = "Attachments"
attachments.Styles.Title = labelStyle
attachments.SetShowHelp(false)
attachments.SetShowStatusBar(false)
attachments.SetStatusBarItemName("attachment", "attachments")
attachments.SetShowPagination(false)

// Add an attachment
m.Attachments.InsertItem(0, attachment(path))
m.Attachments.SetHeight(len(m.Attachments.Items()) + 2)

// Remove an attachment
m.Attachments.RemoveItem(m.Attachments.Index())
m.Attachments.SetHeight(ordered.Max(len(m.Attachments.Items()), 1) + 2)
```

---

## Technical Insights

### **Architecture**
1. **Bubble Tea Model**: The `Model` struct holds all UI state and components.
2. **Component Composition**: Uses **Bubbles** components (text input, textarea, list, etc.) for input handling.
3. **State-Driven UI**: The `State` enum drives focus, keybindings, and rendering.
4. **Event-Driven Updates**: Uses Bubble Tea’s `tea.Msg` and `tea.Cmd` for async operations (e.g., sending email).

### **Performance**
- **Efficient Rendering**: Only the active input field is re-rendered on updates.
- **Lazy Loading**: File picker only loads directory contents when opened.
- **Minimal Redraws**: Bubble Tea optimizes terminal redraws.

### **Cross-Terminal Compatibility**
- **ANSI Colors**: Uses Lip Gloss for colors (24-bit, 256-color, or 16-color).
- **Input Handling**: Works with all major terminals (macOS, Linux, Windows).
- **Error Handling**: Gracefully handles missing dependencies (e.g., SMTP server).

---

## Integration Patterns

### **1. Basic Form TUI**
```go
package main

import (
    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/bubbles/textinput"
    "github.com/charmbracelet/lipgloss"
)

type State int
const (
    editingName State = iota
    editingEmail
)

type Model struct {
    state State
    name  textinput.Model
    email textinput.Model
}

func NewModel() Model {
    name := textinput.New()
    name.Prompt = "Name: "
    email := textinput.New()
    email.Prompt = "Email: "
    return Model{name: name, email: email, state: editingName}
}

func (m Model) Init() tea.Cmd {
    return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        switch msg.String() {
        case "tab":
            m.state = (m.state + 1) % 2
            m.focusActiveInput()
        }
    }
    m.name, _ = m.name.Update(msg)
    m.email, _ = m.email.Update(msg)
    return m, nil
}

func (m *Model) focusActiveInput() {
    m.name.Blur()
    m.email.Blur()
    switch m.state {
    case editingName:
        m.name.Focus()
    case editingEmail:
        m.email.Focus()
    }
}

func (m Model) View() string {
    return m.name.View() + "\n" + m.email.View()
}

func main() {
    p := tea.NewProgram(NewModel())
    p.Start()
}
```

### **2. Form with Validation**
```go
func (m Model) canSubmit() bool {
    return m.name.Value() != "" && m.email.Value() != ""
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        if msg.String() == "enter" && m.canSubmit() {
            // Submit form
        }
    }
    // ...
}
```

### **3. Dynamic Keybindings**
```go
func (m *Model) updateKeymap() {
    m.keymap.Submit.SetEnabled(m.canSubmit())
}
```

---

## Use Cases
1. **Form-Based TUIs**: Email clients, configuration tools, data entry apps.
2. **Multi-Step Workflows**: Wizards, installers, setup tools.
3. **Input Validation**: Ensure required fields are filled before submission.
4. **File Management**: Attach/upload files in a TUI.
5. **Error Handling**: Show temporary errors without blocking the UI.

---

## Comparison to Alternatives
| Feature | Pop (Bubble Tea) | [tview](https://github.com/rivo/tview) | [gocui](https://github.com/jroimartin/gocui) | [termui](https://github.com/gizak/termui) |
|---------|-------------------|----------------------------------------|--------------------------------------------|------------------------------------------|
| **Framework** | Bubble Tea | tview | gocui | termui |
| **Form Support** | ✅ Yes (custom) | ✅ Yes (built-in) | ❌ No (manual) | ❌ No (manual) |
| **Input Components** | ✅ Yes (Bubbles) | ✅ Yes | ❌ No | ❌ No |
| **State Management** | ✅ Yes (custom) | ✅ Yes | ❌ No (manual) | ❌ No |
| **Keybindings** | ✅ Yes (Bubbles/key) | ✅ Yes | ✅ Yes | ✅ Yes |
| **Theming** | ✅ Yes (Lip Gloss) | ✅ Yes | ❌ No | ❌ No |
| **Async Support** | ✅ Yes (tea.Cmd) | ❌ No | ❌ No | ❌ No |
| **Cross-Platform** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

**Key Differentiators**:
- **Bubble Tea + Bubbles**: Reusable components (text input, file picker, etc.).
- **State-Driven**: Explicit state management for complex workflows.
- **Async-Friendly**: Supports background tasks (e.g., sending email).
- **Modern Styling**: Lip Gloss for consistent theming.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/model.go` | Core model and state management. |
| `/keymap.go` | Keybinding definitions and dynamic enabling. |
| `/style.go` | Lip Gloss styles and theming. |
| `/main.go` | CLI entry point and Bubble Tea program. |
| `/email.go` | Email-specific logic (sending, validation). |
| `/attachments.go` | File attachment handling. |

---

## Summary
Pop demonstrates **reusable primitives and patterns** for building **form-heavy TUIs** with Bubble Tea:

1. **State Management**: Use an enum to track UI focus and mode.
2. **Component Composition**: Combine **Bubbles** components (text input, textarea, list, etc.) for input handling.
3. **Context-Sensitive Keybindings**: Enable/disable actions based on the current state.
4. **Input Validation**: Prevent actions until required fields are filled.
5. **Error Handling**: Show temporary errors with timeouts.
6. **Styling**: Use **Lip Gloss** for consistent theming (active/inactive states).
7. **Focus Management**: Dynamically focus/blur input fields based on state.
8. **Async Operations**: Use `tea.Cmd` for background tasks (e.g., API calls).

**Best For**: Building **form-based terminal applications** (e.g., email clients, configuration tools, wizards).
**Avoid If**: You need a **non-Go** solution or a **simple CLI** (not a TUI).
