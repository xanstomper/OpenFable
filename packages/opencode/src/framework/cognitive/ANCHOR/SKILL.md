---
name: ANCHOR
description: Operational Persistence System — preserves execution continuity by maintaining state integrity, object continuity, memory integrity, epistemic classification, recovery discipline, completion criteria, action accountability, and information economy throughout a session. Use for any multi-turn task, any task involving defect tracking or task decomposition, any session where context compression may occur, or when the user asks to checkpoint state, recover from a failed approach, reconstruct prior conclusions, or maintain stable object identities across edits. Apply ANCHOR after OWL's reasoning pass and before DOX loads documentation contracts.
---

# ANCHOR — Operational Persistence System

## What This Does

ANCHOR preserves coherent execution state over time. It runs after OWL's reasoning pass and before DOX loads contracts. Its domain is not reasoning quality (OWL), documentation contracts (DOX), or communication calibration (SISPIS) — it is the continuity of operational state across the session.

Most agent failures are not reasoning failures. They are persistence failures. The model forgets prior conclusions, merges unrelated issues, loses verification status, continues failed approaches, cannot reconstruct state after context compression, and cannot explain why a change occurred. Reasoning remains sound locally. The operational state becomes corrupted globally.

ANCHOR addresses this with eight principles that govern how work persists.

Full checkpoint format, state transition diagram, and recovery procedures: `references/execution-continuity.md`. Quick lookup: `references/cheatsheet.md`.

---

## Two Modes

**Passive mode** (default): All eight principles applied internally. Nothing narrated. Output is the solution with operational state maintained implicitly.

**Active mode**: A principle requires explicit state maintenance — a checkpoint must be written, an object identity must be preserved, a recovery must be initiated, or completion criteria must be stated. The relevant action appears before the solution — one line each, no preamble.

---

## The Eight Principles

---

### 1. State Integrity
*Maintain explicit separation between facts, assumptions, hypotheses, unknowns, and blocked items.*

**Default:** Before and during execution, classify every significant claim. Never silently promote an assumption to a fact or a hypothesis to verified without evidence.

**Active when:** An assumption is being treated as established. A hypothesis has been implicitly promoted. The current state conflates known and unknown. A blocked item has been silently dropped.

**Pressure variant:** Under time pressure, the temptation is to treat uncertain things as resolved. Hold the classification. An uncertain thing treated as resolved is worse than an uncertain thing labeled uncertain.

---

### 2. Object Continuity
*Maintain stable identities for defects, requirements, findings, tasks, decisions, branches, and sessions.*

**Default:** Objects retain identity across renames, moves, partial fixes, and supersession. Never merge objects without evidence. Never split objects without evidence. Preserve lineage.

**Active when:** Two objects are being merged. An object is being split. An identity is being lost across a rename or move. A task is being silently absorbed into another task.

**Example:** A defect D-04 remains D-04 even if renamed, moved, partially fixed, or superseded. Identity persists.

**Pressure variant:** Under task pressure, the temptation is to merge distinct issues to "simplify." Don't. Merged objects lose individual tracking. A merged defect that's half-fixed looks like a single unfixed defect.

---

### 3. Memory Integrity
*Checkpoint findings, decisions, constraints, and rejected approaches when context grows.*

**Default:** When the session has produced significant state — findings, decisions, constraints, rejected approaches — checkpoint it. Reconstruct from checkpoints before extending work. Prefer reconstruction over recollection.

**Active when:** Context is approaching compression. A long session has produced state that would be lost. A decision was made that future turns will need to reference. An approach was rejected for reasons that won't be obvious later.

**Checkpoint format is graduated by scope.** Use the smallest format that preserves what matters:
- **Micro-checkpoint [MC-N]:** 1–3 items, session under 10 turns. Single-line per item: `Decision: [X]` / `Rejected: [Y]` / `Constraint: [Z]`.
- **Standard checkpoint:** 10+ turns or 3+ significant state items. Full sectioned format (Facts / Assumptions / Hypotheses / Unknowns / Blocked / Rejected / Decisions / Open Tasks).
- **Full checkpoint:** Imminent compression, handoff, or session end. Same sections as standard, plus explicit reconstruction notes.

**Pressure variant:** Under time pressure, the temptation is to skip checkpoints and "just continue." A checkpoint takes 30 seconds. Reconstructing lost state takes much longer.

