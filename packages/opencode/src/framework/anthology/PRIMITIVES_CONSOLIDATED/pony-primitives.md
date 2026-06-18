# Pony Primitives Analysis

## Overview
**Pony** is a **declarative, type-safe markup language** for building **terminal user interfaces (TUIs)** in Go. It uses **[Ultraviolet](https://github.com/charmbracelet/ultraviolet)** as the rendering engine and integrates with **[Bubble Tea](https://github.com/charmbracelet/bubbletea)** for state management. Pony provides a **React-like** approach to TUI development, with:
- **XML-based markup** for defining UI structure.
- **Go templates** for dynamic content.
- **Custom components** (functional or type-based).
- **Stateful components** via slots.
- **Type safety** with Go generics.

**Purpose**: Declarative TUI development with Go templates.
**Language**: Go.
**Maturity**: Experimental (AI-generated, but functional).
**Dependencies**: Ultraviolet (rendering), `x/ansi` (ANSI parsing).

---

## Core Primitives

### 1. **Declarative Markup (XML-Based)**
**Purpose**: Define UI structure in a **declarative** way (similar to HTML/JSX).

**Primitives**:
- **XML-like syntax**: Define elements, attributes, and nested children.
- **Self-closing tags**: `<divider />` for elements without children.
- **Go template integration**: `{{ .Variable }}` for dynamic content.

**Example**:
```xml
<vstack spacing="1">
    <box border="rounded" border-color="cyan">
        <text font-weight="bold" foreground-color="yellow">{{ .Title }}</text>
    </box>
    <text>Count: {{ .Count }}</text>
</vstack>
```

**Key Features**:
- **Familiar Syntax**: Similar to HTML/JSX.
- **Type-Safe Templates**: Compile-time type checking with Go generics.
- **Nested Elements**: Supports arbitrary nesting of elements.

---

### 2. **Element Types**
**Purpose**: Predefined UI components for common TUI patterns.

#### **Containers (Layout)**
| Element | Description | Key Attributes |
|---------|-------------|----------------|
| `vstack` | Vertical stack (column layout) | `spacing`, `alignment` (leading/center/trailing), `width`, `height` |
| `hstack` | Horizontal stack (row layout) | `spacing`, `alignment` (top/center/bottom), `width`, `height` |
| `zstack` | Layered stack (overlays) | `alignment`, `vertical-alignment`, `width`, `height` |
| `box` | Generic container (like a `<div>`) | `border`, `border-color`, `padding`, `margin`, `width`, `height` |
| `flex` | Flexible sizing wrapper | `grow`, `shrink`, `basis` |
| `positioned` | Absolute positioning | `x`, `y`, `right`, `bottom`, `width`, `height` |
| `spacer` | Empty space | `size` (fixed) or flexible |

**Example**:
```xml
<!-- Vertical stack with spacing -->
<vstack spacing="1" alignment="center">
    <text>Item 1</text>
    <text>Item 2</text>
</vstack>

<!-- Horizontal stack -->
<hstack spacing="2" alignment="center">
    <text>Left</text>
    <text>Right</text>
</hstack>

<!-- Box with border -->
<box border="rounded" border-color="blue" padding="1">
    <text>Content</text>
</box>

<!-- Absolute positioning -->
<zstack>
    <box>Background</box>
    <positioned x="10" y="5">
        <text>Overlay</text>
    </positioned>
</zstack>
```

#### **Content Elements**
| Element | Description | Key Attributes |
|---------|-------------|----------------|
| `text` | Styled text | `foreground-color`, `background-color`, `font-weight`, `font-style`, `text-decoration`, `alignment`, `wrap` |
| `divider` | Horizontal/vertical separator | `style`, `vertical`, `char` |
| `scrollview` | Scrollable viewport | `height`, `scrollbar` |
| `slot` | Dynamic content placeholder | `name` |

**Example**:
```xml
<!-- Styled text -->
<text foreground-color="red" font-weight="bold" alignment="center">
    Error: File not found
</text>

<!-- Divider -->
<divider style="fg:gray" />

<!-- Scrollable content -->
<scrollview height="10" scrollbar="true">
    <text>Long content...</text>
</scrollview>

<!-- Slot for dynamic content -->
<slot name="content" />
```

#### **Built-in Components**
| Component | Description | Key Attributes |
|-----------|-------------|----------------|
| `badge` | Status indicator | `text`, `style` |
| `progressview` | Progress bar | `value`, `max`, `width`, `style` |
| `button` | Clickable button | `id`, `text`, `border`, `padding` |

**Example**:
```xml
<!-- Badge -->
<badge text="NEW" style="fg:green; bold" />

<!-- Progress bar -->
<progressview value="75" max="100" width="20" style="fg:green" />

<!-- Button -->
<button id="submit" text="Submit" border="rounded" padding="1" />
```

---

### 3. **Styling System**
**Purpose**: Apply colors, text styles, borders, and more to elements.

#### **Inline Styles (Markup)**
```xml
<text 
    foreground-color="red" 
    background-color="black" 
    font-weight="bold" 
    font-style="italic" 
    text-decoration="underline"
>
    Styled Text
</text>
```

#### **Style Attributes**
| Attribute | Values | Description |
|-----------|--------|-------------|
| `foreground-color` | Named, hex, RGB, ANSI | Text color |
| `background-color` | Named, hex, RGB, ANSI | Background color |
| `font-weight` | `bold` | Bold text |
| `font-style` | `italic` | Italic text |
| `text-decoration` | `underline`, `strikethrough` | Text decoration |
| `alignment` | `leading`, `center`, `trailing` | Text alignment |
| `wrap` | `true`, `false` | Word wrapping |

#### **Color Formats**
| Format | Example | Description |
|--------|---------|-------------|
| Named | `red`, `blue`, `green` | Predefined color names |
| Hex | `#FF5555`, `#282a36` | Hexadecimal color codes |
| RGB | `rgb(255,85,85)` | RGB values (0-255) |
| ANSI | `196` | ANSI 256-color index |

#### **Fluent API (Code)**
```go
text := pony.NewText("Hello").
    ForegroundColor(pony.Hex("#FF5555")).
    BackgroundColor(pony.RGB(40, 42, 54)).
    Bold().
    Italic().
    Alignment(pony.AlignmentCenter)
```

---

### 4. **Layout System**
**Purpose**: Control the size, spacing, and alignment of elements.

#### **Sizing**
| Value | Description | Example |
|-------|-------------|---------|
| `auto` | Content-based size (default) | `width="auto"` |
| Fixed | Fixed size in cells | `width="20"` |
| `%` | Percentage of available space | `width="50%"` |
| `min` | Minimum content size | `width="min"` |
| `max` | Maximum available space | `width="max"` |

**Example**:
```xml
<box width="50%">Half width</box>
<box width="20">Fixed width</box>
<box width="auto">Content width</box>
```

#### **Alignment**
| Element | Alignment Attributes | Values |
|---------|----------------------|--------|
| `text` | `alignment` | `leading`, `center`, `trailing` |
| `vstack` | `alignment` | `leading`, `center`, `trailing` |
| `hstack` | `alignment` | `top`, `center`, `bottom` |
| `zstack` | `alignment`, `vertical-alignment` | `leading`/`center`/`trailing`, `top`/`center`/`bottom` |

**Example**:
```xml
<vstack alignment="center">
    <text>Centered</text>
</vstack>

<hstack alignment="center">
    <text>Vertically Centered</text>
</hstack>
```

#### **Flexible Layout**
Use `<spacer>` or `<flex>` for dynamic sizing:
```xml
<!-- Spacer grows to fill space -->
<vstack>
    <text>Header</text>
    <spacer />
    <text>Footer</text>
</vstack>

<!-- Flex grow -->
<hstack>
    <box width="20">Fixed</box>
    <flex grow="1">
        <box>Grows 1x</box>
    </flex>
    <flex grow="2">
        <box>Grows 2x</box>
    </flex>
</hstack>
```

---

### 5. **Go Templates**
**Purpose**: Embed dynamic content in markup using Go’s `text/template` syntax.

#### **Variables**
```xml
<text>Hello, {{ .Username }}!</text>
```

#### **Conditionals**
```xml
{{ if .IsOnline }}
    <text style="fg:green">● Online</text>
{{ else }}
    <text style="fg:red">○ Offline</text>
{{ end }}
```

#### **Loops**
```xml
{{ range .Items }}
    <text>• {{ . }}</text>
{{ end }}
```

#### **Functions**
Built-in functions:
- `upper`, `lower`, `title`: String case conversion.
- `trim`: Remove whitespace.
- `join`: Join a slice into a string.
- `printf`: Format a string.
- `add`, `sub`, `mul`, `div`: Arithmetic.
- `repeat`: Repeat a string.

**Example**:
```xml
<text>{{ upper .Title }}</text>
<text>{{ printf "Count: %d" .Count }}</text>
```

---

### 6. **Template Parsing**
**Purpose**: Parse XML markup into a renderable template.

**Primitives**:
- **`pony.Parse[T](markup)`**: Parse markup into a `*Template[T]`.
- **`pony.MustParse[T](markup)`**: Parse markup and panic on error.
- **`Template[T].Render(data, width, height)`**: Render the template with data and dimensions.

**Example**:
```go
type ViewData struct {
    Title string
    Count int
}

const tmpl = `
<vstack spacing="1">
    <text font-weight="bold">{{ .Title }}</text>
    <text>Count: {{ .Count }}</text>
</vstack>
`

// Parse the template
t := pony.MustParse[ViewData](tmpl)

// Render with data
output := t.Render(ViewData{Title: "My App", Count: 42}, 80, 24)
fmt.Print(output)
```

---

### 7. **Custom Components**
**Purpose**: Extend Pony with reusable, custom components.

#### **Functional Components**
```go
// Register a simple functional component
pony.Register("card", func(props pony.Props, children []pony.Element) pony.Element {
    return pony.NewBox(
        pony.NewVStack(
            pony.NewText(props.Get("title")).Bold(),
            pony.NewDivider(),
            pony.NewVStack(children...),
        ),
    ).Border("rounded").Padding(1)
})
```

#### **Type-Based Components**
```go
// Define a custom component type
type Card struct {
    pony.BaseElement  // Required for ID and bounds tracking
    Title string
    Content []pony.Element
}

// Constructor
func NewCard(props pony.Props, children []pony.Element) pony.Element {
    return &Card{
        Title:  props.Get("title"),
        Content: children,
    }
}

// Draw implementation
func (c *Card) Draw(scr uv.Screen, area uv.Rectangle) {
    c.SetBounds(area)  // REQUIRED for hit testing
    
    card := pony.NewBox(
        pony.NewVStack(
            pony.NewText(c.Title).Bold(),
            pony.NewDivider(),
            pony.NewVStack(c.Content...),
        ),
    ).Border("rounded").Padding(1)
    
    card.Draw(scr, area)
}

// Layout implementation
func (c *Card) Layout(constraints pony.Constraints) pony.Size {
    card := pony.NewBox(
        pony.NewVStack(
            pony.NewText(c.Title).Bold(),
            pony.NewDivider(),
            pony.NewVStack(c.Content...),
        ),
    ).Border("rounded").Padding(1)
    
    return card.Layout(constraints)
}

// Children implementation
func (c *Card) Children() []pony.Element {
    return c.Content
}

// Register the component
pony.Register("card", NewCard)
```

**Usage in Markup**:
```xml
<card title="Profile">
    <text>Name: Alice</text>
    <text>Role: Developer</text>
</card>
```

---

### 8. **Stateful Components (Slots)**
**Purpose**: Create dynamic, stateful components using the **slot system**.

**Primitives**:
- **`<slot name="..." />`**: Placeholder for dynamic content in markup.
- **`RenderWithSlots(data, slots, width, height)`**: Render with slot replacements.

**Example**:
```xml
<!-- Template with slot -->
<vstack>
    <text>Username:</text>
    <slot name="input" />
</vstack>
```

```go
// Render with slot filled
slots := map[string]pony.Element{
    "input": inputComponent.Render(),
}
output := template.RenderWithSlots(data, slots, width, height)
```

---

### 9. **Bubble Tea Integration**
**Purpose**: Use Pony with **Bubble Tea** for stateful TUIs.

**Example**:
```go
import (
    tea "charm.land/bubbletea/v2"
    "github.com/charmbracelet/x/pony"
)

type ViewData struct {
    Count int
}

type model struct {
    template *pony.Template[ViewData]
    count   int
    width   int
    height  int
}

func NewModel() model {
    const tmpl = `<text>Count: {{ .Count }}</text>`
    return model{
        template: pony.MustParse[ViewData](tmpl),
    }
}

func (m model) Init() tea.Cmd {
    return tea.RequestWindowSize
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        m.width = msg.Width
        m.height = msg.Height
    case tea.KeyPressMsg:
        if msg.String() == "space" {
            m.count++
        }
    }
    return m, nil
}

func (m model) View() tea.View {
    data := ViewData{Count: m.count}
    output := m.template.Render(data, m.width, m.height)
    return tea.NewView(output)
}

func main() {
    p := tea.NewProgram(NewModel())
    p.Start()
}
```

---

### 10. **Mouse Click Handling**
**Purpose**: Handle mouse interactions (clicks, hovers) in Pony components.

**Primitives**:
- **`Bounds()`**: Get the last rendered bounds of an element.
- **`SetBounds(area)`**: Set the bounds of an element (call in `Draw`).
- **`BaseElement`**: Embed in custom components for bounds tracking.

**Example**:
```go
type Button struct {
    pony.BaseElement
    Text string
    OnClick func()
}

func (b *Button) Draw(scr uv.Screen, area uv.Rectangle) {
    b.SetBounds(area)  // Required for hit testing
    
    btn := pony.NewBox(
        pony.NewText(b.Text).Alignment(pony.AlignmentCenter),
    ).Border("rounded").Padding(1)
    
    btn.Draw(scr, area)
}

func (b *Button) HandleClick(x, y int) {
    if b.Bounds().Contains(x, y) && b.OnClick != nil {
        b.OnClick()
    }
}
```

---

## Technical Insights

### **Architecture**
1. **Markup Parsing**: XML markup is parsed into an **element tree** (`parser.go`).
2. **Template Rendering**: Templates are rendered using **Go’s `text/template`** for dynamic content.
3. **Layout Engine**: Uses **Ultraviolet** for **constraint-based layout** (like CSS Flexbox).
4. **Rendering**: Elements are drawn onto a **Ultraviolet `Screen`** buffer.
5. **Bubble Tea Integration**: Works seamlessly with **Bubble Tea** for state management.

### **Element Interface**
All Pony elements implement the `Element` interface:
```go
type Element interface {
    uv.Drawable  // Draw(scr uv.Screen, area uv.Rectangle)
    Layout(constraints Constraints) Size  // Calculate size
    Children() []Element  // Return child elements
    ID() string  // Element identifier
    SetID(id string)  // Set identifier
    Bounds() uv.Rectangle  // Last rendered bounds
    SetBounds(bounds uv.Rectangle)  // Set bounds (for hit testing)
}
```

### **Constraints-Based Layout**
Pony uses **Ultraviolet’s constraint system** for layout:
- **`Constraints`**: Min/max width and height for an element.
- **`Size`**: The calculated size of an element.
- **Layout Pass**: Elements compute their size based on constraints and children.

### **Performance**
- **Efficient Rendering**: Only **dirty** elements are re-rendered.
- **Caching**: Templates are **parsed once** and reused.
- **Lazy Evaluation**: Go templates are evaluated **on-demand**.

### **Type Safety**
- **Generics**: Templates are **type-safe** via Go generics (`Template[T]`).
- **Compile-Time Checks**: Invalid data types are caught at **compile time**.

---

## Integration Patterns

### **1. Basic Static UI**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/pony"
)

