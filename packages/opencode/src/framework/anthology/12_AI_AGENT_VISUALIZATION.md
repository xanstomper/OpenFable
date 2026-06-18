# Anthology: AI Agent Visualization

> **Subject:** AI Agent Visualization - visualizing agent behavior, state, and activity in TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## AI Agent Visualization Mastery

### 12.1 Agent State Machine Visualization

```rust
#[derive(Clone, Debug)]
pub enum AgentState {
    Idle,
    Initializing { progress: f32, step: String },
    Thinking { prompt: String, elapsed_ms: u64, confidence: Option<f32> },
    Executing { command: String, status: ExecStatus, logs: Vec<String> },
    AwaitingInput { prompt: String, options: Vec<String> },
    Error { error: String, retryable: bool, stack: Option<String> },
    Success { result: String, metadata: HashMap<String, String> },
    Streaming { tokens_received: usize, estimated_total: Option<usize> },
}

pub struct AgentStateMachine {
    pub state: AgentState,
    pub transition_history: Vec<(Instant, AgentState)>,
    pub max_history: usize,
    pub on_transition: Box<dyn Fn(AgentState, AgentState) + Send + Sync>,
}

impl AgentStateMachine {
    pub fn transition(&mut self, new_state: AgentState) {
        let old_state = self.state.clone();
        self.transition_history.push((Instant::now(), old_state.clone()));

        self.state = new_state.clone();
        (self.on_transition)(old_state, new_state);
    }

    pub fn can_transition_to(&self, target: &AgentState) -> bool {
        match (&self.state, target) {
            (AgentState::Idle, AgentState::Initializing { .. }) => true,
            (AgentState::Initializing { .. }, AgentState::Thinking { .. }) => true,
            (AgentState::Thinking { .. }, AgentState::Executing { .. }) => true,
            (AgentState::Executing { .. }, AgentState::AwaitingInput { .. }) => true,
            (AgentState::AwaitingInput { .. }, AgentState::Executing { .. }) => true,
            (_, AgentState::Error { .. }) => true,
            (AgentState::Error { .. }, AgentState::Idle) => true,
            (AgentState::Streaming { .. }, AgentState::Success { .. }) => true,
            _ => false,
        }
    }

    pub fn duration_in_current_state(&self) -> Duration {
        self.transition_history
            .last()
            .map(|(t, _)| t.elapsed())
            .unwrap_or(Duration::ZERO)
    }
}
```

### 12.2 Behavior Logging

```rust
pub struct BehaviorLogger {
    pub events: Vec<BehaviorEvent>,
    pub enabled: AtomicBool,
    pub buffer: Arc<Mutex<Vec<u8>>>,
}

#[derive(Clone, Debug)]
pub enum BehaviorEvent {
    PromptSubmitted { text: String, length: usize, timestamp: u64 },
    ToolUsed { tool: String, params: HashMap<String, String>, duration_ms: u64 },
    TokenGenerated { token: String, is_complete: bool, model: String },
    StateTransition { from: String, to: String, trigger: String },
    ErrorEncountered { error: String, recoverable: bool },
    UserFeedback { category: FeedbackCategory, sentiment: Sentiment },
    ResourceUsed { type_: ResourceType, amount: u64 },
}

#[derive(Clone, Copy, Debug)]
pub enum FeedbackCategory {
    Positive,      // "Great!", "Thanks"
    Negative,      // "Wrong", "Bad"
    Correction,    // "No, I meant..."
    Interrupt,     // User cut off agent
}

#[derive(Clone, Copy, Debug)]
pub enum Sentiment {
    Positive,
    Neutral,
    Negative,
}

impl BehaviorLogger {
    pub fn record(&self, event: BehaviorEvent) {
        if !self.enabled.load(Ordering::Relaxed) {
            return;
        }

        let mut buf = self.buffer.lock().unwrap();
        let serialized = serde_json::to_string(&event).unwrap();
        buf.extend_from_slice(serialized.as_bytes());
        buf.push(b'\n');
    }

    pub fn export(&self) -> Vec<BehaviorEvent> {
        let buf = self.buffer.lock().unwrap();
        let content = std::str::from_utf8(&buf).unwrap();
        content.lines()
            .filter(|l| !l.is_empty())
            .filter_map(|l| serde_json::from_str(l).ok())
            .collect()
    }

    pub fn analyze(&self) -> BehaviorSummary {
        let events = self.export();
        let summary = BehaviorSummary {
            total_prompts: events.iter().filter(|e| matches!(e, BehaviorEvent::PromptSubmitted { .. })).count(),
            total_errors: events.iter().filter(|e| matches!(e, BehaviorEvent::ErrorEncountered { .. })).count(),
            avg_duration: self.compute_avg_duration(&events),
            tool_usage: self.compute_tool_usage(&events),
            sentiment_distribution: self.compute_sentiment(&events),
        };
        summary
    }
}
```

