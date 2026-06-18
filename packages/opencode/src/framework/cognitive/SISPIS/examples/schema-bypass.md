# Example: SCHEMA BYPASS

## Prompt

"I'm debugging a memory leak in Node.js. The heap dump shows the `EventEmitter` retaining references. What's happening?"

## Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 2 | Multiple debugging approaches exist |
| Tradeoff density | 1 | Different tools have different overhead |
| Ambiguity | 1 | Root cause needs investigation |
| Comparative intent | 0 | Not choosing between paths |
| Downstream impact | 0 | Fixing a specific bug, no architectural decision |

**E = 4** (MEDIUM). **W = 2**. **S = 0.3** (decision-oriented — user has a concrete problem to solve).

## Gate Resolution

- **Stage 1:** E = 4 < 6, no hard override. No user override. → inconclusive, proceed.
- **Stage 2:** S = 0.3, not > 0.7. → no suppression, proceed.
- **Stage 3:** W = 2 < 4. No HIGH_DECISIONAL signal. → no activation, proceed.
- **Stage 4:** E = 4 > 1 → **ACTIVATE = True**.
- **Bypass check:** Evaluate decision_space. The user has a specific bug. "Understand the leak mechanism" and "apply the fix" are sequential steps in a single diagnostic flow, not mutually exclusive branching paths. **decision_space = 1** → **BYPASS to EXPLANATION MODE**.

## Key Insight

The gate function correctly activated the schema (entropy and signals detected something), but the bypass check caught that no actionable decision space exists. This is the critical difference between SCHEMA and EXPLANATION mode: both detected structure, but only one has branching alternatives.

## Expected Output (Explanation Mode, Not Schema)

Your `EventEmitter` is retaining listener references. Common causes:

1. **Listeners added without removal.** Every `emitter.on()` increments the reference count. If the emitting object outlives the listener, memory grows unbounded.

2. **Closures capturing scope.** If listeners close over large objects, those objects stay in memory as long as the listener exists.

3. **The leak pattern:** Your heap dump likely shows `_listeners` arrays growing on the EventEmitter instance. Check who calls `.on()` without a corresponding `.off()` or `.removeListener()`.

Fix: Audit all `.on()` calls in the retention path. Ensure paired `.off()` calls in cleanup. Use `--max-old-space-size` for emergency relief, but the root cause is unbalanced listener attachment.
