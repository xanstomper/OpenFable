# SISPIS Integration — End-to-End Signal Pipeline

Calibrates: OWL signal output → SISPIS entropy input, full pipeline, two scenarios.

---

## How the Pipeline Works

```
Request
  → OWL reasoning pass
      emits: signals with weights (structured JSON)
  → OWL gate: if W_owl >= 1.5, surface findings before output
  → OWL passes signal list to SISPIS
      SISPIS reads: signal_type → delta table
      SISPIS adds deltas to its entropy score E
  → SISPIS gate runs on elevated E
  → Output mode: NO_DECISION / EXPLANATION / SCHEMA
```

OWL does not replace SISPIS's gate function. It pre-scores entropy signals based on pre-implementation findings. SISPIS still runs its full gate on the resulting E. The effect is that OWL can elevate a request from low to medium or high entropy before SISPIS would naturally compute it that way.

---

## Scenario 1: Low → High Escalation

### Request

> Should I migrate the authentication system to OAuth2?

### SISPIS scoring without OWL

User explicitly asked "should I" — comparative_intent = 2. The question has strategic implications — downstream_impact = 2. Two options exist (OAuth2 vs. current) — option_multiplicity = 1. The architecture dimensions differ (security model, token lifecycle, external dependencies) — tradeoff_density = 1. The framing is clear — ambiguity_of_framing = 0.

E (without OWL) = 2 + 2 + 1 + 1 + 0 = 6. HIGH. Stage 1 override → SCHEMA mode.

In this case OWL doesn't change the outcome — SISPIS would activate on its own. But OWL runs anyway.

### OWL reasoning pass

**Epistemics:** "Migrate authentication" has multiple interpretations — migrate all users, migrate new users only, run parallel systems, migrate partially (OAuth for web, keep existing for API). These have materially different implementation paths and costs.

Signal: `multiple_interpretations` (0.5) — `comparative_intent` +1, `ambiguity_of_framing` +1.

**Reality:** No current auth implementation was provided. Migration scope depends on what exists.

Signal: `missing_context` (0.5) — `ambiguity_of_framing` +0.5.

**Verification:** Success criteria for "migrate" is unclear — is it 0% of users on old system? 100% of new signups? Specific date?

Signal: `missing_criteria` (1.0) — `ambiguity_of_framing` +1.

W_owl = 0.5 + 0.5 + 1.0 = 2.0 >= 1.5 → Surface.

### OWL delta application to SISPIS E

Starting E = 6 (already computed above).
- `multiple_interpretations` → comparative_intent +1 (capped at 2, already 2, no change), ambiguity_of_framing +1
- `missing_context` → ambiguity_of_framing +0.5 (caps at 2 after accumulation)
- `missing_criteria` → ambiguity_of_framing +1 (caps at 2)

ambiguity_of_framing starts at 0, after OWL: min(0 + 1 + 0.5 + 1, 2) = 2.
Final E = 2 + 2 + 1 + 1 + 2 = 8.

Result: E = 8. Stage 1 still activates. Decision space = 2 (migrate vs. don't). SCHEMA mode.

**Effect of OWL:** E went from 6 to 8. The additional ambiguity found by OWL strengthens the SCHEMA activation and adds "scope of migration is unclear" as a dimension that SISPIS's SCHEMA structure should address.

---

## Scenario 2: Low → Elevated (SISPIS wouldn't have activated alone)

### Request

> Add error logging to the payment handler.

### SISPIS scoring without OWL

No comparison requested — comparative_intent = 0. Standard feature add — option_multiplicity = 1. No meaningful tradeoffs stated — tradeoff_density = 0. Clear request — ambiguity_of_framing = 0. Self-contained answer — downstream_impact = 0.

E (without OWL) = 0 + 0 + 1 + 0 + 0 = 1. LOW.
W = no HIGH_DECISIONAL signals. W < 4.
Stage 2: S is high (pure feature add, informational). S > 0.7, E < 3 → NO_DECISION mode. SISPIS outputs a direct answer.

### OWL reasoning pass

**Reality:** Code is read. The payment handler currently has try/catch that swallows exceptions silently — no logging, no re-raise, no error propagation. Adding error logging is possible, but swallowing exceptions without propagation means errors are currently hidden from callers. "Adding logging" to a silent-catch pattern logs the error but still hides it from the system — callers won't know requests failed.

Signal: `contradiction` (2.0) — finding: the handler swallows exceptions silently; adding logging doesn't fix the silent failure. Implication: logging without error propagation means callers continue receiving success responses on failed payments.

**Conservation:** Adding logging without fixing the swallow changes the observability of the code without changing its behavior — is that what's wanted, or should the fix also restore propagation?

Signal: `intent_deviation` (2.0) — finding: "add logging" could mean either (a) add logging and leave swallow behavior, or (b) add logging and fix the swallow. These have different downstream effects.

W_owl = 2.0 + 2.0 = 4.0 >= 1.5 → Surface.

### OWL delta application to SISPIS E

Starting E = 1 (SISPIS computed low).
- `contradiction` → option_multiplicity +2 (was 1, now capped at 2+1=2, already 1 → becomes min(1+2, 2) = 2), downstream_impact +2 (was 0 → becomes 2)
- `intent_deviation` → downstream_impact +2 (was now 2, still capped at 2)

E recalculated: comparative_intent=0, tradeoff_density=0, ambiguity_of_framing=0, option_multiplicity=2, downstream_impact=2.
E = 0 + 0 + 0 + 2 + 2 = 4. MEDIUM.

W recalculation: `contradiction` maps to `downstream_impact` (HIGH_DECISIONAL in SISPIS terms — high-risk implication). W now includes HIGH_DECISIONAL signal. S is no longer > 0.7 (the finding changes intent classification from "pure feature add" to "decision with risk").

Stage 3: HIGH_DECISIONAL with S <= 0.7 → ACTIVATE.
Decision space: 2 (add logging with swallow intact vs. add logging with propagation restored).
SCHEMA mode.

**Effect of OWL:** A request that SISPIS computed as NO_DECISION becomes SCHEMA after OWL finds that the request assumes a code state that doesn't exist. The user is not actually choosing whether to add logging — they're choosing between two materially different implementations, one of which silently breaks the system's error handling.

---

## Integration Summary

| Scenario | SISPIS without OWL | OWL signals emitted | SISPIS with OWL | Delta |
|----------|-------------------|--------------------|--------------------|-------|
| "Should I migrate auth?" | E=6, SCHEMA | `multiple_interpretations`, `missing_context`, `missing_criteria` | E=8, SCHEMA (same mode, stronger activation) | Mode unchanged, additional dimensions surfaced |
| "Add error logging" | E=1, NO_DECISION | `contradiction`, `intent_deviation` | E=4, SCHEMA | Mode escalated; silent failure risk surfaced |

OWL's most valuable integration role is Scenario 2: catching cases where SISPIS would suppress structure because the request looks simple, but the code reveals complexity that changes the decision space.
