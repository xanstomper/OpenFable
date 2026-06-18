# Colors Primitives Analysis (x/colors)

## Overview
**`x/colors`** is a **utility package** that provides **predefined adaptive colors** for use with [Lip Gloss](https://github.com/charmbracelet/lipgloss). It defines a set of **light/dark mode-aware colors** that automatically adjust based on the terminal’s background color. This is useful for **theming TUIs** without manually defining separate colors for light and dark modes.

**Purpose**: Predefined adaptive colors for TUI theming.
**Language**: Go.
**Maturity**: Production (experimental in `x`, but stable).
**Dependencies**: `lipgloss` (for `AdaptiveColor` and `Color` types).

---

## Core Primitives

### 1. **Adaptive Colors**
**Purpose**: Colors that automatically switch between light and dark variants based on the terminal’s background.

**Primitives**:
- **`lipgloss.AdaptiveColor`**: A color that has separate `Light` and `Dark` variants.
  ```go
  type AdaptiveColor struct {
      Light string  // Color for light backgrounds
      Dark  string  // Color for dark backgrounds
  }
  ```

**Key Features**:
- **Automatic Switching**: Lip Gloss automatically detects the terminal’s background color and uses the appropriate variant.
- **Consistent Theming**: Ensures colors look good in both light and dark terminals.
- **Hex Color Codes**: Colors are defined as hex strings (e.g., `"#FF4672"`).

---

### 2. **Predefined Color Palette**
**Purpose**: A curated set of colors for common TUI elements (text, background, accents, etc.).

**Color Groups**:

#### **Neutrals (Gray Scale)**
| Color | Light Mode | Dark Mode | Use Case |
|-------|-------------|-----------|----------|
| `Normal` | `#1A1A1A` | `#dddddd` | Default text |
| `NormalDim` | `#A49FA5` | `#777777` | Dimmed text |
| `Gray` | `#909090` | `#626262` | Secondary text |
| `GrayMid` | `#B2B2B2` | `#4A4A4A` | Borders, dividers |
| `GrayDark` | `#DDDADA` | `#222222` | Dark backgrounds |
| `GrayBright` | `#847A85` | `#979797` | Bright accents |
| `GrayBrightDim` | `#C2B8C2` | `#4D4D4D` | Dimmed bright accents |

#### **Accent Colors**
| Color | Light Mode | Dark Mode | Use Case |
|-------|-------------|-----------|----------|
| `Indigo` | `#5A56E0` | `#7571F9` | Primary accent |
| `IndigoDim` | `#9498FF` | `#494690` | Dimmed primary accent |
| `IndigoSubtle` | `#7D79F6` | `#514DC1` | Subtle accent |
| `IndigoSubtleDim` | `#BBBDFF` | `#383584` | Dimmed subtle accent |

#### **Success/Error Colors**
| Color | Light Mode | Dark Mode | Use Case |
|-------|-------------|-----------|----------|
| `Green` | `#04B575` | `#04B575` | Success, positive actions |
| `GreenDim` | `#72D2B0` | `#0B5137` | Dimmed success |
| `Red` | `#FF4672` | `#ED567A` | Errors, warnings |
| `RedDull` | `#FF6F91` | `#C74665` | Subtle errors |

#### **Special Colors**
| Color | Light Mode | Dark Mode | Use Case |
|-------|-------------|-----------|----------|
| `WhiteBright` | `#FFFDF5` | `#FFFDF5` | Bright white (for dark mode) |
| `YellowGreen` | `#04B575` | `#ECFD65` | Yellow-green accent |
| `YellowGreenDull` | `#6BCB94` | `#9BA92F` | Dimmed yellow-green |
| `Fuschia` | `#EE6FF8` | `#EE6FF8` | Magenta/pink accent |
| `FuchsiaDim` | `#F1A8FF` | `#99519E` | Dimmed fuschia |
| `FuchsiaDull` | `#F793FF` | `#AD58B4` | Subtle fuschia |
| `FuchsiaDullDim` | `#F6C9FF` | `#6B3A6F` | Dimmed subtle fuschia |

---

## Technical Insights

### **How Adaptive Colors Work**
1. **Terminal Background Detection**: Lip Gloss detects whether the terminal has a **light** or **dark** background.
2. **Color Selection**: When rendering, Lip Gloss automatically uses the `Light` or `Dark` variant of an `AdaptiveColor`.
3. **Fallback**: If the terminal’s background cannot be detected, Lip Gloss defaults to the `Dark` variant.

### **Performance**
- **Zero Overhead**: Adaptive colors are resolved at **render time** (no runtime detection in `x/colors`).
- **No Allocations**: The color strings are **static** and reused.

### **Cross-Terminal Compatibility**
- Works with **all terminals** that support ANSI colors.
- **Graceful Degradation**: Falls back to `Dark` variant if background detection fails.

---

## Integration Patterns

### **1. Basic Usage with Lip Gloss**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/lipgloss"
    "github.com/charmbracelet/x/colors"
)

