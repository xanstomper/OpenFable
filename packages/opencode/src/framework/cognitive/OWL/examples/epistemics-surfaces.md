# Epistemics Surfaces — "Make the login faster"

Calibrates: ambiguous_requirement fires, multiple_interpretations fires, W_owl crosses threshold.

---

## Input

> The login is too slow. Make it faster.

No code provided.

---

## Reasoning Pass

**Epistemics:**
"Login is too slow" contains no measurement and no target. "Make it faster" has at least four structurally different implementations depending on what is slow:

1. Database query (N+1 on user lookup, missing index, no query cache)
2. Password hashing (bcrypt work factor too high for expected load)
3. Session initialization (synchronous blocking calls that could be async)
4. Network round-trips (unnecessary API calls during auth flow)

Each interpretation requires reading and modifying different code. Implementing without knowing which is slow would mean either: guessing and modifying the wrong layer, or modifying all four (scope explosion, Conservation risk).

Signal emitted:
```json
{
  "principle": "Epistemics",
  "signal_type": "multiple_interpretations",
  "weight": 0.5,
  "finding": "Login performance can degrade from at least four independent causes — DB, hashing, session init, network — each requiring different code changes.",
  "implication": "Implementing without profiling data or a specified bottleneck risks modifying the wrong layer, leaving the actual slow path untouched."
}
```

Signal emitted:
```json
{
  "principle": "Epistemics",
  "signal_type": "ambiguous_requirement",
  "weight": 0.5,
  "finding": "No performance target specified and no measurement provided.",
  "implication": "There is no way to verify completion — 'faster' without a baseline cannot be confirmed."
}
```

**Reality:**
No code provided. The implementation depends entirely on what the login code looks like, which is unknown.

Signal emitted:
```json
{
  "principle": "Reality",
  "signal_type": "code_not_read",
  "weight": 1.0,
  "finding": "No login code was provided.",
  "implication": "Any implementation would be speculative — the actual slow path is unknown without reading the code."
}
```

**Verification:**
"Faster" is not a verifiable success criterion. Without a baseline measurement and a target, the task cannot be confirmed complete.

Signal emitted:
```json
{
  "principle": "Verification",
  "signal_type": "missing_criteria",
  "weight": 1.0,
  "finding": "No performance baseline or target provided.",
  "implication": "The task cannot be verified complete — 'faster' is not testable without measurement."
}
```

All other principles: no signals.

---

## Gate

W_owl = 0.5 + 0.5 + 1.0 + 1.0 = 3.0. W_owl >= 1.5 → Surface mode.

Surface order: `code_not_read` and `missing_criteria` (weight 1.0 each) first, then `multiple_interpretations` and `ambiguous_requirement` (0.5 each). Cap at 5 — all 4 fit.

---

## Output

**Reality:** No login code was provided. The slow path is unknown without reading the implementation.
**Verification:** No performance baseline or target specified — "faster" can't be verified as done without a measurement.
**Epistemics:** Login performance degrades from multiple independent sources (DB query, password hashing, session init, network). Each requires different code. Without a profile or a specified bottleneck, the correct layer is ambiguous.

Share the login code and either a baseline measurement or a description of where it feels slow (e.g., "the DB query takes 2s") and I'll identify the bottleneck and fix it.

---

## SISPIS Integration

OWL emitted four signals. Relevant SISPIS deltas:
- `code_not_read` → `ambiguity_of_framing` +1
- `missing_criteria` → `ambiguity_of_framing` +1
- `multiple_interpretations` → `comparative_intent` +1, `ambiguity_of_framing` +1
- `ambiguous_requirement` → `ambiguity_of_framing` +2 (capped at 2)

`ambiguity_of_framing` would cap at 2. `comparative_intent` reaches 1. `downstream_impact` not elevated here (no code change yet). Base E was likely 1-2. After OWL: E around 5-6 → SISPIS activates with possible SCHEMA or EXPLANATION mode depending on decision_space. Since the user needs to provide info before there are real options to compare, EXPLANATION is the likely output mode.

---

## What This Calibrates

Three principles fire simultaneously on a request that looks simple. This is correct — "make it faster" without code or measurement is a low-information request that can't be executed as stated.

The surface output asks for exactly what's needed: code + measurement/location. It doesn't enumerate every possible cause in a wall of text — it names the category of unknowns (multiple independent causes) and asks the user to narrow it.

Anti-pattern to avoid: speculative optimization. "I'll add caching to the DB query layer and also look at bcrypt settings" — this is guessing, modifying code that may be fine, and introducing changes that the user didn't verify were needed. Reality and Epistemics both fire for this reason.
