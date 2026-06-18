# Gum - Shell Scripting Utility Primitives

## Overview

Gum is a collection of shell utilities for writing interactive scripts. Each command is a standalone TUI tool that can be composed in shell pipelines. Unlike library-based approaches (huh, bubbletea), gum provides CLI-first primitives.

---

## 1. Core Architecture: CLI Commands as Primitives

**Primitive:** Each utility is an independent CLI command with consistent flags

```bash
# Input primitives
gum input          # Single-line text input
gum write          # Multi-line text editor
gum confirm        # Yes/no confirmation
gum choose         # Select from options
gum filter         # Searchable selection

# Display primitives
gum format         # Render styled text
gum style          # Apply ANSI styling
gum table          # Display tabular data

# Progress primitives
gum spin           # Spinner with command
gum progress       # Progress bar
gum log            # Log entries

# Utility primitives
gum file           # File picker
gum date           # Date selector
gum join           # Join text with separator
gum pager          # Scrollable viewer
```

---

## 2. Input Primitives

### 2.1 Single-Line Input

```bash
# Basic usage
name=$(gum input --placeholder "Your name")

# With validation
email=$(gum input \
  --placeholder "Email" \
  --validate "^[^@]+@[^@]+\.[^@]+$" \
  --error.message "Invalid email")

# Password mode
password=$(gum input --password --placeholder "Password")

# With suggestions
command=$(gum input \
  --value "git " \
  --suggest \
  --options "git commit,git push,git pull,git status")
```

**Implementation Pattern:**

```python
def gum_input(
    placeholder: str = "",
    value: str = "",
    password: bool = False,
    validate: Optional[str] = None,
    error_message: str = "Invalid input",
    suggestions: list[str] = None,
    width: int = 50,
    header: str = "",
) -> str:
    """Single-line text input with validation"""
    # Use bubbles textinput
    # Return entered value or empty on abort
    ...
```

### 2.2 Multi-Line Editor

```bash
# Capture multi-line input
notes=$(gum write --placeholder "Enter notes...")

# With title and limit
description=$(gum write \
  --title "Description" \
  --placeholder "Describe your change" \
  --width 60 \
  --height 10 \
  --show-line-numbers)

# Pre-populated content
updated=$(gum write --value "$existing_content")
```

**Features:**
- Scrollable viewport
- Line numbers (optional)
- Configurable width/height
- Pre-populated value

### 2.3 Confirmation

```bash
# Simple confirm
if gum confirm "Are you sure?"; then
    echo "Confirmed"
else
    echo "Aborted" >&2
    exit 1
fi

# With custom labels
if gum confirm \
    --affirmative="Yes, delete" \
    --negative="No, keep" \
    "Delete production database?"; then
    ...
fi

# With timeout (auto-select default)
if gum confirm --timeout=5 --default=yes "Continue?"; then
    ...
fi
```

**Return Codes:**
- 0: Confirmed (yes)
- 1: Aborted (no)
- 2: Timeout

### 2.4 Choice Selection

```bash
# Single choice
option=$(gum choose --cursor ">" "Option A" "Option B" "Option C")

# With limit
env=$(gum choose --limit=1 "dev" "staging" "production")

# Multiple selection
tags=$(gum choose \
  --limit=3 \
  --selected.prefix="[x] " \
  --unselected.prefix="[ ] " \
  --cursor "* " \
  feature1 feature2 feature3 bugfix docs)

# With numbered items
item=$(gum choose --numbered "First" "Second" "Third")
```

**Features:**
- Single or multiple selection
- Custom cursors and prefixes
- Numbered options
- Selection limit
- Timeout support

### 2.5 Filter/Search

```bash
# Searchable list
service=$(gum filter \
  --placeholder "Search services..." \
  --no-limit \
  $(kubectl get services -o name)

# Fuzzy matching
file=$(gum filter \
  --fuzzy \
  --height=20 \
  $(find . -type f -name "*.go"))

# Pre-selected items
selected=$(gum filter \
  --selected "default-item" \
  item1 item2 item3)
```

**Features:**
- Fuzzy or exact matching
- Single or multi-select
- Custom placeholder
- Height-limited viewport
- Pre-selection

---

## 3. Display Primitives

### 3.1 Formatted Text

```bash
# Markdown rendering
gum format <<EOF
# Heading

Some **bold** and *italic* text

- List item 1
- List item 2

\`\`\`go
fmt.Println("Hello")
\`\`\`
EOF

# Different formats
echo "PATH: $PATH" | gum format --type code
echo "# Title" | gum format --type markdown
echo "Plain text" | gum format --type template
```

**Format Types:**
- `markdown` - Render markdown with glamour
- `code` - Syntax highlighted code
- `template` - Go template rendering
- `markdown+code` - Combined

### 3.2 Styling