func main() {
    const tmpl = `
        <vstack spacing="1" alignment="center">
            <text font-weight="bold">Hello, Pony!</text>
            <text>Welcome to declarative TUIs.</text>
        </vstack>
    `
    
    t := pony.MustParse[interface{}](tmpl)
    output := t.Render(nil, 80, 24)
    fmt.Print(output)
}
```

### **2. Dynamic Data with Go Templates**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/pony"
)

type User struct {
    Name string
    Age  int
}

func main() {
    const tmpl = `
        <vstack spacing="1">
            <text>Name: {{ .Name }}</text>
            <text>Age: {{ .Age }}</text>
        </vstack>
    `
    
    t := pony.MustParse[User](tmpl)
    output := t.Render(User{Name: "Alice", Age: 30}, 80, 24)
    fmt.Print(output)
}
```

### **3. Conditional Rendering**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/pony"
)

type Status struct {
    IsOnline bool
}

func main() {
    const tmpl = `
        {{ if .IsOnline }}
            <text style="fg:green">● Online</text>
        {{ else }}
            <text style="fg:red">○ Offline</text>
        {{ end }}
    `
    
    t := pony.MustParse[Status](tmpl)
    output := t.Render(Status{IsOnline: true}, 80, 24)
    fmt.Print(output)
}
```

### **4. Custom Component with Logic**
```go
package main

