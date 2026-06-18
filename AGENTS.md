# OpenFable Code

## Purpose

A terminal-native AI coding assistant with persistent memory, multi-agent orchestration, and TUI. Fork of MiMoCode.

## Ownership

Fork maintained by xanstomper. Full rebrand from MiMoCode → OpenFable complete.

## Build status

- `bun typecheck` → exits 0 (clean)
- `bun lint` (oxlint) → 0 errors
- `openfable` binary launches with OPENFABLE branding; `openfable debug config` shows the `openfable` provider wired (`api: https://api.xiaomimimo.com/v1`)
- Mythos framework modules exist on disk but are not yet imported from `src/index.ts` — they are wired only through `src/session/llm.ts` (prompt wrapper, specialized-agent + token-budget injection) and `src/storage/schema.ts` (table exports)
- Aider-style repo-map context is injected into the system prompt for large-context models (`limit.context >= 200k`), including Claude Opus 4.8, via `src/session/repo-map-context.ts` → `src/session/llm.ts`

## External References

The `references/` directory holds shallow-cloned (`--depth 1`) upstream repos used as design material and benchmarks for OpenFable. They are not source code and are excluded from lint and git tracking.

Cloned reference set:
- `modelcontextprotocol/typescript-sdk` — MCP TS SDK (OpenFable already depends on and uses `@modelcontextprotocol/sdk` 1.27.1)
- `BerriAI/litellm` — unified provider API patterns
- `paul-gauthier/aider` — repo-map and diff-edit format
- `princeton-nlp/SWE-agent` and `princeton-nlp/SWE-bench` — ACI design and the standard coding-agent benchmark
- `langfuse/langfuse` — LLM observability/tracing patterns
- `All-Hands-AI/OpenHands` and `All-Hands-AI/openhands-aci` — full autonomous coding agent + ACI utilities
- `cline/cline` — VS Code autonomous coder edit/approval flows
- `mem0ai/mem0` — long-term memory layer patterns
- `langchain-ai/langgraph` — graph-based workflow patterns
- `e2b-dev/E2B` — secure sandbox execution

## Work Guidance

- Always use superpowers skill instead of builtin plan mode.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `main`.
- CI triggers on both `main` and `dev` branches.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.

## Mythos Framework

The `src/mythos/` module implements a model-agnostic Mythos-grade wrapper system:

- **core.ts** — System prompt wrapper applied to every agent via `LLM.buildSystemArray`. Injects recurrent-depth reasoning, DOX protocol, cognitive framework, safety, and attribution rules into all models.
- **workflow/** — Prelude → Recurrent → Coda workflow state machine stored in SQLite.
- **dox/** — Documentation hierarchy service (AGENTS.md tree loading, contract resolution, filesystem sync).
- **cognitive/** — OWL/ANCHOR/SISPIS cognitive framework: epistemic classification, checkpointing, recovery, signal gating.
- **router/** — Model capability ranking and selection for task routing.
- **anthology/** — TUI development reference knowledge base integration.

Framework assets (`src/framework/`) bundle the full Anthology, CognitiveFrameworks, and DOX reference materials.

### Mythos Tables (auto-migrated)
- `mythos_state` — Per-session mythos config and version tracking
- `mythos_workflow` — Recurrent workflow execution state
- `dox_entries` — AGENTS.md hierarchy entries
- `dox_contracts` — DOX constraint/contract resolution
- `cognitive_checkpoints` — ANCHOR checkpoint persistence
- `cognitive_claims` — Epistemic classification claims log
- `mythos_model_cache` — Model capability routing cache

## Agent System

The `src/agent/specialized/` module implements a multi-agent architecture with 5 specialized roles:

- **Orchestrator** — decomposes tasks, routes subtasks (cheap model)
- **Navigator** — finds relevant code, builds context (cheap model, 3 turns)
- **Editor** — proposes minimal patches (flagship model, 5 turns)
- **Verifier** — runs build/typecheck/lint/test (cheap model)
- **Critic** — reviews diffs before acceptance (flagship model)

Each agent has a short, crisp system prompt designed for the cached prefix.

## Cognitive Workflow

The `src/workflow/cognitive/` module implements a state machine:

```
triage → navigate → edit → verify → [critic] → done / escalate
```

- Adaptive: simple tasks skip navigation, risky changes get critic review
- Risk scoring from file count, line count, test coverage
- Event history for replay/debugging
- Escalation when max attempts exhausted (leaves repo untouched)

## Layered Memory

The `src/memory/layers/` module implements 4 memory layers:

- **Working** — in-RAM session context with TTL and LRU eviction
- **Episodic** — past sessions: what happened, what worked, what failed
- **Semantic** — repo knowledge: symbols, call graph, dependencies
- **Procedural** — learned preferences from user corrections

## Verification Loop

The `src/verification/` module implements `RunUntilGreen`:

- Runs build → typecheck → lint → test
- Parses diagnostics per language (TypeScript, Rust, Python)
- Returns structured `VerifyResult` with per-check pass/fail

## Token Budget Engine

The `src/token-budget/` module implements a context compiler:

- Packs highest-value context into budget, treating cached content as nearly free
- Sorts by value-per-token (greedy knapsack)
- Reports savings estimates per model

## Repo-Map Knowledge Compiler

The `src/knowledge/` module (aider-inspired) provides:

- Full-repo symbol indexing (functions, classes, types, interfaces)
- Call graph and dependency tracking
- Language-aware extraction (TypeScript, Python, Rust, Go)
- File tree generation and symbol search

## Unified Provider Adapter

The `src/provider/unified-adapter.ts` (litellm-inspired) provides:

- Single interface for OpenAI, Anthropic, Ollama
- Model selection by cost, latency, capabilities
- Fallback chains with automatic retry
- Cost estimation per request

## Agent-Computer Interface

The `src/agent/computer-interface.ts` (SWE-agent/OpenHands-inspired) provides:

- Structured command set: read, write, ls, bash, grep, find-def, find-refs, diff, git, context
- Sandboxed execution with timeout
- Command history and replay

## Graph Workflow Engine

The `src/workflow/graph/` (langgraph-inspired) provides:

- Node-based workflow definitions with conditions and loops
- State machine execution with history
- Pause/resume support
- Builder pattern for graph construction

## Skill/Macro Framework

The `src/skill/macro/` (fabric/CrewAI-inspired) provides:

- YAML/JSON-based skill definitions
- Step types: prompt, tool, condition, loop, parallel
- Variable interpolation
- Example skills: /migrate, /audit, /release

## Sandbox Execution

The `src/agent/sandbox.ts` (bubblewrap/E2B-inspired) provides:

- Command blocking for dangerous operations
- Configurable timeouts and memory limits
- Temporary file management
- Optional readonly filesystem mode

## Tool-Call Dialects

The `src/provider/tool-dialects.ts` (Hermes/function-calling) provides:

- OpenAI dialect (JSON function calls)
- Anthropic dialect (tool_use blocks)
- Hermes dialect (XML-style tool_call tags)
- XML dialect (generic XML tool calls)
- Auto-detection by provider

## Child DOX Index
- `packages/opencode/test/AGENTS.md` — Testing contracts