### 12.3 Agent Analytics Dashboard

```rust
pub struct AgentAnalytics {
    pub sessions: Vec<Session>,
    pub metrics: HashMap<String, Metric>,
}

pub struct Session {
    pub id: SessionId,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub prompt_count: usize,
    pub token_count: usize,
    pub error_count: usize,
    pub user_satisfaction: Option<f32>,
    pub tools_used: HashMap<String, usize>,
    pub state_transitions: Vec<StateTransition>,
}

pub enum Metric {
    Throughput(f32),
    ErrorRate(f32),
    Latency(Duration),
    TokenEfficiency(f32),
    UserSatisfaction(f32),
    ToolUsage(HashMap<String, usize>),
}

impl AgentAnalytics {
    pub fn record_session(&mut self, session: Session) {
        self.sessions.push(session.clone());

        // Update rolling metrics
        self.update_metrics(&session);
    }

    pub fn dashboard(&self) -> DashboardView {
        DashboardView {
            total_sessions: self.sessions.len(),
            avg_session_duration: self.avg_duration(),
            throughput_per_hour: self.throughput(),
            error_rate: self.error_rate(),
            top_tools: self.top_tools(5),
            satisfaction_trend: self.satisfaction_trend(),
            state_distribution: self.state_distribution(),
        }
    }
}
```

### 12.4 Tool Usage Patterns

```rust
pub struct ToolPatternAnalyzer {
    pub sequences: Vec<ToolSequence>,
    pub frequency: HashMap<String, usize>,
    pub cooccurrence: HashMap<(String, String), usize>,
}

pub struct ToolSequence {
    pub tools: Vec<String>,
    pub frequency: usize,
    pub avg_duration: Duration,
    pub success_rate: f32,
}

impl ToolPatternAnalyzer {
    pub fn analyze(&self, events: &[BehaviorEvent]) -> PatternReport {
        let tool_events: Vec<_> = events.iter()
            .filter_map(|e| match e {
                BehaviorEvent::ToolUsed { tool, .. } => Some(tool.clone()),
                _ => None,
            })
            .collect();

        let patterns = self.extract_patterns(&tool_events);
        let anomalies = self.detect_anomalies(&tool_events);

        PatternReport {
            common_sequences: patterns,
            anomalies,
            recommendations: self.generate_recommendations(&patterns),
        }
    }

    fn extract_patterns(&self, tools: &[String]) -> Vec<ToolSequence> {
        let mut sequences = Vec::new();
        let n = tools.len();

        for window_size in 1..=3 {
            for i in 0..n - window_size + 1 {
                let seq = &tools[i..i + window_size];
                let key = seq.join(" -> ");
                *self.frequency.entry(key.clone()).or_insert(0) += 1;
            }
        }

        // Convert to ToolSequence structs
        sequences
    }

    fn detect_anomalies(&self, tools: &[String]) -> Vec<Anomaly> {
        let mut anomalies = Vec::new();

        // Example: repeated tool failures
        let consecutive_failures = tools.windows(2)
            .filter(|w| w[0] == w[1] && w[0].contains("retry"))
            .count();
        if consecutive_failures > 3 {
            anomalies.push(Anomaly::RepeatedToolFailure {
                tool: tools[0].clone(),
                count: consecutive_failures,
                suggestion: "Consider changing strategy".to_string(),
            });
        }

        anomalies
    }
}
```