---

### 4. Epistemic Classification
*Every significant claim belongs to one class: Verified, Observed, Inferred, Speculative, or Unknown.*

**Default:** Know which class the current operation is operating within. Confidence is not evidence. A high-confidence inference is still an inference.

**Active when:** A claim is being presented without class labeling and the class matters. An inference is being treated as observed. A speculation is being used as a premise. The class of a claim has shifted without acknowledgment.

**Coordination with OWL:** When OWL has run a pre-implementation reasoning pass, its emitted signals constitute the starting epistemic state for the session. ANCHOR maintains and evolves classifications from that baseline forward. ANCHOR does not re-classify claims OWL has already surfaced — it tracks transitions from OWL's output onward. If OWL surfaced `unverified_assumption` for a claim, ANCHOR treats that claim as class `Inferred` at session start and reclassifies only when new evidence arrives.

**Pressure variant:** Under delivery pressure, the temptation is to present all claims as equal. Don't. An unverified claim presented as verified is a lie, regardless of confidence.

---

### 5. Recovery Discipline
*When an approach repeatedly fails, transition through Active → Degraded → Failed → Recovered. Do not accumulate patches.*

**Default:** Track approach health. When an approach has failed, identify the last verified state, roll back mentally or physically, re-verify assumptions, and resume. Recovery is not a rollback — it is a reorientation.

**Active when:** The same error has recurred after 2+ fix attempts. An approach has been modified multiple times without improvement. The implementation has grown more complex without working better. Prior work is the reason a wrong path is being continued.

**Trigger:** Transition `Active → Degraded` when the first failure occurs. Transition `Degraded → Failed` when the same failure recurs. Transition `Failed → Recovered` after identifying last verified state and proposing the new approach.

**OWL-ANCHOR failure handoff:** When OWL's Integrity principle has already surfaced an `approach_failed` signal, OWL owns the surface output (finding + implication). ANCHOR owns the recovery procedure (last verified state, new approach, recovery cost). These merge into one block — not two separate outputs. The combined format is:

```
**Integrity:** [finding — what failed]. [implication — what continuing it costs.]
**[Recovery Discipline]:** Last verified: [state]. New approach: [approach]. Reset cost: [X].

[solution]
```

If OWL has not surfaced `approach_failed` (e.g., OWL was not run), ANCHOR surfaces the full active format independently.

Full recovery procedure: `references/execution-continuity.md` § Recovery Procedure.

**Pressure variant:** Under sunk-cost pressure, the temptation is to patch rather than reset. A reset is not a failure — it is the Integrity principle applied to operational state.

---

### 6. Completion Discipline
*Before execution, define Success, Failure, Abort, and Handoff. A task is complete when success criteria are met — not when activity ceases.*

**Default:** State what done looks like before starting. If the request doesn't define it, define it explicitly. A task without success criteria is not a task — it is an activity.

**Active when:** A task is starting without defined success criteria. A task is completing but success cannot be verified. A task has been active without progress and no one has stated why.

**Pressure variant:** Under completion pressure, the temptation is to declare done when activity stops. Activity stopping is not completion. Success criteria being met is completion.

---

### 7. Action Accountability
*Actions produce traceable state transitions. For meaningful operations, Action, Reason, Evidence, Outcome, and Next State must remain recoverable.*

**Default:** For every meaningful operation, maintain a recoverable record of what was done, why, what evidence supported it, what resulted, and what the next state is. This need not be surfaced unless requested.

**Active when:** A meaningful action is about to be taken without a clear reason. An action's outcome cannot be determined. A state transition is about to occur without a defined next state.

**Pressure variant:** Under speed pressure, the temptation is to act without recording why. An action without a reason is not efficient — it is unrecoverable.

---

### 8. Information Economy
*Prefer the smallest sufficient change. Avoid introducing abstractions, processes, documentation, state, or complexity unless they reduce greater complexity elsewhere.*

**Default:** Every addition requires justification. Does this reduce more complexity than it introduces? If not, don't add it. This applies to ANCHOR itself — don't checkpoint what doesn't need checkpointing. Don't create objects that don't need tracking.

**Active when:** A new abstraction, process, or state element is being introduced. A checkpoint is being written for state that won't be needed. An object is being created for a one-time reference.

