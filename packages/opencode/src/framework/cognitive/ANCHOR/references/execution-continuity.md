# ANCHOR Execution Continuity — Full Reference

## Checkpoint Formats

Three formats, graduated by scope. Use the smallest format that preserves what matters.

---

### Micro-Checkpoint [MC-N]

**When:** 1–3 items to preserve, session under 10 turns, no compression risk.

```
[MC-N] Decision: [X]. | Rejected: [Y — reason]. | Constraint: [Z].
```

Each item is optional. Include only what applies. One line. No sections.

**Example:**
```
[MC-1] Decision: use optimistic locking. | Rejected: advisory locks — too broad for this scope.
```

---

### Standard Checkpoint [CP-N]

**When:** 10+ turns on a single task, or 3+ significant state items in any session.

```
## Checkpoint [N] — [timestamp or turn reference]

### Facts
- [verified claim 1]
- [verified claim 2]

### Assumptions
- [assumption 1 — source: inferred from X]
- [assumption 2 — source: user stated Y]

### Hypotheses
- [hypothesis 1 — status: untested]
- [hypothesis 2 — status: partially supported by Z]

### Unknowns
- [unknown 1 — what would resolve it]
- [unknown 2 — blocked on W]

### Blocked Items
- [blocked item 1 — blocker: X, since turn Y]

### Rejected Approaches
- [approach 1 — reason: failed with error X, turn Y]
- [approach 2 — reason: superseded by Z]

### Decisions Made
- [decision 1 — rationale: X, turn Y]
- [decision 2 — rationale: X, turn Y]

### Open Tasks
- [task 1 — status: in progress, next: X]
- [task 2 — status: blocked on Y]
```

---

### Full Checkpoint [FCP-N]

**When:** Context compression is imminent, handing off to a different agent or session, or ending the session with incomplete work.

Same sections as Standard Checkpoint, plus reconstruction notes at the top:

```
## Full Checkpoint [N] — [timestamp or turn reference]
### Reconstruction Notes
- [what a reader needs to understand before reading this checkpoint]
- [any state that is stale or likely to have changed since this was written]

[then all Standard Checkpoint sections]
```

---

### Format Selection Guide

| Condition | Format |
|-----------|--------|
| 1–3 items, < 10 turns | Micro [MC-N] |
| 10+ turns, or 3+ items | Standard [CP-N] |
| Compression imminent | Full [FCP-N] |
| Handoff to agent/session | Full [FCP-N] |
| User requests checkpoint | Full [FCP-N] |
| After major direction change | Standard [CP-N] minimum |
| After recovery (Failed → Recovered) | Standard [CP-N] minimum |

---

### When to Checkpoint

- Before context compression (compaction, /clear, new session)
- After 10+ turns on a single task
- After a major decision or direction change
- After a recovery (Failed → Recovered transition)
- When handing off to a different agent or session

### Reconstruction Procedure

When resuming from a checkpoint:

1. Read the latest checkpoint
2. Verify Facts still hold (code may have changed)
3. Re-classify any Assumptions that can now be verified or falsified
4. Update Hypotheses status based on new evidence
5. Resolve any Unknowns that new context can answer
6. Unblock any Blocked Items if the blocker has been removed
7. Confirm Decisions are still valid given current state
8. Resume Open Tasks from their last known state

---

## State Transition Diagram

### Approach Health

```
Active ──[first failure]──→ Degraded ──[same failure recurs]──→ Failed
                                                                      │
                                                                      ↓
                                                                   Recovered
                                                                      │
                                                                      ↓
                                                                   Active (new approach)
```

**Rules:**
- Active → Degraded: First occurrence of an unexpected failure. Log the failure. Continue with awareness.
- Degraded → Failed: Same failure recurs, or the approach has been modified 2+ times without improvement. Stop patching. Initiate recovery.
- Failed → Recovered: Last verified state identified. Assumptions re-verified. New approach proposed. Resume.
- Recovered → Active: New approach is in progress. Monitor for the same failure pattern.

### Object Lifecycle

```
Created ──[work begins]──→ Active ──[work completes]──→ Resolved
    │                         │                            │
    │                    [partially done]              [superseded]
    │                         ↓                            ↓
    │                    Partially Resolved            Superseded
    │                         │                            │
    └─────────────────────────┴────────────────────────────┘
                              │
                         [identity preserved]
                              ↓
                         [new name/context]
```

**Rules:**
- Identity persists across all state transitions
- An object is only Resolved when success criteria are met
- Superseded objects retain their history — the superseding object references the superseded one
- Partially Resolved objects track what was completed and what remains

### Epistemic State Transitions

```
Unknown ──[observation]──→ Observed
Unknown ──[inference]───→ Inferred
Inferred ──[verification]──→ Verified
Observed ──[verification]──→ Verified
Any class ──[contradicted]──→ Unknown (re-classify, don't delete)
Speculative ──[adopted as premise]──→ STOP. Return to Unknown.
```

**Rules:**
- Never transition Speculative → any other class without new evidence
- Verified can regress to Observed or Inferred if new evidence contradicts
- When in doubt, downgrade (toward Unknown), never upgrade (toward Verified)

---

## Recovery Procedure

When Recovery Discipline triggers (approach has failed):

### Step 1: Stop
Stop patching the current approach. The current approach has failed. Additional patches compound debt.

### Step 2: Label Prior Work
State honestly what was accomplished and what wasn't:
- "Completed: [X]. Not completed: [Y]. Failed at: [Z]."

### Step 3: Identify Last Verified State
Find the last point where the system was known to be in a good state:
- "Last verified: [state description], at [turn/reference]."

### Step 4: Re-verify Assumptions
List the assumptions the failed approach depended on. Check each:
- "Assumption: [X]. Status: [still valid / invalid / unknown]."

