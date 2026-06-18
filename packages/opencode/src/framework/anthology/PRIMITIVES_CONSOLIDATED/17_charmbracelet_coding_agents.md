# Charmbracelet Ecosystem for Coding Agents

## Overview
The Charmbracelet ecosystem provides a complete toolkit for building terminal UIs in Go, using **The Elm Architecture** (TEA) - a functional, stateful approach perfect for coding agent interfaces.

**Key Repos Analyzed:** 32 repos in `CharmbraceletEcosystem/`
**Focus:** Components most relevant to coding agent TUIs

---

## Core Stack for Coding Agents

### 1. Bubble Tea (TUI Framework)
**Repo:** `bubbletea/`
**Pattern:** The Elm Architecture (Model-View-Update)

```go
// The Elm Architecture
type Model interface{}

type Msg interface{}

type Model interface {
    Init() Cmd
    Update(Msg) (Model, Cmd)
    View() string
}

// Example: Simple agent status display
type agentModel struct {
    status     string
    tasks      []Task
    spinning   bool
}

func (m agentModel) Update(msg Msg) (Model, Cmd) {
    switch msg := msg.(type) {
    case TaskCompleteMsg:
        m.tasks = append(m.tasks, msg.Task)
        return m, nil
    case StatusUpdateMsg:
        m.status = msg.Status
        if m.spinning {
            return m, spinner.Tick
        }
        return m, nil
    }
}
```

**Why Perfect for Coding Agents:**
- **Stateful by design** - Agent state is explicit and immutable
- **Command pattern** - Async operations (LLM calls, file I/O) are first-class
- **Composable** - Multiple agents as sub-components
- **Testable** - Pure functions, easy to mock
- **Streaming friendly** - Update on each token, maintain spinner

**Key Features:**
- High-performance cell renderer
- Keyboard + mouse handling
- Native clipboard support
- Color downsampling (256 → 16 if needed)
- Declarative views

---