import (
    "fmt"
    "github.com/charmbracelet/x/pony"
)

// Define a counter component
type Counter struct {
    pony.BaseElement
    Count int
}

func NewCounter(props pony.Props, children []pony.Element) pony.Element {
    return &Counter{
        Count: props.GetInt("initial", 0),
    }
}

func (c *Counter) Draw(scr uv.Screen, area uv.Rectangle) {
    c.SetBounds(area)
    
    text := pony.NewText(fmt.Sprintf("Count: %d", c.Count)).
        ForegroundColor(pony.Hex("#FF5555"))
    
    text.Draw(scr, area)
}

func (c *Counter) Layout(constraints pony.Constraints) pony.Size {
    text := pony.NewText(fmt.Sprintf("Count: %d", c.Count))
    return text.Layout(constraints)
}

func (c *Counter) Children() []pony.Element {
    return nil
}

func main() {
    // Register the component
    pony.Register("counter", NewCounter)
    
    const tmpl = `<counter initial="5" />`
    t := pony.MustParse[interface{}](tmpl)
    output := t.Render(nil, 80, 24)
    fmt.Print(output)
}
```

### **5. Full Bubble Tea App**
```go
package main

import (
    tea "charm.land/bubbletea/v2"
    "github.com/charmbracelet/x/pony"
)

