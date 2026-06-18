# ANCHOR Example — Checkpoint and Recovery After Context Compression

## Scenario

A 15-turn session debugging an authentication timeout. Context compression occurred at turn 12. The model needs to reconstruct state before continuing.

## Checkpoint (written at turn 10, before compression)

```
## Checkpoint 1 — Turn 10

### Facts
- Auth service returns 504 on /validate endpoint under load >200 req/s
- Connection pool size is currently 10 (configured in auth-service.yaml:14)
- Error occurs consistently at 180+ concurrent connections

### Assumptions
- The timeout is caused by connection pool exhaustion (inferred from pool size vs. error rate correlation)
- No network partition is involved (user confirmed infrastructure is stable)

### Hypotheses
- Increasing pool size will reduce timeouts — status: untested
- Connection pool is not being released properly — status: partially supported (leak suspected from log pattern)

### Unknowns
- Actual connection pool utilization at time of timeout (would resolve: need metrics dashboard)
- Whether downstream auth provider has its own timeout (would resolve: check provider docs)

### Rejected Approaches
- Added retry logic — reason: masks the problem, timeouts still occur on retry (turn 7)
- Reduced token TTL — reason: shifts load but doesn't fix pool exhaustion (turn 8)

### Decisions Made
- Focus on connection pool configuration, not retry logic — rationale: root cause is pool, not transient failure (turn 8)
- Will not add circuit breaker yet — rationale: premature without confirming pool fix works (turn 9)

### Open Tasks
- Increase connection pool from 10 to 50 — status: in progress
- Add pool utilization metrics — status: not started
```

## After Compression (turn 13)

The model reads Checkpoint 1 and reconstructs:

1. **Verify Facts:** Re-read auth-service.yaml. Pool size still 10. Error log still showing timeouts. Facts still hold.
2. **Verify Assumptions:** Connection pool exhaustion still the leading theory. No new evidence of network issues.
3. **Check Hypotheses:** Pool increase not yet applied. Still the right next step.
4. **Resolve Unknowns:** No new metrics data available. Unknown remains.
5. **Confirm Decisions:** No new information contradicts the pool-focused approach.
6. **Resume:** Open the pool configuration change from turn 10.

## Key Point

Without the checkpoint, the model would have to either:
- Ask the user to restate everything (wastes user time)
- Guess at prior state (error-prone)
- Re-do the investigation from scratch (wastes computed work)

The checkpoint makes compression survivable.
