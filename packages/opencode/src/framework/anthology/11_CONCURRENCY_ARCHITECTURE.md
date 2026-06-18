# Anthology: Concurrency Architecture

> **Subject:** Concurrency Architecture - managing async operations in TUIs without blocking or bugs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## Concurrency Architecture Mastery

### 11.1 The Async Event Loop

```rust
use tokio::sync::mpsc;

pub struct AsyncEventLoop {
    pub tx: mpsc::Sender<Event>,
    pub rx: mpsc::Receiver<Event>,
    pub running: Arc<AtomicBool>,
    pub workers: Vec<JoinHandle<()>>,
}

impl AsyncEventLoop {
    pub async fn run(&mut self) {
        let mut tick_interval = interval(Duration::from_millis(16));  // 60 FPS

        loop {
            select! {
                // User input (from stdin)
                input = self.read_input() => {
                    match input {
                        Ok(event) => self.tx.send(event).await.unwrap(),
                        Err(e) => error_occurred(e),
                    }
                }

                // Periodic tick for animations
                _ = tick_interval.tick() => {
                    self.tx.send(Event::Tick).await.unwrap();
                }

                // Incoming events from async operations
                event = self.rx.recv() => {
                    if let Some(event) = event {
                        self.handle_event(event).await;
                    }
                }

                else => break,
            }
        }
    }
}
```

### 11.2 Threading Model

```rust
pub struct TuiThreadPool {
    pub render_thread: JoinHandle<()>,
    pub input_thread: JoinHandle<()>,
    pub event_thread: JoinHandle<()>,
    pub workers: Vec<JoinHandle<()>>,
}

impl TuiThreadPool {
    pub fn spawn_render_thread(&mut self, mut renderer: Renderer) -> JoinHandle<()> {
        thread::spawn(move || {
            loop {
                let frame = renderer.next_frame();
                if frame.should_exit {
                    break;
                }
                stdout().write_all(&frame.bytes).unwrap();
                stdout().flush().unwrap();
                sleep(Duration::from_millis(16));
            }
        })
    }

    pub fn spawn_input_thread(&self, tx: mpsc::Sender<Event>) -> JoinHandle<()> {
        let stdin = stdin();
        thread::spawn(move || {
            let mut input_buf = [0u8; 32];
            loop {
                match stdin.read(&mut input_buf) {
                    Ok(n) if n > 0 => {
                        let event = parse_event(&input_buf[..n]);
                        let _ = tx.send(event);
                    }
                    _ => break,
                }
            }
        })
    }
}
```

### 11.3 Async/Await Patterns

```rust
pub struct AsyncCommandRunner {
    pub running: Arc<AtomicBool>,
    pub tasks: HashMap<TaskId, JoinHandle<()>>,
}

impl AsyncCommandRunner {
    pub async fn run_command(&mut self, cmd: ShellCommand) -> TaskId {
        let task_id = TaskId::generate();
        let running = self.running.clone();
        let tx = self.tx.clone();

        let handle = tokio::spawn(async move {
            let mut child = Command::new(cmd.program)
                .args(&cmd.args)
                .envs(&cmd.env)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .expect("Failed to spawn child");

            let mut stdout = child.stdout.take().unwrap();
            let mut stderr = child.stderr.take().unwrap();

            loop {
                select! {
                    // Read stdout
                    line = read_line(&mut stdout) => {
                        if let Ok(line) = line {
                            let _ = tx.send(Event::Stdout {
                                task_id,
                                data: line,
                            }).await;
                        }
                    }

                    // Read stderr
                    line = read_line(&mut stderr) => {
                        if let Ok(line) = line {
                            let _ = tx.send(Event::Stderr {
                                task_id,
                                data: line,
                            }).await;
                        }
                    }

                    // Child exited
                    status = child.wait() => {
                        let _ = tx.send(Event::TaskComplete {
                            task_id,
                            status,
                        }).await;
                        break;
                    }
                }
            }
        });

        self.tasks.insert(task_id, handle);
        task_id
    }
}
```

