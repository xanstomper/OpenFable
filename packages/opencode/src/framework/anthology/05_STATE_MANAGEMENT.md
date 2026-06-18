# Anthology: State Management

> **Subject:** State Management - managing application state, updates, and consistency in TUIs
> **Includes:** How-to Guide + Novel Concepts Report

---

# PART 1: HOW-TO GUIDE

## State Management Mastery

### 5.1 The Elm Architecture for TUIs

**Core Pattern:**
```
┌─────────────┐
│     Model   │  ← Application state
└──────┬──────┘
       │
   ┌───▼───┐
   │ Update│  ← Handle messages, return new model
   └───┬───┘
       │
   ┌───▼───┐
   │  View │  ← Render model to screen
   └───┬───┘
       │
   ┌───▼───┐
   │  Msg  │  ← User input, events, commands
   └───────┘
```

**Implementation:**
```rust
pub trait ElmApp {
    type Model;
    type Msg;
    type Cmd;
    
    fn init() -> (Self::Model, Self::Cmd);
    fn update(model: Self::Model, msg: Self::Msg) -> (Self::Model, Self::Cmd);
    fn view(model: &Self::Model) -> View;
}

// Example: Counter app
struct CounterModel {
    count: i32,
    label: String,
}

enum CounterMsg {
    Increment,
    Decrement,
    SetLabel(String),
    Tick,
}

enum CounterCmd {
    None,
    SaveToFile(String),
    Delay(u64),  // milliseconds
}

impl ElmApp for CounterApp {
    fn init() -> (CounterModel, CounterCmd) {
        (CounterModel { count: 0, label: "Counter".to_string() }, CounterCmd::None)
    }
    
    fn update(model: CounterModel, msg: CounterMsg) -> (CounterModel, CounterCmd) {
        match msg {
            CounterMsg::Increment => {
                (CounterModel { count: model.count + 1, ..model }, CounterCmd::None)
            }
            CounterMsg::Decrement => {
                (CounterModel { count: model.count - 1, ..model }, CounterCmd::None)
            }
            CounterMsg::SetLabel(new_label) => {
                (CounterModel { label: new_label, ..model }, CounterCmd::None)
            }
            CounterMsg::Tick => {
                // Auto-increment every second
                (CounterModel { count: model.count + 1, ..model }, CounterCmd::None)
            }
        }
    }
    
    fn view(model: &CounterModel) -> View {
        View::text(format!("{}: {}", model.label, model.count))
    }
}
```

### 5.2 Immutable State with Lenses

**Problem:** Deeply nested state is tedious to update
**Solution:** Lens-based updates

```rust
#[derive(Clone, Debug)]
pub struct AppState {
    pub user: UserProfile,
    pub settings: Settings,
    pub ui: UIState,
}

#[derive(Clone, Debug)]
pub struct UserProfile {
    pub name: String,
    pub preferences: UserPreferences,
}

#[derive(Clone, Debug)]
pub struct UserPreferences {
    pub theme: Theme,
    pub font_size: u8,
}

// Lens for accessing/modifying nested fields
pub struct Lens<State, Field> {
    getter: fn(&State) -> &Field,
    setter: fn(&mut State, Field) -> State,
}

impl<State, Field> Lens<State, Field>
where
    State: Clone,
    Field: Clone,
{
    pub fn get(&self, state: &State) -> &Field {
        (self.getter)(state)
    }
    
    pub fn set(&self, state: &mut State, new_value: Field) {
        *state = (self.setter)(state, new_value);
    }
    
    pub fn modify<F>(&self, state: &mut State, f: F)
    where
        F: FnOnce(&Field) -> Field,
    {
        let current = (self.getter)(state).clone();
        let new_value = f(current);
        self.set(state, new_value);
    }
}

// Define lenses
pub fn user_lens() -> Lens<AppState, UserProfile> {
    Lens {
        getter: |s| &s.user,
        setter: |s, user| AppState { user, ..s.clone() },
    }
}

pub fn preferences_lens() -> Lens<UserProfile, UserPreferences> {
    Lens {
        getter: |u| &u.preferences,
        setter: |u, prefs| UserProfile { preferences: prefs, ..u.clone() },
    }
}

// Usage: Compose lenses to reach deep fields
let mut state = AppState::default();
let user_lens = user_lens();
let prefs_lens = preferences_lens();

// Modify deeply nested field
user_lens.modify(&mut state, |user| {
    prefs_lens.modify(user, |prefs| {
        UserPreferences {
            font_size: prefs.font_size + 1,
            ..prefs.clone()
        }
    })
});
```

### 5.3 State Subscription and Reactive Updates

**Pattern:** Widgets subscribe to specific state slices, re-render only when relevant state changes.

