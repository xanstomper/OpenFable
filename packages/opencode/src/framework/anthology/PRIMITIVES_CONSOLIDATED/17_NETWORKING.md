# NETWORKING IN TUIs — Protocols, Connections, and Distributed State

## Overview

Terminal UIs are not inherently networked — they run on a single machine, speaking to one terminal. Yet every TUI framework analyzed contains patterns that map directly to networking concepts: connection lifecycles, protocol negotiation, middleware pipelines, message framing, stream multiplexing, authentication, encryption, and state replication. This report extracts and consolidates those patterns to form an implementation guide for building networked and distributed TUIs.

**Scope:** SSH server embedding, PTY-as-socket abstractions, message-passing over channels, authentication/encryption, service discovery, connection lifecycle management, offline-first sync, and terminal capability negotiation as network protocol patterns.

**Sources mined:**
- `wish-wishlist-primitives.md` — SSH middleware, host keys, session management, Wishlist directory server, multi-app routing
- `bubbletea-primitives.md` — Elm Architecture over channels, command combinators, message passing, lifecycle (Init/Update/View as handshake/render/teardown)
- `x-term-primitives.md` — raw mode as protocol entry, TTY detection, signal handling, platform-specific syscall abstraction
- `CANOPY_PRIMITIVES.md` — Tauri IPC channels, PTY triple (master/writer/child), OS shell resolution, provider environment injection, credential scrubbing
- `charm-primitives.md` — SSH-based auth, Ed25519/AES-GCM encryption, cloud KV/FS sync, self-hosting server config
- `17_charmbracelet_coding_agents.md` — streaming integration patterns, command palette routing, session state
- `09_notcurses_primitives.md` — ncfdplane (async I/O over file descriptors), non-blocking input poll
- `08_libtcod_primitives.md` — virtual console layers as stacked connections, blit-based frame transfer
- `x-cellbuf-primitives.md` — cell buffer as wire format, style as metadata encoding
- `bubbles-primitives.md` — component hierarchy as routing tree
- `ultraviolet-primitives.md` — event channels, suspend/resume as connection pause

---

## 1. The TTY as a Network Endpoint

### 1.1 Connection Lifecycle Mapping

Every TUI session maps 1:1 to a network connection lifecycle:

```
Network Connection          TUI Equivalent
─────────────────────────   ─────────────────────────
socket()                    MakeRaw(fd) — claim the TTY
bind()                      IsTerminal(fd) — check if it's a real terminal
listen()                    Enable input reader goroutine/thread
accept()                    Session start (ssh.Session for SSH)
handshake()                 Capability detection (query terminal features)
send/recv                   stdin read / stdout write
close()                     Restore(fd, oldState) — release the TTY
shutdown()                  Graceful program exit (cleanup, flush)
```

**Key Insight:** The TTY is a connection. The terminal is the client. Your TUI is the server. Every pattern from network server design applies.

### 1.2 The PTY Triple as Socket Triple

Canopy decomposes PTY management into three distinct handles:

```go
type TerminalInstance struct {
    master  MasterPty   // Read side — like a socket's recv()
    writer  Write       // Write side — like a socket's send()
    child   Child       // Process control — like a connection's close()
}
```

This mirrors the Unix socket pattern where `socket()` returns a descriptor used for both read and write, but with separate concerns:
- **`master`** = read buffer (data arriving from the remote terminal/shell)
- **`writer`** = write buffer (commands/shell input sent to the remote)
- **`child`** = connection lifecycle (kill = RST, graceful wait = FIN)

**Generalized Pattern — any language:**

```python
class TerminalConnection:
    """PTY triple generalized to network sockets."""
    def __init__(self, fd: int):
        self.reader = os.fdopen(fd, 'rb')       # master
        self.writer = os.fdopen(fd, 'wb')       # writer  
        self.process = None                      # child process handle
        
    def close(self):
        if self.process:
            self.process.terminate()             # send SIGTERM
            self.process.wait()                  # wait for EOF (like recv() returning 0)
        self.reader.close()
        self.writer.close()
```