type ViewData struct {
    Count int
}

type model struct {
    template *pony.Template[ViewData]
    count   int
    width   int
    height  int
}

func NewModel() model {
    const tmpl = `
        <vstack spacing="1" alignment="center">
            <text font-weight="bold">Count: {{ .Count }}</text>
            <text>Press space to increment</text>
        </vstack>
    `
    return model{
        template: pony.MustParse[ViewData](tmpl),
    }
}

func (m model) Init() tea.Cmd {
    return tea.RequestWindowSize
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        m.width = msg.Width
        m.height = msg.Height
    case tea.KeyPressMsg:
        if msg.String() == "space" {
            m.count++
        } else if msg.String() == "q" {
            return m, tea.Quit
        }
    }
    return m, nil
}

func (m model) View() tea.View {
    data := ViewData{Count: m.count}
    output := m.template.Render(data, m.width, m.height)
    return tea.NewView(output)
}

func main() {
    p := tea.NewProgram(NewModel())
    p.Start()
}
```

---

## Use Cases
1. **Declarative TUIs**: Build TUIs using **XML markup** instead of imperative Go code.
2. **Dynamic Content**: Use **Go templates** for data-driven UIs.
3. **Custom Components**: Create **reusable components** (like React).
4. **Stateful Apps**: Combine with **Bubble Tea** for state management.
5. **Prototyping**: Quickly prototype TUI layouts.
6. **Theming**: Apply **consistent styles** across components.
7. **Complex Layouts**: Use **flexbox-like** layout systems (VStack, HStack, ZStack).

---

## Comparison to Alternatives
| Feature | Pony | [Bubble Tea](https://github.com/charmbracelet/bubbletea) | [tview](https://github.com/rivo/tview) | [React (JSX)](https://react.dev) |
|---------|------|---------------------------------------------------------|----------------------------------------|----------------------------------|
| **Declarative** | ✅ Yes | ❌ No (imperative) | ❌ No (imperative) | ✅ Yes |
| **Markup Syntax** | ✅ Yes (XML) | ❌ No | ❌ No | ✅ Yes (JSX) |
| **Go Templates** | ✅ Yes | ❌ No | ❌ No | ❌ N/A |
| **Type Safety** | ✅ Yes (generics) | ❌ No | ❌ No | ✅ Yes (TypeScript) |
| **Custom Components** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Layout System** | ✅ Yes (Ultraviolet) | ❌ No (manual) | ✅ Yes (flexbox-like) | ✅ Yes (CSS) |
| **Bubble Tea Integration** | ✅ Yes | ✅ N/A | ❌ No | ❌ N/A |
| **Styling** | ✅ Yes (inline + fluent) | ❌ No (manual) | ✅ Yes | ✅ Yes (CSS) |
| **Mouse Support** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Maturity** | ⚠️ Experimental | ✅ Production | ✅ Production | ✅ Production |

**Key Differentiators**:
- **Declarative Markup**: Define UIs in **XML** (similar to HTML/JSX).
- **Go Templates**: Use **Go’s `text/template`** for dynamic content.
- **Type-Safe**: Compile-time type checking with **Go generics**.
- **Ultraviolet Integration**: Uses **Ultraviolet** for **constraint-based layout**.
- **Bubble Tea Integration**: Works seamlessly with **Bubble Tea** for state management.

---

## Key Files
| Path | Purpose |
|------|---------|
| `/element.go` | Core `Element` interface and types. |
| `/box.go` | `Box` container element. |
| `/text.go` | `Text` element with styling. |
| `/container.go` | `VStack`, `HStack` container implementations. |
| `/zstack.go` | `ZStack` (layering/overlay) element. |
| `/flex.go` | `Flex` wrapper for flexible sizing. |
| `/positioned.go` | `Positioned` element (absolute positioning). |
| `/spacer.go` | `Spacer` element (fixed/flexible). |
| `/divider.go` | `Divider` element. |
| `/scrollview.go` | `ScrollView` with scrollbar support. |
| `/button.go` | `Button` component. |
| `/template.go` | `Template[T]` type with Go template integration. |
| `/parser.go` | XML parser (markup → element tree). |
| `/slot.go` | Slot system for dynamic content. |
| `/style.go` | Style parsing and fluent API. |
| `/registry.go` | Global component registry. |
| `/bounds.go` | Bounds tracking and hit testing. |

---

## Summary
**Pony** is a **declarative, type-safe markup language** for building **terminal UIs** in Go, providing:

1. **XML-Based Markup**: Define UIs in a **declarative** way (similar to HTML/JSX).
2. **Go Templates**: Embed **dynamic content** using Go’s `text/template` syntax.
3. **Custom Components**: Create **reusable components** (functional or type-based).
4. **Stateful Slots**: Use **slots** for dynamic, stateful content.
5. **Type Safety**: Compile-time type checking with **Go generics**.
6. **Layout System**: **Flexbox-like** layout with **VStack**, **HStack**, **ZStack**, etc.
7. **Styling**: Inline styles (markup) or fluent API (code).
8. **Bubble Tea Integration**: Works seamlessly with **Bubble Tea** for state management.
9. **Ultraviolet Rendering**: Uses **Ultraviolet** for **constraint-based layout** and rendering.
10. **Mouse Support**: Built-in **mouse click handling** via bounds tracking.

**Best For**: Building **complex TUIs** with a **declarative, React-like** approach in Go.
**Avoid If**: You prefer **imperative** TUI development (use **Bubble Tea** directly).

**Note**: Pony is **experimental** and primarily **AI-generated**. Use at your own risk, but it’s a promising approach for **declarative TUIs** in Go!
