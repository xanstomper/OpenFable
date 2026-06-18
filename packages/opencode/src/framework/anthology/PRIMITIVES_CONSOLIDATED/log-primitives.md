# Log Primitives Analysis

## Overview
**Log** is a **minimal, colorful, structured logging library** for Go, designed for **human-readable** output in terminals. It’s built on **[Lip Gloss](https://github.com/charmbracelet/lipgloss)** for styling and provides **leveled logging**, **multiple formatters**, and **context-aware** features. While not a TUI framework itself, Log is **terminal-aware** and can be used to **enhance TUIs** with styled logs, debug output, or status messages.

**Purpose**: Colorful, structured logging for terminals.
**Language**: Go.
**Maturity**: Production.
**Dependencies**: `lipgloss` (for styling).

---

## Core Primitives

### 1. **Leveled Logging**
**Purpose**: Filter logs by severity level (Debug, Info, Warn, Error, Fatal).

**Primitives**:
- **Log Levels**:
  ```go
  log.DebugLevel  // Debug messages (lowest)
  log.InfoLevel   // Informational messages
  log.WarnLevel   // Warning messages
  log.ErrorLevel  // Error messages
  log.FatalLevel  // Fatal errors (calls os.Exit(1))
  ```

- **Global Logger**: Pre-configured with `InfoLevel` and timestamps enabled.
- **Level Methods**:
  ```go
  log.Debug("Debug message")
  log.Info("Info message")
  log.Warn("Warning message")
  log.Error("Error message")
  log.Fatal("Fatal message")  // Exits with code 1
  ```

**Example**:
```go
import "github.com/charmbracelet/log"

log.Debug("Debug: This won't print by default")
log.Info("Info: Application started")
log.Warn("Warn: Low disk space")
log.Error("Error: Failed to connect")
// log.Fatal("Fatal: Critical error") // Exits with os.Exit(1)
```

**Output**:
```
10:04:06 INFO  Application started
10:04:06 WARN  Low disk space
10:04:06 ERROR Failed to connect
```

---

### 2. **Structured Logging**
**Purpose**: Add **key-value pairs** to log messages for structured output.

**Primitives**:
- **`With(key, value)`**: Add context to a logger (creates a sub-logger).
- **Key-Value Pairs**: Pass additional context directly to log methods.

**Example**:
```go
// Add context with key-value pairs
log.Info("User logged in", "user", "alice", "ip", "192.168.1.1")

// Output (TextFormatter):
// 10:04:06 INFO  User logged in user=alice ip=192.168.1.1

// Create a sub-logger with fixed context
logger := log.With("service", "auth", "version", "1.0.0")
logger.Info("Request received", "path", "/login")

// Output:
// 10:04:06 INFO  Request received service=auth version=1.0.0 path=/login
```

**Key-Value Types**:
- Supports **any type** (strings, ints, structs, slices, etc.).
- Values are **stringified** using `fmt.Sprint`.

---

### 3. **Formatters**
**Purpose**: Control the output format of logs.

**Primitives**:
- **`TextFormatter`** (default): Human-readable, colored output for terminals.
- **`JSONFormatter`**: Structured JSON output (for log aggregation).
- **`LogfmtFormatter`**: Logfmt-style output (for tools like Loki).

**Example**:
```go
// Use JSON formatter
logger := log.NewWithOptions(os.Stderr, log.Options{
    Formatter: log.JSONFormatter,
})
logger.Info("User logged in", "user", "alice")

// Output:
// {"level":"INFO","time":"2023-01-04T10:04:06Z","message":"User logged in","user":"alice"}

// Use Logfmt formatter
logger := log.NewWithOptions(os.Stderr, log.Options{
    Formatter: log.LogfmtFormatter,
})
logger.Info("User logged in", "user", "alice")

// Output:
// level=INFO time="2023-01-04T10:04:06Z" message="User logged in" user=alice
```

**Note**: Styling (colors) is **only applied** with the `TextFormatter` and when output is a **TTY**.

---

### 4. **Customization (Options)**
**Purpose**: Configure the logger’s behavior.

**Primitives**:
- **`NewWithOptions(output, options)`**: Create a logger with custom options.
- **`Options` struct**: Configure logger behavior.

**Key Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ReportCaller` | `bool` | `false` | Include file:line in output |
| `ReportTimestamp` | `bool` | `true` | Include timestamp in output |
| `TimeFormat` | `string` | `"2006/01/02 15:04:05"` | Timestamp format (Go time layout) |
| `Prefix` | `string` | `""` | Prefix for all log messages |
| `Level` | `Level` | `InfoLevel` | Minimum log level to output |
| `Formatter` | `Formatter` | `TextFormatter` | Output formatter |
| `Styles` | `*Styles` | `DefaultStyles()` | Custom styles (Lip Gloss) |

**Example**:
```go
logger := log.NewWithOptions(os.Stderr, log.Options{
    ReportCaller: true,
    ReportTimestamp: true,
    TimeFormat: time.Kitchen,  // "3:04PM"
    Prefix: "MyApp ",
    Level: log.DebugLevel,
})

logger.Info("Hello")
// Output: MyApp 3:04PM INFO <file.go:123> Hello
```

---

### 5. **Styling with Lip Gloss**
**Purpose**: Customize the **colors and styles** of log levels and keys.

**Primitives**:
- **`DefaultStyles()`**: Get the default styles.
- **`Styles` struct**: Contains styles for levels, keys, and values.
  ```go
  type Styles struct {
      Levels map[Level]lipgloss.Style  // Style for each log level
      Keys   map[string]lipgloss.Style // Style for specific keys
      Values map[string]lipgloss.Style // Style for specific values
  }
  ```

**Example**:
```go
// Customize log level styles
styles := log.DefaultStyles()
styles.Levels[log.ErrorLevel] = lipgloss.NewStyle().
    SetString("ERROR!!").
    Padding(0, 1, 0, 1).
    Background(lipgloss.Color("204")).  // Red background
    Foreground(lipgloss.Color("0"))     // Black text

// Customize key/value styles
styles.Keys["err"] = lipgloss.NewStyle().Foreground(lipgloss.Color("204"))  // Red
styles.Values["err"] = lipgloss.NewStyle().Bold(true)  // Bold

// Apply styles
logger := log.New(os.Stderr)
logger.SetStyles(styles)
logger.Error("Failed", "err", "disk full")
```

**Default Styles**:
- **Debug**: Gray
- **Info**: White
- **Warn**: Yellow
- **Error**: Red
- **Fatal**: Bold red with background

---

### 6. **Helper Functions**
**Purpose**: Mark functions as **helpers** to skip their frames in caller reporting.

**Primitives**:
- **`log.Helper()`**: Call this at the start of helper functions to skip their frame in `ReportCaller` output.

**Example**:
```go
func startOven(degree int) {
    log.Helper()  // Skip this frame in caller reporting
    log.Info("Starting oven", "degree", degree)
}

log.SetReportCaller(true)
startOven(400)
// Output: INFO <cookies/oven.go:123> Starting oven degree=400
// (Note: Line number points to the caller of startOven, not startOven itself)
```

---

### 7. **Slog Handler**
**Purpose**: Use Log as a handler for Go’s **`log/slog`** (structured logging).

**Primitives**:
- **`NewSlogHandler(logger)`**: Create a `slog.Handler` that writes to a Log logger.

**Example**:
```go
import (
    "log/slog"
    "github.com/charmbracelet/log"
)

// Create a Log logger
handler := log.New(os.Stderr)

// Use it with slog
slogLogger := slog.New(handler)
slogLogger.Error("meow?")

// Output: ERROR meow?
```

---

### 8. **Standard Log Adapter**
**Purpose**: Use Log with Go’s **`standard log`** package (for compatibility with libraries that require `*log.Logger`).

**Primitives**:
- **`StandardLog(options)`**: Create a `*log.Logger` that writes to a Log logger.

**Example**:
```go
import (
    "net/http"
    "github.com/charmbracelet/log"
)

// Create a Log logger
logger := log.NewWithOptions(os.Stderr, log.Options{Prefix: "http"})

// Adapt to standard log
stdlog := logger.StandardLog(log.StandardLogOptions{
    ForceLevel: log.ErrorLevel,  // Force all stdlog output to Error
})

// Use with http.Server
s := &http.Server{
    Addr: ":8080",
    ErrorLog: stdlog,
}

// Now http.Server will log errors using Log
stdlog.Printf("Failed: %s", err)
// Output: http ERROR Failed: <error>
```

---

### 9. **Gum Integration**
**Purpose**: Use Log with **[Gum](https://github.com/charmbracelet/gum)** for shell scripting.

**Example**:
```bash
# Log with debug level
gum log --debug "Debug message"

# Log with error level
gum log --error "Error message"

# Log with custom prefix
gum log --prefix "MyApp " "Info message"
```

**Use Case**: Shell scripts that need **colorful, structured logging**.

---

### 10. **Context-Aware Logging**
**Purpose**: Attach loggers to **Go contexts** for request-scoped logging.

**Primitives**:
- **`log.WithContext(ctx)`**: Get a logger from context.
- **`log.ToContext(ctx, logger)`**: Store a logger in context.

**Example**:
```go
// Store logger in context
ctx := log.ToContext(context.Background(), logger)

// Retrieve logger from context
ctxLogger := log.WithContext(ctx)
ctxLogger.Info("Request handled")
```

---

## Technical Insights

### **Architecture**
1. **Logger**: The main struct that holds configuration (level, formatter, styles, etc.).
2. **Handlers**: Write logs to an `io.Writer` (e.g., `os.Stderr`).
3. **Formatters**: Convert log entries into strings (Text, JSON, Logfmt).
4. **Styles**: Apply Lip Gloss styles to log levels, keys, and values.
5. **Context**: Support for storing loggers in `context.Context`.

### **Performance**
- **Fast**: Minimal overhead (comparable to `log/slog`).
- **No Allocations**: Reuses buffers where possible.
- **TTY Detection**: Automatically disables colors when output is not a TTY.

### **Cross-Platform Support**
- Works on **all platforms** (Linux, macOS, Windows, etc.).
- **TTY Detection**: Automatically detects if output is a terminal.
- **Color Support**: Uses **ANSI colors** (24-bit, 256-color, or 16-color).

### **Compatibility**
- **`log/slog`**: Can be used as a `slog.Handler`.
- **Standard `log`**: Can be adapted to `*log.Logger`.
- **Gum**: Works with Gum’s `log` command.

---

## Integration Patterns

### **1. Basic Logging in a TUI**
```go
package main

import (
    "github.com/charmbracelet/log"
)

func main() {
    // Global logger (pre-configured)
    log.Info("Application started")
    
    // Log with context
    log.Info("User logged in", "user", "alice", "ip", "192.168.1.1")
    
    // Debug (won't print by default)
    log.Debug("Debug info")
}
```

### **2. Custom Logger for a TUI**
```go
package main

import (
    "os"
    "github.com/charmbracelet/log"
)

func main() {
    // Create a custom logger
    logger := log.NewWithOptions(os.Stderr, log.Options{
        ReportCaller: true,
        Prefix: "MyTUI ",
        Level: log.DebugLevel,  // Show all levels
    })
    
    // Use the logger
    logger.Info("TUI started")
    logger.Debug("Loading data...")
    logger.Error("Failed to load", "err", err)
}
```

### **3. Styled Logging**
```go
package main

import (
    "os"
    "github.com/charmbracelet/log"
    "github.com/charmbracelet/lipgloss"
)

func main() {
    // Customize styles
    styles := log.DefaultStyles()
    styles.Levels[log.InfoLevel] = lipgloss.NewStyle().
        Foreground(lipgloss.Color("#00FF00")).  // Green
        Bold(true)
    
    logger := log.New(os.Stderr)
    logger.SetStyles(styles)
    logger.Info("Success!")
}
```

### **4. Structured Logging with Slog**
```go
package main

import (
    "log/slog"
    "github.com/charmbracelet/log"
)

func main() {
    // Create a Log handler for slog
    handler := log.New(os.Stderr)
    slogLogger := slog.New(handler)
    
    // Use slog
    slogLogger.Info("User logged in", "user", "alice", "ip", "192.168.1.1")
}
```

### **5. Context-Aware Logging**
```go
package main

import (
    "context"
    "github.com/charmbracelet/log"
)

func handleRequest(ctx context.Context) {
    // Get logger from context
    logger := log.WithContext(ctx)
    logger.Info("Handling request")
}

func main() {
    // Store logger in context
    logger := log.New(os.Stderr)
    ctx := log.ToContext(context.Background(), logger)
    
    // Pass context to handlers
    handleRequest(ctx)
}
```

### **6. Error Handling in TUIs**
```go
package main

import (
    "errors"
    "github.com/charmbracelet/log"
)

func doSomething() error {
    return errors.New("failed")
}

func main() {
    if err := doSomething(); err != nil {
        log.Error("Operation failed", "err", err)
    }
}
```

### **7. Progress Logging**
```go
package main

import (
    "time"
    "github.com/charmbracelet/log"
)

func main() {
    logger := log.New(os.Stderr)
    
    for i := 0; i < 100; i++ {
        logger.Info("Progress", "percent", i)
        time.Sleep(100 * time.Millisecond)
    }
}
```

---

## Use Cases
1. **TUI Debugging**: Add **colorful debug logs** to TUIs during development.
2. **Error Reporting**: Display **styled error messages** in TUIs.
3. **Status Updates**: Log **progress or status** in TUIs (e.g., loading spinners).
4. **CLI Tools**: Add **structured, colorful logging** to CLI tools.
5. **Server Applications**: Use **JSON/Logfmt** formatters for log aggregation.
6. **Shell Scripts**: Use **Gum integration** for logging in shell scripts.
7. **Request Tracing**: Use **context-aware logging** to trace requests in servers.

---

## Comparison to Alternatives
| Feature | Log | [log/slog](https://pkg.go.dev/log/slog) | [zap](https://github.com/uber-go/zap) | [zerolog](https://github.com/rs/zerolog) | [glog](https://github.com/golang/glog) |
|---------|-----|--------------------------------------------|------------------------------------------|--------------------------------------------|------------------------------------------|
| **Colorful Output** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Terminal-Aware** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Leveled Logging** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Structured Logging** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Multiple Formatters** | ✅ Yes (Text/JSON/Logfmt) | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Lip Gloss Integration** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Slog Handler** | ✅ Yes | ❌ N/A | ❌ No | ❌ No | ❌ No |
| **Standard Log Adapter** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Gum Integration** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Context Support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Performance** | ⚡ Fast | ⚡ Fast | ⚡ Fast | ⚡ Fast | 🐢 Slow |

**Key Differentiators**:
- **Colorful Output**: Only Log provides **styled, colorful** output for terminals.
- **Terminal-Aware**: Automatically disables colors when output is not a TTY.
- **Lip Gloss Integration**: Uses **Lip Gloss** for styling (consistent with other Charmbracelet tools).
- **Slog Handler**: Can be used as a **`slog.Handler`** for Go’s structured logging.
- **Gum Integration**: Works with **Gum** for shell scripting.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/log.go` | Core `Logger` type and methods. |
| `/options.go` | `Options` struct for logger configuration. |
| `/styles.go` | Default styles and `Styles` struct. |
| `/formatter.go` | Formatter interfaces and implementations. |
| `/text_formatter.go` | `TextFormatter` (human-readable output). |
| `/json_formatter.go` | `JSONFormatter` (structured JSON output). |
| `/logfmt_formatter.go` | `LogfmtFormatter` (Logfmt-style output). |
| `/slog_handler.go` | `slog.Handler` implementation. |
| `/standard_log.go` | Standard `log` adapter. |
| `/context.go` | Context support for loggers. |

---

## Summary
**Log** is a **colorful, structured logging library** for Go, providing:

1. **Leveled Logging**: Filter logs by severity (Debug, Info, Warn, Error, Fatal).
2. **Structured Logging**: Add key-value pairs for context.
3. **Multiple Formatters**: Text (colored), JSON, Logfmt.
4. **Lip Gloss Styling**: Customize colors and styles for levels, keys, and values.
5. **Context Support**: Attach loggers to Go contexts.
6. **Slog Handler**: Use as a handler for Go’s `log/slog`.
7. **Standard Log Adapter**: Compatible with `*log.Logger`.
8. **Gum Integration**: Works with Gum for shell scripting.
9. **Helper Functions**: Skip caller frames in helper functions.
10. **TTY-Aware**: Automatically disables colors when output is not a terminal.

**Best For**: Adding **colorful, structured logging** to **TUIs**, **CLI tools**, or **server applications**.
**Avoid If**: You need **high-performance logging** without styling (use `zap` or `zerolog` instead).
