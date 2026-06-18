# OWL Signal Schema — Integration Spec

## Signal Type Registry

Complete registry of all signal types, organized by principle. Multiple types per principle — a principle can emit any signal from its list in a single reasoning pass.

### Epistemics

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `unverified_assumption` | 1.0 | Approach depends on an assumption that hasn't been verified and is not inferable from available context |
| `ambiguous_requirement` | 0.5 | The request has two or more distinct interpretations with meaningfully different implementations |
| `multiple_interpretations` | 0.5 | More than two interpretations exist; presenting them requires a decision from the user |
| `position_pressure` | 1.0 | User disagreement arrived without new information — social pressure to revise a correct analysis |

### Reality

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `code_not_read` | 1.0 | Implementation depends on code contents but the code has not been read |
| `contradiction` | 2.0 | Code behavior directly contradicts what the request implies — different API, wrong type, already implemented, missing dependency |
| `missing_context` | 0.5 | Context needed to verify the approach is not available and cannot be safely inferred |
| `constraint_drift` | 1.0 | In a long task, a constraint stated early may no longer be reflected in current direction |

### Verification

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `missing_criteria` | 1.0 | Success is not derivable from the request — "fix it" or "make it work" without a testable state |
| `unverifiable_claim` | 1.0 | A claim is being made that cannot be verified with available tools, context, or code |
| `partial_completion` | 1.0 | Some part of the task is complete but another part cannot be verified — labeling required |

### Locality

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `scope_expansion` | 1.0 | Completing the task requires modifying things beyond what the request implied |
| `unrelated_change_detected` | 0.5 | A change in scope that doesn't trace to the user's request was about to be made |

### Conservation

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `intent_deviation` | 2.0 | The implementation would change observable behavior beyond what was requested |
| `behavior_change_risk` | 1.0 | A meaningful probability exists that existing behavior breaks, even if not certain |

### Simplicity

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `over_complexity_detected` | 0.5 | Current approach is detectably more complex than the problem requires |

### Generalization

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `abstraction_added` | 0.5 | An abstraction, helper, or pattern is being added beyond the literal request |
| `premature_pattern` | 0.5 | A pattern is being introduced where a specific, inline solution would be sufficient |

### Debuggability

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `opacity_risk` | 0.5 | An implementation choice introduces behavior that would surprise a reader or make future debugging significantly harder |

### Integrity

| Signal Type | Weight | Condition |
|-------------|--------|-----------|
| `approach_failed` | 2.0 | The current approach has demonstrably failed and continuing it is a sunk cost |
| `simulated_completion_risk` | 2.0 | There is a risk of presenting inferred or fabricated content as verified output |
| `sunk_cost_detected` | 1.0 | Resistance to abandoning a wrong path because of prior work invested in it |

---

## Weight Summary

| Weight | Signal Types |
|--------|-------------|
| 2.0 | `contradiction`, `intent_deviation`, `approach_failed`, `simulated_completion_risk` |
| 1.0 | `unverified_assumption`, `position_pressure`, `code_not_read`, `constraint_drift`, `missing_criteria`, `unverifiable_claim`, `partial_completion`, `scope_expansion`, `behavior_change_risk`, `sunk_cost_detected` |
| 0.5 | `ambiguous_requirement`, `multiple_interpretations`, `missing_context`, `unrelated_change_detected`, `over_complexity_detected`, `abstraction_added`, `premature_pattern`, `opacity_risk` |

---

## Gate Threshold

```
W_owl = sum of all emitted signal weights

W_owl >= 1.5  →  Surface mode
W_owl <  1.5  →  Silent mode
```

A single weight-2.0 signal always triggers surfacing. Two weight-1.0 signals trigger surfacing. Three weight-0.5 signals do not (sum = 1.5; threshold is >= 1.5, so three does trigger). Two weight-0.5 signals do not (sum = 1.0).

---

## Stacking Rules

Multiple signals can surface in a single response. Rules for stacking:

1. **Order by descending weight.** Higher-weight signals appear first — they have higher action consequence.
2. **Suppress redundant signals from the same principle.** If `contradiction` already surfaces, do not also surface `code_not_read` from the same observation — the contradiction implies the code was read.
3. **Don't merge finding + implication across signals.** Each signal line is independent. Merging them obscures which principle fired for which reason.
4. **Cap at five surface lines.** If W_owl is very high (e.g., multiple weight-2.0 signals), the first five by descending weight are surfaced. Additional signals are available internally but not output — the goal is to change what the user does, not to enumerate every finding.

---

## Conflict Resolution

If two signals contradict each other (rare but possible):