### 1.3 Environment as Handshake

Before any data flows, the terminal environment must be negotiated. This is the TUI equivalent of a protocol handshake:

```go
// Pre-spawn environment negotiation (Canopy pattern)
cmd := exec.Command(shell)
cmd.Env = rebuildEnvironment()          // sanitize env
cmd.Env = append(cmd.Env, "TERM=xterm-256color")  // announce capabilities
// Provider injection (cloud auth = credentials handshake)
if useBedrock {
    cmd.Env = append(cmd.Env, "CLAUDE_CODE_USE_BEDROCK=1")
    cmd.Env = append(cmd.Env, "AWS_REGION="+region)
}
```

**Pattern: Layered Handshake**
1. **Layer 0 — Transport:** Is it a terminal or a pipe? (`IsTerminal(fd)`)
2. **Layer 1 — Terminal type:** What TERM value? What color support?
3. **Layer 2 — Extensions:** Kitty keyboard? Sixel graphics? Mouse?
4. **Layer 3 — Auth:** Provider credentials, API keys, session tokens
5. **Layer 4 — Application:** User identity, workspace, project context

---

## 2. SSH Middleware as Connection Handler

### 2.1 The Middleware Pipeline

Wish implements the classic HTTP middleware pattern for SSH connections. Each connection flows through a chain of handlers, each with read/write access to the session:

```
Client SSH Connect
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Logging    │────▶│     Auth     │────▶│  App Handler │
│  Middleware  │     │  Middleware  │     │  (Bubble Tea) │
└──────────────┘     └──────────────┘     └──────────────┘
  Log connection       Verify creds         Serve TUI
  (onion layer)        (onion layer)        (core)
```

**Middleware Signature (language-agnostic):**

```python
# The fundamental middleware contract
Middleware = Callable[[ConnectionHandler], ConnectionHandler]
ConnectionHandler = Callable[Session]

def logging_middleware(next_handler: ConnectionHandler) -> ConnectionHandler:
    def wrapped(session: Session):
        log.info(f"Connection from {session.remote_addr}")
        try:
            next_handler(session)      # pass to next layer
        finally:
            log.info(f"Session ended: {session.remote_addr}")
    return wrapped
```

**Key Pattern:** Onion/layered architecture. Each middleware can:
- Inspect and modify session before passing down
- Short-circuit (reject without reaching inner handlers)
- Wrap behavior around the inner handler (timing, logging, cleanup)

### 2.2 Authentication Strategies

Three auth patterns extracted from Wish:

| Strategy | Mechanism | Network Equivalent |
|----------|-----------|--------------------|
| Password | `s.Context().Value(PasswordKey)` | Basic Auth |
| Public Key | `s.PublicKey()` fingerprint check | TLS client certs |
| Combined | Try pubkey first, fall back to password | Multi-factor auth |

**Host Key Management (the SSH equivalent of a server certificate):**

```go
// Automatic (development)
wish.WithHostKeyPath("./id_ed25519")

// Manual PEM (production, pinned)
keyPEM, _ := os.ReadFile("host_key.pem")
wish.WithHostKeyPEM(keyPEM)

// Key types = cipher suite selection
keygen.WithKeyType(keygen.Ed25519)   // modern, fast
keygen.WithKeyType(keygen.RSA)       // compatibility, 4096-bit
keygen.WithKeyType(keygen.ECDSA)     // P-384 curve
```

### 2.3 Session as Connection State

An SSH session carries connection context analogous to HTTP request context:

```go
type Session interface {
    User() string              // authenticated identity
    RemoteAddr() net.Addr      // client address (like r.RemoteAddr)
    Environ() []string         // environment variables (like request headers)
    PublicKey() ssh.PublicKey  // client certificate (like tls.ConnectionState)
    Command() []string         // subcommand (like URL path)
    Exit(code int) error       // send status code (like HTTP status)
    Close() error              // close the connection
}
```

---

## 3. Message Framing & Channel Patterns

### 3.1 Bubble Tea's Elm Architecture as Protocol

