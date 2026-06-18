# Dotgrid Terminal Primitives Report

## Overview
Dotgrid is a vector graphics editor that outputs SVG. It uses a dot-grid snapping system for precise geometric design.

## Root Primitives

### 1. Grid/Snap System
**Pattern:**
- Configurable grid size (dots)
- Snap-to-grid for all operations
- Visual grid rendering
- Coordinate transformation (screen <-> grid)

### 2. Vector Path System
- Points with x/y coordinates
- Line segments between points
- Curve support (Bezier, etc.)
- Path closure (shapes)

### 3. SVG Output
- Path element generation
- Stroke/fill attributes
- ViewBox calculation
- Export serialization

### 4. Interactive Drawing
- Mouse/touch input handling
- Point placement with snap
- Drag-and-drop editing
- Undo/redo stack

### 5. Visual Feedback
- Grid rendering
- Preview of in-progress shapes
- Highlight selected points
- Anchor point visualization

## Terminal Application Relevance

### Adaptations for TUI:
1. **ASCII Grid Display**
   - Use Unicode box-drawing characters for grid
   - Character-based coordinate system
   
2. **Text-Based Vector Preview**
   - Bresenham line drawing for previews
   - Character-based shape rendering
   
3. **Keyboard-Driven Input**
   - Arrow keys for position
   - Hotkeys for operations
   - Modal editing (vim-style)

4. **SVG-to-ASCII Conversion**
   - Parse SVG paths
   - Rasterize to character grid
   - Use appropriate Unicode characters

## Cross-Language Applicability

| Primitive | Reusability | Portability | Notes |
|-----------|-------------|-------------|-------|
| Grid System | 5/5 | Universal | Pure math |
| Path Data Structure | 5/5 | Universal | Simple structs |
| SVG Generation | 4/5 | High | XML serialization |
| Snap Logic | 5/5 | Universal | Coordinate math |
| Undo Stack | 5/5 | Universal | Command pattern |

## Files of Interest
- Dotgrid/index.html - Complete implementation (~114KB)
- Dotgrid/links/ - External resources
