# ANCHOR Example — Object Continuity Across Renames and Partial Fixes

## Scenario

A defect D-04 ("Auth timeout on reconnect") has been tracked across a session. It gets renamed, partially fixed, and split across files — but remains D-04 throughout.

## Object Lifecycle

```
Turn 3:  D-04 created — "Auth timeout on reconnect"
Turn 7:  D-04 renamed to D-04-auth-pool-exhaustion (identity preserved, alias added)
Turn 9:  D-04 partially fixed — pool size increased, but leak not addressed
Turn 14: D-04 subcomponent identified — connection release bug in auth/client.go
         This is still D-04. The leak is a root cause of D-04, not a new defect.
Turn 18: D-04 fully fixed — pool size + connection leak both resolved
Turn 18: D-04 → Resolved
```

## What Object Continuity Prevents

### Without ANCHOR:
- Turn 7: Model treats the renamed defect as a new issue. Restates the problem from scratch.
- Turn 9: Model reports "D-04 is fixed" — but only the pool size was changed. The leak remains.
- Turn 14: Model creates a NEW defect D-11 for the connection leak. Now two tracked defects exist for what is one root problem.
- Turn 18: Model marks D-11 as resolved but forgets D-04 is only partially done.

### With ANCHOR:
- Turn 7: D-04 renamed but tracked as same object. Accumulated context preserved.
- Turn 9: D-04 status → Partially Resolved. What was done: pool size. What remains: connection leak.
- Turn 14: Connection leak identified as root-cause subcomponent of D-04. Not a new defect.
- Turn 18: D-04 → Resolved. Both sub-issues complete. Single defect, full lifecycle tracked.

## Merge Prevention

At turn 12, the user says "just combine the timeout issue and the memory leak issue into one task."

ANCHLOr's Object Continuity principle:
- Checks whether the two issues share a root cause
- If they do: they're already one object (D-04), no merge needed
- If they don't: merging them loses individual tracking. Surface this.

Result: The issues DO share a root cause (connection pool mismanagement). D-04 already captures both. No merge needed — the user's request is already satisfied by the existing object structure.

## Key Point

Object identity is not a naming convention. It is a tracking commitment. An object that changes name, scope, or structure is still the same object if it represents the same underlying issue. Breaking that continuity creates tracking gaps.