Bubble Tea's Model-Update-View cycle is isomorphic to a request-response protocol:

```
Network Protocol              Elm Architecture
──────────────────────        ──────────────────────
Request receives data   ←     Input Reader produces Msg
Handler validates       ←     Update() validates/transforms
Handler calls service   ←     Update() returns Cmd
Response returned       ←     View() renders output
Connection closes       ←     QuitMsg / tea.Quit
```

The critical networking insight: **messages are framed events** with type tags, just like protocol messages.

### 3.2 Channel as Byte Stream

Bubble Tea's message channel is fundamentally a `chan Msg` — a typed Go channel. This maps to:

| Bubble Tea | Network Equivalent |
|------------|-------------------|
| `chan Msg` | TCP byte stream (typed framing) |
| `tea.Batch(cmds)` | Multiplexing multiple requests (HTTP/2 streams) |
| `tea.Sequence(cmds)` | Ordered request pipeline (TCP ordering) |
| `tea.Tick(interval)` | Heartbeat/keepalive |
| `WindowSizeMsg` | Flow control notification |
| `QuitMsg` | Connection close (FIN) |
| `tea.Suspend()` / `ResumeMsg` | Connection pause/resume |

### 3.3 Command as Deferred Request

Bubble Tea's `Cmd` type (`func() Msg`) is a deferred network call:

```python
# Cmd = a request that will eventually produce a response
Cmd = Callable[[], Msg]

# HTTP GET as a Cmd
def http_get(url: str) -> Cmd:
    def _cmd():
        response = requests.get(url)
        return ResponseMsg(response.status_code, response.text)
    return _cmd

# Batch = concurrent requests (like HTTP/2 multiplexing)
def batch(*cmds: List[Cmd]) -> Cmd:
    futures = [executor.submit(c) for c in cmds]
    results = [f.result() for f in futures]
    return BatchMsg(results)
```

### 3.4 Event Filter as Packet Inspection

Bubble Tea's event filter intercepts messages before they reach the model — exactly like a network packet filter:

```python
def packet_filter(model, msg) -> Optional[Msg]:
    # Block quit if unsaved changes (like a firewall DROP)
    if isinstance(msg, QuitMsg) and model.has_changes:
        return None  # DROP the quit message
    
    # Rewrite messages (like NAT)
    if isinstance(msg, KeyPressMsg) and model.vim_mode:
        return translate_to_vim(msg)  # REWRITE the packet
    
    return msg  # ACCEPT
```

---

## 4. Protocol Negotiation & Capability Detection

### 4.1 Terminal Capability Query as Protocol Handshake

TUIs must negotiate with the terminal before sending advanced features. The sequence:

```
TUI                          Terminal
───                          ────────
Query: CSI Ps $ p  ───────▶  (response)
  ◀─────── CSI ? Ps ; Ps $ y   Response: supported/not supported
If supported:
  Enable feature
If not:
  Fallback to basic mode
```

**Extracted capability queries (from bubbletea + x-term + Canopy):**

| Feature | Query | Fallback |
|---------|-------|----------|
| True Color | Terminfo `RGB` or 24-bit detection | 256-color, then 16-color |
| Synchronized Output | `ModeSynchronizedOutput` | Double-buffered direct writes |
| Kitty Keyboard Protocol | `ModeKeyboardEnhancements` | Standard escape sequences |
| Mouse (all modes) | `ModeMouseSgrPixels` | No mouse |
| Hyperlinks | `ModeHyperlinks` | Plain text |
| Sixel Graphics | Terminfo `six` | Unicode/ASCII art |
| Bracketed Paste | `ModeBracketedPaste` | Raw paste (may contain escapes) |
| Focus Tracking | `ModeFocusTracking` | No focus events |
| Unicode Core Width | `ModeUnicodeCore` | Assume all chars width-1 |

### 4.2 Environment Variable Canonicalization

Canopy's `TERM=xterm-256color` enforcement is a critical pattern: **always normalize the transport layer before the application starts**. Like TLS ALPN negotiation — both sides agree on a common protocol version before application data flows.

