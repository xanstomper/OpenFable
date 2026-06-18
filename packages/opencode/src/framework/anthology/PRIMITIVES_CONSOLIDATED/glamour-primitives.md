# Glamour Primitives Analysis

## Overview
**Glamour** is a **stylesheet-based markdown renderer** for ANSI-compatible terminals. It converts markdown documents into styled terminal output using customizable CSS-like stylesheets. Glamour is the **core rendering engine** behind **Glow** (the markdown TUI viewer) and is used by major CLI tools like GitHub CLI, GitLab CLI, and Gitea CLI.

**Purpose**: Render markdown in terminals with customizable styling.
**Language**: Go.
**Maturity**: Production (v2+).
**Dependencies**: None (pure Go).

---

## Core Primitives

### 1. **Markdown → ANSI Rendering**
**Purpose**: Convert markdown text into ANSI-styled terminal output.

**Primitives**:
- **`glamour.Render(input, style)`**: Render markdown `input` using a predefined style (e.g., `"dark"`, `"light"`).
- **`glamour.RenderWithEnvironmentConfig(input)`**: Render using styles from the `GLAMOUR_STYLE` environment variable.

**Key Features**:
- **GitHub-Flavored Markdown (GFM)**: Supports tables, task lists, strikethrough, and emoji.
- **ANSI Color Output**: Renders to 24-bit, 256-color, or 16-color terminals.
- **Word Wrapping**: Configurable line width (default: 80 columns).
- **Pure Rendering**: Deterministic output (same input → same output).

**Example**:
```go
import "charm.land/glamour/v2"

input := `# Hello World
This is **bold** and _italic_.`

output, err := glamour.Render(input, "dark")
if err != nil {
    log.Fatal(err)
}
fmt.Print(output)
```

**Output**:
ANSI-styled text with headers, bold/italic formatting, and colors matching the `dark` theme.

---

### 2. **Custom Renderer (`TermRenderer`)**
**Purpose**: Create a reusable renderer with custom settings.

**Primitives**:
- **`glamour.NewTermRenderer(opts...)`**: Initialize a renderer with options.
- **`renderer.Render(input)`**: Render markdown using the configured settings.

**Options**:
| Option | Description | Default |
|--------|-------------|---------|
| `WithStylesheet(style)` | Use a custom stylesheet | `"dark"` |
| `WithWordWrap(width)` | Wrap text at `width` columns | `80` |
| `WithEnvironmentConfig()` | Load styles from `GLAMOUR_STYLE` | `false` |

**Example**:
```go
r, err := glamour.NewTermRenderer(
    glamour.WithWordWrap(120), // Wide terminal
    glamour.WithStylesheet("light"),
)
if err != nil {
    log.Fatal(err)
}

output, err := r.Render("# Title\n\nContent")
fmt.Print(output)
```

---

### 3. **Stylesheets**
**Purpose**: Define the visual appearance of markdown elements (headers, code blocks, lists, etc.).