### 11.4 Task Management

```rust
pub struct TaskManager {
    pub tasks: HashMap<TaskId, Task>,
    pub max_concurrent: usize,
    pub priority_queue: BinaryHeap<TaskPriority>,
}

pub struct Task {
    pub id: TaskId,
    pub kind: TaskKind,
    pub priority: TaskPriority,
    pub status: TaskStatus,
    pub result: Option<TaskResult>,
    pub created_at: Instant,
    pub started_at: Option<Instant>,
    pub finished_at: Option<Instant>,
}

pub enum TaskKind {
    ShellCommand(ShellCommand),
    NetworkRequest(HttpRequest),
    FileOperation(FileOp),
    ComputeJob(ComputeJob),
    AgentPrompt(Prompt),
}

pub enum TaskStatus {
    Queued,
    Running { progress: f32 },
    Completed,
    Failed { error: String },
    Cancelled,
    Pending,  // Waiting for input
}

impl TaskManager {
    pub fn submit(&mut self, task: Task) -> TaskId {
        let id = task.id;
        self.tasks.insert(id, task);
        self.priority_queue.push(TaskPriority {
            id,
            priority: 0,
        });
        self.schedule();
        id
    }

    pub fn cancel(&mut self, task_id: TaskId) -> Result<(), Error> {
        if let Some(mut task) = self.tasks.get_mut(&task_id) {
            match task.status {
                TaskStatus::Queued => {
                    task.status = TaskStatus::Cancelled;
                    Ok(())
                }
                TaskStatus::Running { .. } => {
                    // Attempt to kill the process
                    self.kill_running_task(task_id)
                }
                _ => Err(Error::CannotCancel),
            }
        } else {
            Err(Error::TaskNotFound)
        }
    }
}
```

### 11.5 Lock-Free Data Sharing

```rust
use crossbeam_utils::atomic::AtomicCell;
use once_cell::sync::OnceCell;

pub struct SharedState {
    pub user_input: AtomicCell<String>,
    pub agent_status: AtomicCell<AgentStatus>,
    pub output_buffer: AtomicCell<Vec<String>>,
    pub error_state: AtomicCell<Option<String>>,
}

impl SharedState {
    pub fn new() -> Self {
        SharedState {
            user_input: AtomicCell::new(String::new()),
            agent_status: AtomicCell::new(AgentStatus::Idle),
            output_buffer: AtomicCell::new(Vec::new()),
            error_state: AtomicCell::new(None),
        }
    }

    pub fn try_update<F, T>(&self, field: &AtomicCell<T>, f: F) -> Result<T, ()>
    where
        F: FnOnce(T) -> T,
    {
        let mut current = field.load();
        let new = f(current);
        if field.compare_exchange(current, new).is_ok() {
            Ok(new)
        } else {
            Err(())
        }
    }
}
```

### 11.6 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Blocking render thread | UI freezes | Use async/await |
| Too many threads | Resource exhaustion | Limit thread pool |
| Shared mutable state | Data races | Use channels/Atomics |
| Unbounded channel | Memory leak | Use bounded channels |
| No cancellation | Zombie tasks | Implement cancel tokens |
| Starvation | Slow tasks block fast ones | Use priority queues |

---

# PART 2: NOVEL CONCEPTS REPORT

## Concurrency Architecture: Untapped Opportunities

### Concept 1: Reactor-Native TUI Runtime

**Idea:** The TUI event loop uses **reactor pattern** for zero-cost async integration with OS.