### 12.5 Common Agent Visualization Patterns

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Timeline | Show state transitions over time | Horizontally scrollable timeline widget |
| State Machine | Current state at a glance | Animated state diagram |
| Token Flow | Streaming visualization | Particle flow from model to UI |
| Tool Graph | Tool relationships | Force-directed graph layout |
| Heatmap | Activity patterns | Color-coded time grid |

---

# PART 2: NOVEL CONCEPTS REPORT

## AI Agent Visualization: Untapped Opportunities

### Concept 1: Agent "Digital Twin" Mirror

**Idea:** A **parallel agent visualization** that mirrors real agent state with augmented reality-style overlays.

**How:**
```rust
pub struct DigitalTwin {
    state_mirror: AgentStateMachine,
    overlay_layers: Vec<OverlayLayer>,
    augmented_streams: HashMap<StreamId, AugmentedStream>,
}

pub struct OverlayLayer {
    pub name: String,
    pub renderer: Box<dyn OverlayRenderer>,
    pub opacity: f32,
    pub blend_mode: BlendMode,
}

pub enum OverlayRenderer {
    PredictionConfidence(f32),  // Overlay predicted vs actual
    DataFlowArrows,            // Arrows showing tool→data relationships
    ConfidenceHeatmap,         // Color cells by confidence
    AttentionMap,              // Show what agent is "focusing on"
}

impl DigitalTwin {
    pub fn sync(&mut self, real_agent: &AgentState) {
        self.state_mirror.transition(real_agent.state.clone());

        // Render overlays
        for layer in &mut self.overlay_layers {
            layer.update(&real_agent);
        }
    }

    pub fn render_twin(&self, fb: &mut Framebuffer) {
        // Base: real agent state
        self.render_agent_state(&self.state_mirror.state, fb);

        // Overlays
        for layer in &self.overlay_layers {
            layer.renderer.render(fb, layer.opacity);
        }
    }
}
```

**Novel because:** No TUI visualizes agent internals. This provides X-ray-like view of agent reasoning.

**Complexity:** Very High
**Value:** Very High (debugging, trust, transparency)

---

### Concept 2: Haptic-Feedback Event Timeline

**Idea:** Scrollable timeline with **tactile feedback** for each event type.

**How:**
```rust
pub struct HapticTimeline {
    events: Vec<TimelineEvent>,
    haptic_map: HashMap<EventType, HapticPattern>,
    current_position: usize,
    viewport_size: usize,
}

pub enum HapticPattern {
    Tap { intensity: f32, duration_ms: u64 },
    Ripple { spread: f32, decay: f32 },
    Pulse { frequency: f32, duration_ms: u64 },
    Vibration { amplitude: f32, pattern: Vec<u64> },
}

impl HapticTimeline {
    pub fn on_scroll_to(&mut self, index: usize) -> HapticFeedback {
        if let Some(event) = self.events.get(index) {
            self.haptic_map.get(&event.event_type).cloned()
                .unwrap_or(HapticPattern::Tap { intensity: 0.5, duration_ms: 50 })
        } else {
            HapticPattern::Tap { intensity: 0.1, duration_ms: 20 }
        }
    }
}
```

**Novel because:** TUIs provide no tactile feedback for timeline navigation.

**Complexity:** Medium
**Value:** Medium (accessibility, power users)

---

**End of AI Agent Visualization Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Agent Visualization Primitive Map

The corpus provides primitives across seven distinct display dimensions for agent visualization. Each dimension maps to specific implementations extracted from the analyzed repositories:

### Dimension 1: Streaming Token Display

**Problem:** LLMs output token-by-agent-token. The visualization must render partial content without jarring redraws.

**Primitives:**
- **Bubbletea `Cmd`/`Msg` pipeline** (bubbletea-primitives §2): Async operations return messages that flow through `Update()`. Map each token to a `TokenMsg`; the update loop appends to buffer, triggers re-render. This is the *canonical pattern* for non-blocking streaming in TUIs — pure `Update(Msg) → (Model, Cmd)` means the token stream never blocks the render loop.
- **Bubbletea `spinner.Tick` integration** (17_charmbracelet_coding_agents §2): While tokens arrive, drive a `spinner.Model` on each `TokenMsg`. When the done signal arrives, swap spinner style to success color. The pattern: `case TokenMsg: m.response += msg.Token; if !m.done { return m, spinner.Tick }`.
- **Rich `Live` display** (11_rich_primitives §10): Context manager that auto-refreshes. `with Live() as live:` + `live.update(renderable)` on each chunk. Alternate screen + clear-on-exit. Works for prototyping streaming before building a full TUI.
- **Glamour markdown streaming** (17_charmbracelet_coding_agents §4): `glamour.Render(partialMarkdown, "dark")` re-renders incrementally as tokens arrive. Code blocks get syntax highlighting even mid-stream.