**Primitives**:
- **Predefined Styles**: `dark`, `light`, `ascii`, `notty`, and [many more](https://github.com/charmbracelet/glamour/tree/main/styles/gallery).
- **Custom Stylesheets**: JSON or YAML files defining ANSI styles for markdown elements.

**Stylesheet Structure**:
```json
{
  "name": "My Theme",
  "styles": {
    "h1": {
      "color": "#ff0000",
      "textDecoration": "bold underline",
      "margin": "0 0 1 0"
    },
    "code": {
      "color": "#00ff00",
      "backgroundColor": "#000000"
    }
  }
}
```

**Supported Style Properties**:
| Property | Description | Values |
|----------|-------------|--------|
| `color` | Text color | Hex (`#RRGGBB`), ANSI name (`"red"`), or `"default"` |
| `backgroundColor` | Background color | Same as `color` |
| `textDecoration` | Text styling | `"bold"`, `"italic"`, `"underline"`, `"strikethrough"`, or combinations (e.g., `"bold underline"`) |
| `margin` | Spacing around element | CSS-like (e.g., `"1 0"` = 1 line top/bottom, 0 left/right) |
| `padding` | Inner spacing | Same as `margin` |
| `display` | Visibility | `"block"`, `"inline"`, `"none"` |

**Example Custom Stylesheet**:
```json
{
  "name": "Minimal",
  "styles": {
    "h1": {
      "color": "#6b50ff",
      "textDecoration": "bold",
      "margin": "1 0"
    },
    "p": {
      "color": "#ffffff",
      "margin": "0 0 1 0"
    },
    "code": {
      "backgroundColor": "#2d2d2d",
      "color": "#ff8080",
      "padding": "0 1"
    }
  }
}
```

**Using Custom Styles**:
```go
// Load from file
r, _ := glamour.NewTermRenderer(
    glamour.WithStylesheet("/path/to/custom.json"),
)

// Or use environment variable
// export GLAMOUR_STYLE=/path/to/custom.json
r, _ := glamour.NewTermRenderer(
    glamour.WithEnvironmentConfig(),
)
```

---

### 4. **Color Handling**
**Purpose**: Manage color output for terminals with varying capabilities.

**Primitives**:
- **TrueColor (24-bit)**: Full RGB support (`#RRGGBB`).
- **ANSI 256-color**: Uses closest palette index.
- **ANSI 16-color**: Maps to standard ANSI colors.

**Color Downsampling**:
Glamour itself **does not** perform automatic color downsampling (to keep rendering deterministic). Instead, integrate with **Lip Gloss** or **Colorprofile** for terminal-aware color degradation:

```go
import (
    "charm.land/glamour/v2"
    "charm.land/lipgloss/v2"
)

r, _ := glamour.NewTermRenderer()
output, _ := r.Render("# Hello")

// Downsample colors based on terminal
lipgloss.Print(output) // Lip Gloss handles ANSI downsampling
```

**Why No Built-in Downsampling?**
- **Determinism**: Same input → same output (important for testing).
- **Separation of Concerns**: Use **Colorprofile** or **Lip Gloss** for terminal detection.

---

### 5. **Block-Level Elements**
**Purpose**: Render markdown blocks (headers, lists, code, tables, etc.) with proper styling.

**Supported Elements**:
| Element | Rendering |
|---------|-----------|
| Headers (`#`, `##`, etc.) | Bold, colored, with margin |
| Paragraphs | Wrapped text with spacing |
| Lists (`-`, `*`, `1.`) | Indented with bullet/number |
| Code Blocks (```) | Background color, monospace font |
| Inline Code (`) | Background color |
| Blockquotes (`>`) | Indented with border |
| Horizontal Rule (`---`) | Full-width line |
| Tables | Aligned columns with borders |
| Task Lists (`- [x]`) | Checkbox symbols |
| Strikethrough (`~~`) | Crossed-out text |
| Emoji (`:smile:`) | Unicode emoji (if supported) |
| Links (`[text](url)`) | Underlined (URLs can be hidden) |

**Example Table Rendering**:
```markdown
| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |
```
→ Renders as an aligned ANSI table with borders.

---

### 6. **Inline Elements**
**Purpose**: Style inline markdown (bold, italic, links, etc.).

| Element | Rendering |
|---------|-----------|
| `**bold**` | Bold text |
| `*italic*` | Italic text |
| `~~strikethrough~~` | Strikethrough text |
| `[link](url)` | Underlined (URL optional) |
| `inline code` | Monospace with background |
| `:smile:` | Emoji (if terminal supports) |

---

## Technical Insights

### **Rendering Pipeline**
1. **Parse Markdown**: Uses a GFM-compatible parser (internal).
2. **Apply Styles**: Maps markdown elements to stylesheet rules.
3. **Generate ANSI**: Converts styled elements into ANSI escape sequences.
4. **Word Wrap**: Wraps text to configured width.

### **Performance**
- **Fast Parsing**: Optimized for CLI use (low latency).
- **No Allocations**: Minimal heap allocations for rendering.
- **Streaming**: Can render large documents incrementally (though API is batch-oriented).

### **Limitations**
- **No HTML**: Only markdown (no HTML support).
- **No Images**: Images in markdown are rendered as alt text or links.
- **No Syntax Highlighting**: Code blocks use monospace styling but no language-specific syntax highlighting (use **Chroma** or **Syntect** for that).

### **Cross-Terminal Compatibility**
- **Windows**: Works with `conhost`, Windows Terminal, and WSL.
- **macOS**: Works with Terminal.app, iTerm2, Kitty, etc.
- **Linux**: Works with xterm, GNOME Terminal, Konsole, Alacritty, etc.
- **TrueColor**: Automatically uses 24-bit color if terminal supports it.

---

## Integration Patterns

### **1. Basic CLI Tool**
```go
package main

import (
    "fmt"
    "os"
    "charm.land/glamour/v2"
)

func main() {
    input := `# My CLI Tool
    Welcome to **my awesome tool**!`
    
    output, err := glamour.Render(input, "dark")
    if err != nil {
        fmt.Fprintln(os.Stderr, "Error:", err)
        os.Exit(1)
    }
    fmt.Print(output)
}
```

### **2. Dynamic Styling with Lip Gloss**
```go
package main

import (
    "fmt"
    "charm.land/glamour/v2"
    "charm.land/lipgloss/v2"
)

func main() {
    r, _ := glamour.NewTermRenderer()
    markdown := "# Styled Output"
    
    // Render markdown
    rendered, _ := r.Render(markdown)
    
    // Apply additional styling with Lip Gloss
    style := lipgloss.NewStyle().Padding(1, 2).Border(lipgloss.RoundedBorder())
    fmt.Println(style.Render(rendered))
}
```

### **3. Custom Stylesheet for Branding**
```go
package main

import (
    "fmt"
    "charm.land/glamour/v2"
)

func main() {
    // Load a custom stylesheet matching your app's branding
    r, err := glamour.NewTermRenderer(
        glamour.WithStylesheet("my-brand.json"),
    )
    if err != nil {
        panic(err)
    }
    
    markdown := "# My App\nWelcome!"
    output, _ := r.Render(markdown)
    fmt.Print(output)
}
```

### **4. Pager Integration**
```go
package main

import (
    "os"
    "os/exec"
    "charm.land/glamour/v2"
)

func main() {
    markdown := `# Very Long Document
    ...`
    
    output, _ := glamour.Render(markdown, "dark")
    
    // Pipe to a pager (e.g., less, bat)
    cmd := exec.Command("less", "-r") // -r for ANSI color support
    cmd.Stdin = strings.NewReader(output)
    cmd.Stdout = os.Stdout
    cmd.Run()
}
```

---

## Comparison to Alternatives
| Feature | Glamour | [Rich](https://github.com/Textualize/rich) | [Termdown](https://github.com/trecode/termdown) | [md2term](https://github.com/axcore/md2term) |
|---------|---------|--------------------------------------------|-----------------------------------------------|------------------------------------------|
| **Language** | Go | Python | Go | Go |
| **Markdown Support** | GFM | Full (with extensions) | Basic | GFM |
| **Custom Styles** | ✅ Yes | ✅ Yes (themes) | ❌ No | ❌ No |
| **ANSI Colors** | ✅ 24-bit | ✅ 24-bit | ✅ 24-bit | ✅ 24-bit |
| **Word Wrapping** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Tables** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Syntax Highlighting** | ❌ No | ✅ Yes (Pygments) | ❌ No | ❌ No |
| **Emoji** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Dependencies** | None | Many (Pygments, etc.) | None | None |
| **Performance** | ⚡ Fast | 🐢 Slower (Python) | ⚡ Fast | ⚡ Fast |

**Key Differentiators**:
- **Pure Go**: No external dependencies (unlike Rich, which is Python).
- **Stylesheet-Based**: Declarative styling (like CSS for markdown).
- **Deterministic**: Same input → same output (important for testing).
- **Pluggable**: Works with **Lip Gloss** for color downsampling.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/renderer.go` | Core `TermRenderer` implementation. |
| `/styles/` | Predefined stylesheets (dark, light, etc.). |
| `/parse/` | Markdown parsing logic. |
| `/style/` | Stylesheet parsing and application. |

---

## Use Cases
1. **CLI Documentation**: Render markdown help files in terminals.
2. **Chat Applications**: Display markdown-formatted messages (e.g., AI responses).
3. **Static Site Generators**: Generate terminal-friendly output.
4. **Logging**: Style logs with markdown-like syntax.
5. **TUIs**: Embed markdown rendering in terminal UIs (e.g., **Glow**).

---

## Projects Using Glamour
- **[Glow](https://github.com/charmbracelet/glow)**: Terminal markdown viewer.
- **[GitHub CLI](https://github.com/cli/cli)**: Official GitHub CLI tool.
- **[GitLab CLI](https://gitlab.com/gitlab-org/cli)**: Official GitLab CLI tool.
- **[Gitea CLI](https://gitea.com/gitea/tea)**: Official Gitea CLI tool.
- **[Meteor](https://github.com/odpf/meteor)**: Metadata collection framework.

---

## Summary
Glamour is a **high-performance, stylesheet-driven markdown renderer** for terminals, providing:
1. **Markdown → ANSI Conversion**: Renders GFM markdown to styled terminal output.
2. **Customizable Styles**: JSON/YAML stylesheets for branding and theming.
3. **Deterministic Output**: Same input → same output (no terminal detection by default).
4. **Pluggable Color Handling**: Integrates with **Lip Gloss** or **Colorprofile** for terminal-aware color degradation.
5. **Zero Dependencies**: Pure Go, easy to embed in any application.

**Best For**: Go applications needing markdown rendering in terminals (CLIs, TUIs, chat apps).
**Avoid If**: You need HTML support, syntax highlighting, or non-Go languages.