```rust
pub struct StateTree {
    root: Box<dyn StateNode>,
    subscriptions: HashMap<SubscriptionId, Vec<WidgetId>>,
}

pub trait StateNode {
    fn as_any(&self) -> &dyn Any;
    fn path(&self) -> String;
    fn children(&self) -> Vec<&dyn StateNode>;
}

pub struct Subscription {
    pub id: SubscriptionId,
    pub path: String,  // e.g., "user.preferences.theme"
    pub widget_ids: Vec<WidgetId>,
}

impl StateTree {
    pub fn subscribe(&mut self, path: &str, widget_id: WidgetId) -> SubscriptionId {
        let id = SubscriptionId::generate();
        self.subscriptions
            .entry(id)
            .or_insert_with(Vec::new)
            .push(widget_id);
        id
    }
    
    pub fn update_path<F>(&mut self, path: &str, f: F) -> Vec<WidgetId>
    where
        F: FnOnce(&mut dyn StateNode),
    {
        // Navigate to path, apply update
        let node = self.navigate_to_path_mut(path);
        f(node);
        
        // Return list of widgets that need re-rendering
        self.subscriptions
            .iter()
            .filter(|(_, subs)| subs.iter().any(|s| self.path_matches(&s.path, path)))
            .flat_map(|(_, widget_ids)| widget_ids.clone())
            .collect()
    }
}

// Widget subscribes to state slice
pub struct ThemedWidget {
    subscription: Option<SubscriptionId>,
    current_theme: Theme,
}

impl ThemedWidget {
    pub fn mount(&mut self, state: &mut StateTree) {
        self.subscription = Some(state.subscribe("user.preferences.theme", self.id));
    }
    
    pub fn on_state_change(&mut self, new_theme: Theme) {
        self.current_theme = new_theme;
        self.request_render();
    }
}
```

### 5.4 Undo/Redo with Command Pattern

```rust
pub trait Command {
    fn execute(&mut self, state: &mut AppState);
    fn undo(&mut self, state: &mut AppState);
    fn redo(&mut self, state: &mut AppState);
    fn merge_with(&mut self, other: &dyn Command>) -> Option<Box<dyn Command>>;
}

pub struct UndoStack {
    undo_stack: Vec<Box<dyn Command>>,
    redo_stack: Vec<Box<dyn Command>>,
    max_size: usize,
}

impl UndoStack {
    pub fn execute(&mut self, mut cmd: Box<dyn Command>, state: &mut AppState) {
        cmd.execute(state);
        
        // Merge with previous command if possible (e.g., consecutive typing)
        if let Some(prev) = self.undo_stack.last_mut() {
            if let Some(merged) = prev.merge_with(cmd.as_ref()) {
                self.undo_stack.push(merged);
                self.redo_stack.clear();
                return;
            }
        }
        
        self.undo_stack.push(cmd);
        
        // Trim stack if too large
        while self.undo_stack.len() > self.max_size {
            self.undo_stack.remove(0);
        }
        
        self.redo_stack.clear();
    }
    
    pub fn undo(&mut self, state: &mut AppState) -> bool {
        if let Some(mut cmd) = self.undo_stack.pop() {
            cmd.undo(state);
            self.redo_stack.push(cmd);
            true
        } else {
            false
        }
    }
    
    pub fn redo(&mut self, state: &mut AppState) -> bool {
        if let Some(mut cmd) = self.redo_stack.pop() {
            cmd.redo(state);
            self.undo_stack.push(cmd);
            true
        } else {
            false
        }
    }
}

// Example: Text edit command
pub struct TextEditCommand {
    pub widget_id: WidgetId,
    pub old_text: String,
    pub new_text: String,
}

impl Command for TextEditCommand {
    fn execute(&mut self, state: &mut AppState) {
        let widget = state.get_widget_mut(self.widget_id).unwrap();
        widget.set_text(self.new_text.clone());
    }
    
    fn undo(&mut self, state: &mut AppState) {
        let widget = state.get_widget_mut(self.widget_id).unwrap();
        widget.set_text(self.old_text.clone());
    }
    
    fn redo(&mut self, state: &mut AppState) {
        self.execute(state);
    }
    
    fn merge_with(&mut self, other: &dyn Command) -> Option<Box<dyn Command>> {
        // Merge consecutive text edits in same widget
        if let Some(other_edit) = other.as_any().downcast_ref::<TextEditCommand>() {
            if other_edit.widget_id == self.widget_id {
                return Some(Box::new(TextEditCommand {
                    widget_id: self.widget_id,
                    old_text: self.old_text.clone(),
                    new_text: other_edit.new_text.clone(),
                }));
            }
        }
        None
    }
}
```

### 5.5 State Persistence and Hydration

```rust
pub trait Persistable {
    fn to_serialized(&self) -> serde_json::Value;
    fn from_serialized(value: &serde_json::Value) -> Self;
}

pub struct StatePersister {
    storage_path: PathBuf,
    autosave_interval: Duration,
    last_save: Instant,
}

impl StatePersister {
    pub fn autosave(&mut self, state: &AppState) -> Result<(), Error> {
        if self.last_save.elapsed() < self.autosave_interval {
            return Ok(());
        }
        
        let serialized = serde_json::to_string_pretty(&state.to_serialized())?;
        std::fs::write(&self.storage_path, serialized)?;
        self.last_save = Instant::now();
        
        Ok(())
    }
    
    pub fn load(&self) -> Option<AppState> {
        let content = std::fs::read_to_string(&self.storage_path).ok()?;
        let value: serde_json::Value = serde_json::from_str(&content).ok()?;
        Some(AppState::from_serialized(&value))
    }
}

// Versioned state migration
pub enum AppStateVersion {
    V1(AppStateV1),
    V2(AppStateV2),
    Current(AppState),
}

impl AppState {
    pub fn migrate(old: AppStateVersion) -> AppState {
        match old {
            AppStateVersion::V1(v1) => {
                // Migrate V1 → Current
                AppState {
                    user: v1.user,
                    settings: Settings::default(),  // New in V2
                    ui: v1.ui,
                }
            }
            AppStateVersion::V2(v2) => {
                // Migrate V2 → Current
                AppState {
                    user: v2.user,
                    settings: v2.settings,
                    ui: v2.ui,
                    experiments: Experiments::default(),  // New in Current
                }
            }
            AppStateVersion::Current(current) => current,
        }
    }
}
```