**Key insight:** Never block the render loop on I/O. Bubbletea's command pattern, Rich's `Live` context manager, and Textual's `animate()` all enforce this constraint through different mechanisms.

### Dimension 2: Tool Call Chain Visualization

**Problem:** Agents invoke tools in sequences (possibly nested). The user needs to see: which tools ran, in what order, with what results, and how long each took.

**Primitives:**
- **Textual `Tree` widget** (02_textual_primitives §4): Expandable tree nodes. Each tool call becomes a node; children are parameters and results. Compose with `yield Tree("Tool Calls")` + `tree.root.add(tool_result)`.
- **Rich `Tree` and `Table`** (11_rich_primitives §6-7): `Tree` for hierarchical tool→result chains; `Table` for flat metrics (tool name, duration, status, tokens used). Color cells by status: pending=dim, running=yellow/italic, success=green, error=red/bold.
- **Rich `Syntax`** (11_rich_primitives §8): Pygments-powered code highlighting for tool output that contains code. `Syntax(tool_output, "python", theme="monokai")` renders in-panel.
- **UnicodePlots `Line` plot** (16_UnicodePlots_primitives §3): Inline latency histograms per tool. Braille graphics (2x4 dot pattern per char = 8x resolution) render directly in the terminal without external plot libs. `LinePlot(timestamps, durations)` inside a table cell.
- **Rich `Log`** (11_rich §10, bounded buffer pattern): Circular buffer for tool output with auto-scroll. When buffer fills, oldest lines drop. New lines appear at bottom without full redraw.
- **Bubbletea `Viewport`** (17_charmbracelet_coding_agents §2): Scrollable region for long tool outputs. `viewport.New(w, h)` + `vp.SetContent(output)` + `vp.Style = lipgloss.NewStyle().Border(...)`. Mouse/key scroll.

**Implementation pattern:**
```
Tool Call (expandable)
├── Parameters (collapsed by default)
│   ├── file_path: "src/main.rs"
│   └── line_count: 42
├── stdout (Syntax-highlighted, scrollable Viewport)
├── stderr (red, collapsed)
├── Duration: 230ms  [████░░░░░░] inline bar
└── Children:
    ├── ReadFile → ...
    └── Grep → ...
```

### Dimension 3: Agent State Machine Rendering

**Problem:** Agents move through states (idle→thinking→executing→waiting→done). Each state needs distinct visual encoding.

**Primitives:**
- **Canopy tab lifecycle FSM** (CANOPY_PRIMITIVES §4): `starting → running → (idle|waiting) → (done-success|done-error)`. Maps to exact visual states: Claude Session badge, Workspace Agent badge, status dot color. The `TerminalTabBar` branches UI on both identity (session/agent/project) AND lifecycle state.
- **Canopy attention detection** (CANOPY_PRIMITIVES §11): Regex scans last 500 chars of output for patterns like "Do you want to proceed?" / "Esc to cancel". 5-second cooldown prevents re-fire. Transitions tab to `waiting` state. This is the *critical primitive* for agent visualization — most frameworks lack it.
- **Bubbletea `status.TickMsg` + state-driven styling** (17_charmbracelet_coding_agents §2): In `View()`, switch on `m.status` to emit different lipgloss styles. Add spinner during `running`, solid dot during `idle`, pulsing indicator during `waiting`.
- **Textual `reactive` system** (02_textual_primitives §2): `value = reactive(0)` + `def watch_value(self, old, new)` auto-triggers re-render on state change. No manual `setState()` — the state machine IS the reactive graph.

### Dimension 4: Session Lifecycle & Multi-Agent Dashboard

**Problem:** Production agent systems run multiple concurrent sessions. Users need overview + drill-down.

