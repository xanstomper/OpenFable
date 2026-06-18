# Example: USER OVERRIDE

## Prompt

"Just tell me if I should use Redis or Memcached. I don't need the full breakdown, I'm in a hurry and need a decision."

## Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 2 | Explicit A vs B |
| Tradeoff density | 2 | Differences in data structures, persistence, clustering |
| Ambiguity | 1 | Depends on use case |
| Comparative intent | 2 | Direct comparison |
| Downstream impact | 2 | Session/cache infrastructure choice |

**E = 9** (HIGH). Gate function says schema required.

**But user said:** "Just tell me" + "don't need the full breakdown" + "in a hurry".

User override activates. Force suppression despite HIGH entropy.

## Expected Output (Override: Suppressed)

Use Redis. It supports more data types, has built-in persistence, and can do everything Memcached does plus more. Memcached is marginally faster for simple key/value but the difference rarely matters. Redis gives you more room to grow without a migration.

## Alternate Prompt (Override: Forced Activation)

"Give me the full breakdown — Redis vs Memcached. I need to understand all the tradeoffs before deciding."

Same signals (E = 9), but now user explicitly requests structure. Gate function already said schema — user override confirms activation.

Full 5-section schema applies.