```go
// Always set — apps depend on consistent terminal behavior
cmd.Env("TERM", "xterm-256color")

// Strip dangerous env (like stripping HTTP headers in a proxy)
// Remove CLAUDECODE* prefixes to prevent nested session injection
for _, key := range dangerousKeys {
    cmd.EnvFilter(key)
}

// Augment PATH for GUI apps (like DNS resolution for the process)
ensureFullPath()  // adds ~/.local/bin, Homebrew, nvm, etc.
```

---

## 5. Encryption, Auth, and Secure State

### 5.1 SSH-Based Identity (Charm Pattern)

Charm's auth model eliminates passwords entirely by binding identity to SSH keypairs:

```
User generates SSH keypair (ed25519)
       │
       ▼
Public key ──▶ Server (Charm Cloud / self-hosted)
       │
       ▼
Every subsequent auth: SSH key proves identity
       │
       ▼
Encryption keys derived from SSH identity
(AES-GCM for data at rest)
```

**Security Properties:**
- No password storage (eliminates credential leaks)
- Key-based machine linking (device authorization)
- Automatic key rotation (Charm-managed)
- Backup/recovery via `charm backup-keys` → `charm import-keys`

### 5.2 Credential Scrubbing (Canopy Pattern)

Before spawning child processes, sensitive credentials must be protected:

```rust
// Allowlist-based credential access
const ALLOWED_KEYRING_KEYS: [&str; 3] = [
    "aws_access_key_id",
    "aws_secret_access_key", 
    "aws_session_token",
];

// The keyring acts like a secrets manager / HSM
fn get_secret(key: &str) -> Result<String> {
    validate_keyring_key(key)?;  // enforce allowlist
    keyring::Entry::new(APP_NAME, key).get_password()
}
```

**Mapping to network security:** This is equivalent to a TLS termination proxy that only passes whitelisted headers to the backend.

### 5.3 End-to-End Encrypted Sync

Charm KV provides encrypted client-side storage with cloud sync:

```
BadgerDB (local) ◄───Sync───▶ Charm Server (cloud)
     │                              │
     └─ AES-GCM encrypted ─────────┘
     └─ Ed25519 identity bound ────┘
```

**Offline-First Pattern (critical for TUIs):**
1. Write locally first (immediate, no network dependency)
2. Queue sync operation (async, can fail gracefully)
3. On reconnect, flush pending syncs
4. Resolve conflicts (last-writer-wins or custom merge)

---

## 6. Service Discovery & Routing

### 6.1 Wishlist as DNS

Wishlist provides a directory of SSH-accessible TUI services — a DNS-like discovery mechanism:

```yaml
# Service registry (like DNS records)
endpoints:
  - name: "Bubbles Demo"       # SRV record name
    address: "bubbles.charm.sh:22"  # host:port
    desc: "Interactive components"   # TXT record
    
  - name: "Git Server"
    address: "git.charm.sh:23232"
    keys:                          # trusted certs
      - "ssh-ed25519 AAAA..."
```

### 6.2 Multi-App Routing

SSH subcommand routing (Wish multi-app pattern) maps to HTTP path-based routing:

```python
# Like nginx location blocks / Express routes
def route(session: Session) -> Optional[ConnectionHandler]:
    command = session.command  # e.g., ["counter"] or ["info"]
    
    routes = {
        "":        welcome_menu_handler,     # default route
        "counter": counter_app_handler,      # /counter
        "info":    system_info_handler,     # /info
    }
    
    return routes.get(command[0] if command else "", not_found_handler)
```

### 6.3 Descriptor Pattern for Service Metadata

Wishlist's descriptor pattern extracts structured metadata from each endpoint:

```python
EndpointDescriptor = Callable[[Endpoint, Styles], str]

def with_ssh_url(endpoint, styles) -> str:
    return f"ssh://{endpoint.address}"

def with_description(endpoint, styles) -> str:
    return endpoint.desc or "no description"

# Like HTTP content negotiation — different descriptors for different consumers
descriptors = [with_ssh_url, with_description, with_last_seen]
```

