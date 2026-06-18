# Wish & Wishlist - SSH/TUI Bridge Primitives

## Overview

**Wish** is a middleware framework for building SSH servers that serve TUI applications. **Wishlist** is a directory/server listing for SSH-accessible TUI applications. Together, they enable deploying terminal applications over SSH with minimal boilerplate.

---

## Part 1: Wish - SSH Middleware for TUI

### 1. Core Architecture: SSH Middleware Pattern

**Primitive:** Middleware chain wraps TUI handlers

```go
// Middleware signature
type Middleware func(next ssh.Handler) ssh.Handler

// Server setup
server := wish.NewServer(
    wish.WithAddress(":2222"),
    wish.WithHostKeyPath("./id_ed25519"),
    wish.WithMiddleware(
        logging.Middleware(),      // Log connections
        auth.Middleware(),         // Handle auth
        bubbleteapath.Middleware(), // Serve Bubble Tea app
    ),
)
```

**Language-Agnostic Pattern:**

```python
# Python equivalent
class SSHMiddleware(ABC):
    @abstractmethod
    def wrap(self, handler: 'SSHHandler') -> 'SSHHandler':
        pass

class LoggingMiddleware(SSHMiddleware):
    def wrap(self, handler):
        def wrapped(session: SSHSession):
            log(f"Connection from {session.client}")
            return handler(session)
        return wrapped

class BubbleTeaMiddleware(SSHMiddleware):
    def __init__(self, app_factory: Callable[[], Model]):
        self.app_factory = app_factory
    
    def wrap(self, handler):
        def wrapped(session):
            # Set up Bubble Tea with session I/O
            program = tea.NewProgram(
                self.app_factory(),
                tea.WithInput(session.stdin),
                tea.WithOutput(session.stdout),
            )
            program.run()
        return wrapped
```

---

### 2. SSH Server Setup

#### 2.1 Basic Server

```go
import (
    "github.com/charmbracelet/wish"
    "github.com/charmbracelet/wish/bubbletea"
)

func main() {
    s, err := wish.NewServer(
        wish.WithAddress(":2222"),
        wish.WithHostKeyPath("./ssh_host_ed25519_key"),
        wish.WithMiddleware(bubbletea.Middleware(teaHandler)),
    )
    if err != nil {
        log.Fatal(err)
    }
    log.Println("Starting SSH server on port 2222")
    if err := s.ListenAndServe(); err != nil {
        log.Fatal(err)
    }
}

func teaHandler(s ssh.Session) (tea.Model, []tea.ProgramOption) {
    // Return your Bubble Tea model
    return myModel{}, nil
}
```

#### 2.2 Authentication Middleware

```go
// Password authentication
wish.WithMiddleware(func(next ssh.Handler) ssh.Handler {
    return func(s ssh.Session) {
        user := s.User()
        pass := s.Context().Value(ssh.PasswordKey{})
        
        if !validateCredentials(user, pass.(string)) {
            wish.Fatalln(s, "Authentication failed")
            return
        }
        next(s)
    }
})

// Public key authentication
wish.WithMiddleware(func(next ssh.Handler) ssh.Handler {
    return func(s ssh.Session) {
        pubKey := s.PublicKey()
        if pubKey == nil {
            wish.Fatalln(s, "Public key required")
            return
        }
        
        if !isAuthorizedKey(pubKey) {
            wish.Fatalln(s, "Key not authorized")
            return
        }
        next(s)
    }
})
```

#### 2.3 Combined Auth

```go
wish.WithMiddleware(
    // First: logging
    func(next ssh.Handler) ssh.Handler {
        return func(s ssh.Session) {
            log.Printf("Connection from %s", s.RemoteAddr())
            next(s)
        }
    },
    // Second: auth
    auth.PublicKeyAuthMiddleware(),
    // Third: TUI handler
    bubbletea.Middleware(teaHandler),
)
```

---

### 3. Bubble Tea Integration

#### 3.1 Handler Pattern

```go
// Simple handler
func teaHandler(s ssh.Session) (tea.Model, []tea.ProgramOption) {
    return &model{
        session: s,
        message: "Welcome!",
    }, []tea.ProgramOption{
        tea.WithAltScreen(),
    }
}

type model struct {
    session ssh.Session
    message string
    cursor  int
}

func (m *model) Init() tea.Cmd {
    return nil
}

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        switch msg.String() {
        case "ctrl+c":
            return m, tea.Quit
        case "up":
            m.cursor--
        case "down":
            m.cursor++
        }
    }
    return m, nil
}

func (m *model) View() string {
    return fmt.Sprintf("%s\n\nCursor: %d\n\nPress ctrl+c to exit", 
        m.message, m.cursor)
}
```