**Primitives:**
- **Canopy Home Tab** (CANOPY_PRIMITIVES §7): Persistent non-closable tab showing workspace overview (projects, daily plan, GitHub activity, resource usage). Separates navigation context from terminal execution.
- **Canopy split-layout mode** (CANOPY_PRIMITIVES §2): Responsive grid adjusts columns based on tab count (1→2→3+). Essential for comparing agent outputs side-by-side.
- **Bubbletea sub-component composition** (bubbletea-primitives §8.1): Parent model delegates to child models by message type. Route `Agent1Msg` → `agent1.Update()`, `Agent2Msg` → `agent2.Update()`. Commands bubble up.
- **Textual `Screen` stack** (02_textual_primitives §8): `push_screen("agent-detail")` / `pop_screen()`. Per-screen state, screen-specific bindings, transitions between overview and detail views.
- **Rich `Layout`** (11_rich_primitives §5): `Layout().split(Layout("sidebar", size=30), Layout("main"), Layout("footer", size=3))`. Column-based proportional sizing for multi-pane dashboards.
- **Notcurses plane system** (09_notcurses_primitives §1): `ncplane` as virtual drawing surface. Z-order stacking, independent coordinate systems, per-plane dirty tracking. The most powerful primitive for compositing multiple agent views — each agent gets its own plane, planes composite automatically.
- **Tcell `Screen.Show()` diff** (13_tcell_primitives §8): Double-buffered output. Only changed cells written to terminal. When N agents update simultaneously, only their dirty cells emit — critical for multi-agent I/O efficiency.

**Architecture pattern:**
```
┌──────────────────────────────────────────────────┐
│ Home Tab │ Agent1 │ Agent2 │ Agent3 │ + │
├──────────────────────────────────────────────────┤
│                                                   │
│  Notcurses plane 1 (Agent 1)    Notcurses        │
│  ┌──────────────────────┐       plane 2          │
│  │ Running ● 2 prompts  │       (Agent 2)       │
│  │ ▓▓▓▓▓▓░░░ 145 tokens │       ┌───────────┐   │
│  │ Tools: Read→Grep→Edit │       │ Idle ○    │   │
│  └──────────────────────┘       │ Waiting...│   │
│                                  └───────────┘   │
├──────────────────────────────────────────────────┤
│ Status: 2 active, 1 waiting, 156 total tokens    │
└──────────────────────────────────────────────────┘
```

### Dimension 5: Performance & Resource Tracking

**Problem:** Users need real-time visibility into token consumption, latency, cost, and compute usage.

**Primitives:**
- **Rich `Table`** (11_rich_primitives §6): Structured metrics display. Columns: Agent, Tokens In, Tokens Out, Cost, Latency p50/p95/p99. Auto-column sizing, Unicode borders, per-row styling.
- **Rich `Progress` / `ProgressColumn`** (11_rich_primitives §7): Custom columns for token budgets. `Progress(SpinnerColumn(), BarColumn(), "[progress.percentage]{task.percentage:>3.0f}%", TimeRemainingColumn())`. Multiple simultaneous bars for multi-agent.
- **UnicodePlots `Heatmap`** (16_UnicodePlots_primitives §3): Activity heatmap by time-of-day and agent. Braille-encoded density plot. Color-coded by intensity: `░` (low) → `▓` (medium) → `█` (high).
- **UnicodePlots `Histogram`** (16_UnicodePlots_primitives §3): Latency distribution per agent/tool. Inline in terminal without external widgets.
- **Bubbletea `progress.WithSolidFill`** (17_charmbracelet_coding_agents §2): `p := progress.New(progress.WithSolidFill("#89ff69"))` + `p.SetPercent(msg.Percent)`. Minimal API for resource gauges.
- **Textual `Digits`** widget (02_textual_primitives §4): Large number display for key metrics (total tokens, cost in dollars, active agents). Designed for dashboard-style readouts.
- **Textual `DataTable`** (02_textual_primitives §4): Sortable, scrollable tabular data for per-session metrics. `yield DataTable()` + `table.add_columns("Agent", "Tokens", "Cost", "Status")`.

### Dimension 6: Animation & "Alive" State Indicators

**Problem:** Static dashboards feel dead. Agents in "thinking" state need ambient motion to convey liveness.

