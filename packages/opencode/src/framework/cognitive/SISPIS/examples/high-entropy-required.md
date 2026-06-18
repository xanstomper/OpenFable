# Example: HIGH ENTROPY — SCHEMA REQUIRED

## Prompt

"We need to choose between PostgreSQL and MongoDB for a new product. Half our data is relational with complex joins. The other half is user-generated content with varying schemas. We have 2 senior engineers, no dedicated DBA, and need to ship in 3 months."

## Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 2 | Clear choice between two viable databases (plus hybrid options) |
| Tradeoff density | 2 | Differences in consistency model, scaling, operational complexity, team fit |
| Ambiguity | 2 | "Right choice" depends on which constraints matter most |
| Comparative intent | 2 | Explicit A vs B request |
| Downstream impact | 2 | Determines data architecture for the product lifetime |

**E = 10** (HIGH). Stage 1 hard override → **SCHEMA REQUIRED**.

## Expected Output

**Why This Surfaced:** Database selection at this stage determines migration cost, hiring needs, and architectural constraints for the product's lifetime. Wrong choice at this scale carries high reversal cost.

**What It Means:** Half your workload demands relational guarantees (JOINs, transactions, constraints) that PostgreSQL handles natively. The other half demands schema flexibility that requires engineering workarounds in PostgreSQL but comes free in MongoDB. The no-DBA constraint increases the cost of whichever system requires more operational attention.

**Available Options:**
1. **PostgreSQL only** — store the flexible data as JSONB columns
2. **MongoDB only** — enforce relational patterns in application logic
3. **Hybrid (PostgreSQL + MongoDB)** — each database handles what it does best
4. **PostgreSQL + separate document store** — simpler than full hybrid if document needs are narrow

**Consequences:**
- **PostgreSQL only:** Lowest operational complexity. JSONB covers flexible data but sacrifices indexing flexibility. Requires schema design work. No DBA needed for basic operations.
- **MongoDB only:** Flexible side is trivial. Relational side requires application-level JOINs, no referential integrity, possible data consistency bugs. Higher debugging cost.
- **Hybrid:** Best technical fit. Doubles operational surface. Two systems to monitor, backup, and migrate. Harder to hire for both.
- **PostgreSQL + document store:** Clean separation. Adds managed service cost. Still two systems but with clearer boundaries.

**Recommended Path:** PostgreSQL with JSONB for the flexible content. Add a dedicated document store later only if JSONB proves insufficient. This minimizes operational overhead for a small team shipping under time pressure while preserving the relational guarantees your complex data needs. Revisit MongoDB if the flexible content grows to dominate the workload.
