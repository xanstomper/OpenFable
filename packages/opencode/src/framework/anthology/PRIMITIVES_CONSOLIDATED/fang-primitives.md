# Fang Primitives Analysis

## Overview
**Fang** is a **CLI starter kit** for Go, designed to **supercharge [Cobra](https://github.com/spf13/cobra)** applications with **batteries-included** features. It provides **fancy output**, **styled errors**, **automatic versioning**, **manpages**, **shell completions**, and **theming**—all out of the box. Fang is **not a TUI library**, but it **enhances CLI tools** with **Charmbracelet’s styling** (Lip Gloss) and **better UX patterns**, making it a valuable **primitive for CLI applications** that may interact with TUIs.

**Purpose**: CLI starter kit for Cobra (fancy output, errors, versioning, manpages, completions).
**Language**: Go.
**Maturity**: Production (experimental label, but stable).
**Dependencies**: Cobra, Lip Gloss, Mango (for manpages).

---

## Core Primitives

### 1. **Fancy Output (Styled Help and Usage)**
**Purpose**: Automatically style **Cobra’s help and usage** output with **Lip Gloss**.

**Primitives**:
- **Automatic Styling**: Fang **replaces Cobra’s default help/usage templates** with **styled versions** (using Lip Gloss).
- **Theming**: Customize the appearance of help text, errors, and other output.

**Example**:
```go
package main

import (
    "context"
    "os"
    "github.com/charmbracelet/fang"
    "github.com/spf13/cobra"
)

func main() {
    cmd := &cobra.Command{
        Use:   "example",
        Short: "A simple example program!",
    }
    if err := fang.Execute(context.Background(), cmd); err != nil {
        os.Exit(1)
    }
}
```

**Output**:
- Help text (`--help`) is **automatically styled** with colors and formatting.
- Usage text is **enhanced** for readability.

**Key Features**:
- **No Manual Styling**: Fang handles styling automatically.
- **Consistent Look**: All Cobra commands get a **unified, polished** appearance.
- **Lip Gloss Integration**: Uses **Lip Gloss** for styling (same as other Charmbracelet tools).

---

### 2. **Fancy Errors (Styled Error Messages)**
**Purpose**: Display **styled error messages** (instead of Cobra’s plain text errors).

**Primitives**:
- **Automatic Error Styling**: Errors are **automatically formatted** with colors and icons.
- **Error Context**: Includes **command name**, **error message**, and **suggestions** (if available).

**Example**:
```go
func main() {
    cmd := &cobra.Command{
        Use:   "example",
        Short: "A simple example",
        RunE: func(cmd *cobra.Command, args []string) error {
            return fmt.Errorf("something went wrong")
        },
    }
    if err := fang.Execute(context.Background(), cmd); err != nil {
        os.Exit(1)
    }
}
```

**Output**:
```
❌ Error: something went wrong

Usage:
  example [flags]
  example [command]

Available Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  man         Generate man pages

Flags:
  -h, --help   help for example

Run 'example --help' for more information.
```

**Key Features**:
- **Error Icon**: Prepends an error icon (❌) to error messages.
- **Command Context**: Shows the **command path** where the error occurred.
- **Suggestions**: Includes **usage hints** to help users recover.

---

### 3. **Automatic `--version` Flag**
**Purpose**: Automatically add a `--version` flag with **build info** or a **custom version string**.

**Primitives**:
- **Build Info**: Uses Go’s [`runtime/debug.BuildInfo`](https://pkg.go.dev/runtime/debug#BuildInfo) to extract version, commit, and build time.
- **Custom Version**: Override with a **custom version string**.

**Example**:
```go
func main() {
    cmd := &cobra.Command{
        Use:   "example",
        Short: "A simple example",
    }
    
    // Set a custom version (optional)
    cmd.Version = "1.0.0"
    
    if err := fang.Execute(context.Background(), cmd); err != nil {
        os.Exit(1)
    }
}
```

**Output**:
```bash
$ example --version
Example v1.0.0

# Or with build info (if Version is not set):
$ example --version
Example v0.1.0 (commit: abc1234, built: 2024-01-01T00:00:00Z)
```

**Key Features**:
- **Automatic Flag**: Adds `--version` to all commands.
- **Build Info**: Extracts version from **Go build info** (if available).
- **Custom Override**: Set `cmd.Version` to override the default.

---

### 4. **Manpages (Hidden `man` Command)**
**Purpose**: Generate **manpages** for the CLI using **[Mango](https://github.com/muesli/mango)**.

**Primitives**:
- **`man` Command**: Adds a hidden `man` command to generate manpages.
- **Mango Integration**: Uses **Mango** (a _roff_ manpage generator) for **better-looking manpages** than Cobra’s default.

**Example**:
```bash
# Generate manpages
$ example man | gzip > example.1.gz

# View manpage
$ man ./example.1
```

**Key Features**:
- **Single Manpage**: Unlike Cobra (which generates one manpage per command), Fang generates **one manpage** for the entire CLI (better for small tools).
- **Better Rendering**: Uses **Mango** (which writes _roff_ directly) for **better-looking manpages**.
- **Hidden Command**: The `man` command is **hidden** from `--help` by default.

---

### 5. **Shell Completions**
**Purpose**: Generate **shell completions** (Bash, Zsh, Fish, PowerShell).

**Primitives**:
- **`completion` Command**: Adds a `completion` command to generate completions for the user’s shell.
- **Automatic Detection**: Detects the user’s shell and generates the appropriate completions.

**Example**:
```bash
# Source completions (Bash)
source <(example completion bash)

# Source completions (Zsh)
source <(example completion zsh)

# Fish
source (example completion fish | psub)

# PowerShell
example completion powershell | Out-String | Invoke-Expression
```

**Key Features**:
- **Multi-Shell Support**: Bash, Zsh, Fish, PowerShell.
- **Automatic Detection**: Detects the user’s shell and generates the right completions.
- **Easy Installation**: Users can **source** the completions directly.

---

### 6. **Theming**
**Purpose**: Customize the **appearance** of Fang’s output (help, errors, etc.).

**Primitives**:
- **`fang.Theme`**: A struct that defines the **styles** for different parts of the output.
- **`fang.DefaultTheme`**: The default theme (uses Lip Gloss styles).
- **`fang.NewTheme()`**: Create a custom theme.

**Theme Structure**:
```go
type Theme struct {
    // Help text styles
    HelpTitle       lipgloss.Style
    HelpDescription lipgloss.Style
    HelpCommand     lipgloss.Style
    HelpFlag        lipgloss.Style
    
    // Error styles
    ErrorPrefix     lipgloss.Style
    ErrorMessage    lipgloss.Style
    ErrorSuggestion lipgloss.Style
    
    // Version styles
    VersionPrefix   lipgloss.Style
    VersionValue    lipgloss.Style
    
    // Other styles
    UsagePrefix     lipgloss.Style
    UsageCommand    lipgloss.Style
}
```

**Example**:
```go
import "github.com/charmbracelet/lipgloss"

// Create a custom theme
theme := fang.NewTheme()
theme.HelpTitle = lipgloss.NewStyle().
    Foreground(lipgloss.Color("#FF0000")).
    Bold(true)

// Apply the theme
fang.Theme = theme

// Execute with the custom theme
if err := fang.Execute(context.Background(), cmd); err != nil {
    os.Exit(1)
}
```

**Key Features**:
- **Lip Gloss Integration**: Uses **Lip Gloss** for styling (consistent with other Charmbracelet tools).
- **Full Customization**: Style **every part** of the output (help, errors, usage, etc.).
- **Default Theme**: Sensible defaults out of the box.

---

### 7. **UX Improvements**
**Purpose**: Enhance the **user experience** of CLI tools.

**Primitives**:
- **Silent `usage` Output**: By default, Fang **does not show usage** after a user error (unlike Cobra, which shows usage for every error). This reduces **noise** in the output.
- **Better Error Messages**: Errors are **styled** and include **context** (command path, suggestions).
- **Consistent Formatting**: All output is **consistently formatted** with Lip Gloss.

**Example**:
```bash
# With Cobra (default):
$ example invalid-command
Error: unknown command "invalid-command" for "example"
Run 'example --help' for usage.

# With Fang:
$ example invalid-command
❌ Error: unknown command "invalid-command"

Usage:
  example [command]

Available Commands:
  help        Help about any command

Run 'example --help' for more information.
```

---

## Technical Insights

### **How Fang Works**
1. **Wraps Cobra**: Fang **wraps Cobra’s `Execute`** method and **injects its own templates and handlers**.
2. **Replaces Templates**: Fang **replaces Cobra’s default templates** (help, usage, errors) with **styled versions**.
3. **Adds Commands**: Fang **adds hidden commands** (`man`, `completion`) to the root command.
4. **Handles Errors**: Fang **catches errors** from Cobra and **restyles them** before displaying.

### **Performance**
- **Minimal Overhead**: Fang adds **little to no overhead** to Cobra (just template replacements).
- **No Allocations**: The styling is done **lazily** (only when needed).

### **Compatibility**
- **Cobra Compatibility**: Works with **any Cobra command** (no changes needed).
- **Go Version**: Requires **Go 1.20+** (for generics and other features).
- **Cross-Platform**: Works on **all platforms** (Linux, macOS, Windows).

### **Limitations**
- **Cobra-Only**: Fang **only works with Cobra** (not other CLI libraries like `flag` or `urfave/cli`).
- **Opinionated**: Fang makes **opinionated choices** about UX (e.g., silent usage output).

---

## Integration Patterns

### **1. Basic Fang CLI**
```go
package main

import (
    "context"
    "os"
    "github.com/charmbracelet/fang"
    "github.com/spf13/cobra"
)

func main() {
    cmd := &cobra.Command{
        Use:   "mycli",
        Short: "A fancy CLI tool",
        RunE: func(cmd *cobra.Command, args []string) error {
            cmd.Println("Hello, Fang!")
            return nil
        },
    }
    
    if err := fang.Execute(context.Background(), cmd); err != nil {
        os.Exit(1)
    }
}
```

### **2. Custom Version**
```go
func main() {
    cmd := &cobra.Command{
        Use:   "mycli",
        Short: "A fancy CLI tool",
        Version: "1.0.0",  // Custom version
    }
    
    if err := fang.Execute(context.Background(), cmd); err != nil {
        os.Exit(1)
    }
}
```

### **3. Custom Theme**
```go
package main

import (
    "context"
    "os"
    "github.com/charmbracelet/fang"
    "github.com/charmbracelet/lipgloss"
    "github.com/spf13/cobra"
)

func main() {
    // Create a custom theme
    theme := fang.NewTheme()
    theme.HelpTitle = lipgloss.NewStyle().
        Foreground(lipgloss.Color("#FF00FF")).
        Bold(true)
    theme.ErrorPrefix = lipgloss.NewStyle().
        Foreground(lipgloss.Color("#FF0000")).
        SetString("❌ ")
    
    // Apply the theme
    fang.Theme = theme
    
    cmd := &cobra.Command{
        Use: "mycli",
    }
    
    if err := fang.Execute(context.Background(), cmd); err != nil {
        os.Exit(1)
    }
}
```

### **4. Subcommands**
```go
package main

import (
    "context"
    "os"
    "github.com/charmbracelet/fang"
    "github.com/spf13/cobra"
)

func main() {
    cmd := &cobra.Command{
        Use:   "mycli",
        Short: "A fancy CLI tool",
    }
    
    // Add a subcommand
    cmd.AddCommand(&cobra.Command{
        Use:   "greet",
        Short: "Greet someone",
        RunE: func(cmd *cobra.Command, args []string) error {
            name, _ := cmd.Flags().GetString("name")
            cmd.Println("Hello, " + name)
            return nil
        },
    })
    
    if err := fang.Execute(context.Background(), cmd); err != nil {
        os.Exit(1)
    }
}
```

### **5. Manpages**
```bash
# Generate manpages
go build -o mycli
./mycli man > mycli.1

# Compress and install
man ./mycli.1
```

### **6. Shell Completions**
```bash
# Generate completions for your shell
./mycli completion bash > /etc/bash_completion.d/mycli
./mycli completion zsh > ~/.zsh/completion/_mycli
```

---

## Use Cases
1. **CLI Tools**: Build **fancy, user-friendly CLI tools** with minimal effort.
2. **TUI Bootstrapping**: Use Fang to **bootstrap CLI tools** that later integrate with TUIs.
3. **Internal Tools**: Create **internal tools** with **consistent styling** and **good UX**.
4. **Open-Source Projects**: Add **professional polish** to open-source CLI tools.
5. **Prototyping**: Quickly prototype **CLI ideas** with styled output.
6. **Replacing Cobra Defaults**: Upgrade existing Cobra CLIs with **better output and UX**.

---

## Comparison to Alternatives
| Feature | Fang | [Cobra](https://github.com/spf13/cobra) | [urfave/cli](https://github.com/urfave/cli) | [kingpin](https://github.com/alecthomas/kingpin) | [oops](https://github.com/rocketlaunchr/oops) |
|---------|------|-------------------------------------------|-------------------------------------------------|------------------------------------------------|-----------------------------------------------|
| **Fancy Output** | ✅ Yes | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Styled Errors** | ✅ Yes | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Automatic `--version`** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Manpages** | ✅ Yes (Mango) | ✅ Yes (Cobra) | ✅ Yes | ✅ Yes | ❌ No |
| **Shell Completions** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Theming** | ✅ Yes (Lip Gloss) | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **UX Improvements** | ✅ Yes | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Cobra Compatibility** | ✅ Yes | ✅ N/A | ❌ No | ❌ No | ❌ No |
| **Lip Gloss Integration** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Minimal Setup** | ✅ Yes (1 line) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

**Key Differentiators**:
- **Fancy Output**: Only Fang and **oops** provide **styled output** for Cobra.
- **Lip Gloss Integration**: Uses **Lip Gloss** for styling (consistent with other Charmbracelet tools).
- **Mango Manpages**: Generates **better-looking manpages** than Cobra’s default.
- **Silent Usage**: **Does not show usage** after every error (reduces noise).
- **Zero Configuration**: Works **out of the box** with **sensible defaults**.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/fang.go` | Core `Execute` function and initialization. |
| `/theme.go` | `Theme` struct and default theme. |
| `/completion.go` | Shell completion command. |
| `/man.go` | Manpage generation command. |
| `/templates.go` | Custom Cobra templates (help, usage, errors). |
| `/errors.go` | Error handling and styling. |

---

## Summary
**Fang** is a **CLI starter kit** for **Cobra** applications, providing:

1. **Fancy Output**: Automatically **styles help and usage** text with Lip Gloss.
2. **Fancy Errors**: **Styled error messages** with icons, context, and suggestions.
3. **Automatic `--version`**: Adds a `--version` flag with **build info** or **custom version string**.
4. **Manpages**: Generates **better-looking manpages** using Mango.
5. **Shell Completions**: Adds a `completion` command for **Bash, Zsh, Fish, PowerShell**.
6. **Theming**: Customize the **appearance** of all output with Lip Gloss.
7. **UX Improvements**: **Silent usage** output, better error messages, consistent formatting.
8. **Zero Configuration**: Works **out of the box** with **sensible defaults**.

**Best For**: Building **fancy, user-friendly CLI tools** with **Cobra** (or upgrading existing Cobra CLIs).
**Avoid If**: You’re **not using Cobra** (Fang is Cobra-only).