```bash
# Apply ANSI styles
gum style \
  --foreground=212 \
  --background=236 \
  --bold \
  --italic \
  --underline \
  --padding "1 2" \
  --margin "1 2" \
  --border double \
  "Styled Text"

# Chain multiple styled blocks
gum style "Regular" \
  && gum style --bold --fg=196 "Bold Red" \
  && gum style --italic --fg=21 "Italic Blue"
```

**Style Options:**
- Foreground/background colors (0-255 or hex)
- Bold, italic, underline, strikethrough, reverse
- Padding and margin
- Border styles (normal, rounded, double, etc.)

### 3.3 Table Display

```bash
# From stdin (TSV)
echo -e "Name\tAge\tCity\nAlice\t30\tNYC\nBob\t25\tLA" | gum table

# With custom delimiter
cat data.csv | gum table --delimiter=","

# Column-specific styling
gum table \
  --columns="Name:20,Age:5,City:15" \
  --border=rounded \
  data.tsv
```

**Features:**
- Auto-column width
- Custom delimiters
- Border styles
- Column width hints

---

## 4. Progress Primitives

### 4.1 Spinner

```bash
# Wrap a command
gum spin --title "Building..." -- ./build.sh

# Show output on failure
gum spin \
  --title "Deploying..." \
  --show-output \
  -- ./deploy.sh

# Custom spinner styles
gum spin \
  --spinner=dot \
  --title "Loading..." \
  -- ./load.sh

# Spinner types: line, dot, minidot, jump, pulse, points, gap, material
```

**Return Behavior:**
- Runs command, shows spinner
- Shows command output on failure
- Suppresses output on success (unless --show-output)

### 4.2 Progress Bar

```bash
# Manual progress
(
  for i in $(seq 1 100); do
    echo $i
    sleep 0.1
  done
) | gum progress --total=100 --title "Processing..."

# With show-output for command progress
tar -xzf archive.tar.gz 2>&1 | gum progress --title "Extracting..."
```

**Features:**
- Manual progress via stdin numbers
- Automatic progress from output
- Custom title and style
- Percentage display

### 4.3 Logging

```bash
# Log levels
gum log --level=info "Application started"
gum log --level=warn "Low disk space"
gum log --level=error "Connection failed"
gum log --level=debug "Verbose details"

# With timestamp
gum log --timestamp --level=info "Message"

# Styled output
gum log \
  --level=error \
  --time-format=2006-01-02 \
  "Critical failure"
```

**Log Levels:**
- `debug` - Faint, detailed
- `info` - Normal, informational
- `warn` - Yellow, caution
- `error` - Red, errors
- `fatal` - Bold red, critical

---

## 5. File System Primitives

### 5.1 File Picker

```bash
# Select a file
file=$(gum file --path="$HOME" --cursor="> ")

# Filter by type
config=$(gum file \
  --path="/etc" \
  --glob="*.conf" \
  --cursor="* ")

# Multiple selection
files=$(gum file \
  --path="." \
  --all \
  --limit=5)
```

**Features:**
- Directory navigation (../, Enter)
- Glob filtering
- Hidden file option
- Single or multiple selection

### 5.2 Date Selector

```bash
# Select a date
birthday=$(gum date --year-range=100)

# With format
formatted=$(gum date \
  --format="2006-01-02" \
  --date-format="Monday, January 2, 2006")

# With selections
meeting=$(gum date \
  --selected-dates=2024-01-15 \
  --first-day-of-week=Monday)
```

---

## 6. Composition Patterns

### 6.1 Pipeline Composition

```bash
# Chain commands
service=$(gum choose --limit=1 api web worker)
env=$(gum choose --limit=1 dev staging prod)
confirm=$(gum confirm "Deploy $service to $env?")

# Use in shell pipelines
gum filter --fuzzy < /usr/share/dict/words | \
  gum format --type markdown | \
  gum pager
```

### 6.2 Script Templates

```bash
#!/bin/bash
# Interactive deployment script

set -e

# Gather input
service=$(gum choose --cursor="→ " "api" "web" "worker")
env=$(gum choose --cursor="→ " "dev" "staging" "production")
version=$(gum input --placeholder "Version (e.g., v1.2.3)" --value "v")

# Confirm
if ! gum confirm "Deploy $service $version to $env?"; then
    gum log --level=error "Aborted"
    exit 1
fi

# Execute with progress
gum spin --title "Deploying..." -- \
    kubectl set image deployment/$service $service=$service:$version \
    --namespace=$env

gum log --level=info "Deployment complete!"
```

### 6.3 Menu Systems

```bash
#!/bin/bash
# Main menu

while true; do
    action=$(gum choose \
        --cursor="▶ " \
        --limit=1 \
        "📦 Deploy" \
        "🔍 View Logs" \
        "⚙️  Configure" \
        "❌ Exit")
    
    case "$action" in
        "📦 Deploy")
            ./deploy.sh
            ;;
        "🔍 View Logs")
            gum pager < logs.txt
            ;;
        "⚙️  Configure")
            ./config.sh
            ;;
        "❌ Exit")
            gum style "Goodbye!" --foreground=212
            exit 0
            ;;
    esac
done
```

---

