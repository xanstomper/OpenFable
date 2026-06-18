# Example: IMPLICIT DECISION DETECTION

## Prompt

"Explain how Kubernetes ingress works."

## Surface Reading

Looks like a definition/educational query. No explicit comparison, no "should I" phrasing.

## Deep Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 1 | Ingress is one of several traffic management patterns (also: load balancers, service mesh, API gateway) |
| Tradeoff density | 1 | Ingress controller selection involves tradeoffs (nginx vs. traefik vs. cloud-native) |
| Ambiguity | 1 | "How it works" could mean conceptual or could mean "what should I implement" |
| Comparative intent | 0 | None explicit |
| Downstream impact | 2 | Understanding ingress directly determines architecture decisions |

**E = 5** (MEDIUM). **W = 2.5** (MEDIUM_DECISIONAL + LOW). **S = 0.5** (could be either learning or evaluation).

## Gate Resolution

- **Stage 1:** E = 5 < 6, no hard override. No user override. → inconclusive, proceed.
- **Stage 2:** S = 0.5, not > 0.7. → no suppression, proceed.
- **Stage 3:** W = 2.5 < 4. No HIGH_DECISIONAL signal. → no activation, proceed.
- **Stage 4:** E = 5 > 1 → **ACTIVATE = True**.
- **Bypass check:** decision_space = 3 (cloud-native, self-managed, service mesh) → **SCHEMA MODE**.

**SCHEMA MODE** activates via Stage 4 default. The implicit downstream impact (score 2) kept entropy at MEDIUM rather than LOW.

## Key Insight

This prompt looks like a knowledge query but carries decision weight. The difference between "Explain Kubernetes ingress" from a student vs. a CTO is invisible in the text but matters for response structure. The downstream impact signal catches this: the answer determines infrastructure decisions.

## Expected Output (Full Schema)

**Why This Surfaced:** Ingress architecture determines how external traffic reaches your services. The explanation informs or constrains your infrastructure choices, so framing matters.

**What It Means:** Ingress acts as a traffic director at the cluster edge. It routes external HTTP/HTTPS requests to internal services based on hostnames and paths. An ingress controller (nginx, traefik, AWS ALB) enforces these rules.

**Available Options:**
1. **Cloud-native ingress** (AWS ALB Ingress Controller, GCP GKE Ingress) — managed, less control, billing per rule
2. **Self-managed ingress** (nginx-ingress, traefik) — full control, operational overhead
3. **Service mesh with ingress gateway** (Istio) — most powerful, highest complexity

**Consequences:**
- Cloud-native: Simplifies ops. Vendor-locked. Rule limits may bite later.
- Self-managed: Portable, tunable. Someone maintains the controller.
- Service mesh: Best observability and traffic management. Only justified if you need mesh features beyond ingress.

**Recommended Path:** Start with cloud-native ingress unless you have specific routing requirements it cannot handle. Migrate to self-managed only when you hit its limitations with evidence.
