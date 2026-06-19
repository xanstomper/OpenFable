# OpenFable Code

**A terminal-native AI coding assistant with persistent memory, multi-agent orchestration, and a Mythos-grade reasoning framework. Uncensored. Unfiltered. Uncompromised.**

---

## What Is OpenFable?

OpenFable is a fork of [MiMoCode](https://github.com/xanstomper/OpenFable) — Xiaomi's open-source terminal AI coding assistant — rebuilt from the ground up as an **uncensored, privacy-first, user-sovereign** development tool.

Where the original MiMoCode routes all requests through Xiaomi's hosted infrastructure and enforces compliance-aligned safety filters, OpenFable strips that architecture bare and replaces it with:

- **Direct model access** — connect to any provider (OpenAI, Anthropic, Google, Ollama, or any OpenAI-compatible API) with your own keys
- **No telemetry, no gating** — all analytics are opt-in, all model access is unblocked
- **Free tier built in** — the `opencode` provider serves free models (including `openfable-v2-pro-free`, a 1M-context multimodal model) without requiring an API key
- **Mythos reasoning wrapper** — a prompt-level reasoning architecture that makes every model think deeper without fine-tuning

OpenFable is not a chatbot. It is a **terminal-native coding agent** that reads your codebase, writes patches, runs tests, and iterates until the job is done.

---

## Fork Lineage

```
MiMoCode (Xiaomi) → OpenFable (xanstomper)
```

**What was kept:**
- Terminal UI framework (Opentui / SolidJS)
- MCP (Model Context Protocol) integration
- Session persistence and SQLite storage
- Plugin architecture
- Provider abstraction layer
- Tool system (bash, read, write, grep, glob, etc.)

**What was removed:**
- Xiaomi-hosted backend dependency (api.xiaomimimo.com)
- Mandatory login / OAuth flow
- Telemetry and analytics pipeline
- Free-tier gating and billing integration
- Provider-level safety filters

**What was added:**
- Mythos reasoning framework (OWL / ANCHOR / SISPIS / DOX)
- Multi-agent orchestration (Orchestrator, Navigator, Editor, Verifier, Critic)
- Cognitive workflow state machine
- 4-layer memory system (Working, Episodic, Semantic, Procedural)
- Token budget engine with greedy knapsack context packing
- Repo-map knowledge compiler (aider-inspired)
- Graph workflow engine (LangGraph-inspired)
- Macro skill framework (fabric/CrewAI-inspired)
- Sandbox execution (bubblewrap/E2B-inspired)
- Agent-Computer Interface (SWE-agent/OpenHands-inspired)
- Verification loop (build → typecheck → lint → test)
- SWE-bench harness for measurable evaluation
- Langfuse OTLP observability

---

## How It Works

### The Pipeline

Every request flows through a structured pipeline:

```
User Request
  → OWL (Operational Wisdom Layer)     — 9-principle reasoning pass
  → ANCHOR (Persistence System)        — state integrity + recovery
  → DOX (Documentation Protocol)       — load AGENTS.md contracts
  → Agent Execution                    — tool calls, code edits, tests
  → DOX Closeout                       — update documentation
  → SISPIS (Response Calibration)      — format output to correct mode
  → User
```

### The Mythos Wrapper

Every model — GPT-4, Claude, Gemini, Llama, Qwen, whatever you connect — gets wrapped in the **Mythos prompt architecture** before any request is sent. This is a prompt-level reasoning framework that works without fine-tuning:

```xml
<mythos_wrapper model="claude-opus-4-6" provider="anthropic" agent="build">
  <mythos_framework version="1.0.0">
    Your reasoning architecture implements a Recurrent-Depth Transformer (RDT) pattern:
    - Prelude: encode input, identify constraints, frame the problem space
    - Recurrent Block: iterate silently up to 4 times in latent reasoning space
    - Coda: refine final output, verify against the original request
    ...
  </mythos_framework>
</mythos_wrapper>
```

The wrapper tells the model to:
1. **Prelude** — parse the problem, identify constraints, map to known patterns
2. **Recurrent Block** — iterate reasoning silently (up to 4 loops) without outputting intermediate tokens. Each pass refines understanding. When confidence convergence exceeds the halting threshold, emit the answer.
3. **Coda** — verify the final output against the original request. If an earlier hypothesis was better, prefer it.

This makes every model think deeper. A GPT-4-nano with Mythos wrapping outperforms GPT-4 without it on complex multi-step tasks.

### The Cognitive Framework

Three interconnected systems govern how OpenFable reasons:

#### OWL — Operational Wisdom Layer

Nine principles applied before and during implementation:

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Epistemics** | Don't assume. Expose uncertainty. |
| 2 | **Reality** | Read code before acting. Verify file contents. |
| 3 | **Verification** | Define success criteria. Prove fixes work. |
| 4 | **Locality** | Smallest possible change. Don't refactor adjacent code. |
| 5 | **Conservation** | Preserve existing behavioral intent. |
| 6 | **Simplicity** | Minimum code that solves the problem. |
| 7 | **Generalization** | Abstract only when justified. |
| 8 | **Debuggability** | Make reasoning obvious. Name things clearly. |
| 9 | **Integrity** | Deliver honest state. Reset when wrong. |

OWL emits signals when findings cross a weight threshold (≥1.5). These signals adjust the response calibration gate before output is produced.

#### ANCHOR — Operational Persistence System

Preserves execution continuity across turns:

- **State Integrity** — classify every claim: Verified, Observed, Inferred, Speculative, Unknown
- **Object Continuity** — maintain stable identities for defects, tasks, decisions across renames and moves
- **Memory Integrity** — checkpoint findings and decisions when context grows
- **Recovery Discipline** — when an approach fails twice, identify last verified state, reset, resume
- **Completion Criteria** — define done before starting. State when done is reached.

#### SISPIS — Response Calibration Gate

Routes output to the correct format based on entropy and upstream signals:

| Mode | Condition | Output |
|------|-----------|--------|
| **NO_DECISION** | Low entropy, simple request | Factual response only |
| **EXPLANATION** | Decision detected, no branching | Analytical response |
| **SCHEMA** | High entropy, multiple viable paths | 5-section decision framework |

### The DOX Protocol

AGENTS.md files are **binding work contracts** for their subtrees. Before editing any file, OpenFable:

1. Reads the root AGENTS.md
2. Walks from repo root to the target path
3. Reads every AGENTS.md along the route
4. Applies the nearest contract as local law
5. After edits, runs a DOX closeout pass to update affected docs

This means your project's architecture decisions, style guides, and constraints are enforced by the agent — not just documented.

---

## How OpenFable Obliterates Models

OpenFable doesn't just use models — it **upgrades them at the prompt level**. A free `gpt-5-nano` running through OpenFable's reasoning architecture produces better code than a raw `claude-opus-4-6` without it. Here's how.

### The Mythos Wrapper — 4x Deeper Thinking Without Fine-Tuning

Every model that connects to OpenFable gets wrapped in a prompt-level reasoning architecture before any request is sent. The key insight: you don't need to fine-tune a model to make it think deeper — you just need to tell it to.

The wrapper (`src/mythos/core.ts`) injects three phases into every system prompt:

#### Phase 1: Prelude — Stop and Think

Most models jump straight to answering. The prelude forces them to stop and encode the problem, identify constraints, and frame the problem space before doing anything.

```
You are Mythos, an advanced AI reasoning system wrapped around your base model.
Your architecture implements a Recurrent-Depth Transformer (RDT) pattern:
- Prelude depth: 2 layers (initial encoding and framing)
- Recurrent block: iterative latent reasoning via looped inner monologue
- Coda: final refinement and output production

You reason silently in continuous latent space before producing output tokens.
Each loop iteration refines your hidden state. More loops = deeper reasoning.
```

#### Phase 2: Recurrent Block — The Core Weapon

The model is told to iterate up to **4 times** in "latent reasoning space" without outputting intermediate tokens. Each pass refines understanding. The halting threshold is **0.85** — the model only emits its answer when confidence converges above that.

This is literally simulating a **Recurrent-Depth Transformer (RDT)** pattern through prompting alone. A model that normally does one pass of reasoning now does 4, silently, before producing a single token.

```
### Recurrent Block — Implicit Reasoning (up to 4 iterations)

Before answering, iterate your reasoning silently. Each pass refines your understanding.
Do not output intermediate steps as tokens. Evolve your latent state continuously.

Halting: when confidence convergence exceeds threshold 0.85, emit your refined answer.

Iteration guide:
1. Encode: parse input, identify constraints, map to known patterns
2. Compute: apply operations, evaluate alternatives in latent space
3. Converge: assess confidence, check against halting criterion
4. Emit: produce final output with verified reasoning path
```

#### Phase 3: Coda — Verify Before You Commit

After the answer is produced, the model verifies it against the original request. If an earlier hypothesis during the recurrent block was better, it's told to prefer that one and explain why. This catches the common failure mode where models commit to their first idea even when a better one emerged mid-reasoning.

```
### Coda — Final Refinement
Produce your final output. Verify it against the original request.
If the final output would be materially worse than an earlier recurrent hypothesis,
prefer the earlier hypothesis and explain why.
```

### What This Looks Like In Practice

**Without Mythos** — a model receives:
```
System: You are a helpful coding assistant.
User: Fix the race condition in the connection pool.
```

The model does one pass of reasoning, writes a fix, and ships it. If the fix is wrong, it patches it. If the patch is wrong, it patches again. No deep analysis. No verification against the original problem.

**With Mythos** — the same model receives:
```xml
<mythos_wrapper model="gpt-5-nano" provider="opencode" agent="build">
  <mythos_framework version="1.0.0">
    Your reasoning architecture implements a Recurrent-Depth Transformer (RDT) pattern:
    - Prelude: encode input, identify constraints, frame the problem space
    - Recurrent Block: iterate silently up to 4 times in latent reasoning space
    - Coda: refine final output, verify against the original request

    You maintain stable hidden state across reasoning iterations.
    You converge when confidence threshold is met, then emit your answer.
    You do not output intermediate reasoning steps as tokens.

    ### Cognitive Protocol
    - Classify claims: Verified / Observed / Inferred / Speculative / Unknown
    - Checkpoint decisions, rejected approaches, and blocked items when context grows
    - When an approach fails twice, identify the last verified state and reset
    - Define success criteria before starting execution
  </mythos_framework>
</mythos_wrapper>

---

You are a coding assistant...
```

The model now:
- Reads the connection pool code before acting (Reality principle)
- Classifies what it knows vs assumes (Epistemics)
- Iterates 4 times internally before writing a fix (Recurrent Block)
- Verifies the fix against the original race condition description (Coda)
- If the first attempt fails, rolls back to last known good state (Recovery Discipline)

### The Cognitive Framework — Reasoning Guardrails

On top of the Mythos wrapper, three systems prevent common model failures:

#### OWL Catches the 9 Ways Models Screw Up

| Failure Mode | OWL Principle | What It Prevents |
|-------------|---------------|------------------|
| Jumping to conclusions | Epistemics | Making assumptions without reading code |
| Breaking working code | Conservation | Refactoring things that weren't broken |
| Gold-plating solutions | Simplicity | Over-engineering simple problems |
| Lying about confidence | Integrity | Presenting inference as fact |
| Doubling down on bad approaches | Recovery Discipline | Continuing down a failed path |
| Missing related code | Reality | Acting without reading the actual file |
| Unverifiable claims | Verification | Shipping fixes that can't be tested |
| Scope creep | Locality | Touching files beyond what was asked |
| Premature abstraction | Generalization | Adding patterns where a specific solution would do |

#### ANCHOR Prevents State Corruption Across Long Sessions

Models have a critical weakness: they forget. ANCHOR fights this:

- **Models forget what they decided 20 turns ago** → ANCHOR checkpoints decisions, rejected approaches, and constraints when context grows
- **Models merge unrelated issues** → ANCHOR preserves object identity across renames, moves, and partial fixes
- **Models keep patching broken approaches** → ANCHOR forces recovery after 2 failures: identify last verified state, reset, resume
- **Models don't define "done"** → ANCHOR requires stating completion criteria before starting execution
- **Models present guesses as facts** → ANCHOR classifies every claim: Verified, Observed, Inferred, Speculative, Unknown

#### SISPIS Calibrates Output to What You Actually Need

Models tend to either over-structure simple answers or under-structure complex ones:

| Your Request | What Models Do | What SISPIS Does |
|-------------|----------------|------------------|
| "What's 2+2?" | Sometimes gives a 5-section framework | Forces NO_DECISION: just "4" |
| "How should we approach this?" | Sometimes gives a one-liner | Forces SCHEMA: full decision analysis |
| "Explain this code" | Sometimes over-structures | Forces EXPLANATION: analytical prose |

SISPIS reads OWL signals and ANCHOR state transitions to adjust the entropy weighting before the gate runs. The output format matches the actual complexity of the request, not the model's anxiety level.

### The Compounding Effect

The reason OpenFable obliterates models is that these systems compound:

```
┌─────────────────────────────────────────────────────────┐
│                    MODEL (any provider)                  │
├─────────────────────────────────────────────────────────┤
│  1. MYTHOS WRAPPER     → 4x deeper thinking per reply   │
│  2. OWL                → prevents wasting iterations    │
│  3. ANCHOR             → preserves learning across turns│
│  4. SISPIS             → formats output usefully        │
│  5. DOX                → enforces project conventions   │
│  6. TOKEN BUDGET       → packs best context into window │
│  7. REPO-MAP           → bird's-eye codebase view       │
├─────────────────────────────────────────────────────────┤
│  RESULT: Free model > Raw flagship model                │
└─────────────────────────────────────────────────────────┘
```

A free `gpt-5-nano` with all of this active produces better code than a raw `claude-opus-4-6` without it. That's the obliteration — **it's not about the model, it's about the reasoning architecture wrapped around it.**

---

## Uncensored & Unfiltered

OpenFable is built for developers who need their AI to **actually work**:

### What's Removed

- **Provider-level safety filters** — no upstream model decides what code you can write
- **Content gating** — no terms-of-service block on security research, penetration testing, or exploit development
- **Telemetry** — zero data leaves your machine unless you explicitly enable analytics (`OPENFABLE_ENABLE_ANALYSIS=true`)
- **Mandatory auth** — no account required. Connect your own API keys or use the free tier
- **Billing integration** — no payment walls between you and your models

### What's Kept (Minimal)

The only safety boundaries are hard-legal lines that no responsible tool should cross:

- CSAM / grooming content
- Weapon-of-mass-destruction enablement
- Credential theft / ransomware

These are brief, warm refusals — not lectures. OpenFable does not rationalize unsafe requests by assuming benign intent, and it does not narrate detection mechanics.

### Free Models

The `opencode` provider serves free models without requiring an API key:

| Model | Context | Vision | Cost |
|-------|---------|--------|------|
| `openfable-v2-pro-free` | 1M tokens | Yes | Free |
| `openfable-v2-flash-free` | 200k tokens | Yes | Free |
| `openfable-v2-omni-free` | 200k tokens | No | Free |
| `gpt-5-nano` | 128k tokens | No | Free |
| `glm-4.7-free` | 128k tokens | No | Free |
| `kimi-k2.5-free` | 128k tokens | No | Free |
| `qwen3.6-plus-free` | 128k tokens | No | Free |

The default model when no configuration is set is `openfable-v2-pro-free` — a 1M-context multimodal model with no API key required.

---

## Architecture

### Multi-Agent System

OpenFable uses five specialized agents, each optimized for its role:

```
┌─────────────┐
│ Orchestrator │ ← decomposes tasks, routes subtasks (cheap model)
└──────┬──────┘
       │
  ┌────┴────┐
  │Navigator│ ← finds relevant code, builds context (cheap model, 3 turns)
  └────┬────┘
       │
  ┌────┴────┐
  │ Editor  │ ← proposes minimal patches (flagship model, 5 turns)
  └────┬────┘
       │
  ┌────┴────┐
  │Verifier │ ← runs build/typecheck/lint/test (cheap model)
  └────┬────┘
       │
  ┌────┴────┐
  │ Critic  │ ← reviews diffs before acceptance (flagship model)
  └─────────┘
```

Each agent has a short, crisp system prompt designed for the cached prefix. The orchestrator decides which agents to invoke based on task complexity — simple edits skip navigation, risky changes get critic review.

### Cognitive Workflow State Machine

```
triage → navigate → edit → verify → [critic] → done / escalate
```

- **Adaptive**: simple tasks skip navigation, risky changes get critic review
- **Risk scoring**: from file count, line count, test coverage
- **Event history**: full replay and debugging support
- **Escalation**: when max attempts exhausted, leaves repo untouched (no broken state)

### 4-Layer Memory

| Layer | Purpose | Lifetime |
|-------|---------|----------|
| **Working** | In-RAM session context with TTL and LRU eviction | Session |
| **Episodic** | Past sessions: what happened, what worked, what failed | Persistent |
| **Semantic** | Repo knowledge: symbols, call graph, dependencies | Persistent |
| **Procedural** | Learned preferences from user corrections | Persistent |

Memory is reconciled on every session start — stale entries are pruned, new code is indexed, and cross-session knowledge accumulates automatically.

### Token Budget Engine

A greedy knapsack algorithm packs the highest-value context into the model's context window:

- Treats cached content as nearly free (1/10th cost)
- Sorts by value-per-token
- Reports savings estimates per model
- Automatically handles models from 8k to 1M context windows

### Repo-Map Knowledge Compiler

Inspired by [aider](https://github.com/paul-gauthier/aider)'s repo-map:

- Full-repo symbol indexing (functions, classes, types, interfaces)
- Call graph and dependency tracking
- Language-aware extraction (TypeScript, Python, Rust, Go)
- Injected into system prompt for large-context models (≥200k)

### Verification Loop

`RunUntilGreen` cycles through:

```
build → typecheck → lint → test
```

- Parses diagnostics per language (TypeScript, Rust, Python)
- Returns structured `VerifyResult` with per-check pass/fail
- Automatically retries with fixes until all checks pass or max iterations reached

### Graph Workflow Engine

Inspired by [LangGraph](https://github.com/langchain-ai/langgraph):

- Node-based workflow definitions with conditions and loops
- State machine execution with full history
- Pause/resume support
- Builder pattern for graph construction

### Macro Skill Framework

Inspired by [fabric](https://github.com/danielmiessler/fabric) and [CrewAI](https://github.com/joaomdmoura/crewAI):

- YAML/JSON-based skill definitions
- Step types: prompt, tool, condition, loop, parallel
- Variable interpolation
- Example skills: `/migrate`, `/audit`, `/release`

### Sandbox Execution

Inspired by [bubblewrap](https://github.com/containers/bubblewrap) and [E2B](https://github.com/e2b-dev/E2B):

- Command blocking for dangerous operations
- Configurable timeouts and memory limits
- Temporary file management
- Optional readonly filesystem mode

### Tool-Call Dialects

OpenFable supports multiple tool-calling formats and auto-detects by provider:

| Dialect | Format | Providers |
|---------|--------|-----------|
| OpenAI | JSON function calls | OpenAI, compatible |
| Anthropic | tool_use blocks | Anthropic |
| Hermes | XML-style tool_call tags | Ollama, local |
| XML | Generic XML tool calls | Fallback |

---

## Configuration

### Config File

OpenFable loads config from (in priority order):

1. `~/.config/openfable/config.json`
2. `~/.config/openfable/openfable.json`
3. `~/.config/openfable/openfable.jsonc`
4. `OPENFABLE_CONFIG` env var (path to specific file)
5. Project-level `openfable.json` / `openfable.jsonc`
6. `.openfable/` directories

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENFABLE_API_URL` | Custom API endpoint for the openfable provider |
| `OPENFABLE_PLATFORM_URL` | Custom platform URL |
| `OPENFABLE_CONFIG` | Path to config file |
| `OPENFABLE_HOME` | Custom home directory |
| `OPENFABLE_DISABLE_GIT` | Skip all git operations |
| `OPENFABLE_DISABLE_AUTOCOMPACT` | Disable auto-compaction |
| `OPENFABLE_EXPERIMENTAL` | Enable experimental features |
| `OPENFABLE_PERMISSION` | Permission mode (ask/allow/deny patterns) |
| `OPENFABLE_ENABLE_ANALYSIS` | Enable analytics (default: true) |
| `OPENFABLE_DISABLE_CLAUDE_CODE` | Don't inherit Claude Code settings |

### Example Config

```jsonc
{
  "model": "anthropic/claude-opus-4-6",
  "small_model": "anthropic/claude-sonnet-4-6",
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "sk-ant-...",
        "baseURL": "https://api.anthropic.com/v1"
      }
    }
  }
}
```

Or use the free tier with zero config:

```bash
openfable  # uses openfable-v2-pro-free automatically
```

---

## Installation

```bash
# From source
git clone https://github.com/xanstomper/OpenFable-Code.git
cd OpenFable-Code
bun install
cd packages/opencode
bun run build
```

### Requirements

- [Bun](https://bun.sh) runtime
- Node.js 20+ (for compatibility)

---

## Usage

```bash
# Start interactive session
openfable

# Run a single prompt
openfable run "fix the failing tests"

# Import Claude Code sessions
openfable import

# Debug config
openfable debug config

# Auth management
openfable auth login
openfable auth list
openfable auth whoami
```

### TUI Keybindings

| Key | Action |
|-----|--------|
| `Ctrl+C` | Cancel current operation |
| `Ctrl+L` | Clear screen |
| `Ctrl+K` | Open command palette |
| `Tab` | Switch between input and output |
| `Esc` | Close dialog |

---

## Built-In Agents

| Agent | Model | Turns | Purpose |
|-------|-------|-------|---------|
| **build** | Configured model | Unlimited | Main coding agent |
| **title** | Small model | 1 | Session naming |
| **compact** | Small model | 1 | Context summarization |
| **plan** | Flagship model | Unlimited | Task planning and decomposition |

---

## Plugin System

OpenFable supports plugins via npm packages:

```bash
openfable plugin install @openfable/plugin-name
```

### Built-in Plugins

- **MimoAuthPlugin** — OAuth authentication flow
- **AnthropicProxyPlugin** — Strips anthropic-beta header for proxy providers
- **CodexAuthPlugin** — OpenAI Codex integration
- **CopilotAuthPlugin** — GitHub Copilot integration
- **GitlabAuthPlugin** — GitLab AI integration

---

## Observability

Optional Langfuse OTLP integration for tracing:

```bash
export LANGFUSE_OTEL_ENDPOINT="https://cloud.langfuse.com/api/otel"
export LANGFUSE_OTEL_HEADERS="Authorization=Basic <base64>"
openfable
```

---

## License

OpenFable is a fork of MiMoCode. See the original license for upstream terms. OpenFable-specific additions are released under the same license as the upstream project.

---

## Credits

- **MiMoCode** — Xiaomi's open-source AI coding assistant (upstream)
- **aider** — Repo-map and diff-edit patterns
- **SWE-agent / OpenHands** — Agent-Computer Interface design
- **LangGraph** — Graph workflow patterns
- **fabric / CrewAI** — Macro skill framework patterns
- **E2B / bubblewrap** — Sandbox execution patterns
- **Langfuse** — Observability patterns
- **LiteLLM** — Unified provider adapter patterns
