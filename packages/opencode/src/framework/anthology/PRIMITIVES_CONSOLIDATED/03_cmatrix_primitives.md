# CMatrix Terminal Primitives Report

## Overview
CMatrix is a classic terminal animation demonstrating the "Matrix rain" effect. It's a single-file C program showcasing terminal animation techniques.

## Root Primitives

### 1. Terminal Setup (ncurses)
**Key Functions:**
- initscr() - Initialize ncurses
- cbreak() - Disable line buffering
- noecho() - Don't echo input
- curs_set(0) - Hide cursor
- timeout(0) - Non-blocking input
- start_color() - Enable colors

### 2. Double-Buffered Screen
**Pattern:**
- 2D array for screen state (matrix[][])
- 1D array for drop head positions
- Update off-screen, then render with addch()

### 3. Animation Loop Structure
```
while (!done):
    check_input()
    update_matrix()  // Move drops down
    draw_screen()    // Render to terminal
    refresh()        // Flush to screen
    napms(delay)     // Frame timing
```

### 4. Color Cycling
**ncurses Color API:**
- init_pair(id, fg, bg) - Define color pairs
- COLOR_PAIR(n) | A_BOLD - Apply with attributes
- Multiple pairs for head vs trail

### 5. Falling Drop Logic
- Each column tracks head position
- Head moves down each frame
- Leaves trailing characters behind
- Randomly reset to top for continuous effect
- Hybrid/sync mode for varied patterns

### 6. Random Character Selection
- Alternates between numbers and letters
- Per-drop randomness for variety
- Optional first-line init for staggered start

### 7. Input Handling
- Non-blocking getch()
- 'q' to quit
- 'a' toggle async/sync mode
- 'b' toggle bold
- SPACE to pause
- KEY_RESIZE handling

### 8. Screen Resize Handling
- Detect KEY_RESIZE
- endwin()/refresh() to re-query size
- Reallocate matrix arrays
- Preserve animation state

## Reusable Patterns

### 1. Terminal Animation Loop (Universal)
Any terminal animation follows this pattern:
- Setup terminal (raw mode, hide cursor)
- Loop: input -> update -> render -> sync -> delay
- Cleanup on exit

### 2. Column-Based Animation
- Each column independently animated
- Track state per column (position, speed, etc.)
- Independent timing creates organic effect
- Non-uniform = more natural looking

### 3. Trail Effect
- Store history of positions
- Fade old positions (change color/character)
- Create visual persistence
- Multiple trail segments for smooth effect

### 4. Graceful Resize
- Detect resize event
- Reallocate all buffers
- Preserve as much state as possible
- Re-render immediately

### 5. Frame Timing Control
- napms() for frame delay
- Adjustable speed via command-line
- Balance smoothness vs CPU usage

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Terminal Init | 5/5 | High | ncurses/crossterm/tcell all support |
| Animation Loop | 5/5 | Universal | Core game loop pattern |
| Color Pairs | 5/5 | High | All TUI libs support |
| Double Buffer | 5/5 | Universal | Essential pattern |
| Resize Handling | 4/5 | High | Event-based in modern libs |
| Random Text | 5/5 | Universal | Trivial to port |

## Implementation in Other Languages

### Rust (crossterm):
Use terminal.draw() closure, thread::sleep for timing

### Go (tcell):
screen.Init(), screen.Clear(), screen.Show() in loop

### Python (curses):
curses.wrapper(main), stdscr.refresh()

## Files of Interest
- cmatrix/cmatrix.c - Complete implementation (~26KB single file)

## Lessons for TUI Development
1. Always handle resize gracefully
2. Use non-blocking input for animations
3. Double-buffer to prevent flicker
4. Keep frame timing consistent
5. Provide clean exit on user input
6. Command-line options for behavior tuning
