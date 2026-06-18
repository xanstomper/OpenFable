# WCWidth Primitives Analysis (x/wcwidth)

## Overview
**`x/wcwidth`** is a **utility package** for calculating the **display width** of runes and strings in terminals. It correctly handles **wide characters** (e.g., CJK, emoji) and **combining characters** (e.g., accents), which occupy **2 columns** or **0 columns** in the terminal, respectively. This is **critical** for proper text alignment, wrapping, and layout in TUIs.

**Purpose**: Calculate the display width of runes and strings (for terminal layout).
**Language**: Go.
**Maturity**: Production (deprecated in favor of `go-runewidth`).
**Dependencies**: [`github.com/mattn/go-runewidth`](https://github.com/mattn/go-runewidth).

---

## Core Primitives

### 1. **Rune Width**
**Purpose**: Get the display width of a single rune (character).

**Primitives**:
- **`RuneWidth(r rune) int`**: Returns the display width of `r` in terminal columns.

**Width Rules**:
| Rune Type | Width | Example |
|-----------|-------|---------|
| **ASCII/Latin** | 1 | `'A'`, `'a'`, `'1'` |
| **CJK (Chinese/Japanese/Korean)** | 2 | `'世'`, `'中'`, `'あ'` |
| **Emoji** | 2 | `'😀'`, `'🎉'`, `'👍'` |
| **Combining Characters** | 0 | `'\u0301'` (combining acute accent) |
| **Zero-Width Characters** | 0 | `'\u200B'` (zero-width space) |
| **Wide Emoji (e.g., flags)** | 2 | `'🇺🇸'` (US flag, counts as 1 emoji but 2 columns) |

**Example**:
```go
import "github.com/charmbracelet/x/wcwidth"

// ASCII character (width = 1)
width := wcwidth.RuneWidth('A')  // 1

// CJK character (width = 2)
width = wcwidth.RuneWidth('世') // 2

// Emoji (width = 2)
width = wcwidth.RuneWidth('😀') // 2

// Combining character (width = 0)
width = wcwidth.RuneWidth('\u0301') // 0
```

---

### 2. **String Width**
**Purpose**: Get the display width of a string (sum of rune widths).

**Primitives**:
- **`StringWidth(s string) int`**: Returns the total display width of `s` in terminal columns.

**Example**:
```go
import "github.com/charmbracelet/x/wcwidth"

// ASCII string (width = 5)
width := wcwidth.StringWidth("Hello")  // 5

// Mixed-width string (width = 1 + 2 + 1 = 4)
width = wcwidth.StringWidth("A世B")  // 4

// String with emoji (width = 1 + 2 + 1 = 4)
width = wcwidth.StringWidth("A😀B")  // 4
```

---

## Technical Insights

### **Why WCWidth Matters**
In terminals, **not all characters occupy 1 column**:
- **ASCII/Latin**: 1 column (e.g., `'A'`, `'a'`, `'1'`).
- **CJK/Emoji**: 2 columns (e.g., `'世'`, `'😀'`).
- **Combining Characters**: 0 columns (e.g., `'\u0301'` for accents).

**Example Problem**:
If you assume all characters are 1 column wide, a string like `"Hello 世界"` would be **misaligned** in the terminal:
- Actual width: `5 (Hello) + 1 (space) + 2 (世) + 2 (界) = 10`
- Assumed width (naive): `8`

**Solution**:
Use `wcwidth.StringWidth()` to get the **correct width** for terminal layout.

### **Unicode Support**
- **Full Unicode Coverage**: Handles all Unicode characters (including CJK, emoji, and combining marks).
- **East Asian Width**: Follows the [Unicode East Asian Width](https://www.unicode.org/reports/tr11/) standard.
- **Combining Characters**: Correctly handles **zero-width** combining marks (e.g., `e + \u0301 = é`).

### **Performance**
- **Fast Lookup**: Uses a **precomputed table** for fast width calculations.
- **No Allocations**: The functions are **allocation-free** (important for high-performance TUIs).
- **Caching**: `go-runewidth` caches results for efficiency.

### **Deprecation Notice**
**`x/wcwidth` is deprecated** in favor of using [`github.com/mattn/go-runewidth`](https://github.com/mattn/go-runewidth) directly. The functions in `x/wcwidth` are **simple wrappers** around `go-runewidth`.

**Migration**:
```go
// Old (deprecated)
import "github.com/charmbracelet/x/wcwidth"
width := wcwidth.RuneWidth('世')

// New (recommended)
import "github.com/mattn/go-runewidth"
width := runewidth.RuneWidth('世')
```

---

## Integration Patterns

### **1. Text Alignment**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/wcwidth"
)

func main() {
    text := "Hello 世界"
    width := wcwidth.StringWidth(text)
    
    // Right-align in a 20-column field
    padding := 20 - width
    fmt.Printf("%*s%s\n", padding, "", text)
}
```

### **2. Text Wrapping**
```go
package main

import (
    "fmt"
    "strings"
    "github.com/charmbracelet/x/wcwidth"
)

func wrap(text string, maxWidth int) []string {
    var lines []string
    var currentLine string
    var currentWidth int
    
    for _, r := range text {
        w := wcwidth.RuneWidth(r)
        if currentWidth + w > maxWidth {
            lines = append(lines, currentLine)
            currentLine = ""
            currentWidth = 0
        }
        currentLine += string(r)
        currentWidth += w
    }
    
    if currentLine != "" {
        lines = append(lines, currentLine)
    }
    
    return lines
}

func main() {
    text := "This is a very long line of text with 世界 and emoji 😀."
    lines := wrap(text, 20)
    for _, line := range lines {
        fmt.Println(line)
    }
}
```

### **3. Truncation**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/wcwidth"
)

func truncate(text string, maxWidth int) string {
    var result string
    var width int
    
    for _, r := range text {
        w := wcwidth.RuneWidth(r)
        if width + w > maxWidth {
            break
        }
        result += string(r)
        width += w
    }
    
    if len(result) < len(text) {
        result += "…"  // Ellipsis (width = 1)
    }
    
    return result
}

func main() {
    text := "This is a very long line of text with 世界."
    truncated := truncate(text, 20)
    fmt.Println(truncated)
}
```

### **4. Progress Bars**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/wcwidth"
)

func main() {
    // Create a progress bar with wide characters
    progress := "▰▱▱▱▱▱▱▱▱▱"  // 10 columns (each ▰ or ▱ is width 1)
    
    // Calculate width (should be 10)
    width := wcwidth.StringWidth(progress)
    fmt.Printf("Progress bar width: %d\n", width)
}
```

### **5. Table Layout**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/wcwidth"
)

func main() {
    // Define table columns
    headers := []string{"Name", "Age", "City"}
    rows := [][]string{
        {"Alice", "30", "New York"},
        {"Bob", "25", "Tokyo"},
        {"Charlie", "35", "世界"},  // "世界" = 2 columns
    }
    
    // Calculate column widths
    colWidths := make([]int, len(headers))
    for i, header := range headers {
        colWidths[i] = wcwidth.StringWidth(header)
    }
    
    for _, row := range rows {
        for i, cell := range row {
            w := wcwidth.StringWidth(cell)
            if w > colWidths[i] {
                colWidths[i] = w
            }
        }
    }
    
    // Print table
    for _, header := range headers {
        fmt.Printf("%-*s", colWidths[0]+2, header)
    }
    fmt.Println()
    
    for _, row := range rows {
        for i, cell := range row {
            fmt.Printf("%-*s", colWidths[i]+2, cell)
        }
        fmt.Println()
    }
}
```

---

## Use Cases
1. **Text Alignment**: Right-align, center, or left-align text in terminals.
2. **Text Wrapping**: Wrap long text to fit terminal columns.
3. **Truncation**: Truncate text to fit a given width (with ellipsis).
4. **Table Layout**: Create properly aligned tables with mixed-width characters.
5. **Progress Bars**: Display progress bars with correct width calculations.
6. **UI Layout**: Position UI elements (buttons, inputs) correctly in terminals.
7. **Cursor Movement**: Move the cursor to the correct position after printing wide characters.

---

## Comparison to Alternatives
| Feature | `x/wcwidth` | [`go-runewidth`](https://github.com/mattn/go-runewidth) | [`unicode/utf8`](https://pkg.go.dev/unicode/utf8) | [`golang.org/x/text/width`](https://pkg.go.dev/golang.org/x/text/width) |
|---------|-------------|----------------------------------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------------------|
| **Rune Width** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **String Width** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **CJK Support** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Emoji Support** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Combining Characters** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Performance** | ⚡ Fast | ⚡ Fast | ❌ N/A | ⚡ Fast |
| **Dependencies** | `go-runewidth` | None | None | None |
| **Deprecated** | ✅ Yes | ❌ No | ❌ N/A | ❌ No |

**Key Differentiators**:
- **Deprecated**: `x/wcwidth` is a **wrapper** around `go-runewidth` and is **deprecated** in favor of using `go-runewidth` directly.
- **Same Functionality**: `x/wcwidth` provides the **exact same API** as `go-runewidth`.
- **Charmbracelet Ecosystem**: Used by **Bubble Tea**, **Glamour**, and other Charmbracelet tools.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/wcwidth.go` | Wrapper functions (`RuneWidth`, `StringWidth`). |

---

## Summary
**`x/wcwidth`** is a **utility package** for calculating the **display width** of runes and strings in terminals, providing:

1. **Rune Width**: Get the width of a single rune (`RuneWidth`).
2. **String Width**: Get the width of a string (`StringWidth`).
3. **Unicode Support**: Correctly handles **CJK**, **emoji**, and **combining characters**.
4. **Terminal Layout**: Essential for **text alignment**, **wrapping**, and **UI layout** in TUIs.
5. **Deprecated**: Use [`github.com/mattn/go-runewidth`](https://github.com/mattn/go-runewidth) directly instead.

**Best For**: Calculating **display widths** for terminal layout (but use `go-runewidth` directly for new projects).
**Avoid If**: You’re starting a new project (use `go-runewidth` instead).
