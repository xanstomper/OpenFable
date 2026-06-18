# VHS Primitives Analysis

## Overview
**VHS** (Video Hosting Service) is a **terminal session recorder and GIF generator** that allows you to **script terminal interactions** and render them as GIFs, MP4s, or WebM videos. It’s designed for **integration testing, demos, and documentation** of CLI tools and TUIs. VHS uses a **declarative tape file format** to define terminal actions (typing, scrolling, waiting) and renders them into videos.

**Purpose**: Record, script, and render terminal sessions as animated GIFs/videos.
**Language**: Go.
**Maturity**: Production.
**Dependencies**: `ttyd` (terminal recorder), `ffmpeg` (video encoding).

---

## Core Primitives

### 1. **Tape File Format (`.tape`)**
**Purpose**: Declarative scripting of terminal sessions.

**Primitives**:
- **Tape File**: A text file with commands defining terminal actions (e.g., `Type`, `Enter`, `Sleep`).
- **Syntax**: Elixir-inspired (but not Elixir; just a DSL).

**Key Features**:
- **Human-Readable**: Easy to write, edit, and version-control.
- **Deterministic**: Same tape → same output (reproducible demos).
- **Cross-Platform**: Works on any system with `ttyd` and `ffmpeg`.

**Example Tape File**:
```elixir
# Set output file
Output demo.gif

# Configure terminal
Set FontSize 24
Set Width 800
Set Height 600

# Type a command
Type "echo 'Hello, VHS!'"
Enter

# Wait for output
Sleep 1s

# Scroll up
ScrollUp 5
```

---

### 2. **Terminal Configuration Primitives**
**Purpose**: Define the appearance and behavior of the virtual terminal.

**Primitives**:
| Command | Description | Example |
|---------|-------------|---------|
| `Set FontSize <n>` | Font size in pixels | `Set FontSize 24` |
| `Set FontFamily <name>` | Font family (e.g., `"Monoflow"`) | `Set FontFamily "Fira Code"` |
| `Set Width <n>` | Terminal width in pixels | `Set Width 800` |
| `Set Height <n>` | Terminal height in pixels | `Set Height 600` |
| `Set Padding <n>` | Padding around terminal (pixels) | `Set Padding 20` |
| `Set Margin <n>` | Margin around video (pixels) | `Set Margin 60` |
| `Set MarginFill <color>` | Margin background color | `Set MarginFill "#6B50FF"` |
| `Set LetterSpacing <n>` | Spacing between characters (pixels) | `Set LetterSpacing 2` |
| `Set LineHeight <n>` | Line height multiplier | `Set LineHeight 1.8` |
| `Set Theme <name/json>` | Color theme (name or JSON) | `Set Theme "Catppuccin Frappe"` |
| `Set Framerate <n>` | Frames per second | `Set Framerate 60` |
| `Set PlaybackSpeed <n>` | Playback speed multiplier | `Set PlaybackSpeed 1.5` |
| `Set Shell <path>` | Shell to use (e.g., `bash`, `zsh`) | `Set Shell /bin/zsh` |
| `Set BorderRadius <n>` | Rounded corners (pixels) | `Set BorderRadius 10` |
| `Set WindowBar <type>` | Window bar style | `Set WindowBar Colorful` |

**Theme JSON Structure**:
```json
{
  "name": "My Theme",
  "black": "#000000",
  "red": "#ff0000",
  "green": "#00ff00",
  "yellow": "#ffff00",
  "blue": "#0000ff",
  "magenta": "#ff00ff",
  "cyan": "#00ffff",
  "white": "#ffffff",
  "brightBlack": "#808080",
  "brightRed": "#ff8080",
  "brightGreen": "#80ff80",
  "brightYellow": "#ffff80",
  "brightBlue": "#8080ff",
  "brightMagenta": "#ff80ff",
  "brightCyan": "#80ffff",
  "brightWhite": "#ffffff",
  "background": "#1e1e1e",
  "foreground": "#ffffff",
  "selection": "#404040",
  "cursor": "#ffffff"
}
```

**Predefined Themes**:
- Use `vhs themes` to list all built-in themes (e.g., `"Catppuccin Frappe"`, `"Dracula"`, `"Solarized Dark"`).

---

### 3. **Input Primitives (Terminal Actions)**
**Purpose**: Simulate user input in the terminal.

**Primitives**:
| Command | Description | Example |
|---------|-------------|---------|
| `Type "<text>"` | Type text into the terminal | `Type "ls -la"` |
| `Type@<speed> "<text>"` | Type with custom speed | `Type@500ms "slow text"` |
| `Enter` | Press Enter key | `Enter` |
| `Backspace` | Press Backspace | `Backspace` |
| `Tab` | Press Tab | `Tab` |
| `Space` | Press Space | `Space` |
| `Left` / `Right` / `Up` / `Down` | Arrow keys | `Right` |
| `Ctrl+<char>` | Control key combo | `Ctrl+c` |
| `Alt+<char>` | Alt key combo | `Alt+Tab` |
| `Shift+<char>` | Shift key combo | `Shift+A` |
| `Ctrl+Alt+<char>` | Combined modifiers | `Ctrl+Alt+Del` |

