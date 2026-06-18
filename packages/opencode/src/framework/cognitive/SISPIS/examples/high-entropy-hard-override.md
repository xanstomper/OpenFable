# Example: MEDIUM ENTROPY — DETERMINISTIC OUTPUT

## Prompt

"Is Kubernetes a good fit for a 3-person team running 10 microservices?"

## Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 2 | Multiple deployment options exist (K8s, Docker Compose, ECS, bare metal) |
| Tradeoff density | 1 | Operational complexity vs. scalability |
| Ambiguity | 1 | "Good fit" depends on team expertise, future growth |
| Comparative intent | 1 | Implicit: K8s vs. alternatives |
| Downstream impact | 2 | Determines infrastructure for months/years |

**E = 7** (HIGH). **W = 4** (MEDIUM_DECISIONAL: tool evaluation + suitability + design-related). **S = 0.4** (mixed intent — evaluative question from a practitioner).

Gate resolution:
- Stage 1: E >= 6 → **ACTIVATE = True** (hard override)
- Bypass check: decision_space = 4 (K8s, Compose, managed service, hybrid) → **SCHEMA MODE**

## Why This Is Deterministic

The original version of this example showed two possible outputs ("either format is acceptable"). That was incorrect for a deterministic gating system. With E = 7, Stage 1 hard-overrides to SCHEMA. There is no ambiguity: the gate function produces one output.

The "judgment call" framing belonged to an earlier version of the gate that used categorical thresholds. The current scoring function makes this unambiguous.

## Expected Output (Schema — Deterministic)

**Why This Surfaced:** Infrastructure choices at this scale have long-term operational consequences. The "good fit" framing signals evaluation, not just learning.

**What It Means:** Kubernetes provides orchestration, auto-scaling, and service discovery — but requires significant operational knowledge. For 10 services and 3 people, the management overhead may exceed the benefit.

**Available Options:**
1. **Kubernetes** — maximum scalability, highest operational cost
2. **Docker Compose + managed hosting** — simpler, works at this scale
3. **Managed service (ECS/Fargate)** — less control, less operational burden

**Consequences:**
- K8s: Powerful but demands dedicated infra expertise; risk of 1+ person becoming a bottleneck
- Compose: Works now but doesn't scale past ~20 services cleanly
- Managed: Lowest control, pricing scales with usage

**Recommended Path:** Start with Docker Compose or a managed service. Migrate to K8s when operational complexity is justified by scale (20+ services or multi-region).