#### 3.2 Session-Aware Applications

```go
type sessionModel struct {
    username  string
    remoteAddr string
    env       map[string]string
    // ... application state
}

func teaHandler(s ssh.Session) (tea.Model, []tea.ProgramOption) {
    // Extract session info
    env := make(map[string]string)
    for _, e := range s.Environ() {
        parts := strings.SplitN(e, "=", 2)
        if len(parts) == 2 {
            env[parts[0]] = parts[1]
        }
    }
    
    return &sessionModel{
        username:   s.User(),
        remoteAddr: s.RemoteAddr().String(),
        env:        env,
    }, nil
}
```

---

### 4. Middleware Patterns

#### 4.4.1 Logging Middleware

```go
func LoggingMiddleware() wish.Middleware {
    return func(next ssh.Handler) ssh.Handler {
        return func(s ssh.Session) {
            startTime := time.Now()
            
            // Log connection
            log.Printf("New connection: %s@%s", 
                s.User(), s.RemoteAddr())
            
            // Defer completion logging
            defer func() {
                duration := time.Since(startTime)
                log.Printf("Session completed: %s (duration: %v)", 
                    s.User(), duration)
            }()
            
            next(s)
        }
    }
}
```

#### 4.2 Rate Limiting Middleware

```go
func RateLimitMiddleware(maxPerMinute int) wish.Middleware {
    connections := make(map[string][]time.Time)
    var mu sync.Mutex
    
    return func(next ssh.Handler) ssh.Handler {
        return func(s ssh.Session) {
            mu.Lock()
            now := time.Now()
            addr := s.RemoteAddr().String()
            
            // Clean old entries
            recent := []time.Time{}
            for _, t := range connections[addr] {
                if now.Sub(t) < time.Minute {
                    recent = append(recent, t)
                }
            }
            
            if len(recent) >= maxPerMinute {
                wish.Fatalln(s, "Rate limit exceeded")
                mu.Unlock()
                return
            }
            
            connections[addr] = append(recent, now)
            mu.Unlock()
            
            next(s)
        }
    }
}
```

#### 4.3 Access Control Middleware

```go
func AccessControlMiddleware(allowedUsers []string) wish.Middleware {
    allowed := make(map[string]bool)
    for _, u := range allowedUsers {
        allowed[u] = true
    }
    
    return func(next ssh.Handler) ssh.Handler {
        return func(s ssh.Session) {
            if !allowed[s.User()] {
                wish.Fatalln(s, "Access denied")
                return
            }
            next(s)
        }
    }
}
```

#### 4.4 Session Storage Middleware

```go
type SessionData struct {
    Data map[string]interface{}
}

func SessionStorageMiddleware() wish.Middleware {
    store := sync.Map{} // map[string]*SessionData
    
    return func(next ssh.Handler) ssh.Handler {
        return func(s ssh.Session) {
            sessionID := s.Context().Value("session-id").(string)
            
            // Get or create session data
            data, _ := store.LoadOrStore(sessionID, &SessionData{
                Data: make(map[string]interface{}),
            })
            sessionData := data.(*SessionData)
            
            // Store in context for handler access
            ctx := context.WithValue(s.Context(), 
                "session-data", sessionData)
            
            // Wrap session with context
            wrapped := &sessionWithContext{
                Session: s,
                ctx:     ctx,
            }
            
            next(wrapped)
        }
    }
}
```

---

### 5. Session Utilities

#### 5.1 I/O Helpers

```go
// Print to session stdout
wish.Println(s, "Hello, World!")

// Print to stderr
wish.Errorln(s, "An error occurred")

// Formatted output
wish.Printf(s, "User %s connected from %s\n", 
    s.User(), s.RemoteAddr())

// Write raw bytes
io.WriteString(s, "Raw output")

// Fatal error and exit
wish.Fatal(s, "Critical failure")
wish.Fatalf(s, "Error: %v", err)
```

#### 5.2 Environment Access

```go
func getEnv(s ssh.Session, key string) string {
    for _, e := range s.Environ() {
        if strings.HasPrefix(e, key+"=") {
            return strings.TrimPrefix(e, key+"=")
        }
    }
    return ""
}

// Usage
term := getEnv(s, "TERM")
lang := getEnv(s, "LANG")
```

#### 5.3 Exit Handling

