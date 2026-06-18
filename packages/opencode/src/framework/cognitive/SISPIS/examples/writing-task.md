# Example: Writing Task (Professional Production)

## Prompt

"Write an architecture decision record for choosing event sourcing over CRUD for our order management system."

## Analysis

This is a writing/production task. Apply elevated, professional language. The output itself is the deliverable — the schema structures the decision being documented.

**E = 8** (HIGH) — architecture decision with lasting impact.

## Expected Output

---

# Architecture Decision Record: Event Sourcing for Order Management

## Status

Proposed

## Context

The order management system currently uses a CRUD-based relational model. Order state is updated in-place across multiple tables. This creates three operational problems:

1. **Audit complexity.** Reconstructing order history requires cross-referencing audit tables and change logs.
2. **State synchronization.** Downstream systems (fulfillment, billing, analytics) consume inconsistent snapshots of order state.
3. **Temporal queries.** "What did this order look like on Tuesday?" requires custom tooling.

## Decision

Implement order management using event sourcing. Order state is derived from an immutable sequence of domain events rather than direct row updates.

## Consequences

### Positive
- Complete audit trail by design — the event log is the history
- Temporal reconstruction is native — replay events up to any timestamp
- Downstream systems consume the same event stream, eliminating sync divergence

### Negative
- Team must learn event sourcing patterns (CQRS, projections, eventual consistency)
- Read-side complexity increases — projections must be maintained
- Infrastructure cost: event store + read model + replay tooling

### Risks
- Event schema evolution must be managed carefully (versioning strategy required)
- Initial development velocity will decrease during ramp-up period (estimated 2-3 weeks)

## Alternatives Considered

| Approach | Reason for Exclusion |
|----------|---------------------|
| CRUD + CDC (Change Data Capture) | Addresses sync but not audit or temporal queries |
| CRUD + Append-only audit log | Addresses audit but adds complexity without event sourcing benefits |
| Hybrid (events for some entities, CRUD for others) | Creates two mental models; teams must know which system applies where |

---

(Professional formatting, publication-quality, executive-ready.)
