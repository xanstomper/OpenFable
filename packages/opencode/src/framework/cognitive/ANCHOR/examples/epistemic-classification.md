# ANCHOR Example — Epistemic Classification in Practice

## Scenario

A model is investigating a performance issue. Multiple claims are made during the investigation. Each claim has a different epistemic class.

## Claims Made During Investigation

### Turn 2: "The query takes 4.2 seconds"
**Class: Observed** — read directly from the slow query log.
**Evidence:** Log line: `duration: 4200ms, query: SELECT * FROM orders WHERE...`

### Turn 3: "This is a missing index issue"
**Class: Inferred** — derived from the query pattern (sequential scan on a large table) but not confirmed.
**Evidence:** EXPLAIN shows sequential scan. No index on the WHERE column. But the correlation is not proof.

### Turn 4: "Adding an index will fix this"
**Class: Speculative** — a prediction about future behavior with no supporting evidence yet.
**Evidence:** None. The index hasn't been added. The query plan might change in unexpected ways.

### Turn 5: User says "I think it's the network, not the query"
**Class: User speculation** — the user's claim is Speculative. No evidence provided.
**Model's response:** "That's possible. The query time from the log is Observed at 4.2s, but that includes network round-trip. To verify: run the query locally on the database server and compare."

### Turn 7: "Network round-trip is 12ms, not 4.2s"
**Class: Observed** — measured directly.
**Implication:** The user's network theory is wrong. The query itself is the bottleneck. Model holds this without being dismissive — theuser's speculation was reasonable given available information.

### Turn 8: "The index on orders.customer_id resolves the query plan"
**Class: Observed** — EXPLAIN before and after shows sequential scan → index scan.
**Prior Inferred claim from turn 3 is now Verified.**

### Turn 9: "Query now takes 23ms"
**Class: Observed** — measured directly.
**Prior Speculative claim from turn 4 is now Verified.**

## What Epistemic Classification Prevents

### Without ANCHOR:
- Turn 3: "This is a missing index issue" stated as fact. Model proceeds with high confidence.
- Turn 4: Index added. Query still slow. Model confused — "the index should have worked."
- Root cause: Actually a lock contention issue, not a missing index. But the model treated its Inferred claim as Verified and stopped investigating.

### With ANCHOR:
- Turn 3: "This is likely a missing index issue" — labeled Inferred. Model proceeds but remains open to alternatives.
- Turn 4: Index added. Query still slow. Model recognizes the Inferred claim was wrong. Investigates further. Finds lock contention.
- Turn 5: User's network speculation is labeled Speculative. Model tests it rather than accepting or dismissing it.

## Classification Decay

If the model had stopped at turn 3 and never revisited:
- The Inferred claim would have sat as Inferred indefinitely.
- Without ANCHOR, there's no trigger to re-classify when new evidence arrives.
- With ANCHOR, any new evidence (turn 7 measurement, turn 8 EXPLAIN) triggers re-classification of all claims.

## Key Point

The investigation produced four claims across four different epistemic classes. Mixing them up — treating inference as observation, speculation as inference — would have led to wrong conclusions and wasted turns. Keeping them distinct let the model reason about what it actually knew versus what it was guessing.