---

## 7. Streaming & Real-Time I/O

### 7.1 PTY Output as Byte Stream

Canopy's PTY output streaming pattern:

```
PTY Master (Rust) ──read()──▶ Reader Thread ──Channel──▶ React/xterm.js
     │                                                              │
     │                    4096-byte chunks                          │
     │                    Uint8Array (raw bytes)                    │
     │                                                              │
     └── Tagged enum: Output{data} | Exit{code} ───────────────────┘
```

**Key Pattern:** Tagged union messages over a channel = framed protocol messages over a byte stream.

### 7.2 ANSI Redaction as Content Filtering

Before pattern matching on terminal output, ANSI escape sequences must be stripped:

```python
# Like a WAF stripping HTML before content inspection
ANSI_ESCAPE_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

def sanitize_output(raw_bytes: bytes) -> str:
    text = raw_bytes.decode('utf-8', errors='replace')
    return ANSI_ESCAPE_RE.sub('', text)
```

### 7.3 Attention Detection as Protocol Signal

Canopy scans terminal output for attention patterns — like a protocol-level signal embedded in the data stream:

```python
ATTENTION_PATTERNS = [
    r"Do you want to proceed\?",
    r"Esc to cancel",
    r"Allow once",
    r"Allow always",
]

# Scan last N bytes of output (rolling window)
# Cooldown prevents re-triggering (like debouncing a signal)
ATTENTION_COOLDOWN_MS = 5000
OUTPUT_BUFFER_SIZE = 500
```

---

## 8. Connection Lifecycle Management

### 8.1 Graceful Shutdown

Every TUI must handle shutdown gracefully — the equivalent of TCP's four-way close:

```python
async def graceful_shutdown(program, timeout=5.0):
    # 1. Stop accepting new input (close listen socket)
    program.stop_input_reader()
    
    # 2. Flush pending output (drain send buffer)
    await program.flush_renderer()
    
    # 3. Cancel background tasks (close child connections)
    for task in program.background_tasks:
        task.cancel()
    
    # 4. Wait for cleanup with timeout (TIME_WAIT)
    await asyncio.wait_for(
        asyncio.gather(*program.background_tasks, return_exceptions=True),
        timeout=timeout
    )
    
    # 5. Restore terminal state (close socket)
    program.restore_terminal()
```

### 8.2 Suspend/Resume as Connection Pause

Bubble Tea's suspend/resume maps to TCP connection pause (like SSH's `~^Z`):

```
Running ──Ctrl+Z──▶ Suspended (SIGTSTP)
   ▲                    │
   │                    ▼
   └────fg───────── Running (SIGCONT)
   
TUI equivalent:
  Running ──tea.Suspend()──▶ Suspended
     ▲                           │
     │                           ▼
     └────ResumeMsg────────── Running
```

### 8.3 Focus/Blur as Connection State

Terminal focus events (`CSI I` / `CSI O`) are like connection state changes:

```python
class ConnectionState(Enum):
    CONNECTED = "connected"      # Terminal has focus
    DISCONNECTED = "disconnected" # Terminal lost focus (blur)
    PAUSED = "paused"            # Suspended (Ctrl+Z)
    RECONNECTING = "reconnecting" # Resize event (connection params changed)
```

---

## 9. Implementation Patterns

### 9.1 The Networked TUI Stack

A complete networked TUI architecture, layer by layer:

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  (Bubble Tea Model, business logic, state management)    │
├─────────────────────────────────────────────────────────┤
│                  Message Protocol Layer                  │
│  (Typed messages, command pattern, event filters)        │
├─────────────────────────────────────────────────────────┤
│                Connection Management Layer               │
│  (Session lifecycle, auth, middleware pipeline)          │
├─────────────────────────────────────────────────────────┤
│              Transport Abstraction Layer                 │
│  (PTY triple, SSH session, Tauri Channel, stdin/stdout)  │
├─────────────────────────────────────────────────────────┤
│                Platform I/O Layer                        │
│  (termios, Windows Console API, ioctl, syscalls)         │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Minimal SSH-TUI Server (Complete)