**Typing Speed**:
- Global: `Set TypingSpeed 100ms` (100ms delay per character).
- Per-command: `Type@200ms "text"` (overrides global).

---

### 4. **Wait Primitives (Synchronization)**
**Purpose**: Pause execution until a condition is met.

**Primitives**:
| Command | Description | Example |
|---------|-------------|---------|
| `Sleep <duration>` | Wait for a duration | `Sleep 1s` (or `500ms`) |
| `Wait /<regex>/` | Wait for regex match in output | `Wait /Hello World/` |
| `Wait+Screen /<regex>/` | Wait for regex on current screen | `Wait+Screen /Done/` |
| `Wait+Line /<regex>/` | Wait for regex on a new line | `Wait+Line /Success/` |

**Duration Formats**:
- `1s` = 1 second
- `500ms` = 500 milliseconds
- `1m` = 1 minute

**Example**:
```elixir
Type "npm test"
Enter
Wait /All tests passed/
```

---

### 5. **Output Primitives (Rendering)**
**Purpose**: Define the output format and location.

**Primitives**:
| Command | Description | Example |
|---------|-------------|---------|
| `Output <path>` | Set output file | `Output demo.gif` |
| Multiple `Output` | Render to multiple formats | `Output demo.gif` `Output demo.mp4` |

**Supported Output Formats**:
- `.gif` (GIF animation)
- `.mp4` (H.264 video)
- `.webm` (VP9 video)
- `<directory>/` (PNG frame sequence)

**Example**:
```elixir
Output demo.gif
Output demo.mp4
Output frames/  # PNG sequence
```

---

### 6. **Dependency Primitives**
**Purpose**: Declare required programs for the tape.

**Primitives**:
- **`Require <program>`**: Fail early if a required CLI tool is missing from `$PATH`.

**Example**:
```elixir
Require node
Require npm

Type "npm --version"
Enter
```

**Key Features**:
- Must be defined **at the top** of the tape file (before any actions).
- Improves error messages (e.g., "Missing `node`" instead of a cryptic failure).

---

### 7. **Clipboard Primitives**
**Purpose**: Simulate copy/paste actions.

**Primitives**:
| Command | Description | Example |
|---------|-------------|---------|
| `Copy "<text>"` | Copy text to clipboard | `Copy "hello"` |
| `Paste` | Paste from clipboard | `Paste` |

**Example**:
```elixir
Copy "git commit -m 'fix'"
Paste
Enter
```

---

### 8. **Scroll Primitives**
**Purpose**: Control the terminal viewport.

**Primitives**:
| Command | Description | Example |
|---------|-------------|---------|
| `ScrollUp <n>` | Scroll up by `n` lines | `ScrollUp 5` |
| `ScrollDown <n>` | Scroll down by `n` lines | `ScrollDown 3` |

**Example**:
```elixir
Type "cat /etc/os-release"
Enter
Sleep 1s
ScrollUp 10  # Scroll up to see the top
```

---

### 9. **Modularity Primitives**
**Purpose**: Reuse and organize tape files.

**Primitives**:
| Command | Description | Example |
|---------|-------------|---------|
| `Source <path>` | Include another tape file | `Source common.tape` |
| `Env <key> <value>` | Set environment variables | `Env API_KEY "12345"` |
| `Hide` / `Show` | Hide/show commands in output | `Hide` `Type "secret"` `Show` |

**Example**:
```elixir
# common.tape
Type "cd /project"
Enter

# demo.tape
Source common.tape
Type "npm start"
Enter
```

---

### 10. **Screen Capture Primitives**
**Purpose**: Capture individual frames.

**Primitives**:
- **`Screenshot`**: Capture the current terminal frame as a PNG (saved to output directory).

**Example**:
```elixir
Type "echo 'Snapshot!'"
Enter
Screenshot  # Saves a PNG of the current screen
```

---

## Technical Insights

### **Architecture**
1. **Tape Parser**: Reads `.tape` files and validates syntax.
2. **Terminal Emulator**: Uses `ttyd` to create a virtual terminal session.
3. **Input Injector**: Sends keystrokes to the terminal via `ttyd`.
4. **Frame Capture**: Records terminal frames (PNGs) at the specified framerate.
5. **Video Encoder**: Uses `ffmpeg` to stitch frames into GIFs/MP4s/WebM.

### **Workflow**
1. **Parse Tape**: Read and validate the `.tape` file.
2. **Start `ttyd`**: Launch a virtual terminal session.
3. **Inject Input**: Send commands (typing, scrolling, etc.) to `ttyd`.
4. **Capture Frames**: Record terminal frames at the specified framerate.
5. **Encode Video**: Use `ffmpeg` to create the final output.

### **Performance**
- **Framerate**: Configurable (default: 30 FPS).
- **Resolution**: Limited by terminal size (e.g., 800x600).
- **Overhead**: Minimal (most work is done by `ttyd` and `ffmpeg`).