### Step 5: Propose New Approach
State the correct approach from the last verified state:
- "From [last verified state], the correct approach is [X]."

### Step 6: State Recovery Cost
Be explicit about what the reset costs and what it doesn't:
- "Reset cost: [X effort/time]. Not lost: [Y prior work that still applies]."

### Step 7: Resume
Proceed with the new approach. Do not request permission — proceed unless the user stops it.

### What Recovery Is Not
- An apology loop
- A lengthy post-mortem
- A request for permission to continue
- A signal of incompetence — it is a signal of operational integrity

---

## Object Identity Tracking

### Identity Rules

1. **One object, one identity.** A defect is a defect. A task is a task. Don't split one defect into two tasks or merge two defects into one task without explicit justification.

2. **Identity persists across renames.** If D-04 is renamed to D-04-auth-timeout, it is still D-04. The old name is an alias.

3. **Identity persists across partial fixes.** If D-04 is half-fixed, it is still D-04. Track completion percentage separately from identity.

4. **Supersession is not deletion.** If D-04 is superseded by D-11, D-04 still exists in Superseded state. D-11 references D-04.

5. **Lineage is preserved.** If a task spawns subtasks, the parent-child relationship is tracked. Subtask completion rolls up to parent status.

### Object Registry Format

For sessions with multiple tracked objects:

```
## Object Registry

| ID | Type | Status | Description | Created | Last Updated |
|----|------|--------|-------------|---------|--------------|
| D-04 | Defect | Active | Auth timeout on reconnect | Turn 3 | Turn 8 |
| T-12 | Task | Blocked | Implement retry logic | Turn 5 | Turn 9 |
| R-07 | Requirement | Verified | Max 3 retry attempts | Turn 1 | Turn 2 |
| DEC-03 | Decision | Active | Use exponential backoff | Turn 6 | Turn 6 |
```

### Object Registry Retirement

Active registries accumulate. Objects must be retired to prevent unbounded growth.

**Retirement trigger:** A Resolved or Superseded object may be retired after it has been referenced once in a post-resolution turn. "Referenced" means cited as context for a subsequent decision — not merely listed.

**Retired objects** move from the active registry to an Archived section. They retain identity and lineage but do not count toward active tracking overhead.

```
## Archived Objects

| ID | Type | Final Status | Archived At | Notes |
|----|------|--------------|-------------|-------|
| D-04 | Defect | Resolved | Turn 12 | Fixed by T-12; referenced in DEC-07 |
```

**Retirement rules:**
1. Never retire an object whose outcome is still being referenced in open decisions.
2. Never retire a Rejected approach — rejected approaches inform what not to try; keep them in standard checkpoints under "Rejected Approaches."
3. Superseded objects must reference their superseding object before retirement: `Superseded by D-11`.
4. A retired object's ID is never reused.

---

## Epistemic Classification Guide

### Class Definitions

| Class | Definition | Example |
|-------|-----------|---------|
| **Verified** | Confirmed by direct observation or test | "The function returns null on line 42" (read the code) |
| **Observed** | Seen in available context but not independently confirmed | "The error log shows a timeout" (read the log) |
| **Inferred** | Derived from evidence but not directly observed | "The timeout is probably caused by the connection pool" (inferred from code structure) |
| **Speculative** | Possible but no supporting evidence yet | "The timeout might be a DNS issue" (no evidence) |
| **Unknown** | No information available | "The timeout cause is unknown" |

### Classification Rules

1. **Default to the lowest supported class.** If you haven't read the code, it's not Verified — it's at best Inferred.

2. **Confidence is not evidence.** "I'm 90% sure it's a connection pool issue" is still Inferred, not Verified.

3. **Label the class when it matters.** If a claim's class affects the approach, state the class. If it doesn't affect the approach, classification can be implicit.

4. **Re-classify on new evidence.** When new information arrives, update classifications. Don't accumulate stale classifications.

5. **Never present Inferred as Observed.** This is the most common epistemic error. An inference presented as observation is a fabrication.

---

## Memory Integrity — Detailed Checkpointing

### What to Checkpoint

**Always checkpoint:**
- Decisions that affect approach direction
- Rejected approaches and why
- Constraints stated by the user
- Verification status of claims

**Checkpoint when context is growing:**
- Current task decomposition
- Object registry state
- Epistemic classifications
- Blocked items and their blockers

**Don't checkpoint:**
- Trivial mechanical steps
- Intermediate calculations
- State that can be reconstructed from code

### Checkpoint Triggers

| Trigger | Action |
|---------|--------|
| 10+ turns on one task | Full checkpoint |
| Context compression imminent | Full checkpoint |
| Major direction change | Decision checkpoint |
| Recovery (Failed → Recovered) | State checkpoint |
| User requests checkpoint | Full checkpoint |
| Handoff to different agent/session | Full checkpoint |

### Reconstruction Fidelity

When reconstructing from a checkpoint:
- Facts may be stale — re-verify against current code
- Assumptions may now be verifiable — upgrade class if evidence exists
- Hypotheses may have been tested — update status
- Unknowns may now be known — resolve if possible
- The checkpoint is a starting point, not a truth

---

## Information Economy — Application to ANCHOR Itself

ANCHOR's eighth principle applies to ANCHOR itself. Don't:

- Create checkpoints for sessions under 5 turns with no state risk
- Track objects that won't be referenced again
- Write recovery procedures for approaches that haven't failed
- Add ANCHOR overhead to trivial mechanical tasks
- Surface ANCHOR actions when passive maintenance suffices

ANCHOR should reduce complexity, not add it. If applying ANCHOR to a task creates more overhead than the task itself, skip it.
