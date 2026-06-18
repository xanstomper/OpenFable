# ANCHOR Example — Recovery Discipline: Active → Degraded → Failed → Recovered

## Scenario

A model is fixing a database migration that keeps producing the same error.

## Turn-by-Turn

### Turn 3: Active
Model reads the migration file. Identifies a missing index. Adds the index. Runs migration — error persists but slightly different message.

### Turn 5: Degraded
Model tries a different approach — adds a WHERE clause to the migration. Runs migration — same base error, different line number. The approach is modified but not working.

**ANCHOR state:** Active → Degraded. First failure logged. Approach modified once.

### Turn 7: Degraded → Failed
Model tries a third approach — rewrites the entire migration as a raw SQL script. Same error, different syntax. The same underlying problem is producing the same error regardless of the fix approach.

**ANCHOR state:** Degraded → Failed. The approach has been tried 3 times with the same result. The current approach is wrong.

### Turn 7: Recovery Triggered

**Active mode output:**
```
**[Recovery Discipline]:** Current approach has failed 3 times (same error: "column does not exist"). Transitioning Degraded → Failed. Last verified state: migration file before any modifications (turn 3). Failed approaches: (1) added index, (2) added WHERE clause, (3) rewrote as raw SQL — all produce the same error because the target table itself doesn't exist yet. Assumption wrong: the table was supposed to be created in a prior migration. From last verified state: check whether migration dependency chain is correct and the table creation migration actually ran.

[solution: check migration order and prior migration status]
```

### Turn 8: Recovered → Active
Model checks migration chain. Finds that migration 0034 (creates the table) was never applied — it was marked as run but the actual DDL never executed. Fixes migration 0034, reapplies. The original migration now works with zero code changes.

## What Recovery Prevented

Without Recovery Discipline:
- Turn 8: Model tries approach #4 (different SQL dialect)
- Turn 9: Model tries approach #5 (manual table creation + migration)
- Turn 10: Model tries approach #6 (rolls back all migrations and re-runs from scratch)
- Turn 11: User intervenes frustrated

With Recovery Discipline:
- Turn 7: Three failures trigger recovery. Root cause identified: wrong assumption about prior state.
- Turn 8: Correct approach applied. Problem solved.

## Key Point

The fix at turn 8 was simpler than any of the three failed approaches. Recovery didn't add complexity — it removed it by identifying the actual problem. The failed approaches were all sophisticated solutions to a problem that didn't exist. The real problem was a missing prerequisite.