### **Limitations**
- **Requires `ttyd` and `ffmpeg`**: Must be installed on the system.
- **No Audio**: Videos are silent (no audio recording).
- **Terminal Dependencies**: Commands in the tape must be available in the environment.

---

## Integration Patterns

### **1. Basic Recording**
```bash
# Create a new tape file
vhs new demo.tape

# Edit the tape file
vim demo.tape

# Render to GIF
vhs demo.tape
```

### **2. Record Live Terminal Session**
```bash
# Start recording (press Ctrl+D or type `exit` to stop)
vhs record > live.tape

# Replay and render
vhs live.tape
```

### **3. Multi-Format Output**
```elixir
# demo.tape
Output demo.gif
Output demo.mp4
Output frames/

Set FontSize 20
Type "echo 'Multi-format!'"
Enter
```

### **4. Themed Demo**
```elixir
Output demo.gif
Set Theme "Dracula"
Set FontFamily "Fira Code"
Set FontSize 24

Type "cat package.json"
Enter
```

### **5. Waiting for Output**
```elixir
Output demo.gif

Type "npm test"
Enter
Wait /All tests passed/
```

### **6. Modular Tapes**
```elixir
# setup.tape
Type "cd /my-project"
Enter

# demo.tape
Source setup.tape
Type "npm start"
Enter
Wait /Server running on port 3000/
```

### **7. Environment Variables**
```elixir
Output demo.gif
Env NODE_ENV "production"

Type "npm run build"
Enter
```

### **8. SSH Server Mode**
```bash
# Start VHS server
vhs serve

# Connect from another machine
ssh user@vhs-server < demo.tape > demo.gif
```

---

## Use Cases
1. **CLI Tool Demos**: Create animated GIFs for READMEs.
2. **Integration Testing**: Verify CLI tool behavior visually.
3. **Documentation**: Show how to use a tool step-by-step.
4. **Bug Reports**: Record and share terminal issues.
5. **Tutorials**: Teach terminal workflows with animated examples.
6. **CI/CD Pipelines**: Generate GIFs for release notes.

---

## Comparison to Alternatives
| Feature | VHS | [asciinema](https://asciinema.org) | [termtosvg](https://github.com/nbedos/termtosvg) | [ttyrec](https://en.wikipedia.org/wiki/Ttyrec) |
|---------|-----|-----------------------------------|-----------------------------------------------|-----------------------------------------------|
| **Scriptable** | ✅ Yes (tape files) | ❌ No (records live) | ❌ No | ❌ No |
| **GIF Output** | ✅ Yes | ❌ No (SVG/HTML) | ✅ Yes | ❌ No |
| **MP4/WebM Output** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Custom Themes** | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| **Wait Conditions** | ✅ Yes (regex) | ❌ No | ❌ No | ❌ No |
| **Multi-Format** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Dependencies** | `ttyd`, `ffmpeg` | Python | Python, Inkscape | None |
| **Deterministic** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Cross-Platform** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

**Key Differentiators**:
- **Declarative Scripting**: Write terminal sessions as code (`.tape` files).
- **Multi-Format Output**: GIF, MP4, WebM, or PNG sequences.
- **Wait Conditions**: Pause until output matches a regex (for testing).
- **Theming**: Custom color themes and fonts.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/tape/` | Tape file parser and validator. |
| `/cmd/` | CLI commands (record, render, serve). |
| `/internal/` | Core logic (terminal, ffmpeg, ttyd). |
| `/examples/` | Example tape files. |
| `/THEMES.md` | List of built-in themes. |

---

## VHS Server
**Purpose**: Self-host VHS for remote rendering.

**Primitives**:
- **`vhs serve`**: Start an SSH server for VHS.
- **Configuration**: via environment variables (see below).

**Environment Variables**:
| Variable | Default | Description |
|----------|---------|-------------|
| `VHS_PORT` | `1976` | SSH server port |
| `VHS_HOST` | `localhost` | Host to bind to |
| `VHS_GID` | Current user’s GID | Group ID to run as |
| `VHS_UID` | Current user’s UID | User ID to run as |
| `VHS_KEY_PATH` | `.ssh/vhs_ed25519` | SSH key path |
| `VHS_AUTHORIZED_KEYS_PATH` | Empty | Authorized keys file (public access if empty) |

**Usage**:
```bash
# Start server
vhs serve

# Connect from client
ssh vhs.example.com < demo.tape > demo.gif
```

---

## Summary
VHS provides **declarative terminal session recording** with the following primitives:
1. **Tape File Format**: Script terminal actions (typing, scrolling, waiting).
2. **Terminal Configuration**: Font, size, theme, margins, etc.
3. **Input Simulation**: Type, Enter, Backspace, arrow keys, modifiers.
4. **Synchronization**: Sleep, regex-based waiting.
5. **Output Control**: GIF, MP4, WebM, or PNG frames.
6. **Modularity**: Include other tapes, set environment variables.
7. **Server Mode**: Self-host for remote rendering.

**Best For**: Creating **reproducible, scripted terminal demos** (GIFs/videos) for documentation, testing, or marketing.
**Avoid If**: You need **live recording without scripting** (use `asciinema` instead).
