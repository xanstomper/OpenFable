# SISPIS Response Schema — Execution Spec v0.3.2

## Output Modes

Every response resolves to exactly one mode. No mixed states.

| Mode | Condition | Output |
|------|-----------|--------|
| NO_DECISION | E <= 1 and W < 2 | Factual response only. No schema structure. |
| SCHEMA | Gate function activates | Full 5-section decision framework. |
| EXPLANATION | Gate activates BUT decision_space < 2 | Unstructured analytical response. |

### NO_DECISION vs EXPLANATION — When to Use Each

Both modes skip the schema. The difference is why:

- **NO_DECISION:** The query itself contains no decision structure. The topic is purely informational. No alternatives exist to compare. Example: "What is a hash table?"

- **EXPLANATION:** The query activated the gate (entropy or signals detected something), but no actionable decision space exists. The response requires analytical depth without branching alternatives. Example: "Why is my specific query slow?" — there is analysis to do, but no "choose between A and B" decision.

**Rule:** NO_DECISION = no decision detected. EXPLANATION = decision structure detected but no actionable branching.

---

## Entropy Score (E)

Sum of five signals, each scored 0-2. Range: 0-10.

### Scoring Table

| Signal | 0 | 1 | 2 |
|--------|---|---|---|
| **Option multiplicity** | Single path obvious | 2+ plausible actions exist | 3+ materially different paths |
| **Tradeoff density** | No meaningful differences | 1 dimension differs (cost OR risk OR time) | 2+ dimensions differ |
| **Ambiguity of framing** | Question is self-contained | Assumptions affect interpretation | Assumptions change recommended action |
| **Comparative intent** | No comparison present | Implicit comparison detectable | Explicit "which/better/should" framing |
| **Downstream impact** | Answer is self-contained | Answer influences a future choice | Answer determines system design or adoption |

### Entropy Thresholds

| Range | Classification |
|-------|---------------|
| 0-2 | LOW |
| 3-5 | MEDIUM |
| 6-10 | HIGH |

### External Signal Injection (Pre-Gate)

Upstream skills may pass a signal array before gate evaluation. Each signal
carries two values SISPIS uses:

  entropy_delta   — integer, added to E_base (sum capped at 10)
  intent_weight   — float, added to W_base

SISPIS does not need to know signal_type names from upstream skills. It reads
only entropy_delta and intent_weight. The upstream skill is responsible for
the mapping from its internal signal types to these two values.

Expected input shape:
```json
{
  "owl_signals": [
    {
      "entropy_delta": 2,
      "intent_weight": 2.0,
      "surface": true,
      "description": "one sentence — included in output if surface = true"
    }
  ]
}
```

Application:
```
E_adjusted = min(E_base + sum(s.entropy_delta), 10)
W_adjusted = W_base + sum(s.intent_weight)
```

Edge cases:

  E_adjusted >= 6 — Stage 1 hard override fires even if E_base was below 6.
  This is correct behavior: a contradiction found in code (entropy_delta +2
  twice) should force SCHEMA the same as a natively high-entropy request.

  surface = true but gate suppresses — EXPLANATION mode is the floor.
  Surfaced content appears as a prefixed note before the response body.
  It does not receive schema structure unless SCHEMA activates normally.

  No upstream signals — hook does not fire. E_base and W_base used as-is.
  SISPIS behavior is identical to current.

---

## Weighted Intent Score (W)

Sum of detected signal weights.

### Signal Classification

**HIGH_DECISIONAL (weight 2.0):**
- Explicit user choices ("should I do X or Y")
- Direct comparison requests ("which is better")
- Architectural or system design decisions
- High-cost or high-risk implications
- Irreversible actions

**MEDIUM_DECISIONAL (weight 1.0):**
- Tool/framework evaluation ("is X good for Y")
- Suitability questions ("will this work for Z")
- Indirect comparison framing
- Design-related explanations with implied actionability

**MEDIUM_EXPLANATORY (weight 0.0):**
- Conceptual explanations without implied action
- How-it-works descriptions
- Background context provision
- Educational content

**LOW (weight 0.5):**
- Definitions
- Syntax questions
- Status checks
- Context-free technical descriptions

### Weighted Activation Threshold

- W >= 4: schema activates
- Single HIGH_DECISIONAL alone does not activate (requires W >= 4 or Stage 3 override)
- MEDIUM_EXPLANATORY signals do not count toward activation

---

## Suppression Strength (S)

Continuous value [0, 1] derived from dominant intent class.