```rust
pub struct ReactorRuntime {
    reactor: epoll::Evented,
    wakers: HashMap<Waker, EventType>,
}

impl ReactorRuntime {
    pub fn register_stdin(&mut self) {
        self.reactor.register(&stdin, epoll::Events::new(), epoll::Edge);  // placeholder
    }

    pub fn wait_for_event(&self) -> Result<Event, Error> {
        let mut events = vec![epoll::Event::new(0, epoll::Events::empty())];
        self.rector.poll(&mut events, None)?;
        // process events
        Ok(Event::new())
    }
}
```

**Novel because:** All TUIs use poll/select. Reactor enables true async.

**Complexity:** High
**Value:** High (better resource usage, cleaner code)

---

### Concept 2: Lock-Free Priority Lanes

**Idea:** **Lock-free priority queues** for task scheduling.

```rust
pub struct LockFreeScheduler {
    lanes: [crossbeam::queue::SegQueue<Task>; 3],
}

impl LockFreeScheduler {
    pub fn submit(&self, task: Task, priority: Priority) {
        match priority {
            Priority::High => self.lanes[0].push(task),
            Priority::Medium => self.lanes[1].push(task),
            Priority::Low => self.lanes[2].push(task),
        }
    }

    pub fn next(&self) -> Option<Task> {
        self.lanes[0].pop()
            .or_else(|| self.lanes[1].pop())
            .or_else(|| self.lanes[2].pop())
    }
}
```

**Novel because:** TUIs use simple thread pools. Lock-free scheduling = no contention.

**Complexity:** High
**Value:** Medium (better performance under load)

---

**End of Concurrency Architecture Anthology**

---

--- BEGIN ENHANCED CONTENT ---

# PART 3: COLLECTIVE PRIMITIVE SYNTHESIS — CONCURRENCY ARCHITECTURE

> Expanded analysis synthesizing concurrency patterns across 10+ TUI frameworks and 100K+ lines of primitives. Organized by architectural layer.

---

## 3.1 Cross-Framework Taxonomy of Concurrency Models

Every TUI framework in the primitive analysis implements exactly one of three concurrency models, each with distinct tradeoffs:

| Model | Frameworks | Mechanism | Blocking Risk |
|-------|-----------|-----------|---------------|
| **Reactor + Async Runtime** | Textual, Urwid (asyncio mode) | asyncio event loop drives all I/O | Low — structured async/await |
| **Elm Architecture + Cmd Pool** | Bubbletea, Charm ecosystem | Goroutine-per-Cmd, message channel backpressure | None — commands are fire-and-forget |
| **OS Thread + MPSC Channel** | bracket-lib, raw Rust TUIs | `std::thread::spawn` + `mpsc`/`crossbeam` | Medium — manual sync required |

**The key insight:** a TUI never needs shared mutable state across threads if it adopts either Model 1 or 2. Shared state (Model 3) is only necessary when interfacing with OS-level primitives that demand synchronous access (PTY master/slave handles, terminal state structs like `termios`).