### 5.6 Common Pitfalls

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Mutable shared state | Race conditions, inconsistent UI | Use immutable updates |
| No subscription filtering | Everything re-renders always | Subscribe to specific paths |
| Blocking state updates | UI freezes during save | Use async commands |
| No undo support | User mistakes are fatal | Implement command pattern |
| Version incompatibility | Old saves crash new app | Add migration layer |

---

# PART 2: NOVEL CONCEPTS REPORT

## State Management: Untapped Opportunities

### Concept 1: Time-Travel Debugging with State Snapshots

**Idea:** Automatically snapshot state at regular intervals, enable rewinding to any previous state for debugging.

**How:**
```rust
pub struct TimeTravelDebugger {
    snapshots: Vec<StateSnapshot>,
    snapshot_interval_ms: u64,
    current_index: usize,
    is_playing: bool,
}

pub struct StateSnapshot {
    pub timestamp: u64,
    pub state: serde_json::Value,
    pub events_since_last: Vec<Event>,
    pub checksum: u64,  // Detect corruption
}

impl TimeTravelDebugger {
    pub fn record(&mut self, state: &AppState, events: Vec<Event>) {
        if !self.is_playing {
            let snapshot = StateSnapshot {
                timestamp: current_time_ms(),
                state: serde_json::to_value(state).unwrap(),
                events_since_last: events,
                checksum: compute_checksum(&state),
            };
            
            // Keep last N minutes of history
            self.snapshots.push(snapshot);
            while self.snapshots.len() > self.max_snapshots() {
                self.snapshots.remove(0);
            }
        }
    }
    
    pub fn rewind(&mut self, steps: usize) -> Option<AppState> {
        if self.current_index >= steps {
            self.current_index -= steps;
            let snapshot = &self.snapshots[self.current_index];
            Some(self.deserialize(&snapshot.state))
        } else {
            None
        }
    }
    
    pub fn replay_from(&mut self, index: usize) -> Vec<StateSnapshot> {
        self.current_index = index;
        self.is_playing = false;
        self.snapshots[index..].to_vec()
    }
    
    // Export timeline for external analysis
    pub fn export_timeline(&self) -> TimelineExport {
        TimelineExport {
            snapshots: self.snapshots.iter().map(|s| {
                ExportedSnapshot {
                    timestamp: s.timestamp,
                    event_count: s.events_since_last.len(),
                    state_size: serde_json::to_string(&s.state).unwrap().len(),
                }
            }).collect(),
            total_duration_ms: self.snapshots.last().unwrap().timestamp 
                - self.snapshots.first().unwrap().timestamp,
        }
    }
}
```

**Novel because:** Debugging TUIs currently requires print statements or external log analysis. Built-in time travel enables interactive debugging.

**Complexity:** Medium
**Value:** High (dramatically faster bug diagnosis)

---

### Concept 2: CRDT-Based Collaborative State

**Idea:** Use **Conflict-free Replicated Data Types** for collaborative TUIs where multiple users edit shared state.

**How:**
```rust
use crdts::{GCounter, MVRegister, LWWMap};

pub struct CollaborativeState {
    // Each field is a CRDT that can be merged across instances
    counter: GCounter<UserId>,
    text_buffer: RGA<Char>,  // Replicated Growable Array
    settings: LWWMap<String, serde_json::Value>,
    selections: MVRegister<UserId, Vec<Selection>>,
}

impl CollaborativeState {
    pub fn increment_counter(&mut self, user: UserId) {
        self.counter.increment(user);
    }
    
    pub fn insert_char(&mut self, pos: usize, c: char, user: UserId, timestamp: u64) {
        self.text_buffer.insert(pos, c, user, timestamp);
    }
    
    pub fn merge(&mut self, remote: CollaborativeState) {
        // CRDTs guarantee convergence without conflicts
        self.counter.merge(remote.counter);
        self.text_buffer.merge(remote.text_buffer);
        self.settings.merge(remote.settings);
        self.selections.merge(remote.selections);
    }
}

// Synchronization over network
pub struct StateSync {
    local_state: CollaborativeState,
    peer_states: HashMap<PeerId, CollaborativeState>,
}

impl StateSync {
    pub fn receive_update(&mut self, peer: PeerId, delta: StateDelta) {
        if let Some(remote) = self.peer_states.get_mut(&peer) {
            remote.merge(delta.state);
            
            // Merge into local state
            self.local_state.merge(remote.clone());
            
            // Broadcast merged state to other peers
            self.broadcast_to_others(peer, &self.local_state);
        }
    }
}
```

**Novel because:** TUIs are inherently single-user. CRDTs enable real-time collaborative TUIs (like Google Docs for terminal).

**Complexity:** Very High
**Value:** High (enables entirely new class of collaborative terminal apps)

---

### Concept 3: Semantic State Diffing with Intent Preservation

**Idea:** Diff state **semantically** (by intent/meaning) rather than structurally, preserving user intent across updates.