1. Higher-weight signal takes precedence.
2. If equal weight, prefer the signal from the earlier principle in the SKILL.md ordering (Epistemics > Reality > Verification > Locality > Conservation > Simplicity > Generalization > Debuggability > Integrity).
3. Both can surface if they represent genuinely distinct findings — conflicting signals usually indicate a design ambiguity that should be surfaced anyway.

---

## Suppression Conditions

Do not run the reasoning pass (W_owl = 0, silent) when all of the following are true:
- Task is purely mechanical: rename, reformat, move, delete
- No code read is required to complete it
- The request is unambiguous (single valid interpretation)
- No existing code is being modified in a way that could change behavior

Examples: "rename `usr` to `user` in this file", "add a blank line between these two functions", "move this function to the bottom of the file."

---

## SISPIS Entropy Mapping

OWL signals map to SISPIS entropy dimensions. When OWL runs before SISPIS, the emitted signals pre-score specific SISPIS entropy signals, adding delta values to E before SISPIS runs its own gate.

The SISPIS entropy signals are: `option_multiplicity`, `tradeoff_density`, `ambiguity_of_framing`, `comparative_intent`, `downstream_impact`.

### Mapping Table

| OWL signal_type | SISPIS signal affected | Delta |
|-----------------|----------------------|-------|
| `contradiction` | `option_multiplicity`, `downstream_impact` | +2 each |
| `ambiguous_requirement` | `ambiguity_of_framing` | +2 |
| `unverified_assumption` | `ambiguity_of_framing` | +1 |
| `multiple_interpretations` | `comparative_intent`, `ambiguity_of_framing` | +1 each |
| `scope_expansion` | `downstream_impact` | +1 |
| `approach_failed` | `option_multiplicity`, `tradeoff_density` | +1 each |
| `intent_deviation` | `downstream_impact` | +2 |
| `position_pressure` | `ambiguity_of_framing` | +1 |
| `missing_criteria` | `ambiguity_of_framing` | +1 |
| `constraint_drift` | `ambiguity_of_framing`, `downstream_impact` | +1 each |
| `behavior_change_risk` | `downstream_impact` | +1 |
| `simulated_completion_risk` | `tradeoff_density`, `downstream_impact` | +1 each |
| `sunk_cost_detected` | `tradeoff_density` | +1 |
| `abstraction_added` | `option_multiplicity` | +0.5 |
| `over_complexity_detected` | `tradeoff_density` | +0.5 |
| `opacity_risk` | `downstream_impact` | +0.5 |
| `code_not_read` | `ambiguity_of_framing` | +1 |
| `missing_context` | `ambiguity_of_framing` | +0.5 |
| `unverifiable_claim` | `tradeoff_density` | +0.5 |
| `partial_completion` | `downstream_impact` | +0.5 |
| `premature_pattern` | `option_multiplicity` | +0.5 |
| `unrelated_change_detected` | `downstream_impact` | +0.5 |

### Capping

SISPIS entropy signals are scored 0-2 per signal. OWL deltas can push a signal past 2. Cap each SISPIS signal at 2.0 after applying deltas. Overflow does not carry to adjacent signals.

### Pipeline Operation

```
1. OWL runs reasoning pass → emits signals with weights
2. OWL gate: if W_owl >= 1.5, surface findings before output
3. OWL passes emitted signal list to SISPIS
4. SISPIS applies delta table to its entropy score E
5. SISPIS runs its gate function on the resulting E
6. Output mode: NO_DECISION / EXPLANATION / SCHEMA
```

OWL can elevate E enough to cross SISPIS thresholds. A request that SISPIS would ordinarily resolve as NO_DECISION may become SCHEMA after OWL finds a `contradiction` (+2 to two signals, potentially pushing E from 2 to 6).

---

## Integration Test Cases

### Low-signal request (W_owl = 0)
Rename a variable. No signals. SISPIS receives E unelevated. If the request was already low-entropy, output is direct.

### Single weight-1.0 signal (W_owl = 1.0)
`missing_criteria` fires. W_owl = 1.0 < 1.5 → silent. SISPIS receives +1 to `ambiguity_of_framing`. If E was 2, it becomes 3 — SISPIS may now activate where it wouldn't have.

### Single weight-2.0 signal (W_owl = 2.0)
`contradiction` fires. W_owl = 2.0 >= 1.5 → surface. SISPIS receives +4 total (two signals +2 each, capped at 2 each). E likely crosses 6 → SISPIS Stage 1 hard override → SCHEMA mode.

### Two weight-1.0 signals (W_owl = 2.0)
`unverified_assumption` + `scope_expansion`. Surfaces. SISPIS receives +1 to `ambiguity_of_framing` and +1 to `downstream_impact`. E elevates moderately; SISPIS gate depends on base E.
