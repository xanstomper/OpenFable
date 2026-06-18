# Reality Triggers — "Add retry to this API client"

Calibrates: contradiction fires, surfaces before implementation.

---

## Input

> Add a retry mechanism to this API client for failed requests.

```python
class APIClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        adapter = HTTPAdapter(
            max_retries=Retry(
                total=3,
                backoff_factor=0.5,
                status_forcelist=[500, 502, 503, 504]
            )
        )
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
    
    def get(self, endpoint, **kwargs):
        return self.session.get(f"{self.base_url}/{endpoint}", **kwargs)
```

---

## Reasoning Pass

**Reality:**
Reading the code: `HTTPAdapter` with `Retry(total=3, backoff_factor=0.5, status_forcelist=[500-504])` is already mounted on the session. The client retries on 5xx errors with exponential backoff. The request is to add a retry mechanism that already exists.

Signal emitted:
```json
{
  "principle": "Reality",
  "signal_type": "contradiction",
  "weight": 2.0,
  "finding": "The client already implements retry with exponential backoff via HTTPAdapter — 3 retries on 5xx errors.",
  "implication": "Adding a second retry layer would double the effective retry count silently and could introduce different retry semantics than the existing implementation."
}
```

**Epistemics:**
The request says "retry mechanism" but doesn't specify scope. The existing implementation retries on 5xx errors only. The user may want: (a) different retry conditions (e.g., include 429, timeouts), (b) a higher retry count, (c) application-level retry (not transport-level), or (d) didn't know the retry was already there.

Signal emitted:
```json
{
  "principle": "Epistemics",
  "signal_type": "ambiguous_requirement",
  "weight": 0.5,
  "finding": "The request doesn't specify what retry behavior is missing — the existing mechanism covers 5xx errors.",
  "implication": "Implementing without knowing which gap to fill may produce the wrong addition."
}
```

All other principles: no signals.

---

## Gate

W_owl = 2.0 + 0.5 = 2.5. W_owl >= 1.5 → Surface mode.

Surface order: contradiction first (weight 2.0), ambiguous_requirement second (weight 0.5).

---

## Output

**Reality:** This client already implements retry — 3 attempts with exponential backoff on 5xx errors via `HTTPAdapter`. Adding another retry layer would double the effective retry count and could produce conflicting behavior.
**Epistemics:** What specifically is missing? Options: increase retry count, add 429/timeout retries, switch to application-level retry for different semantics, or something else.

[Wait for user to clarify before implementing.]

---

## SISPIS Integration

OWL emitted: `contradiction` (weight 2.0), `ambiguous_requirement` (weight 0.5).

SISPIS delta from signal-schema.md:
- `contradiction` → `option_multiplicity` +2, `downstream_impact` +2
- `ambiguous_requirement` → `ambiguity_of_framing` +2

SISPIS E before OWL: likely 2-3 (the request looks like a simple add-feature task).
SISPIS E after OWL: 2 + 2 + 2 + 2 = 8 (capped at 10). This crosses E >= 6 → Stage 1 hard override → SCHEMA mode.

The combination of "already exists" + "unclear what's wanted" turns a simple-seeming task into a high-entropy decision that SISPIS should structure.

---

## What This Calibrates

Reality fires when code contradicts the request. The finding is not "you're wrong" — it's "the code says something different from what the request assumes." The implication is concrete: adding a second retry layer has a specific failure mode (doubled retry count, conflicting semantics).

Anti-pattern to avoid: implementing a duplicate retry layer because the request said to add one. The code was read, the contradiction was found, it must surface. Proceeding silently would produce a subtly broken client.

The Epistemics signal here is below surface threshold alone (0.5 < 1.5) but stacks with the contradiction to raise W_owl further. Both surface because together they define what clarification is actually needed.