**How:**
```rust
pub enum StateChangeIntent {
    UserEdit(String),      // User explicitly changed this
    AutoUpdate,            // System update (e.g., timestamp)
    Derived,               // Computed from other state
    External,              // From network/file
}

pub struct SemanticDiff {
    pub path: String,
    pub old_value: serde_json::Value,
    pub new_value: serde_json::Value,
    pub intent: StateChangeIntent,
    pub should_animate: bool,
    pub priority: ChangePriority,
}

pub struct SemanticState {
    state: AppState,
    intent_annotations: HashMap<String, StateChangeIntent>,
}

impl SemanticState {
    pub fn set_with_intent<F>(&mut self, path: &str, intent: StateChangeIntent, f: F)
    where
        F: FnOnce(&mut AppState),
    {
        f(&mut self.state);
        self.intent_annotations.insert(path.to_string(), intent.clone());
    }
    
    pub fn diff_semantic(&self, old: &SemanticState) -> Vec<SemanticDiff> {
        let structural_diff = compute_structural_diff(&old.state, &self.state);
        
        // Enrich with intent information
        structural_diff
            .into_iter()
            .map(|d| {
                let intent = self.intent_annotations
                    .get(&d.path)
                    .cloned()
                    .unwrap_or(StateChangeIntent::AutoUpdate);
                
                SemanticDiff {
                    should_animate: matches!(intent, StateChangeIntent::UserEdit(_)),
                    priority: self.compute_priority(&d.path, &intent),
                    ..d
                }
            })
            .collect()
    }
    
    fn compute_priority(&self, path: &str, intent: &StateChangeIntent) -> ChangePriority {
        match intent {
            StateChangeIntent::UserEdit(_) => ChangePriority::High,
            StateChangeIntent::External if path.contains("error") => ChangePriority::Critical,
            _ => ChangePriority::Normal,
        }
    }
}

// Usage: Animate only user-edited fields
let diffs = new_state.diff_semantic(&old_state);
for diff in diffs {
    if diff.should_animate {
        animate_transition(&diff.path, &diff.old_value, &diff.new_value);
    } else {
        apply_instant(&diff.path, &diff.new_value);
    }
}
```

**Novel because:** Current state diffing is purely structural (what changed). Semantic diffing understands why it changed, enabling smarter animations and updates.

**Complexity:** High
**Value:** Medium (smoother UX, better user understanding of changes)

---

**End of State Management Anthology**

---



# PART 3: ENHANCED CONTENT FROM COLLECTIVE PRIMITIVE ANALYSIS

## 3.1 Reactive State from Textual and Bubbletea

Textual's `reactive` system (`value = reactive(0)`) with `watch_value(self, old, new)` auto-called on change is the TUI equivalent of Vue's computed properties. Validators run before assignment: `def validate_value(self, value) -> int:` can reject or transform. Computed properties: `computed = reactive(lambda: value * 2)`. Type coercion is automatic. Bubbletea's Elm-architecture `Model` + `Update(msg, model) -> (model, Cmd)` pattern provides the same guarantee through a different shape: state updates are always in `update()`, never scattered. Both produce the same invariant: state changes flow through a single function, making diffing and undo trivial.

### 3.1a Textual's Reactive System in Detail

Textual implements three distinct reactive mechanisms that can be ported to any TUI framework:

**1. Reactive Attributes with Automatic Re-render:**
```python
class MyWidget(Widget):
    value = reactive(0)
    enabled = reactive(True)
    
    # Watchers automatically called when value changes
    def watch_value(self, old: int, new: int):
        self.update_display()
```
The key insight: the `reactive()` descriptor intercepts `__set__` on the attribute. On every assignment, Textual checks if the value changed (old != new), and if so, schedules a refresh of the widget. This eliminates the largest class of TUI bugs — forgetting to call `refresh()` after state mutation.

**2. Validators Before Assignment:**
```python
def validate_value(self, value: int) -> int:
    if value < 0:
        raise ValueError("Value must be positive")
    return value
```
Validators run synchronously before the value is committed. They can reject (raise) or transform (return modified value). This is strictly more powerful than checking after the fact because it prevents invalid state from ever existing — the model is always valid.

**3. Computed Properties:**
```python
computed_value = reactive(lambda: value * 2)
```
Computed properties are reactive values derived from other reactives. They recompute only when a dependency changes, and their watchers fire only when the derived value actually changes (not when any dependency changes). This avoids cascading re-renders.

### 3.1b Bubbletea's Command Pattern for Side Effects

Bubbletea separates state mutation (pure `Update` function) from side effects (`Cmd`). Commands are functions `func() Msg` that run asynchronously and return a message when done. Two critical combinators:

```go
// Batch: run commands concurrently
func Batch(cmds ...Cmd) Cmd

// Sequence: run commands in order  
func Sequence(cmds ...Cmd) Cmd
```

This matters for state management because side effects (file I/O, network calls, timers) cannot corrupt the model mid-render. The pattern: `Update` returns `(model, cmd)`, the runtime spawns `cmd` in a goroutine, and when it completes, the resulting `Msg` is fed back into `Update`. The model is only ever mutated in `Update`, never in a command.

### 3.1c Convergence: Single Update Function

Both Textual and Bubbletea converge on the same architectural invariant: **state changes flow through exactly one function.** Textual routes all state through reactive setters that funnel into the framework's render cycle. Bubbletea funnels everything through `Model.Update(Msg) -> (Model, Cmd)`. This makes:

- **Undo/redo trivial**: capture the sequence of inputs (messages/reactive assignments), replay forward
- **Time-travel debugging possible**: snapshot model at each state transition
- **Testing deterministic**: `(model, msg) -> (new_model, cmd)` is a pure function (modulo command generation)