```go
package main

import (
    "log"
    "github.com/charmbracelet/wish"
    "github.com/charmbracelet/wish/bubbletea"
    tea "github.com/charmbracelet/bubbletea"
)

type model struct{ count int }

func (m model) Init() tea.Cmd { return nil }
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        switch msg.String() {
        case "ctrl+c": return m, tea.Quit
        case "up":     m.count++; return m, nil
        case "down":   m.count--; return m, nil
        }
    }
    return m, nil
}
func (m model) View() string {
    return fmt.Sprintf("Count: %d\n\n↑/↓ to change, ctrl+c to quit", m.count)
}

func main() {
    s, err := wish.NewServer(
        wish.WithAddress(":2222"),
        wish.WithHostKeyPath("./host_key"),
        wish.WithMiddleware(
            // Layer 1: Logging (outermost)
            func(next ssh.Handler) ssh.Handler {
                return func(s ssh.Session) {
                    log.Printf("Connect: %s@%s", s.User(), s.RemoteAddr())
                    defer log.Printf("Disconnect: %s", s.User())
                    next(s)
                }
            },
            // Layer 2: Auth
            func(next ssh.Handler) ssh.Handler {
                return func(s ssh.Session) {
                    if s.PublicKey() == nil {
                        wish.Fatalln(s, "Public key required")
                        return
                    }
                    next(s)
                }
            },
            // Layer 3: Application (innermost)
            bubbletea.Middleware(func(s ssh.Session) (tea.Model, []tea.ProgramOption) {
                return model{}, []tea.ProgramOption{tea.WithAltScreen()}
            }),
        ),
    )
    log.Fatal(s.ListenAndServe())
}
```

### 9.3 Multi-Protocol TUI (SSH + Local)

A TUI that works both locally and over SSH needs protocol abstraction:

```python
class Transport(ABC):
    """Abstract transport — works over PTY, SSH, or WebSocket."""
    @abstractmethod
    def read(self) -> bytes: ...
    @abstractmethod
    def write(self, data: bytes) -> None: ...
    @abstractmethod
    def get_size(self) -> Tuple[int, int]: ...
    @abstractmethod
    def close(self) -> None: ...

class PtyTransport(Transport):
    """Local PTY transport."""
    def __init__(self, fd: int):
        self.fd = fd
        self.old_state = term.MakeRaw(fd)
    
    def read(self) -> bytes:
        return os.read(self.fd, 4096)
    
    def write(self, data: bytes) -> None:
        os.write(self.fd, data)

class SshTransport(Transport):
    """SSH session transport."""
    def __init__(self, session: ssh.Session):
        self.session = session
    
    def read(self) -> bytes:
        # Read from SSH channel
        return self.session.read(4096)
    
    def write(self, data: bytes) -> None:
        self.session.write(data)

# The TUI doesn't know or care which transport it's using
class TUI:
    def __init__(self, transport: Transport):
        self.transport = transport
    
    def run(self):
        while True:
            data = self.transport.read()
            msg = self.parse_input(data)
            new_state, cmd = self.model.update(msg)
            output = self.model.view()
            self.transport.write(output.encode())
```

---

## 10. Cross-Reference Matrix

