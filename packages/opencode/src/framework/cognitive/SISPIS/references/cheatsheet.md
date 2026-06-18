# SISPIS Quick-Reference Cheatsheet

## The 3 Output Modes

| Mode | When | Output |
|------|------|--------|
| **NO_DECISION** | E <= 1 and W < 2 | Direct factual answer. No schema. |
| **SCHEMA** | Gate activates, decision_space >= 2 | 5-section decision framework. |
| **EXPLANATION** | Gate activates, decision_space < 2 | Unstructured analytical response. |

## The 4-Stage Gate

```
Stage 1 — Hard Overrides
    User override? → apply it
    E >= 6? → ACTIVATE

Stage 2 — Suppression
    S > 0.7 AND E < 3? → NO_DECISION

Stage 3 — Activation
    W >= 4? → ACTIVATE
    HIGH_DECISIONAL AND S <= 0.7? → ACTIVATE

Stage 4 — Default
    E <= 1 AND W < 2? → NO_DECISION
    Otherwise? → ACTIVATE

Bypass (after any activation)
    decision_space < 2? → EXPLANATION
    Otherwise? → SCHEMA
```

## Entropy Signals (each 0-2, sum = E)

| Signal | 0 | 1 | 2 |
|--------|---|---|---|
| Option multiplicity | Single path | 2+ options | 3+ different paths |
| Tradeoff density | None | 1 dimension | 2+ dimensions |
| Ambiguity | Self-contained | Assumptions matter | Assumptions change action |
| Comparative intent | None | Implicit | Explicit "which/better/should" |
| Downstream impact | Self-contained | Influences choice | Determines design/adoption |

**Thresholds:** 0-2 = LOW | 3-5 = MEDIUM | 6-10 = HIGH

**External signals:** E_adj = min(E_base + Σentropy_delta, 10) · W_adj = W_base + Σintent_weight · runs before Stage 1

## Signal Weights (sum = W)

| Class | Weight | Examples |
|-------|--------|----------|
| HIGH_DECISIONAL | 2.0 | Explicit choices, direct comparisons, architecture decisions |
| MEDIUM_DECISIONAL | 1.0 | Tool evaluation, suitability questions, indirect comparison |
| MEDIUM_EXPLANATORY | 0.0 | Conceptual explanations, how-it-works, educational |
| LOW | 0.5 | Definitions, syntax, status checks |

**Activation threshold:** W >= 4

## Suppression Strength (S)

| Intent | S Range |
|--------|---------|
| Pure informational | 0.8-1.0 |
| Mixed | 0.3-0.7 |
| Decision-oriented | 0-0.3 |

## Decision Space

```
decision_space = count(valid_actions)

where valid_action requires:
    - executable (can be performed)
    - non-hallucinatory (no fabricated assumptions)
    - context-supported
    - mutually exclusive branching path (not sequential steps in the same procedure)
```

Sequential steps in one workflow (e.g. "diagnose" then "fix") count as one path.

< 2 → bypass to EXPLANATION

## Schema Structure (5 Sections)

1. Why This Surfaced
2. What It Means
3. Available Options
4. Consequences
5. Recommended Path

## User Override Keywords

| User says | Effect |
|-----------|--------|
| "just tell me", "keep it simple" | Force suppression |
| "give me options", "what should I do" | Force activation |
| "deep dive", "full analysis" | Force activation, max detail |

## Multi-Turn Adjustments

| Prior State | Adjustment |
|-------------|-----------|
| Decision resolved | Reduce E by 2-3 |
| Decision pending | Maintain E, re-score ambiguity |
| Info provided | Reduce ambiguity by 1-2 |
| User asks "why"/"how" | Increase tradeoff_density by 1 |

## Calibration Checks

1. Compare scoring against examples — if E differs by 3+ for similar query, re-examine
2. Each signal should capture a distinct dimension — no double-counting
3. If E >= 6 but S > 0.7, re-read for dominant intent
4. downstream_impact = 2 only for adoption/architecture/high-stakes decisions
5. Before counting MEDIUM_DECISIONAL, ask: "Does removing this signal change the outcome?"

## Failure Conditions

| Failure | Fix |
|---------|-----|
| Schema without decision_space | Force EXPLANATION |
| Suppression blocks E >= 6 | Override suppression |
| Conflicting states persist | Default to SCHEMA |
| User override contradicts gate | User override wins |