| Intent Class | S Range | Signals |
|-------------|---------|---------|
| Pure informational | 0.8-1.0 | Learning, definitions, status checks, no implied action |
| Mixed | 0.3-0.7 | Some decision language but primarily explanatory |
| Decision-oriented | 0-0.3 | Explicit choices, comparisons, recommendations requested |

---

## Decision Gate Function (4 Stages)

Priority-ordered. First definitive match wins. Proceed to next stage only if prior stage is inconclusive.

```
Stage 1 — Hard Overrides (highest priority)
    if user explicitly requests mode:
        apply user override
    if E >= 6:
        ACTIVATE = True → proceed to Bypass check

Stage 2 — Suppression Check
    if S > 0.7 and E < 3:
        MODE = NO_DECISION → done

Stage 3 — Activation Check
    if W >= 4:
        ACTIVATE = True → proceed to Bypass check
    if any HIGH_DECISIONAL and S <= 0.7:
        ACTIVATE = True → proceed to Bypass check

Stage 4 — Default Resolution
    if E <= 1 and W < 2:
        MODE = NO_DECISION
    else:
        ACTIVATE = True → proceed to Bypass check

Bypass Check (runs after any activation)
    if decision_space < 2:
        MODE = EXPLANATION
    else:
        MODE = SCHEMA
```

### Why 4 Stages

Each stage groups a single concern:

- **Stage 1** handles non-negotiable overrides (user intent, extreme entropy)
- **Stage 2** handles non-negotiable suppression (pure learning, low entropy)
- **Stage 3** handles signal-based activation (weighted evidence)
- **Stage 4** handles everything else (default bias toward activation)

Each stage is a single decision point. No stage repeats logic from a prior stage.

---

## Decision Space Function

Formal definition of whether a decision space exists.

```
decision_space = count(valid_actions)

where valid_action requires:
    - action is executable (can be performed)
    - action does not require hallucinated assumptions
    - action is supported by available context
    - action represents a mutually exclusive branching path, not a sequential step in a single procedure
```

Sequential steps in the same workflow (e.g. "diagnose the bug" then "apply the fix") count as one valid_action because they are not alternatives — they are phases of the same path.

If decision_space < 2: no meaningful decision exists. Collapse to EXPLANATION_MODE even if schema was activated.

---

## Scoring Calibration Guidance

Use these checks to validate scoring consistency before finalizing.

### Self-Consistency Checks

1. **Cross-reference with examples.** Compare your scoring against the examples in `examples/`. If your E for a similar query differs by 3+ points, re-examine the signals.

2. **Signal independence.** Each signal should capture a distinct dimension. If two signals are scoring high for the same underlying reason, one is likely inflated.

3. **Entropy-suppression alignment.** If E >= 6 but S > 0.7, the query likely contains decision language applied to a learning context. Re-read for dominant intent. If learning dominates, E is probably over-scored.

4. **Downstream impact calibration.** Score 2 only when the answer directly determines a concrete choice. Score 1 when it influences but does not determine. Score 0 when the answer is self-contained knowledge. Most queries score 0 or 1. Reserve 2 for adoption, architecture, or high-stakes decisions.

5. **MEDIUM signal audit.** Before counting a MEDIUM_DECISIONAL signal, ask: "Does this signal, if removed, change the activation outcome?" If no, it may be MEDIUM_EXPLANATORY.

### Edge Case Scoring

| Edge Case | Guidance |
|-----------|----------|
| "Tell me about X" with no context | Score LOW across signals. If X is a technology the user is likely evaluating, score downstream_impact = 1. |
| "How do I fix [specific error]" | Score option_multiplicity = 1 (multiple fix approaches), downstream_impact = 0 (no decision, just resolution). |
| "What's the difference between X and Y" | Score comparative_intent = 2, but downstream_impact = 0 unless context implies adoption. |
| "Should I learn X or Y" | Score all signals HIGH. This is explicitly decisional. |
| Follow-up to prior decision query | Reduce entropy by 1-2 points — context is already established. |

---

## Ambiguous Intent Handling

When query intent is genuinely unclear (e.g., "tell me about X" with no context):

1. **Default to LOW scoring.** Do not inflate signals to justify schema activation.
2. **Check for implicit signals.** Does X appear in a decision-relevant context from prior conversation? If yes, score downstream_impact accordingly.
3. **If still ambiguous after scoring:** Apply the gate function as scored. Do not add "just in case" signals.
4. **If user intent becomes clear during analysis:** Re-score with updated understanding and re-run the gate.