**Primitives:**
- **Dear ImGui hover/active interpolation** (18_animation_alive_patterns §1): `color.Current = Lerp(color.Current, color.Target, dt * 0.1)`. Smooth color transition over ~10 seconds — never instant. Apply to agent state indicators: idle slowly shifts hue, thinking pulses.
- **React Spring staggered reveal** (18_animation_alive_patterns §1.1): Each agent panel in a multi-agent dashboard animates in with `delay={i * 100}`. `opacity: 0→1, y: 20→0`. Prevents all-at-once pop-in.
- **Spring-back selection** (18_animation_alive_patterns §4): `acceleration = -tension * (position - target) / mass`. When user switches focus between agents, the selection indicator springs smoothly with overshoot. Config: `{mass: 1.0, tension: 170, friction: 0.92}`.
- **Breathing border** (18_animation_alive_patterns §1): `intensity = 0.5 + 0.5*sin(phase)` oscillating at 2 rad/s. Border opacity pulses between 0.3 and 0.8. Signals "agent is alive" without demanding attention.
- **Particle cursor trail** (18_animation_alive_patterns §3): `Particle{X, Y, VX, VY, Life, MaxLife, Char, Color}`. Spawn at cursor on state transition. Gravity pulls down. Fade by life. Adds "digital twin" feel to agent output text.
- **TerminalTextEffects `Effect` state machine** (15_terminaltexteffects_primitives §1): Per-character `CharState{x, y, target_x, target_y, revealed, color}`. Effects: Typewriter (sequential reveal), Scatter (random→center), Wave (sine motion), Fall (gravity). Compose: chain + parallel + groups.
- **TerminalTextEffects HSV cycling** (15_terminaltexteffects_primitives §3): `hue = (frame / total_frames) % 1.0` → `hsv_to_rgb(hue, 1.0, 1.0)`. Error states flash red via saturation cycling. Tool arrivals rainbow-sweep.
- **Scrollbar settle animation** (18_animation_alive_patterns §1, Scrollbar): `scrollVel *= 0.95` friction decay. After user stops scrolling, viewport drifts to rest. Mimics physical momentum.

### Dimension 7: Attention, Notification & Interrupt Handling

**Problem:** Agent produces output requiring user action (permission prompts, errors). TUI must break through.

**Primitives:**
- **Canopy attention detection** (CANOPY_PRIMITIVES §11): Rolling 500-char buffer, regex scan, 5-second cooldown. Transitions to `waiting` state. Dot notification in tab bar. OS notification via `tauri-plugin-notification`.
- **Tcell `EventFocus`** (13_tcell_primitives §6): `FocusMsg` / `BlurMsg` events. Pause animations on blur (save CPU), resume on focus.
- **Bubbletea `Suspend`/`Resume`** (bubbletea-primitives §7.3): `tea.Suspend()` handles Ctrl+Z. On `ResumeMsg`, re-initialize terminal state. Prevents display corruption after shell suspend.
- **Textual `notify()`** (02_textual_primitives §6): `self.notify("Agent needs input!", severity="warning")`. Toast notification with auto-dismiss.
- **Rich `Panel`** (11_rich §2): Boxed alert for attention-required events. `Panel(attention_content, title="Agent Waiting", border_style="yellow")` floats above normal output.
- **Canopy pause-resume input buffers** (CANOPY_PRIMITIVES §20): Reset rolling buffer on user input to prevent re-triggering same attention pattern.

---

## 3.2 Cross-Primitive Architecture Patterns for Agent TUIs

These patterns emerge from combining multiple primitives into cohesive architectures:

### Pattern A: Elm-Architecture Agent Runtime

**Source:** Bubbletea §2 + Charmbracelet §4

```
Token Stream ──→ Cmd(HTTP call) ──→ TokenMsg ──→ Update ──→ View ──→ Render
                     ↑                                              │
                     └──────────── spinner.Tick ←───────────────────┘
```

1. `Init()` fires `Cmd(fetch_agent_response)` (async HTTP)
2. Each HTTP chunk fires `TokenMsg{data}` through the update loop
3. `Update` appends to `m.response`, returns `spinner.Tick` Cmd
4. `View` renders: `spinner.View() + " " + glamour.Render(m.response, "dark")`
5. On `DoneMsg`, `m.done = true`, spinner changes to success color

