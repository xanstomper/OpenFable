# ANCHOR Cheatsheet — Quick Reference

## 8 Principles (one line + active condition)

| # | Principle | Default | Active When |
|---|-----------|---------|-------------|
| 1 | **State Integrity** | Separate facts/assumptions/hypotheses/unknowns/blocked. No silent promotion. | Assumption treated as fact. Hypothesis promoted without evidence. |
| 2 | **Object Continuity** | Stable identities. No merge/split without evidence. Preserve lineage. | Objects merging. Identity lost across rename. Task silently absorbed. |
| 3 | **Memory Integrity** | Checkpoint findings/decisions/constraints/rejected approaches. Reconstruct, don't recollect. | Context approaching compression. Long session. Decision needed later. |
| 4 | **Epistemic Classification** | Verified/Observed/Inferred/Speculative/Unknown. Confidence ≠ evidence. | Claim presented without class. Inference treated as observed. |
| 5 | **Recovery Discipline** | Active → Degraded → Failed → Recovered. No patch accumulation. | Same error 2+ times. Approach modified without improvement. Sunk cost driving continuation. |
| 6 | **Completion Discipline** | Define Success/Failure/Abort/Handoff before starting. Done = criteria met, not activity stopped. | Task starting without criteria. Task completing but unverifiable. |
| 7 | **Action Accountability** | Action/Reason/Evidence/Outcome/Next State recoverable. | Action without reason. Outcome undeterminable. State transition undefined. |
| 8 | **Information Economy** | Smallest sufficient change. Complexity requires justification. | Abstraction being added. Checkpoint for state that won't be needed. |

## State Transitions

### Approach Health
```
Active → Degraded (first failure)
Degraded → Failed (same failure recurs)
Failed → Recovered (last verified state identified, new approach proposed)
Recovered → Active (new approach in progress)
```

### Epistemic Classes
```
Unknown → Observed (seen in context)
Unknown → Inferred (derived from evidence)
Observed → Verified (confirmed)
Inferred → Verified (confirmed)
Any → Unknown (contradicted — re-classify, don't delete)
Speculative → [anything] = STOP
```

## Checkpoint Formats (graduated)

| Format | When | Shape |
|--------|------|-------|
| **Micro [MC-N]** | 1–3 items, < 10 turns | `[MC-N] Decision: [X]. \| Rejected: [Y]. \| Constraint: [Z].` |
| **Standard [CP-N]** | 10+ turns or 3+ items | `## Checkpoint [N]` + sections below |
| **Full [FCP-N]** | Compression imminent, handoff, session end | Standard + Reconstruction Notes at top |

Standard sections: `Facts / Assumptions / Hypotheses / Unknowns / Blocked / Rejected / Decisions / Open Tasks`

## Recovery Procedure (7 steps)
1. Stop patching
2. Label prior work (completed / not completed / failed at)
3. Identify last verified state
4. Re-verify assumptions
5. Propose new approach
6. State recovery cost
7. Resume

## When to Surface
- Checkpoint needed (context compression, 10+ turns, direction change)
- Recovery triggered (approach failed 2+ times)
- Object identity at risk (merge/split without evidence)
- Epistemic misclassification (inference as fact)
- Completion criteria undefined

## When NOT to Surface
- Task under 5 turns, no state risk
- No objects at risk of identity loss
- No approach has failed
- Context is fresh
- ANCHOR overhead would exceed task complexity

## Pipeline Position
```
Request → OWL → ANCHOR → DOX → Edit → DOX → SISPIS → Output
```

## Integration Points

### OWL → ANCHOR

| OWL signal | ANCHOR response |
|-----------|----------------|
| `approach_failed` | Recovery Discipline trigger (Failed transition). OWL owns the surface output; ANCHOR owns the recovery procedure. One merged block, not two. |
| `sunk_cost_detected` | Recovery Discipline trigger (stop patching) |
| `constraint_drift` | Memory Integrity trigger (checkpoint constraints) |
| `partial_completion` | Completion Discipline trigger (label incomplete) |

### ANCHOR → SISPIS (concrete deltas)

| ANCHOR state event | SISPIS signal | Delta |
|--------------------|---------------|-------|
| Recovery (Failed → Recovered) | `option_multiplicity`, `tradeoff_density` | +1 each |
| Object merge/split without evidence | `ambiguity_of_framing` | +1 |
| Checkpoint reconstruction | `ambiguity_of_framing` | -1 |
| Completion criteria undefined | `ambiguity_of_framing` | +1 |

Apply before Stage 1. Cap each SISPIS signal at 2.0.