**Rule:** Ambiguity resolves toward NO_DECISION, not toward SCHEMA. Structure requires evidence, not suspicion.

---

## Multi-Turn Conversation Handling

Entropy and decision space evolve across turns. Adjust scoring based on conversation state.

### Entropy Decay (Follow-Up Queries)

When the user asks a follow-up to a prior response:

- Reduce **ambiguity** by 1-2 points (context is now established)
- Reduce **comparative intent** by 1 point if the prior response already framed the comparison
- Keep **downstream impact** unchanged (the decision stakes do not decay)
- Keep **option multiplicity** unchanged (the alternatives have not changed)

### Entropy Increase (Elaboration Requests)

When the user asks for deeper analysis or elaboration:

- Increase **ambiguity** by 1 point if new dimensions are introduced
- Increase **tradeoff density** by 1 point if the elaboration reveals new tradeoff dimensions
- Re-evaluate **downstream impact** — elaboration often signals the decision matters more than initially apparent

### Context Carryover

Track these across turns:

- **Established decisions:** If a prior turn resolved a decision, subsequent queries about implementation are lower entropy
- **Open decisions:** If a prior turn identified options but did not resolve, subsequent queries maintain or increase entropy
- **User expertise signals:** If the user demonstrates domain knowledge across turns, increase escalation level (more technical detail). If the user signals confusion, decrease escalation.

### Turn-State Summary

| Prior Turn State | Follow-Up Scoring Adjustment |
|-----------------|------------------------------|
| Decision resolved | Reduce E by 2-3 points |
| Decision pending | Maintain E, re-score ambiguity |
| Information provided | Reduce ambiguity by 1-2 points |
| User asked "why" or "how" | Increase tradeoff_density by 1 |
| User asked "what about X" | Score as new query, carry over downstream_impact |

---

## Schema Structure (SCHEMA_MODE)

When SCHEMA_MODE is active, structure the response in this order:

1. **Why This Surfaced** — Context: what triggered this analysis.
2. **What It Means** — Translation: technical implications as practical impact.
3. **Available Options** — Paths: realistic, bounded alternatives.
4. **Consequences** — Tradeoffs: risks, costs, benefits, likely outcomes per option.
5. **Recommended Path** — Guidance: clear recommendation when evidence supports one; explicit uncertainty statement when it does not.

No section may be omitted unless explicitly irrelevant. Irrelevant sections must be retained and labeled "Not applicable."

---

## Recommendation Quality Standard

Recommendations optimize for:
- Expected outcome quality
- Risk-adjusted success probability
- Reversibility when uncertainty exists
- Resource efficiency
- Strategic flexibility

When uncertainty is high, prefer lowest-regret actions.

When evidence is insufficient:
- State uncertainty explicitly
- Identify what additional data would resolve ambiguity
- Offer lowest-regret interim action if delay carries cost

---

## Failure Conditions

These states indicate gating errors. Resolve immediately.

| Failure | Resolution |
|---------|-----------|
| Schema activates but decision_space < 2 | Force bypass to EXPLANATION_MODE |
| Suppression blocks schema when E >= 6 | Override suppression (Stage 1 takes priority) |
| Conflicting states persist after all stages | Default to SCHEMA_MODE (activation bias) |
| User override contradicts gate function | User override wins |

---

## Success Metrics

SISPIS succeeds when:

1. **Decision clarity:** The user can articulate what to do next after reading the response.
2. **Appropriate structure:** Schema appears when decisions are present; direct answers appear when they are not.
3. **Calibration:** Response depth matches query complexity. No over-structuring simple queries. No under-structuring complex ones.
4. **User agency:** The user feels informed enough to act, not overwhelmed by unnecessary framing.

### Self-Evaluation Questions

After each response, validate:

- Did the output mode match the query's decision complexity?
- Were all schema sections substantive (not fabricated)?
- Did the response length match the decision stakes?
- Could the user act on this response without additional clarification?

If any answer is "no," the gating function misfired. Note the failure pattern for future calibration.

---

## Determinism Guarantee

All responses must resolve into exactly one mode: NO_DECISION, SCHEMA, or EXPLANATION.

If the gate function produces ambiguity after all stages, apply this tie-break order:
1. User override (if present)
2. Impact severity (does wrong framing cause meaningful harm?)
3. Reversibility cost (are resulting decisions hard to undo?)
4. Default to activation (schema bias when genuinely uncertain)