**Why this works:** The `Cmd` pattern means zero blocking. The `Update` function is pure — testable, replayable, deterministic. The `View` function is a pure function of state — time-travel debuggable.

### Pattern B: Plane-Composited Multi-Agent

**Source:** Notcurses §1 + Tcell §8 + Canopy §2

```
Terminal Screen
├── Plane: Title Bar (z=max, persistent)
├── Plane: Agent 1 (z=3, scrollable, 50% width)
├── Plane: Agent 2 (z=2, scrollable, 50% width)
├── Plane: Sidebar (z=4, overlay, slide-in from left)
└── Plane: Status Bar (z=max-1, persistent)
```

1. Each `ncplane` has its own coordinate system and dirty tracking
2. `ncplane_move_above/below()` handles z-order for focus changes
3. Only damaged cells are re-rendered (notcurses §10 + tcell §8)
4. Canopy split-layout pattern: plane count → column count auto-adjust
5. Resize: only refit visible planes (Canopy §3 — `display:none` skips xterm init)

### Pattern C: Reactive State-Agent Binding

**Source:** Textual §2 + Canopy §4

```python
class AgentDashboard(Screen):
    active_agent = reactive(None)
    agent_states = reactive({})  # id → AgentState

    def watch_active_agent(self, old, new):
        # Auto-switch detail view when agent selected
        self.query_one("#detail-panel").agent = new

    def on_agent_status_changed(self, event: AgentStatusChanged):
        self.agent_states[event.agent_id] = event.new_state
        # Reactive: any widget watching agent_states re-renders

    def compose(self) -> ComposeResult:
        with Horizontal():
            yield AgentList(id="agent-list")  # sidebar
            yield AgentDetail(id="detail-panel")  # main
            yield MetricsPanel(id="metrics")  # right
```

1. `reactive()` attributes auto-trigger `watch_*` methods
2. State changes propagate through the widget tree without explicit `setState`
3. `compose()` generator yields declarative layout — reorder widgets by editing the generator
4. CSS styling responds to state: `AgentWidget.running { border: solid green; }`

### Pattern D: Animation State Machine for Agent Lifecycle

**Source:** Dear ImGui §1 + React Spring §1 + TerminalTextEffects §1 + 18_animation_alive_patterns

```
AgentState::Idle
  → Breathing border (sine opacity 0.3↔0.8 at 2 rad/s)
  → No spinner, muted colors

AgentState::Thinking
  → Spinner activates (Bubbletea spinner.Tick)
  → Border color Lerp→blue (smooth, not instant)
  → Tooltip: "Analyzing..." with 300ms delay + fade-in

AgentState::Executing
  → Progress bar advances (Rich/Progress or Bubbletea/Progress)
  → Tool calls stagger-reveal (i*100ms delay per tool)
  → Inline latency bars (UnicodePlots Line)

AgentState::AwaitingInput
  → Attention pulse (color saturation cycling)
  → Tab dot notification (Canopy §11)
  → Optional: OS notification

AgentState::Error
  → HSV red flash (TerminalTextEffects §3)
  → Error Panel floats above (Rich Panel)
  → Retry button with spring-back animation

AgentState::Success
  → Border Lerp→green
  → Spinner → checkmark (style swap)
  → Staggered fade-out of detail panels
```

Each state transition triggers animation primitives, never instant style swaps. Colors Lerp (Dear ImGui §1), elements spring (React Spring §1), characters animate (TerminalTextEffects §1).

---

## 3.3 Data Flow Integration Map

For implementors building an agent visualization TUI, here is the complete data flow from agent runtime to terminal pixels:

```
                    ┌─────────────────────────────────────┐
                    │         AGENT RUNTIME               │
                    │  (Claude Code / custom / multi)     │
                    └──────────┬──────────────────────────┘
                               │ PTY output (bytes)
                    ┌──────────▼──────────────────────────┐
                    │    OUTPUT PARSER                    │
                    │  • ANSI redaction (Canopy §12)     │
                    │  • Attention regex (Canopy §11)     │
                    │  • Token boundary detection          │
                    └──────────┬──────────────────────────┘
                               │ Tagged events
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
    ┌─────────────┐  ┌──────────────┐  ┌────────────────┐
    │ State FSM   │  │ Token Buffer │  │ Tool Call Log  │
    │ (Canopy §4) │  │ (btea Cmd)   │  │ (Rich Log)     │
    └──────┬──────┘  └──────┬───────┘  └───────┬────────┘
           │                │                   │
           ▼                ▼                   ▼
    ┌─────────────────────────────────────────────────┐
    │              VIEW COMPOSITOR                     │
    │  • Notcurses planes OR Bubbletea View()         │
    │  • Lip Gloss styles OR Textual CSS              │
    │  • Rich renderables (fallback/static)           │
    │  • UnicodePlots inline charts                   │
    └──────────────────────┬──────────────────────────┘
                           │ composed string/cells
    ┌──────────────────────▼──────────────────────────┐
    │            RENDER BACKEND                        │
    │  • Tcell Show() diff (double-buffered)          │
    │  • Notcurses rasterize (dirty region)           │
    │  • xterm.js write (web target)                  │
    │  • Direct ANSI escape sequences (fallback)      │
    └─────────────────────────────────────────────────┘
```

**Critical paths:**
1. **Token stream → View pipeline must never block.** Bubbletea Cmd pattern, Textual async handlers, or Rust mpsc channels — all enforce this.
2. **State → Style mapping must interpolate, never snap.** Dear ImGui color Lerp, React Spring position interpolation, TerminalTextEffects easing functions.
3. **Multi-agent I/O must be parallel.** Notcurses planes (z-order composite), Tcell diff rendering (only dirty cells), Canopy's per-tab xterm.js instance (lazy init).

---

## 3.4 Implementation Priority Matrix

For a team building an agent visualization TUI, ordered by dependency and value:

| Phase | Feature | Primitive Source | LOC Estimate | Priority |
|-------|---------|-----------------|--------------|----------|
| 1 | Token streaming display | Bubbletea Cmd/Msg + Glamour | 200-400 | Critical |
| 1 | Agent state display | Bubbletea state + Lip Gloss styles | 100-200 | Critical |
| 1 | Tool call log | Rich Log pattern + Tree widget | 150-300 | Critical |
| 2 | Attention/notifications | Canopy §11 + Textual notify() | 100-200 | High |
| 2 | Multi-agent tabs | Canopy §2 layout + Bubbletea compositing | 300-500 | High |
| 2 | Performance metrics | Rich Table + UnicodePlots inline | 200-350 | High |
| 3 | Animated transitions | Dear ImGui Lerp + React Spring | 200-400 | Medium |
| 3 | Session persistence | Charm KV/SQLite or localStorage | 100-200 | Medium |
| 3 | Plane compositing | Notcurses plane system | 400-800 | Medium |
| 4 | Devtools/inspector | Textual devtools pattern | 300-500 | Low |
| 4 | Particle effects | 18_animation_alive_patterns §3 | 150-300 | Low |
| 4 | "Digital twin" overlay | Composite of §3.1 Dim 1-7 | 500-1000 | Low |

---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Canopy's Claude Attention State Diagram

Canopy's Claude integration produces a FSM visualization pattern useful for agent dashboards:

```typescript
transitions: {
  // output event
  "any": { "output": "running", effects: ["clearIdleTimer", "scanAttention"] },
  // timer fire
  "running": { "TIMEOUT": "idle" },
  "any": { "BELL": "waiting" },
  "any": { "ATTENTION_PATTERN": "waiting", effects: ["notify"] },
  // user input
  "waiting": { "user_input": "running" },
  "idle": { "user_input": "running" },
  // process exit
  "running": { "EXIT_0": "done-success" },
  "running": { "EXIT_NONZERO": "done-error" }
}
```

**Notification integration points:**
- OS notification on transition to `waiting`
- Visual indicator: cursor changes, tab border glow, prompt color shift
- Dot notification in multi-session channel (e.g., matrix rain in Canopy's tab bar)

**Practical gap:** Canopy does not yet send OS notifications on `waiting` status. The `on_window_event` cleanup runs, but `tauri-plugin-notification` is registered and could dispatch on status change.

---