```go
// Clean exit
_ = s.Exit(0)
_ = s.Close()

// Exit with code
_ = s.Exit(1)
_ = s.Close()

// With message
wish.Fprintln(s, "Operation completed")
_ = s.Exit(0)
_ = s.Close()
```

---

### 6. Host Key Management

#### 6.1 Automatic Key Generation

```go
// Generates key if doesn't exist
s, err := wish.NewServer(
    wish.WithHostKeyPath("./id_ed25519"),
    // ... other options
)
```

#### 6.2 Manual Key Loading

```go
// From PEM bytes
keyPEM, _ := os.ReadFile("./host_key.pem")
s, err := wish.NewServer(
    wish.WithHostKeyPEM(keyPEM),
)

// From file
s, err := wish.NewServer(
    wish.WithHostKeyPath("./host_key"),
    wish.WithHostKeyPath("./host_key_ecdsa"), // Multiple keys
)
```

#### 6.3 Key Types

```go
import "github.com/charmbracelet/keygen"

// Generate specific key type
ed25519Key, _ := keygen.New("id_ed25519", 
    keygen.WithKeyType(keygen.Ed25519))

rsaKey, _ := keygen.New("id_rsa", 
    keygen.WithKeyType(keygen.RSA),
    keygen.WithBits(4096))

ecdsaKey, _ := keygen.New("id_ecdsa",
    keygen.WithKeyType(keygen.ECDSA),
    keygen.WithCurve(keygen.CurveP384))
```

---

## Part 2: Wishlist - SSH Directory Server

### 7. Core Architecture

**Primitive:** Centralized directory of SSH-accessible services

```
Wishlist Server
├── Endpoint 1: ssh://bubbles.charm.sh:22
├── Endpoint 2: ssh://wishdemo.charm.sh:22
├── Endpoint 3: ssh://myapp.example.com:2222
└── ...
```

### 7.1 Endpoint Definition

```go
type Endpoint struct {
    Name     string   `yaml:"name"`     // Display name
    Address  string   `yaml:"address"`  // host:port
    Desc     string   `yaml:"desc"`     // Description
    Link     Link     `yaml:"link"`     // Documentation link
    Keys     []string `yaml:"keys"`     // Authorized keys
    Username string   `yaml:"username"` // Default username
}

type Link struct {
    Name string `yaml:"name"`
    URL  string `yaml:"url"`
}
```

### 7.2 Configuration (YAML)

```yaml
# wishlist.yaml
endpoints:
  - name: "Bubbles Demo"
    address: "bubbles.charm.sh:22"
    desc: "Interactive Bubble Tea components"
    link:
      name: "GitHub"
      url: "https://github.com/charmbracelet/bubbles"
  
  - name: "Wish Demo"
    address: "wish.charm.sh:22"
    desc: "Wish middleware showcase"
    username: "demo"
  
  - name: "Soft Serve"
    address: "git.charm.sh:23232"
    desc: "Self-hosted Git server"
    keys:
      - "ssh-ed25519 AAAA..."

# Server options
listen:
  address: ":2222"
  key: "./wishlist_key"
```

### 7.3 Item Display

```go
// Bubbles list.Item implementation
type ItemWrapper struct {
    endpoint    *Endpoint
    descriptors []descriptor
    styles      styles
}

func (i ItemWrapper) Title() string {
    return i.endpoint.Name
}

func (i ItemWrapper) FilterValue() string {
    return i.endpoint.Name
}

func (i ItemWrapper) Description() string {
    lines := []string{}
    for _, desc := range i.descriptors {
        lines = append(lines, desc(i.endpoint, i.styles))
    }
    return strings.Join(lines, "\n")
}

// Built-in descriptors
func withSSHURL(e *Endpoint, _ styles) string {
    return "ssh://" + e.Address
}

func withDescription(e *Endpoint, styles styles) string {
    if e.Desc != "" {
        return e.Desc
    }
    return styles.NoContent.Render("no description")
}
```

---

### 8. Wishlist Server Implementation

#### 8.1 Basic Server

```go
import (
    "github.com/charmbracelet/wishlist"
)

func main() {
    config := wishlist.LoadConfig("./wishlist.yaml")
    
    server := wishlist.NewServer(config)
    
    log.Println("Starting Wishlist server on :2222")
    if err := server.ListenAndServe(); err != nil {
        log.Fatal(err)
    }
}
```

#### 8.2 Custom Backend