| Primitive | Source File | Network Equivalent | Reusability |
|-----------|-------------|-------------------|-------------|
| SSH Middleware Pipeline | wish-wishlist | HTTP middleware / onion routing | 5/5 |
| Host Key Management | wish-wishlist | TLS certificate management | 5/5 |
| PTY Triple (master/writer/child) | CANOPY | Socket triple (recv/send/close) | 5/5 |
| Elm Architecture (MUV) | bubbletea | Request-response protocol | 5/5 |
| Command Pattern (Cmd) | bubbletea | Deferred async request | 5/5 |
| Message Channel | bubbletea | Framed byte stream | 5/5 |
| Event Filter | bubbletea | Packet filter / WAF | 4/5 |
| Capability Detection | bubbletea, x-term | TLS ALPN / protocol negotiation | 5/5 |
| Raw Mode (MakeRaw/Restore) | x-term | socket() / close() | 5/5 |
| SSH-Based Auth (Charm) | charm | mTLS / client certificates | 4/5 |
| Encrypted Sync (Charm KV) | charm | Encrypted replication (CRDT-like) | 4/5 |
| Service Discovery (Wishlist) | wish-wishlist | DNS / service registry | 4/5 |
| Multi-App Routing | wish-wishlist | HTTP path-based routing | 4/5 |
| Environment Negotiation | CANOPY, x-term | Protocol handshake | 5/5 |
| Tagged Union Messages | CANOPY | Protocol message framing | 5/5 |
| Graceful Shutdown | bubbletea, CANOPY | TCP four-way close | 5/5 |
| Suspend/Resume | bubbletea | Connection pause (TCP suspend) | 3/5 |
| Focus/Blur Events | bubbletea | Connection state change | 4/5 |
| Credential Scrubbing | CANOPY | Secrets management / header filtering | 5/5 |
| ANSI Redaction | CANOPY | Content sanitization (WAF) | 4/5 |
| Attention Detection | CANOPY | Protocol signal in data stream | 3/5 |
| ncfdplane (async I/O) | notcurses | Non-blocking socket I/O | 4/5 |
| Cell Buffer as Wire Format | x-cellbuf | Binary protocol message format | 4/5 |

---

## 11. Key Insights

1. **The TTY is a connection.** Every TUI is a network server that happens to speak to a local terminal. Design it that way and it becomes trivial to extend to SSH, WebSocket, or any other transport.

2. **Middleware is universal.** The onion-layer pattern from Wish applies to any connection handler — logging, auth, rate limiting, access control. Build it once, use it everywhere.

3. **Messages are protocol frames.** Bubble Tea's typed messages over channels are isomorphic to protocol messages over a byte stream. The same patterns (framing, routing, filtering, batching) apply.

4. **Capability detection is handshake.** Terminal feature queries are protocol negotiation. Always detect before assuming, always have a fallback.

5. **Offline-first is non-negotiable.** TUIs run on laptops, in terminals, over unreliable connections. Charm's local-first sync pattern (write locally, sync async) is the only correct approach.

6. **Environment is the handshake layer.** Before any application data flows, the environment must be sanitized, augmented, and normalized. This is your protocol's handshake phase.

7. **The PTY triple is the socket API.** Master=recv, writer=send, child=close. Keep them separate for precise lifecycle control.

8. **SSH is the natural transport for TUIs.** Wish proves that serving a TUI over SSH requires ~50 lines of Go. Every TUI framework should support this as a first-class deployment target.

---

## 12. Files Worth Reading Line-by-Line

### SSH & Connection Management
- `wish/server.go` — SSH server setup with middleware
- `wish/bubbletea/middleware.go` — Bubble Tea over SSH bridge
- `wishlist/config.go` — YAML-based service registry
- `wishlist/server.go` — directory server implementation

### Transport & I/O
- `x/term/term_unix.go` — raw mode via termios (the socket() of TUIs)
- `x/term/terminal.go` — terminal state management
- `x/input/driver.go` — input event parsing (protocol decoder)
- `x/cellbuf/buffer.go` — cell buffer as wire format

### Message Protocol
- `bubbletea/program.go` — event loop (the protocol engine)
- `bubbletea/tea.go` — command and message types
- `bubbletea/options.go` — program configuration

### Security
- `charm/crypt/crypt.go` — encryption/decryption
- `charm/kv/kv.go` — encrypted KV with sync
- `charm/server/server.go` — self-hosted Charm server

### Lifecycle
- `ultraviolet/terminal.go` — terminal start/stop/suspend
- `bubbletea/tea.go` — Init/Update/View cycle
- `CANOPY/src-tauri/src/terminal.rs` — PTY triple management

---

*Report 17 — NETWORKING. Compiled from 12 source analysis files across the PRIMITIVES_CONSOLIDATED collection. 2026-06-01.*
