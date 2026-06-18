# Verification Triggers — "Refactor this to be cleaner"

Calibrates: missing_criteria fires, success state is not derivable, surfacing asks for a specific target.

---

## Input

> Can you refactor this function to be cleaner?

```python
def process(data, mode, flag=False, extra=None):
    result = []
    for item in data:
        if mode == "a":
            if flag:
                result.append(item * 2)
            else:
                result.append(item)
        elif mode == "b":
            if extra is not None:
                result.append(item + extra)
            else:
                result.append(item - 1)
        else:
            result.append(str(item))
    return result
```

---

## Reasoning Pass

**Verification:**
"Cleaner" is not a testable state. It maps to at least five distinct refactoring targets:

1. Extract the mode logic into separate functions (readability via decomposition)
2. Replace the mode string with an enum or dispatch table (type safety, extensibility)
3. Collapse nested conditionals with early returns or guard clauses (reduced nesting)
4. Rename `process` and its parameters to reflect actual semantics (legibility)
5. Simplify to list comprehensions (concision)

Some of these conflict. Decomposing into functions increases line count but reduces nesting. Using a dispatch table changes the call site. Renaming requires knowing what the function actually does. Each is a valid reading of "cleaner" — none is obviously the right one without knowing the user's goal.

Signal emitted:
```json
{
  "principle": "Verification",
  "signal_type": "missing_criteria",
  "weight": 1.0,
  "finding": "'Cleaner' is not a verifiable success state — it maps to at least five distinct and partially conflicting refactoring targets.",
  "implication": "Any refactor made now risks being the wrong one. Completion cannot be verified without knowing which dimension of quality the user wants to improve."
}
```

**Locality:**
The function is self-contained. Any refactoring approach stays within this function unless the user wants to extract helpers — which Locality flags as a scope question.

Signal emitted (conditional):
```json
{
  "principle": "Locality",
  "signal_type": "scope_expansion",
  "weight": 1.0,
  "finding": "Some refactoring targets (decomposition, dispatch table) require adding new functions or structures outside this function.",
  "implication": "User should know whether the refactor is intended to stay within this function or can expand into new helpers."
}
```

**Epistemics:**
The parameter names (`process`, `mode`, `flag`, `extra`, `data`) give no information about what this function does or what "a", "b", and the else branch represent. Any rename-based refactor requires semantic knowledge that isn't available from the code.

Signal emitted:
```json
{
  "principle": "Epistemics",
  "signal_type": "missing_context",
  "weight": 0.5,
  "finding": "Parameter and function names don't indicate what this code does — what 'mode a', 'mode b', and the flag represent is unknown.",
  "implication": "Meaningful renaming (often the most impactful clarity improvement) requires semantic context that isn't available from the code alone."
}
```

All other principles: no signals.

---

## Gate

W_owl = 1.0 + 1.0 + 0.5 = 2.5. W_owl >= 1.5 → Surface mode.

Surface order: `missing_criteria` and `scope_expansion` (weight 1.0 each) first, `missing_context` (0.5) third.

---

## Output

**Verification:** "Cleaner" covers several distinct targets — reduced nesting, decomposition into functions, a dispatch table, concision, or meaningful naming. These partially conflict (decomposition increases lines; a dispatch table changes the call site). Which dimension matters here?
**Locality:** Some of these keep the refactor inside this function; others add helpers or a new structure. Should the changes stay within this function?
**Epistemics:** Renaming (often the highest-impact clarity improvement) requires knowing what `mode`, `flag`, and `extra` actually represent. Can you share context on what this function does?

Once those three are clear, the refactor is straightforward.

---

## SISPIS Integration

OWL emitted: `missing_criteria` (1.0), `scope_expansion` (1.0), `missing_context` (0.5).

SISPIS deltas:
- `missing_criteria` → `ambiguity_of_framing` +1
- `scope_expansion` → `downstream_impact` +1
- `missing_context` → `ambiguity_of_framing` +0.5 (rounded to cap behavior)

E elevates moderately. The request has no explicit comparison (no comparative_intent) and low option_multiplicity from OWL alone. SISPIS would likely land in EXPLANATION mode — there's analysis to share but no "choose between A and B" decision until the user specifies what they want.

---

## What This Calibrates

Verification fires specifically because the user cannot evaluate the output without knowing which dimension of "clean" was targeted. If the code is refactored toward decomposition and the user wanted concision, both parties were working toward different things — and the user has no way to know that until they see an output that doesn't match their mental image.

The surface output here is a set of three questions. This is correct — each question unblocks a different part of the implementation. Answering them takes 30 seconds; implementing in the wrong direction takes 10 minutes.

Anti-pattern to avoid: picking one interpretation and refactoring toward it with a comment like "I focused on reducing nesting." This silently applies a judgment the user should have made. The output feels responsive but may be entirely wrong.