### 2. Bubbles (Widget Library)
**Repo:** `bubbles/`
**Production Use:** Used in [Crush](https://github.com/charmbracelet/crush) (Charm's AI assistant)

**Essential Widgets for Coding Agents:**

#### Text Input (for prompts)
```go
import "github.com/charmbracelet/bubbles/textinput"

ti := textinput.New()
ti.Placeholder = "Ask about your code..."
ti.Focus()
ti.CharLimit = 1000
ti.Width = 60

// In Update:
case KeyMsg:
    if key.Matches(msg, keymap.Submit) {
        submitCmd := submitPrompt(ti.Value())
        return m, submitCmd
    }
```

#### Spinner (for async operations)
```go
import "github.com/charmbracelet/bubbles/spinner"

s := spinner.New()
s.Spinner = spinner.Dot
s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

// In Update:
case spinner.TickMsg:
    var cmd Cmd
    s, cmd = s.Update(msg)
    return m, cmd
```

#### Viewport (for code output)
```go
import "github.com/charmbracelet/bubbles/viewport"

vp := viewport.New(width, height)
vp.SetContent(codeOutput)
vp.Style = lipgloss.NewStyle().
    Border(lipgloss.RoundedBorder()).
    BorderForeground(lipgloss.Color("62"))

// Scroll support
case KeyMsg:
    switch msg.String() {
    case "pgup":
        vp.ScrollUp(10)
    case "pgdown":
        vp.ScrollDown(10)
    }
```

#### Progress (for task progress)
```go
import "github.com/charmbracelet/bubbles/progress"

p := progress.New(progress.WithSolidFill("#89ff69"))

// In Update:
case ProgressMsg:
    p.percent = msg.Percent
    cmd := p.SetPercent(msg.Percent)
    return m, cmd
```

#### List (for file trees, task lists)
```go
import "github.com/charmbracelet/bubbles/list"

// Custom delegate for code files
type CodeItem struct {
    Name     string
    Path     string
    Language string
    Modified bool
}

func (c CodeItem) Title() string       { return c.Name }
func (c CodeItem) Description() string { return c.Language }

// Usage for file browser
l := list.New(items, NewCodeDelegate(), width, height)
l.Title = "Project Files"
l.SetFilteringEnabled(true)
```

#### Table (for structured data)
```go
import "github.com/charmbracelet/bubbles/table"

columns := []table.Column{
    {Title: "File", Width: 40},
    {Title: "Changes", Width: 10},
    {Title: "Status", Width: 15},
}

t := table.New(
    table.WithColumns(columns),
    table.WithRows(rows),
    table.WithFocused(true),
)
```

#### Help (for keybindings)
```go
import "github.com/charmbracelet/bubbles/help"

h := help.New()

// In View:
func (m model) View() string {
    return m.body + "\n\n" + h.View(m.keymap)
}
```

#### Textarea (for multi-line input)
```go
import "github.com/charmbracelet/bubbles/textarea"

ta := textarea.New()
ta.Placeholder = "Paste your code here..."
ta.Focus()
ta.SetWidth(60)
ta.SetHeight(10)
ta.ShowLineNumbers = true
```

#### File Picker (for file selection)
```go
import "github.com/charmbracelet/bubbles/filepicker"

fp := filepicker.New()
fp.CurrentDirectory, _ = os.Getwd()
fp.AllowedTypes = []string{".go", ".py", ".rs", ".ts"}

// In Update:
case filepicker.FileSelectedMsg:
    m.selectedFile = msg.File
    return m, loadFileCmd(msg.File.Path)
```

---

### 3. Lip Gloss (Styling)
**Repo:** `lipgloss/`
**Pattern:** CSS-like styling for terminal

```go
import "github.com/charmbracelet/lipgloss"

// Define styles
var (
    TitleStyle = lipgloss.NewStyle().
        Bold(true).
        Foreground(lipgloss.Color("#FAFAFA")).
        Background(lipgloss.Color("#7D56F4")).
        Padding(0, 1)
    
    CodeStyle = lipgloss.NewStyle().
        Border(lipgloss.RoundedBorder()).
        BorderForeground(lipgloss.Color("62")).
        Padding(1).
        Margin(1)
    
    ErrorStyle = lipgloss.NewStyle().
        Foreground(lipgloss.Color("196")).
        Bold(true)
    
    SuccessStyle = lipgloss.NewStyle().
        Foreground(lipgloss.Color("42")).
        Bold(true)
)

// Apply to content
title := TitleStyle.Render("Code Agent")
codeBlock := CodeStyle.Render(code)
error := ErrorStyle.Render("Error: File not found")

// Layout helpers
row := lipgloss.JoinHorizontal(lipgloss.Top, sidebar, main)
column := lipgloss.JoinVertical(lipgloss.Left, header, body, footer)

// Center in viewport
centered := lipgloss.Place(
    width, height,
    lipgloss.Center, lipgloss.Center,
    content,
)
```

**Key Features for Coding Agents:**
- **Syntax highlighting colors** - Match VS Code themes
- **Borders** - Separate agent output from user input
- **Layout** - Side-by-side views (code + explanation)
- **Conditional styling** - Error states, success states
- **Responsive** - Adapt to terminal size

---

### 4. Glamour (Markdown Rendering)
**Repo:** `glamour/`
**Use Case:** Render LLM responses (usually Markdown)

```go
import "github.com/charmbracelet/glamour"

// Render markdown with default style
rendered, err := glamour.Render(llmResponse, "dark")

// Custom style for code blocks
customStyle := glamour.WithStyles(glamour.DarkStyleConfig)
customStyle := glamour.WithStylesFromJSONBytes(styleJSON)

// In Bubble Tea:
type ResponseReadyMsg struct {
    Rendered string
}

func renderMarkdown(md string) Cmd {
    return func() Msg {
        rendered, _ := glamour.Render(md, "dark")
        return ResponseReadyMsg{Rendered: rendered}
    }
}
```

**Why Essential:**
- LLMs output Markdown
- Code blocks get syntax highlighting
- Tables, lists, blockquotes rendered beautifully
- Matches terminal color scheme

---

### 5. X Package (Utilities)
**Repo:** `x/`
**Key Sub-packages for Coding Agents:**

#### `x/input` - Keyboard shortcuts
```go
import "github.com/charmbracelet/x/input"

// Better keyboard handling
key := input.GetKey(msg)
if key.Matches(Quit) { ... }
```

#### `x/term` - Terminal detection
```go
import "github.com/charmbracelet/x/term"

if term.IsTerminal() {
    // Use full TUI
} else {
    // Fallback to plain text output
}
```

#### `x/cellbuf` - Low-level rendering
```go
import "github.com/charmbracelet/x/cellbuf"

// Direct cell manipulation for custom rendering
buf := cellbuf.NewBuffer(width, height)
buf.SetCell(0, 0, cellbuf.Cell{Rune: '█', Style: style})
```

#### `x/exp/teatest` - TUI testing
```go
import "github.com/charmbracelet/x/exp/teatest"

func TestAgent(t *testing.T) {
    tm := teatest.NewTestModel(t, NewAgent())
    tm.Type("What does this function do?")
    tm.Expect("This function")
}
```

---

## Coding Agent Architecture Patterns

### Pattern 1: Multi-Agent Dashboard
```go
type mainModel struct {
    agents      []agentModel
    activeAgent int
    chatInput   textinput.Model
    viewport    viewport.Model
}

func (m mainModel) View() string {
    // Top: Agent tabs
    tabs := m.renderAgentTabs()
    
    // Middle: Code viewport
    code := m.viewport.View()
    
    // Bottom: Chat input
    input := "❯ " + m.chatInput.View()
    
    return lipgloss.JoinVertical(
        lipgloss.Left,
        tabs,
        code,
        input,
    )
}
```

### Pattern 2: Streaming LLM Response
```go
type streamingModel struct {
    spinner     spinner.Model
    response    string
    done        bool
}

func (m streamingModel) Update(msg Msg) (Model, Cmd) {
    switch msg := msg.(type) {
    case TokenMsg:
        // Stream token by token
        m.response += msg.Token
        if !m.done {
            return m, spinner.Tick
        }
        return m, nil
        
    case DoneMsg:
        m.done = true
        m.spinner.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
        return m, nil
    }
}

func (m streamingModel) View() string {
    s := m.spinner.View() + " "
    return s + m.response
}
```

### Pattern 3: Code Diff Viewer
```go
type diffModel struct {
    oldCode     string
    newCode     string
    viewport    viewport.Model
}

func renderDiff(old, new string) string {
    lines := strings.Split(old, "\n")
    newLines := strings.Split(new, "\n")
    
    var result []string
    for i, line := range lines {
        if i < len(newLines) && line != newLines[i] {
            result = append(result, 
                lipgloss.NewStyle().
                    Foreground(lipgloss.Color("196")).
                    Render("- " + line))
            result = append(result,
                lipgloss.NewStyle().
                    Foreground(lipgloss.Color("42")).
                    Render("+ " + newLines[i]))
        } else {
            result = append(result, "  " + line)
        }
    }
    return strings.Join(result, "\n")
}
```

### Pattern 4: File Tree Navigation
```go
type fileTreeModel struct {
    list        list.Model
    selected    FileInfo
    preview     string
}

func NewFileTreeModel(root string) fileTreeModel {
    items := scanDirectory(root)
    l := list.New(items, fileDelegate(), 40, 20)
    l.Title = "Project Files"
    l.SetFilteringEnabled(true)
    
    return fileTreeModel{
        list: l,
    }
}

func (m fileTreeModel) Update(msg Msg) (Model, Cmd) {
    switch msg := msg.(type) {
    case list.ItemMsg:
        m.selected = msg.Item.(FileInfo)
        // Load preview
        return m, loadPreviewCmd(m.selected.Path)
    }
}
```

### Pattern 5: Command Palette
```go
type paletteModel struct {
    input       textinput.Model
    commands    []Command
    filtered    []Command
    selected    int
}

func (m paletteModel) Update(msg Msg) (Model, Cmd) {
    switch msg := msg.(type) {
    case textinput.KeyMsg:
        if msg.Type == tea.KeyEnter {
            return m, executeCmd(m.filtered[m.selected])
        }
    case textinput.ValueChangedMsg:
        m.filtered = filterCommands(m.commands, m.input.Value())
        m.selected = 0
    }
    return m, nil
}

func (m paletteModel) View() string {
    var items []string
    for i, cmd := range m.filtered {
        style := lipgloss.NewStyle()
        if i == m.selected {
            style = style.Reverse(true)
        }
        items = append(items, style.Render(cmd.Name))
    }
    return m.input.View() + "\n" + strings.Join(items, "\n")
}
```

---

## Complete Coding Agent Example

```go
package main

import (
    "fmt"
    "github.com/charmbracelet/bubbles/spinner"
    "github.com/charmbracelet/bubbles/textarea"
    "github.com/charmbracelet/bubbles/viewport"
    tea "github.com/charmbracelet/bubbletea"
    "github.com/charmbracelet/lipgloss"
)

type agentModel struct {
    spinner     spinner.Model
    input       textarea.Model
    viewport    viewport.Viewport
    response    string
    working     bool
    err         error
    width       int
    height      int
}

var (
    titleStyle = lipgloss.NewStyle().
        Bold(true).
        Foreground(lipgloss.Color("#FAFAFA")).
        Background(lipgloss.Color("#7D56F4")).
        Padding(0, 1)
    
    errorStyle = lipgloss.NewStyle().
        Foreground(lipgloss.Color("196")).
        Bold(true)
)

func newModel() agentModel {
    ta := textarea.New()
    ta.Placeholder = "Ask about your code..."
    ta.Focus()
    ta.SetWidth(60)
    ta.CharLimit = 1000
    
    return agentModel{
        spinner:  spinner.New(),
        input:    ta,
        viewport: viewport.New(60, 10),
    }
}

func (m agentModel) Init() tea.Cmd {
    return spinner.Tick
}

func (m agentModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        m.width = msg.Width
        m.height = msg.Height
        m.viewport.Width = msg.Width - 4
        m.viewport.Height = msg.Height - 8
        m.input.SetWidth(msg.Width - 4)
        return m, nil
        
    case tea.KeyMsg:
        switch msg.Type {
        case tea.KeyCtrlC, tea.KeyEsc:
            return m, tea.Quit
            
        case tea.KeyEnter:
            if !m.working && m.input.Value() != "" {
                m.working = true
                m.response = ""
                return m, submitToAgentCmd(m.input.Value())
            }
        }
        
    case ResponseTokenMsg:
        m.response += msg.Token
        m.viewport.SetContent(m.response)
        if m.working {
            return m, spinner.Tick
        }
        return m, nil
        
    case ResponseCompleteMsg:
        m.working = false
        m.input.SetValue("")
        return m, nil
        
    case ErrorMsg:
        m.err = msg.Err
        m.working = false
        return m, nil
    }
    
    var cmd tea.Cmd
    m.input, cmd = m.input.Update(msg)
    return m, cmd
}

func (m agentModel) View() string {
    var b lipgloss.JoinStyle
    
    // Title
    b = lipgloss.JoinVertical(lipgloss.Left, 
        titleStyle.Render(" Code Agent "),
        "",
    )
    
    // Response or spinner
    if m.working {
        b = lipgloss.JoinVertical(lipgloss.Left, b,
            m.spinner.View()+" Processing...",
        )
    }
    
    // Viewport with response
    b = lipgloss.JoinVertical(lipgloss.Left, b,
        lipgloss.NewStyle().
            Border(lipgloss.RoundedBorder()).
            BorderForeground(lipgloss.Color("62")).
            Render(m.viewport.View()),
    )
    
    // Error
    if m.err != nil {
        b = lipgloss.JoinVertical(lipgloss.Left, b,
            errorStyle.Render("Error: " + m.err.Error()),
        )
    }
    
    // Input
    b = lipgloss.JoinVertical(lipgloss.Left, b,
        "",
        m.input.View(),
    )
    
    return lipgloss.Place(m.width, m.height, 
        lipgloss.Center, lipgloss.Center, 
        b,
    )
}

func main() {
    p := tea.NewProgram(newModel(), tea.WithAltScreen())
    if _, err := p.Run(); err != nil {
        fmt.Printf("Error: %v\n", err)
        }
    }
}
```

---

## Files to Study

### Must Read:
- `bubbletea/tea.go` - Core framework (read line-by-line)
- `bubbles/textinput/textinput.go` - Text input widget
- `bubbles/spinner/spinner.go` - Spinner animation
- `lipgloss/style.go` - Style definitions
- `glamour/glamour.go` - Markdown rendering

### Examples:
- `bubbletea/examples/` - 20+ example applications
- `bubbles/examples/` - Individual widget examples
- `gum/` - See how Gum uses the whole stack

---

## Why Charmbracelet for Coding Agents?

1. **Elm Architecture** - Perfect for stateful agent interactions
2. **Production Ready** - Used in Crush (Charm's AI assistant)
3. **Composeable** - Mix and match widgets
4. **Streaming Native** - Token-by-token updates built-in
5. **Testable** - Pure functions, mockable commands
6. **Beautiful Defaults** - Looks professional out of the box
7. **Active Development** - Regular updates, new widgets
8. **Go Ecosystem** - Strong typing, fast compilation

---

## Next Steps

1. **Study bubbletea/examples** - Run each example
2. **Build a simple agent UI** - Spinner + text input + viewport
3. **Add streaming** - Connect to LLM API
4. **Add file context** - File picker + preview
5. **Add command palette** - Slash commands
6. **Add diff view** - Show code changes
7. **Production polish** - Help, quit confirmations, error handling

The Charmbracelet ecosystem provides everything needed for a professional coding agent TUI.