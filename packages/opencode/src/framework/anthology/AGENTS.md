# ANTHOLOGY

## Purpose

A comprehensive knowledge base for terminal UI (TUI) development, covering 20 fundamental topics from terminal escape sequences to production runtime architecture. Includes consolidated primitives for 30+ TUI libraries and frameworks.

## Ownership

This is a reference knowledge base for TUI development patterns, architecture, and implementation techniques.

## Local Contracts

- All content is reference material for TUI development
- Primitives directory contains library-specific implementation patterns
- Use as a lookup resource when building terminal applications

## Work Guidance

When building TUI applications:

1. Start with `01_TERMINAL_FUNDAMENTALS.md` for escape sequences and PTY basics
2. Reference `02_RENDERING_ARCHITECTURE.md` for rendering pipelines
3. Use `05_STATE_MANAGEMENT.md` for application state patterns
4. Consult `PRIMITIVES_CONSOLIDATED/` for library-specific implementations

## Verification

- Verify escape sequences against terminal emulator documentation
- Test rendering patterns in target terminal (kitty, alacritty, wezterm)
- Validate state management against actual application behavior

## Child DOX Index

- `01_TERMINAL_FUNDAMENTALS.md` — Escape sequences, PTY, terminal stack
- `02_RENDERING_ARCHITECTURE.md` — Rendering pipelines, double buffering
- `03_LAYOUT_SYSTEMS.md` — Flexbox-like layout for TUI
- `04_INPUT_SYSTEMS.md` — Keyboard, mouse, paste handling
- `05_STATE_MANAGEMENT.md` — Application state patterns
- `06_ANIMATION_SYSTEMS.md` — Animation and transition systems
- `07_SCROLLING_SYSTEMS.md` — Scrollback and viewport management
- `08_TEXT_RENDERING.md` — Text shaping, Unicode, fonts
- `09_WIDGET_ARCHITECTURE.md` — Widget composition patterns
- `10_MULTI_PANE_WORKSPACES.md` — Pane management and splits
- `11_CONCURRENCY_ARCHITECTURE.md` — Async patterns for TUI
- `12_AI_AGENT_VISUALIZATION.md` — Visualizing AI agent state
- `13_DATA_VISUALIZATION.md` — Charts and data display
- `14_THEMING_SYSTEMS.md` — Color schemes and theming
- `15_ACCESSIBILITY.md` — Accessibility in terminal apps
- `16_PERSISTENCE.md` — Data persistence patterns
- `17_NETWORKING.md` — Network protocols for TUI
- `18_PERFORMANCE_ENGINEERING.md` — Performance optimization
- `19_PLUGIN_ARCHITECTURE.md` — Plugin systems
- `20_PRODUCTION_RUNTIME_ARCHITECTURE.md` — Production deployment
- `PRIMITIVES_CONSOLIDATED/` — Library-specific primitives (30+ libraries)