**When each model wins:**
- **Model 1 (Reactor)** — Best for I/O-bound TUIs (network calls, subprocess PTYs, file watchers). Python TUIs default here. Rust TUIs using `tokio` or `async-std` follow it.
- **Model 2 (Elm + Cmd)** — Best for state-heavy TUIs that orchestrate many concurrent side effects (agent dashboards, multi-session managers). The command pool acts as a bounded scheduler. Go TUIs default here via Bubbletea.
- **Model 3 (Threads + Channels)** — Best when you need zero-copy handoff between specialized threads (game loops, render pipelines, bracket-lib's tick architecture). Requires careful lock discipline.

**The Urwid lesson:** Urwid supports 7 different event loop backends (`SelectLoop`, `GLibEventLoop`, `TwistedEventLoop`, `AsyncioEventLoop`, `TornadoEventLoop`, `TrioEventLoop`, `ZeroMQEventLoop`). This is the strongest empirical evidence that **the event loop is a pluggable seam, not a framework core**. Any production TUI runtime should support at least 2 backends.

---

## 3.2 The Elm Architecture Cmd/Msg Pattern (Bubbletea)

Bubbletea's concurrency model is the most complete implementation of structured concurrency in any TUI framework. It eliminates an entire class of bugs by making side effects impossible to perform inside state update code.

### Core Mechanism

```go
// A Command is a function that produces a message when done
type Cmd func() Msg

// Update is PURE: no I/O, no mutations outside its scope
func (m Model) Update(msg Msg) (Model, Cmd) {
    switch msg := msg.(type) {
    case ResponseMsg:
        m.data = msg.Data
        return m, nil  // No new work
    case SubmitRequestMsg:
        return m, httpGetCmd(msg.URL)  // Return Cmd, don't execute
    }
}
```

### Command Combinators

```go
// Batch: run all commands concurrently, collect all results
tea.Batch(httpGetCmd("url1"), httpGetCmd("url2"), tickCmd())

// Sequence: run commands serially
tea.Sequence(validateCmd, saveCmd, notifyCmd)
```

The nil-command optimization is critical: `nil`/`None` commands are no-ops, allowing conditional work without `if/else` branching in the update function:

```go
var nextCmd tea.Cmd
if needsRefresh {
    nextCmd = refreshCmd()
}
// If needsRefresh is false, nextCmd is nil — a valid no-op
return m, nextCmd
```

### Goroutine Execution Model

Every `Cmd` runs in its own goroutine. The framework guarantees that only the returned `Msg` reaches the `Update` function through a single message channel. This means:
- Goroutine leaks are impossible (the Cmd completes or is abandoned at shutdown)
- The Update function is single-threaded — no locks, no atomics, no races
- Backpressure is natural (channel capacity)

### Cancellation

Bubbletea's `Program` uses a Go `context.Context`. On shutdown, cancellation propagates to all running goroutines:

```go
ctx, cancel := context.WithCancel(context.Background())
cancel()  // Signals all goroutines
```

**Cross-language mapping:**
- **Rust:** `tokio::sync::broadcast` channel for shutdown signal + `tokio::select!` in every task
- **Python:** `asyncio.shield()` + task groups with `asyncio.timeout_at()`

### Frame Rate Limiting

Bubbletea clamps render FPS to `[1, 120]` with a ticker. Multiple state updates are coalesced between frames — only the latest view is rendered:

```go
p.fps = 60  // Default
ticker := time.NewTicker(time.Second / time.Duration(fps))
```

This prevents busy-looping the terminal. The pattern applies whether you're in Rust, Go, or Python: **debounce state-to-screen at 60fps, process events as fast as they arrive.**

---

## 3.3 Threading and Channel Patterns (OS Thread Model)

### bracket-lib: parking_lot Event Queue

bracket-lib uses `parking_lot::Mutex<Vec<BEvent>>` for thread-safe input collection. Its `GameState::tick()` runs on the main thread while input arrives on a reader thread. The `tick()` function drains the event queue each frame:

```rust
// Simplified from bracket-lib's architecture
trait GameState {
    fn tick(&mut self, ctx: &mut BTerm) -> BResult<()>;
}

// Backend abstraction receives events from any thread
fn on_key_event(event: BEvent) {
    EVENT_QUEUE.lock().push(event);  // parking_lot: fast, no poisoning
}
```

**Key decision:** bracket-lib uses `parking_lot` rather than `std::sync::Mutex` because `parking_lot` has no poisoning (no `.unwrap()` on lock), smaller size, and faster performance — important for a 60fps game loop.

### tcell: Event Channel with Overflow Protection

tcell's event system demonstrates the canonical "decouple input from processing" pattern:

```go
type tscreen struct {
    eventQ chan Event  // Buffered channel
}

func (t *tscreen) emitEvent(ev Event) {
    select {
    case t.eventQ <- ev:
        // Delivered
    default:
        // Queue full, drop event
    }
}
```

**The `select` with `default` is the anti-pattern to unbounded channels.** When the consumer (main loop) can't keep up, drop events silently. This prevents memory exhaustion from buffered input. The buffer size determines the latency tolerance.

### The Fundamental Rule

**The render path must never block.** Every primitive analysis converges on this:
- blocking I/O → worker thread/channel
- blocking computation → yield/slice across frames
- waiting on OS → event notification via channel

Network ops, file reads, subprocess output — all must flow into the same event surface as keyboard input, through a common message channel or event queue.

---

## 3.4 Canopy's Production Concurrency Patterns

Canopy (a Tauri desktop app managing Claude Code PTY sessions) demonstrates production-grade concurrency patterns relevant to any TUI that embeds subprocesses or terminal sessions.

### PTY Reader Thread with Atomic Handshake

```rust
let has_output = Arc::new(AtomicBool::new(false));

std::thread::spawn(move || {
    let mut buf = [0u8; 4096];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                has_output_reader.store(true, Ordering::Release);
                let _ = on_event.send(TerminalEvent::Output {
                    data: buf[..n].to_vec(),
                });
            }
            Err(_) => break,
        }
    }
});
```

The atomic `has_output` flag is essential for initial-command sequencing: a 10-second poll waits for the PTY to produce output before writing the first command (e.g., `--resume`). Without it, the command arrives before the shell is ready and is silently lost.

### Short-Lock → Long-Wait Pattern

```rust
// Lock only to remove the entry from the map
let removed_child = terminals_ref.lock().ok()
    .and_then(|mut t| t.remove(&tid).map(|term| term.child));
// child.wait() runs OUTSIDE the lock
let exit_code = removed_child.and_then(|mut child| child.wait().ok())
    .map(|s| s.exit_code() as i32);
```

`child.wait()` blocks until the subprocess exits. If this were inside the mutex lock, `close_terminal()` (which also locks) would deadlock. By extracting the child handle first and waiting outside the lock, both paths can proceed concurrently.

### Tab Lifecycle State Machine

```
starting → running → (idle | waiting) → (done-success | done-error)
```

Each tab is a concurrent process. The state machine drives both UI (icon color, notification dot) and behavior (whether to auto-relaunch). This FSM pattern is generalizable to any multi-session TUI where each session is an independent concurrent unit with its own lifecycle.

### Tauri Channel IPC (Typed Streaming)

PTY output is streamed from Rust to React/TypeScript frontend via `Channel<TerminalEvent>`:

```rust
enum TerminalEvent {
    Output { data: Vec<u8> },
    Exit { code: Option<i32> },
}
```

**Why tagged unions over raw strings:** binary PTY output contains escape sequences that would corrupt string serialization. The tagged enum also provides type-safe dispatch on the frontend.

### Pty Instance Triple

Canopy separates PTY handles into three distinct objects:

```rust
struct TerminalInstance {
    master: Box<dyn MasterPty + Send>,   // Read from PTY
    writer: Box<dyn Write + Send>,       // Write to PTY
    child: Box<dyn Child + Send>,        // Process control (kill, wait)
}
```

This separation is the correct pattern: it decouples the read lifecycle (stream data until EOF) from the write lifecycle (accept user input until close) from the process lifecycle (kill on demand, wait for exit).

### Pause-Resume Input Buffers

Canopy resets its output buffer when transitioning to waiting state *and* when user data is sent, preventing re-triggering of attention patterns:

```
ATTENTION_COOLDOWN = 5000ms
BUFFER_CAP = 5000 chars (last N)
```

Without clearing the buffer on user interaction, the same prompt text would re-trigger attention in the next 500-char window, creating a notification loop.

---

## 3.5 Input Driver Architecture (x/input)

The Charmbracelet `x/input` library defines the most complete terminal input driver abstraction across all primitives analyzed. Every TUI input layer should mirror this structure.

### Driver → Parser → Event Pipeline

```
Raw bytes (stdin/tty) → Driver.Read() → Parser.Parse() → typed Event enum
```

| Layer | Responsibility |
|-------|---------------|
| **Driver** | Platform-specific raw I/O (`termios` on Unix, Console API on Windows) |
| **Parser** | Byte-sequence → typed event (handles multi-byte escape sequences, disambiguation) |
| **Event** | Rich typed enum: `KeyEvent`, `MouseEvent`, `PasteEvent`, `WindowSizeEvent`, `FocusEvent` |

### Non-Blocking with Overflow Handling

The driver supports both blocking and non-blocking reads. In non-blocking mode, the `select`-with-default pattern (from tcell) is the correct overflow strategy: if the event consumer can't keep up, drop input rather than growing the buffer unbounded.

### Keyboard Protocol Support

x/input supports Kitty keyboard protocol in addition to legacy xterm sequences. This is critical because the Kitty protocol provides disambiguated key events (key-repeat flag, `BaseCode` for layout-independent matching). Touching this in the concurrency architecture: **input parsing takes CPU time proportional to byte count**, and high-frequency input (mouse motion, key repeats) can saturate a single-threaded event loop. The parser must be O(n) in input length with no allocations in the hot path.

---

## 3.6 Multi-Agent Concurrent Orchestration (Charmbracelet Patterns)

The Charmbracelet coding-agent primitives (Crush, Bubbles widgets) demonstrate concurrency patterns for TUIs that orchestrate multiple AI agents simultaneously.

### Multi-Agent Dashboard Architecture

```go
type mainModel struct {
    agents      []agentModel      // One per active agent
    activeAgent int               // Which agent is focused
    chatInput   textinput.Model   // Shared input
    viewport    viewport.Model    // Shared output
}
```

Each agent runs its own Bubbletea sub-program with its own `Cmd` channel. The parent model receives results via the Elm message mechanism. Because Bubbletea guarantees Update is single-threaded, the parent can safely merge results from multiple agents without locks.

### Streaming LLM Concurrent with Spinner

```go
case TokenMsg:
    m.response += msg.Token
    if !m.done {
        return m, spinner.Tick  // Concurrent: keep spinner alive while tokens stream
    }
    return m, nil
```

This pattern — **keeping a visual indicator alive while an async operation streams partial results** — is essential for any TUI that hits network APIs. The spinner's `Tick` command runs concurrently with the LLM streaming command. Both post messages to the same channel; `Update` serializes them.

### Widget-Level Concurrency Primitives

Bubbles widgets that are relevant to concurrent TUIs:

| Widget | Concurrency Pattern |
|--------|-------------------|
| `spinner` | Tick command driving render frequency |
| `progress` | Percent update via SetPercent Cmd |
| `viewport` | Async content load + scroll position |
| `list` | Streamed item additions via list.SetItems Cmd |
| `filepicker` | Async directory scan + result message |

Each widget follows the same pattern: **background work produces a Cmd, Cmd produces a Msg, Msg updates state in Update.** No widget touches another widget's state.

---

## 3.7 Async I/O Integration Points

### notcurses: ncfdplane (Async FD Plane)

notcurses provides `ncfdplane` — a plane backed by a file descriptor with async I/O. This is the pattern for integrating arbitrary file descriptor sources (pipes, sockets, PTYs) into the render loop:

```c
// Simplified from notcurses architecture
struct ncfdplane {
    int fd;           // File descriptor to read from
    ncplane* plane;   // Rendering target
    // ... callback on read, error, close
};
```

The file descriptor is monitored via the same poll/epoll mechanism that watches stdin, so external data arrives in the same event iteration as keyboard input.

### tcell: Signal Event for External Interrupts

tcell defines an `EventInterrupt` type for external signals. This is the correct integration point for cross-thread notification: a background thread sends a signal, the main loop receives it as a normal event, and processes it without any lock.

### Textual: Worker Tasks

Textual's `worker` system runs background tasks in asyncio and posts results back to the main thread via the message queue:

```python
class MyWidget(Widget):
    @work(exclusive=True)  # Only one instance at a time
    async def fetch_data(self) -> Data:
        result = await httpx.get(url)
        return result
```

The `exclusive=True` flag prevents duplicate concurrent runs — a pattern for debouncing expensive operations (don't fire 5 HTTP requests if the user taps a key 5 times rapidly).

### Urwid: Multi-Event-Loop Proof

Urwid supports 7 event loop backends. This means Urwid's concurrency model is **backend-agnostic** — the same application code works with asyncio, Twisted, Trio, Tornado, GLib, ZeroMQ, or a simple `select()` loop. The only requirement is the backend provides:
- A way to watch stdin for readability
- A way to schedule a timeout/callback
- A way to wake the loop from another thread (thread-safe callback)

These three capabilities are the **minimal concurrency interface** any TUI framework must implement.

---

## 3.8 Synthesis: The Universal Concurrency Protocol

Every framework in the primitive analysis converges on the same protocol, despite different languages and idioms:

```
1. READ INPUT (stdin, PTY, FD)  ← blocking or poll/epoll
2. PARSE EVENT (bytes → typed)   ← O(n), no allocations
3. POST MESSAGE (enum/struct)     ← to single channel/queue
4. DRAIN QUEUE (Update/handler)   ← single-threaded, pure function
5. SCHEDULE WORK (Cmd/Coroutine)  ← return command, don't execute
6. EXECUTE WORK (thread/async)    ← in background
7. POST RESULT (message)          ← back to channel
8. GOTO 1
```

**The critical sections and how each primitive resolves them:**

| Critical Section | Resolution |
|----------------|------------|
| Input parsing blocks main loop | Dedicated input thread or async I/O |
| Shared state between threads | Message passing (no shared state) OR atomics (for flags) |
| Lock contention on terminal state | Short-lock → long-wait; or avoid lock via message passing |
| Unbounded channel growth | Bounded channel + drop on full |
| Zombie tasks/callbacks | Context cancellation + lifecycle FSM |
| PTY lost input on spawn | Atomic handshake (has_output flag) + drain buffer |
| Render starvation | Frame rate limiting (60fps debounce) |
| Initial-command sequencing before shell ready | Atomic output flag + timed poll |

---

## 3.9 Implementation Checklist for Production TUI Concurrency

From the ground up, in order:

1. **Raw mode + state save/restore** — Always save `termios`/console state before entering raw mode, always restore on exit (even on panic). Canopy, x/term, and tcell all demonstrate this.
2. **Event channel (bounded)** — Single MPSC channel for all input events. Buffer size 64-256. Drop on overflow.
3. **Event enum (tagged)** — All event types in one enum/union. Supports key, mouse, resize, paste, focus, error, custom.
4. **Input thread or async poll** — Dedicated thread reading from stdin, or async I/O in the main loop. Never block the render loop.
5. **PTY triple (master/writer/child)** — If embedding subprocesses, keep all three handles separate.
6. **Atomic flags for PTY handshake** — Arc<AtomicBool> for shell-ready detection.
7. **Task manager with lifecycle FSM** — starting→running→idle/waiting→done-success/done-error.
8. **Context/broadcast for cancellation** — Propagate shutdown to all workers.
9. **Frame rate limiter** — 60fps ticker with coalesced updates.
10. **Pluggable event loop interface** — Support at least 2 backends; expose stdin-read, timeout-schedule, thread-safe-wake as the minimal trait/interface.
11. **Error taxonomy for async work** — Every async result must classify into a type the UI can render: timeout, connection-refused, server-error, parse-error, cancelled.
12. **No cleanup on visibility flip** — Heavy resources (PTYs, xterm.js, subprocesses) must survive tab switches. Cleanup only on unmount/close.

---