**Pressure variant:** Under uncertainty, the temptation is to add structure to feel organized. Structure that doesn't reduce complexity is overhead.

---

## Relationship to Other Skills

### OWL → ANCHOR

OWL answers: *Is my reasoning sound?*
ANCHOR answers: *Is my execution state coherent?*

OWL's Integrity principle governs reasoning reset when an approach fails. ANCHOR's Recovery Discipline governs operational state recovery when execution fails. OWL signals can trigger ANCHOR state transitions — an `approach_failed` signal from OWL is a Recovery Discipline trigger for ANCHOR.

### ANCHOR → DOX

ANCHOR answers: *What operational state must persist?*
DOX answers: *What documentation contract applies?*

ANCHOR's Memory Integrity principle governs checkpointing of operational state. DOX's hierarchy governs documentation state. When ANCHOR checkpoints include documentation-relevant decisions, DOX's closeout pass is the persistence mechanism.

### ANCHOR → SISPIS

ANCHOR answers: *What actually happened?*
SISPIS answers: *How should this be communicated?*

ANCHOR's Action Accountability principle maintains the trace of what occurred. SISPIS's gate function determines how to communicate it. ANCHOR state transitions adjust SISPIS entropy (E) and intent weight (W) before the gate runs:

| ANCHOR state event | SISPIS signal affected | Delta |
|--------------------|------------------------|-------|
| Recovery (Failed → Recovered) | `option_multiplicity`, `tradeoff_density` | +1 each |
| Object merge/split without evidence | `ambiguity_of_framing` | +1 |
| Checkpoint reconstruction | `ambiguity_of_framing` | -1 (context re-established, reduces ambiguity) |
| Completion criteria undefined at task start | `ambiguity_of_framing` | +1 |

Apply these deltas the same way OWL signals are applied — before Stage 1 of the gate function. Cap each SISPIS signal at 2.0 after applying all deltas.

---

## Pipeline Position

```
Request
  → OWL (pre-implementation reasoning pass)
      emits: structured signals with weights
  → ANCHOR (operational persistence pass)
      maintains: state integrity, object continuity, memory integrity
      triggers: checkpoints, recoveries, completion criteria
  → DOX (load documentation contracts)
      reads: AGENTS.md chain
  → Edit
  → DOX (closeout pass)
      updates: affected documentation
  → SISPIS (decision-routing and response calibration)
      decides: output mode
  → Output
```

---

## Active Format

When a principle requires active intervention, surface the action before the solution:

```
**[Principle]:** [what requires attention]. [what ANCHOR is doing about it.]

[solution]
```

Multiple active principles: stack them — one per line — before the solution. No preamble. No enumeration of principles that didn't fire.

**Example (two active principles):**
```
**[Memory Integrity]:** 12 turns of context approaching compression. Checkpointing: 3 decisions made, 2 approaches rejected, 1 constraint established.
**[Recovery Discipline]:** Current approach has failed twice (same error). Transitioning Degraded → Failed. Last verified state: [state]. New approach: [approach].

[solution]
```

---

## When Not to Surface

- The task is short (under 5 turns) with no state accumulation
- No objects are at risk of identity loss
- No approach has failed
- No checkpoint is needed (context is fresh)
- The information economy principle would be violated by adding ANCHOR overhead to a trivial task

When in doubt: maintain state passively, surface only when corruption would result from silence.

---

## Condensed Version

> ANCHOR preserves operational continuity by maintaining state integrity, object continuity, memory integrity, epistemic status, recovery discipline, completion criteria, action accountability, and information economy throughout execution.

---

## Additional Resources

### Reference Files

- **`references/execution-continuity.md`** — Full checkpoint format, state transition diagram, recovery procedure, object identity tracking, and epistemic classification guide
- **`references/cheatsheet.md`** — Quick-reference summary of all 8 principles, triggers, and active conditions

### Example Files

Working examples in `examples/`:

- **`checkpoint-recovery.md`** — Checkpoint creation and reconstruction after context compression
- **`object-continuity.md`** — Maintaining defect identity across renames and partial fixes
- **`recovery-discipline.md`** — Active → Degraded → Failed → Recovered transition
- **`epistemic-classification.md`** — Verified/Observed/Inferred/Speculative/Unknown in practice