```go
// Instead of YAML file, use database
type DatabaseBackend struct {
    db *sql.DB
}

func (d *DatabaseBackend) ListEndpoints() ([]*Endpoint, error) {
    rows, err := d.db.Query("SELECT name, address, desc FROM endpoints")
    if err != nil {
        return nil, err
    }
    
    var endpoints []*Endpoint
    for rows.Next() {
        var e Endpoint
        err := rows.Scan(&e.Name, &e.Address, &e.Desc)
        if err != nil {
            return nil, err
        }
        endpoints = append(endpoints, &e)
    }
    
    return endpoints, nil
}
```

---

## Part 3: Deployment Patterns

### 9. Single-Application SSH Server

```go
package main

import (
    "github.com/charmbracelet/wish"
    "github.com/charmbracelet/wish/bubbletea"
    tea "github.com/charmbracelet/bubbletea"
)

type model struct {
    count int
}

func (m model) Init() tea.Cmd { return nil }
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        switch msg.String() {
        case "ctrl+c":
            return m, tea.Quit
        case "up":
            m.count++
        case "down":
            m.count--
        }
    }
    return m, nil
}
func (m model) View() string {
    return fmt.Sprintf("Count: %d\n\nPress up/down, ctrl+c to exit", m.count)
}

func main() {
    s, _ := wish.NewServer(
        wish.WithAddress(":2222"),
        wish.WithHostKeyPath("./ssh_key"),
        wish.WithMiddleware(
            bubbletea.Middleware(func(s ssh.Session) (tea.Model, []tea.ProgramOption) {
                return model{}, []tea.ProgramOption{tea.WithAltScreen()}
            }),
        ),
    )
    s.ListenAndServe()
}
```

**Usage:**
```bash
ssh -p 2222 localhost
```

### 10. Multi-Application SSH Server

```go
// Serve different apps based on subcommand
func multiAppMiddleware(next ssh.Handler) wish.Middleware {
    return func(s ssh.Session) {
        cmd := s.Command()
        
        switch len(cmd) {
        case 0:
            // Default: show menu
            wish.Println(s, "Available commands:")
            wish.Println(s, "  counter - Counter demo")
            wish.Println(s, "  info - System info")
            _ = s.Exit(0)
        case 1:
            // Route to app
            switch cmd[0] {
            case "counter":
                bubbletea.Middleware(counterHandler)(s)
            case "info":
                bubbletea.Middleware(infoHandler)(s)
            default:
                wish.Printf(s, "Unknown command: %s", cmd[0])
                _ = s.Exit(1)
            }
        default:
            wish.Println(s, "Too many arguments")
            _ = s.Exit(1)
        }
    }
}
```

**Usage:**
```bash
# Show menu
ssh -p 2222 localhost

# Run specific app
ssh -p 2222 localhost counter
ssh -p 2222 localhost info
```

---

## Part 4: Implementation Checklist

### Wish Core

- [ ] SSH server setup with wish.NewServer
- [ ] Host key management (generate/load)
- [ ] Middleware pattern implementation
- [ ] Bubble Tea middleware integration
- [ ] Session I/O helpers (Println, Errorln, etc.)
- [ ] Exit handling (Exit, Close, Fatal)

### Authentication

- [ ] Password authentication middleware
- [ ] Public key authentication middleware
- [ ] Combined auth strategies
- [ ] Custom auth logic

### Middleware Patterns

- [ ] Logging middleware
- [ ] Rate limiting middleware
- [ ] Access control middleware
- [ ] Session storage middleware
- [ ] Environment variable middleware

### Wishlist

- [ ] Endpoint configuration (YAML)
- [ ] List item display
- [ ] Descriptor functions
- [ ] Custom backends (database, API)
- [ ] Server implementation

### Deployment

- [ ] Single-application server
- [ ] Multi-application routing
- [ ] Reverse proxy integration
- [ ] Docker deployment
- [ ] TLS/SSL wrapping (if needed)

---

## Summary

Wish and Wishlist provide:

1. **SSH Middleware Pattern**: Composable request processing
2. **Bubble Tea Integration**: Seamless TUI over SSH
3. **Authentication Flexibility**: Password, pubkey, custom
4. **Session Management**: Context, storage, I/O helpers
5. **Directory Server**: Wishlist for service discovery
6. **Deployment Simplicity**: Minimal boilerplate for SSH apps

The patterns enable:
- Deploying existing TUI apps over SSH
- Building SSH-native applications
- Creating centralized TUI directories
- Multi-tenant SSH application hosting

Key insight: SSH becomes a transport layer for TUI apps, similar to how HTTP serves web apps. Middleware handles cross-cutting concerns (auth, logging), while handlers focus on application logic.