### 3.1d Urwid's Signal System as a Third Model

Urwid offers a third approach to reactive state: the observer pattern. Widgets define signals, and other widgets subscribe:

```python
class Button(Widget):
    __signals__ = ['clicked']
    
    def _emit(self):
        emit_signal(self, 'clicked')

def on_click(button):
    print("Clicked!")

urwid.connect_signal(button, 'clicked', on_click)
```

Key property: weak references. Urwid holds weak references to signal handlers, preventing memory leaks when widgets are destroyed without explicit unsubscribe. This is the TUI equivalent of automatic event listener cleanup in modern web frameworks.

**Tradeoff:** Signals are more flexible than Bubbletea's typed messages but less auditable. With signals, any part of the system can connect to any signal — great for decoupling, hard to trace for debugging. With Bubbletea's message system, the `Update` function is a complete manifest of every state transition.

---

## 3.2 Undo/Redo as Event Sourcing

The undo/redo primitive from Urwid and libtcod converges on event sourcing: store state mutations as a list of `Command` objects (from Dotgrid's Command pattern), not as before/after snapshots. Each command has `execute(state)` and `undo(state)`. Stack execution is push-forward, undo is pop-and-invert. Redo stack mirrors undo. Merge consecutive edits in the same field (Dotgrid pattern). Limit stack size by evicting oldest entries. Expose `Ctrl+Z` / `Ctrl+Y` bindings. Preserve undo/redo separately from session state persistence — undo history is ephemeral, session state is durable.

### 3.2a Dotgrid's Command Pattern as the Canonical Reference

Dotgrid's undo stack is the cleanest reference implementation. The pattern from Dotgrid's source:

1. Every user action creates a `Command` struct (not a method — a data structure)
2. Commands are pushed to a stack array
3. Undo pops the stack, calls `undo()`, and moves the command to a redo stack
4. Redo pops the redo stack, calls `redo()`, pushes back to undo stack
5. New commands clear the redo stack

The data-structure approach (over method-based) is significant: commands can be serialized for crash recovery, logged for debugging, or transmitted over network for collaborative undo.

### 3.2b Urwid's Canvas Memoization as State Cache

Urwid introduces `CacheCanvas` — a canvas that memoizes its rendered output and invalidates only when content changes:

```python
class CacheCanvas(Canvas):
    def __init__(self, canvas):
        self._original = canvas
        self._cache = None
        self._valid = False
    
    def get_data(self):
        if not self._valid:
            self._cache = self._original.get_data()
            self._valid = True
        return self._cache
```

For state management: the same principle applies to expensive derived state. Cache the result of computation over state, invalidate only when the specific state slice changes. This is exactly what Textual's `computed` reactive does, but Urwid's version is explicit and controllable.

### 3.2c Temporal State from Urwid's 20-Year Refinement

Urwid's longevity (2004-present) means its state management patterns have survived refactors that killed lesser frameworks. Key enduring patterns:

- **Content tracking**: Every canvas knows when it was last rendered and when the source data changed, enabling smart dirty-region tracking
- **Attribute encoding**: State (colors, styles) is encoded directly into the rendering pipeline as `attr_string` tuples, making the state→render path zero-allocation
- **Multiple display backends**: The same state tree renders to curses, raw terminals, HTML, and web — proving that proper state separation from rendering works

---

## 3.3 Finite State Machines for Agent Lifecycle

Canopy's tab FSM (`starting → idle → running → {idle | waiting} → {done-success | done-error}`) generalizes to any TUI that manages async agent processes. The pattern:

1. **States are data**: `enum Status { Starting, Idle, Running, Waiting, DoneSuccess, DoneError }` — not methods on a class, not polymorphism. Pure data that drives UI rendering and behavior branching.
2. **Transitions are explicit**: Every state change is a named transition with a trigger condition. No hidden transitions.
3. **Terminal states are distinct**: `DoneSuccess` vs `DoneError` produce different UI (relaunch prompt vs error display). The distinction is data, not logic.

### 3.3a FSM Implementation Pattern for TUIs

```rust
pub enum AgentStatus {
    Starting,
    Idle,
    Running,
    WaitingForInput { prompt: String },
    DoneSuccess,
    DoneError { code: i32 },
}

pub struct AgentTab {
    pub id: String,
    pub status: AgentStatus,
    pub output_buffer: String,
    pub idle_timer: Option<Instant>,
}

impl AgentTab {
    pub fn transition(&mut self, event: AgentEvent) -> Vec<UIAction> {
        match (&self.status, event) {
            (AgentStatus::Starting, AgentEvent::Output(_)) => {
                self.status = AgentStatus::Running;
                vec![UIAction::ResetIdleTimer]
            }
            (AgentStatus::Running, AgentEvent::Output(text)) => {
                self.output_buffer.push_str(&text);
                vec![UIAction::AppendOutput(text), UIAction::ResetIdleTimer]
            }
            (AgentStatus::Idle, AgentEvent::AttentionPattern(_)) => {
                self.status = AgentStatus::WaitingForInput { 
                    prompt: "Permission required" 
                };
                vec![UIAction::ShowNotificationDot, UIAction::ResetIdleTimer]
            }
            (AgentStatus::WaitingForInput { .. }, AgentEvent::UserInput(_)) => {
                self.status = AgentStatus::Running;
                self.output_buffer.clear();  // Reset to prevent re-trigger
                vec![UIAction::ClearBuffer, UIAction::ResetIdleTimer]
            }
            (_, AgentEvent::Exit { code }) => {
                self.status = if code == 0 {
                    AgentStatus::DoneSuccess
                } else {
                    AgentStatus::DoneError { code }
                };
                vec![UIAction::ShowRelaunchPrompt]
            }
            // No-op transitions: (Running, Output) already handled; all other combos are identity
            (current, _) => {
                vec![]  // No state change, no UI action
            }
        }
    }
}
```

The key design decisions:
- **`&self.status` match in arm**: The current state is always available for branch logic (unlike `self.status = ...` which consumes)
- **Transitions return `Vec<UIAction>`**: State transitions and UI effects are coupled but documented — each transition declares what UI changes it triggers
- **Buffer reset on state re-entry**: Prevents attention-loop bugs (same prompt triggering attention again after user responds)

---

## 3.4 Shared State via Refs (Stale Closure Avoidance)

Canopy's "Partially Shared State via Refs" pattern solves a fundamental problem in reactive TUIs: callbacks that outlive the render that created them capture stale state. The solution:

```typescript
const tabsRef = useRef(tabs);
tabsRef.current = tabs;  // Updated every render

// Long-lived callback always reads latest:
const onTerminalSpawned = useCallback((id) => {
    const currentTabs = tabsRef.current;  // Never stale
    // ...
}, []);  // Empty deps — callback identity is stable
```

**The principle:** When a callback must be stable (assigned to a long-lived listener like xterm.js `onData`) but needs current state, store the state in a ref and update the ref on every render. The callback reads the ref, not the closure.

This is the React-ism version of a pattern that appears in every mature TUI framework:
- **Textual**: The `reactive` descriptor avoids closures entirely by intercepting attribute access
- **Bubbletea**: The `Update` function is called fresh every tick — no stale closures possible
- **Urwid**: Signal handlers are bound at connect-time but receive the widget as first arg, giving access to current state

The ref pattern is the most portable because it works in any language with mutable references.

---

## 3.5 Split-Persistence Strategy

Canopy demonstrates a critical persistence decision: **not all state uses the same storage mechanism.**

| Storage | Use Case | Latency | Reliability |
|---------|----------|---------|-------------|
| localStorage | Tab layout, UI state, dismissed items | ~0ms (sync) | Survives refresh, not crash |
| SQLite | Project data, planner tasks, structured records | ~1ms | ACID, survives crash |
| In-memory only | Undo history, transient focus state, PTY buffers | 0ms | Lost on unmount |

The anti-pattern: putting everything in one layer. Persistent UI state in SQLite adds latency for no benefit. Structured app data in localStorage risks corruption and size limits.

**For TUIs specifically**: session state (window layout, cursor position, scroll position) should be fast-persistence (localStorage or flat file). Structured app data (project config, user preferences, undo history) should be durable (SQLite or embedded KV like Charm/BadgerDB). Ephemeral state (current animation frame, pending API responses) should be in-memory only.

### 3.5a Charm KV for Embedded State Persistence

Charm provides an offline-first embedded KV store built on BadgerDB with optional cloud sync:

```go
db, _ := kv.OpenWithDefaults("talon-state")
defer db.Close()

// Set state atomically
db.Set([]byte("window.layout"), []byte(layoutJSON))

// Sync with cloud (async)
db.Sync()
```

Features relevant to TUI state management:
- **End-to-end encryption**: State is encrypted before leaving the device
- **Multi-device sync**: State follows the user across machines
- **Offline-first**: Local BadgerDB instance works without network
- **Binary data**: Store arbitrary bytes (serialized state, buffers, snapshots)
- **Atomic transactions**: Multiple state fields updated atomically

### 3.5b Tauri's Typed Channel for Backend State Sync

Canopy's Rust→React communication uses `Channel<TerminalEvent>` with a tagged enum:

```rust
enum TerminalEvent {
    Output { data: Vec<u8> },
    Exit { code: Option<i32> },
}
```

The state management insight: **strongly typed IPC prevents desynchronization**. Each message variant carries exactly the data needed for its state transition. The Rust backend owns the PTY state machine; the React frontend owns the visual representation. The channel is the single source of truth for state synchronization.

For TUIs: if your state lives partially in Rust (rendering engine) and partially in Go (Bubble Tea model), define a typed FFI protocol — not raw strings or JSON. Use protobuf/cap'n proto/framed enums.

---

## 3.6 Validation and Field State from Huh

Huh's form library contributes several state management patterns that generalize beyond forms:

### 3.6a The Accessor Pattern: Decoupling State Storage from Field Logic

Huh separates *where* a value lives from *how* it's validated and rendered:

```python
class PointerAccessor(Generic[T]):
    """Bind to external variable"""
    def __init__(self, ref: list[T]):
        self.ref = ref  # Use list for mutability
    
    def get(self) -> T:
        return self.ref[0]
    
    def set(self, value: T):
        self.ref[0] = value

class MapAccessor(Generic[T]):
    """Store in dictionary by key"""
    def __init__(self, map: dict, key: str):
        self.map = map
        self.key = key
    
    def get(self) -> T:
        return self.map.get(self.key)
    
    def set(self, value: T):
        self.map[self.key] = value
```

This means the same field component can bind to any storage backend — a local variable, a map key, a database column — without changing the field's validation or rendering logic. For TUIs: the same input component should work whether its state lives in the model, in a parent's state, or in a database.

### 3.6b The Eval Pattern: Computed / Derived State

Huh's `Eval` type implements cached derived state:

```python
class Eval(Generic[T]):
    def get(self) -> T:
        current_hash = hash(self.bindings)
        if current_hash != self._old_bindings_hash:
            self._cache = self.fn()
            self._old_bindings_hash = current_hash
        return self._cache
```

This is a hand-rolled version of Textual's `computed` reactive. The pattern: compute a derived value, cache it, invalidate when dependencies change (detected by hash comparison). For TUIs with expensive derived state (syntax highlighting, layout calculations), this avoids redundant computation.

### 3.6c Focus/Blur as State Machine Transitions

Huh's fields have explicit focus state transitions:

```python
class Field(ABC):
    @abstractmethod
    def focus(self) -> Optional['Cmd']:
        """Called when field gains focus — initialize cursor, show help"""
        pass
    
    @abstractmethod
    def blur(self) -> Optional['Cmd']:
        """Called when field loses focus — validate, save draft"""
        pass
```

This is a micro-FSM embedded in every field. The pattern generalizes: every TUI component that can be focused should have `on_focus` and `on_blur` handlers. On focus: restore cursor position, load draft state, show contextual help. On blur: validate, persist draft, release resources.

---

## 3.7 Streaming State for AI Agent UIs

Charmbracelet's coding agent patterns from the ecosystem analysis add a critical state management pattern unique to AI agent TUIs: **progressive state enrichment from streaming data**.

```go
type streamingModel struct {
    spinner     spinner.Model
    response    string
    done        bool
}

func (m streamingModel) Update(msg Msg) (Model, Cmd) {
    switch msg := msg.(type) {
    case TokenMsg:
        m.response += msg.Token
        if !m.done {
            return m, spinner.Tick
        }
        return m, nil
    case DoneMsg:
        m.done = true
        return m, nil
    }
}
```

The state management insight for agent TUIs: state is **incrementally revealed**. The model begins with an empty response field and grows with each token. The spinner state is orthogonal — it runs its own tick cycle independent of the response accumulation. Multiple independent state machines compose in a single `Update` function.

**For state management design in agent TUIs:**
1. **Separate streaming state from terminal state**: A spinner's tick cycle and a response buffer are independent; don't couple them
2. **State grows by accumulation**: Append-only state (response tokens, output lines) is easier to manage than replacement state
3. **Completion is a state transition**: `DoneMsg` transitions from streaming to complete — this is an FSM transition, not a boolean flag
4. **Viewport scroll state is separate from content state**: The user can scroll while content streams; the scroll offset is an independent state dimension


---

# PART 4: CANOPY PRIMITIVES INTEGRATION

## 4.1 Canopy's Tab State Machine

Canopy uses a finite state machine for terminal tabs in the `useTerminal` hook:

```
starting → idle → running → { idle | waiting } → { done-success | done-error }
```

Transitions:
- `output event` → `running` (idle timer reset)
- `idle timer fires` → `idle`
- bell or attention-pattern match → `waiting`
- `user input` → resets buffer, `running`
- `exit { code }` → `done-success` (code === 0) / `done-error`
- `done-*` → UI shows relaunch prompt instead of resuming

**Persistence via `localStorage`:**
All tabs (except active PTY handles) are serialized under key `canopy-tab-sessions`:
```typescript
localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
  tabs: [{ id, label, isClaudeSession, projectPath, sessionId }],
  activeTabId,
}));
```

**Home tab pattern:**
```typescript
export const HOME_TAB_ID = "home";
// Hardcoded — never closable
<TermTab label="Home" isActive={...} onClose={() => {}} />
```

**Adjacency-aware tab closing:**
When the active tab is closed, the hook selects the tab at the closed tab's index in the remaining array — preferring the right neighbor, then left — rather than always reverting to Home.

---

## 4.2 Provider-Aware State Injection

Canopy stores AI provider configuration in `Arc<Mutex<Option<ProviderSettings>>>` and injects it at process spawn time. The state management insight: **environment state is part of application state.** Provider selection, model override, and API keys are not just configuration — they're state that the user changes at runtime and that affects process behavior.

Pattern for TUIs:
```rust
pub struct ProviderState {
    pub current: Provider,  // Direct | Bedrock | Vertex
    pub model_override: Option<String>,
    pub credentials: HashMap<String, String>,  // Keyring-backed
}

impl ProviderState {
    pub fn to_env_vars(&self) -> Vec<(String, String)> {
        match self.current {
            Provider::Direct => vec![],
            Provider::Bedrock => vec![
                ("CLAUDE_CODE_USE_BEDROCK".into(), "1".into()),
                ("AWS_REGION".into(), self.credentials["aws_region"].clone()),
                // ...
            ],
            // ...
        }
    }
}
```

**Anti-pattern:** Hardcoding provider selection at build time. **Correct approach:** Provider is runtime state, changeable without restart, with credentials managed by the OS keyring (not stored in application state).

---

## 4.3 Attention State Detection

Canopy implements pattern-based attention detection — scanning terminal output for prompts that require user response. This is a **state derivation** pattern: the attention state is not set by user action but derived from output content.

```rust
const ATTENTION_PATTERNS: &[&str] = &[
    "Do you want to proceed?",
    "Esc to cancel",
    "Allow once",
    "Allow always",
];

fn detect_attention(output: &str) -> bool {
    ATTENTION_PATTERNS.iter().any(|p| output.contains(p))
}
```

Key design decisions:
- **Rolling 500-char buffer**: Only the last 500 characters are kept for scanning (memory efficiency)
- **5-second cooldown**: Prevents flickering when a prompt is repeatedly matched
- **Buffer reset on user input**: Clears the rolling buffer when the user types (prevents re-triggering on same prompt)

**Generalized pattern:** Any TUI that displays subprocess output can derive state (attention, error, completion) from output patterns. Keep the pattern matching separate from the state machine — it's a pure function `output → Optional<StateTransition>`.

---

# PART 5: CONSOLIDATED STATE MANAGEMENT PATTERN INDEX

## 5.1 Pattern Taxonomy

| # | Pattern | Source | Framework | Use When |
|---|---------|--------|-----------|----------|
| 1 | Reactive Attributes with Watchers | Textual | Python TUI | State changes should auto-trigger re-render |
| 2 | Elm Architecture (Model-Update-View) | Bubbletea, Canopy | Go, React | Unidirectional data flow, pure state transitions |
| 3 | Typed Message System | Bubbletea, Urwid | Go, Python | All state changes are explicit, auditable events |
| 4 | Command Pattern (Side Effects) | Bubbletea, Dotgrid | Go, JS | Async operations must be separated from state mutation |
| 5 | Accessor Pattern (Value Binding) | Huh | Go | Same UI component, different storage backends |
| 6 | Lens-Based Immutable Updates | Part 1 original | Rust | Deeply nested state, functional style |
| 7 | State Tree with Path Subscriptions | Part 1 original | Rust | Large state, selective re-rendering |
| 8 | Finite State Machine (Lifecycle) | Canopy, Charm agents | React, Go | Tab/agent lifecycle with distinct terminal states |
| 9 | Typed IPC / Channel Sync | Canopy (Tauri) | Rust↔TS | Backend-frontend state synchronization |
| 10 | Split Persistence (localStorage + SQLite) | Canopy | Web/Tauri | Different state lifetimes require different storage |
| 11 | Shared State via Refs (Stale Closure fix) | Canopy | React | Long-lived callbacks need current state |
| 12 | Embedded Encrypted KV (Charm/BadgerDB) | Charm | Go | Offline-first, encrypted state persistence |
| 13 | Streaming State Accumulation | Charmbracelet agents | Go | AI response streaming, incremental state growth |
| 14 | Undo/Redo as Event Sourcing | Dotgrid, Urwid | JS, Python | User actions are reversible |
| 15 | Semantic State Diffing with Intent | Part 2 original | Any | Animate user edits, skip system updates |
| 16 | Time-Travel Debugging | Part 2 original | Any | Record/replay for debugging |
| 17 | CRDT Collaborative State | Part 2 original | Any | Multi-user concurrent editing |
| 18 | Content-Validated Reactive Setters | Textual | Python | Invalid state must be impossible |
| 19 | Signal System (Observer) | Urwid | Python | Decoupled event-driven communication |
| 20 | Eval / Derived State Cache | Huh | Go | Expensive computed values, cache invalidation |

## 5.2 Decision Tree: Which Pattern to Use

```
Is your state local to one component?
├── YES → Use Reactive Attributes (Pattern 1) or simple struct fields
│   └── Need deep nesting? → Lenses (Pattern 6)
│
└── NO → Does state need to survive process restart?
    ├── YES → Is it structured data?
    │   ├── YES → Persistence layer (Pattern 10 — SQLite or KV)
    │   └── NO → localStorage / flat file (Pattern 10)
    │
    └── NO → Is it shared across backend/frontend boundary?
        ├── YES → Typed IPC (Pattern 9) + Ref-based stale closure fix (Pattern 11)
        │
        └── NO → Is it a lifecycle state with distinct phases?
            ├── YES → FSM (Pattern 8)
            │   └── Need undo/redo? → Event sourcing (Pattern 14)
            │
            └── NO → Is it async/streaming?
                ├── YES → Streaming accumulation (Pattern 13) + Commands (Pattern 4)
                │
                └── NO → State Tree with Subscriptions (Pattern 7)
```

## 5.3 Anti-Patterns Compendium (Expanded)

| Anti-Pattern | Source | Symptom | Fix |
|------------|--------|---------|-----|
| Mutation inside `View()` | Study Report Cluster 1 | Stuttering re-renders | Separate render state from animation state |
| Stale closures in callbacks | Canopy analysis | Callbacks see old state | Ref pattern (Pattern 11) or Elm architecture |
| Single storage for all state | Canopy analysis | Latency for transient data, corruption risk for structured | Split persistence (Pattern 10) |
| Untyped state changes everywhere | Urwid/Bubbletea comparison | Impossible to trace state transitions | Typed message system (Pattern 3) |
| Commands that mutate state | Bubbletea analysis | Race conditions, inconsistent model | Commands only return Msg; state mutates in Update only |
| Attention detection without cooldown | Canopy analysis | Flickering notification state | Cooldown timer + buffer reset on user input |
| Mixed identity and lifecycle state | Canopy analysis | Complex branching logic | Separate enums: one for identity, one for lifecycle |
| Hardcoded provider at build time | Canopy analysis | Can't switch models at runtime | Runtime provider state (Section 4.2) |
| Validator after assignment | Textual comparison | Invalid state exists transiently | Validate before commit (Pattern 18) |
| Signal chains with cycles | Signal system analysis | Stack overflow, infinite loops | Break cycles, use messages for core flow |

---

**End of Enhanced State Management Anthology**