## 7. Shell Integration

### 7.1 Return Codes

| Command | Success | Abort | Error |
|---------|---------|-------|-------|
| input | 0 | 130 (Ctrl+C) | - |
| confirm | 0 (yes) | 1 (no) | 2 (timeout) |
| choose | 0 | 130 | - |
| filter | 0 | 130 | - |
| spin | command's exit | 130 | - |

### 7.2 Environment Variables

```bash
export GUM_INPUT_CURSOR=">"
export GUM_CHOOSE_CURSOR="▶ "
export GUM_CHOOSE_SELECTED_PREFIX="✓ "
export GUM_FORMAT_THEME="dark"
export GUM_SPIN_SPINNER="dot"
```

### 7.3 Escaping and Quoting

```bash
# Preserve formatting in variables
message=$(gum format "# Hello")
echo "$message"  # Preserves ANSI codes

# Use printf for complex cases
printf "%s\n" "$(gum style --bold "Text")"
```

---

## 8. Implementation Patterns for Other Languages

### 8.1 Python CLI Utilities

```python
#!/usr/bin/env python3
# gum-like input utility

import sys
from rich.console import Console
from rich.prompt import Prompt
from rich.style import Style

def main():
    console = Console()
    
    # Parse arguments
    placeholder = "--placeholder" in sys.argv
    value = ""
    for i, arg in enumerate(sys.argv):
        if arg == "--placeholder" and i + 1 < len(sys.argv):
            placeholder = sys.argv[i + 1]
        elif arg == "--value" and i + 1 < len(sys.argv):
            value = sys.argv[i + 1]
    
    # Get input
    result = Prompt.ask(
        "Enter value",
        default=value if value else None,
        console=console
    )
    
    print(result)

if __name__ == "__main__":
    main()
```

### 8.2 Rust CLI Utilities

```rust
// gum-like choose utility
use inquire::{Select, InquireError};

fn main() -> Result<(), InquireError> {
    let args: Vec<String> = std::env::args().collect();
    let options = &args[1..];
    
    if options.is_empty() {
        eprintln!("Usage: choose <option1> [option2] ...");
        std::process::exit(1);
    }
    
    let ans = Select::new("Select an option:", options.to_vec())
        .prompt()?;
    
    println!("{}", ans);
    Ok(())
}
```

### 8.3 TypeScript/Node Utilities

```typescript
#!/usr/bin/env node
// gum-like filter utility

import { Select } from '@inquirer/prompts';

const [,, ...options] = process.argv;

if (options.length === 0) {
    console.error('Usage: filter <option1> [option2] ...');
    process.exit(1);
}

const answer = await Select({
    message: 'Select:',
    choices: options.map(o => ({ name: o, value: o })),
});

console.log(answer);
```

---

## 9. Advantages of CLI-First Approach

### 9.1 Composability

```bash
# Each tool does one thing well
gum input | gum format | gum pager

# Easy to replace
gum choose | fzf | gum style --bold

# Pipeline-friendly
grep "error" logs.txt | gum filter --fuzzy
```

### 9.2 Language Agnostic

```bash
# Works in any shell
bash script.sh      # Uses gum
zsh script.zsh      # Uses gum
fish script.fish    # Uses gum
sh script.sh        # Uses gum

# No import/package needed
./script.sh         # Just needs gum in PATH
```

### 9.3 Testing

```bash
# Easy to test with pipes
echo "yes" | gum confirm  # Returns 0
echo "" | gum choose a b  # Returns "a"

# Mock in tests
alias gum='echo "mocked"'
```

---

## 10. Implementation Checklist

### Core Input Utilities

- [ ] Single-line input with validation
- [ ] Multi-line text editor
- [ ] Yes/No confirmation
- [ ] Single choice selection
- [ ] Multiple choice selection
- [ ] Filterable/searchable selection

### Display Utilities

- [ ] Markdown formatting
- [ ] ANSI styling
- [ ] Table display
- [ ] Pager/scrolling viewer

### Progress Utilities

- [ ] Spinner with command wrapper
- [ ] Progress bar
- [ ] Structured logging

### File Utilities

- [ ] File/directory picker
- [ ] Date selector

### Shell Integration

- [ ] Consistent return codes
- [ ] Environment variable configuration
- [ ] Pipeline compatibility
- [ ] Timeout support

---

## Summary

Gum provides shell-first TUI primitives with:

1. **CLI-First Design**: Each utility is a standalone command
2. **Pipeline Composition**: Easy chaining in shell scripts
3. **Consistent UX**: Unified styling and behavior
4. **Return Code Semantics**: Scriptable success/abort detection
5. **Zero-Import Usage**: No package management in scripts
6. **Language Agnostic**: Works in bash, zsh, fish, sh

The pattern is ideal for:
- Shell scripts needing interactivity
- DevOps automation
- Quick CLI tools without full application overhead
- Composable utility ecosystems

For other languages: create a suite of single-purpose CLI tools with consistent flags and output that can be composed in pipelines.