func main() {
    // Create a style with an adaptive color
    style := lipgloss.NewStyle().Foreground(colors.Indigo)
    
    // This will automatically use the correct variant
    fmt.Println(style.Render("Hello, world!"))
}
```

### **2. Theming a TUI**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/lipgloss"
    "github.com/charmbracelet/x/colors"
)

var (
    // Define a theme
    titleStyle = lipgloss.NewStyle().
        Foreground(colors.Indigo).
        Bold(true)
    
    textStyle = lipgloss.NewStyle().
        Foreground(colors.Normal)
    
    errorStyle = lipgloss.NewStyle().
        Foreground(colors.Red)
    
    successStyle = lipgloss.NewStyle().
        Foreground(colors.Green)
)

func main() {
    fmt.Println(titleStyle.Render("My App"))
    fmt.Println(textStyle.Render("Welcome!"))
    fmt.Println(errorStyle.Render("Error: File not found"))
    fmt.Println(successStyle.Render("Success!"))
}
```

### **3. Custom Adaptive Colors**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/lipgloss"
)

func main() {
    // Define a custom adaptive color
    myColor := lipgloss.AdaptiveColor{
        Light: "#FF0000",  // Red for light mode
        Dark:  "#00FF00",  // Green for dark mode
    }
    
    // Use it in a style
    style := lipgloss.NewStyle().Foreground(myColor)
    fmt.Println(style.Render("Custom color!"))
}
```

### **4. Combining with Other Styles**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/lipgloss"
    "github.com/charmbracelet/x/colors"
)

func main() {
    // Create a border with adaptive colors
    borderStyle := lipgloss.NewStyle().
        Border(lipgloss.RoundedBorder()).
        BorderForeground(colors.Indigo).
        Padding(1)
    
    // Create a title
    titleStyle := lipgloss.NewStyle().
        Foreground(colors.Indigo).
        Bold(true)
    
    // Combine them
    ui := borderStyle.Render(titleStyle.Render("My App"))
    fmt.Println(ui)
}
```

---

## Use Cases
1. **Theming TUIs**: Define a consistent color scheme that works in both light and dark terminals.
2. **CLI Tools**: Add colors to CLI output that adapt to the user’s terminal.
3. **Error/Success Messages**: Use `Red` and `Green` for clear feedback.
4. **Syntax Highlighting**: Define adaptive colors for code syntax.
5. **Accessibility**: Ensure colors are readable in both light and dark modes.

---

## Comparison to Alternatives
| Feature | `x/colors` | [lipgloss](https://github.com/charmbracelet/lipgloss) | [fatih/color](https://github.com/fatih/color) | [gdamore/tcell](https://github.com/gdamore/tcell) |
|---------|------------|----------------------------------------------------|-----------------------------------------------|---------------------------------------------------|
| **Adaptive Colors** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Predefined Palette** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **ANSI Colors** | ✅ Yes (via Lip Gloss) | ✅ Yes | ✅ Yes | ✅ Yes |
| **24-bit Color** | ✅ Yes (via Lip Gloss) | ✅ Yes | ✅ Yes | ✅ Yes |
| **Theming** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Dependencies** | Lip Gloss | None | None | Cgo (ncurses) |

**Key Differentiators**:
- **Predefined Palette**: Ready-to-use colors for **light/dark modes**.
- **Lip Gloss Integration**: Designed to work seamlessly with **Lip Gloss**.
- **Consistent Theming**: All colors are **tested and curated** for readability.
- **Zero Overhead**: No runtime performance impact.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/colors.go` | Predefined adaptive colors. |

---

## Summary
**`x/colors`** is a **small but powerful utility package** that provides:

1. **Predefined Adaptive Colors**: A curated palette of colors that **automatically switch** between light and dark variants.
2. **Consistent Theming**: Colors are designed to work well together and be **readable** in both modes.
3. **Lip Gloss Integration**: Works seamlessly with **Lip Gloss** for styling TUIs.
4. **Zero Dependencies**: Pure Go, no runtime overhead.

**Best For**: **Theming TUIs** with colors that adapt to the user’s terminal background.
**Avoid If**: You need **custom color manipulation** (use `x/ansi` or `lipgloss` directly).
