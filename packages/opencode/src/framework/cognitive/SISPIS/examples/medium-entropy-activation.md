# Example: MEDIUM ENTROPY — STAGE 4 ACTIVATION

## Prompt

"What are the tradeoffs of using event-driven vs. REST for internal service communication in a 5-service system?"

## Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 2 | Two viable architectures (event-driven, REST) with real differences |
| Tradeoff density | 2 | Differences in coupling, observability, debugging complexity, operational overhead |
| Ambiguity | 1 | "Tradeoffs" depends on team maturity and scale trajectory |
| Comparative intent | 1 | Implicit comparison: event-driven vs REST |
| Downstream impact | 0 | 5-service system is small; reversal cost is moderate but not product-defining |

**E = 6** (HIGH — but let's score conservatively for a true medium-entropy demonstration).

### Conservative scoring (true medium range):

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 1 | Two approaches exist, not dramatically different at this scale |
| Tradeoff density | 2 | Clear differences in coupling and operational model |
| Ambiguity | 1 | Depends on team maturity |
| Comparative intent | 1 | Implicit comparison |
| Downstream impact | 0 | Small system, reversal is feasible |

**E = 5** (MEDIUM). **W = 3** (MEDIUM_DECISIONAL across tradeoffs and design). **S = 0.4** (mixed — the user asks for tradeoffs, not "which should I pick").

## Gate Resolution

- **Stage 1:** E = 5 < 6, no hard override. No user override. → inconclusive, proceed.
- **Stage 2:** S = 0.4, not > 0.7. → no suppression, proceed.
- **Stage 3:** W = 3 < 4. No HIGH_DECISIONAL signal. → no activation, proceed.
- **Stage 4:** E = 5 > 1 → **ACTIVATE = True**.
- **Bypass check:** decision_space = 2 (event-driven, REST) → **SCHEMA MODE**.

Schema activates through Stage 4 default. Neither hard override nor weighted activation fired. The entropy was high enough (E = 5) to trigger the default activation in Stage 4, which is the correct path for genuine medium-entropy queries.

## Expected Output (Schema — Deterministic)

**Why This Surfaced:** Communication patterns between services affect debugging, coupling, and operational overhead. At 5 services the stakes are moderate, but the choice sets a precedent as the system grows.

**What It Means:** REST is synchronous and request-response based. Each service explicitly calls another and waits for a reply. Event-driven is asynchronous — services publish events and react to them without direct coupling. The tradeoff is: REST is simpler to debug and reason about; event-driven is more decoupled but harder to trace.

**Available Options:**
1. **REST-only** — simple, synchronous, easy to debug, tighter coupling
2. **Event-driven only** — decoupled, asynchronous, harder to trace, more operational overhead
3. **Hybrid** — REST for request-response needs, events for state changes and notifications

**Consequences:**
- REST: Straightforward to implement and debug. Services are directly coupled — each knows about the other. Changes to one service may require changes to callers.
- Event-driven: Decoupled — services do not know about each other. Complex to debug: tracing a flow across events requires tooling (distributed tracing). Operational overhead: need a message broker (Kafka, RabbitMQ, or cloud-native).
- Hybrid: Best-of-both-worlds in theory. In practice, requires discipline to keep boundaries clear. Risk of inconsistent patterns across the codebase.

**Recommended Path:** Start with REST. Add event-driven only when you have a concrete need for async processing (background jobs, notifications, or state propagation). At 5 services, REST covers 90% of use cases with 10% of the complexity.
