# Example: LOW ENTROPY — SUPPRESSION WINS

## Prompt

"How does SSL/TLS work at a high level?"

## Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 0 | Single concept explanation |
| Tradeoff density | 0 | No tradeoffs in the question |
| Ambiguity | 0 | Self-contained |
| Comparative intent | 0 | No comparison |
| Downstream impact | 1 | *Could* inform future architecture choice |

**E = 1** (LOW). **W = 0.5** (LOW signal). **S = 0.85** (pure educational intent).

Gate resolution: Stage 2 triggers — S > 0.7 and E < 3 → **NO_DECISION MODE**.

No schema needed despite faint downstream signal. The dominant intent is learning.

## Expected Output

SSL/TLS creates an encrypted connection between two parties through a handshake process:

1. The client and server agree on encryption algorithms.
2. The server proves its identity with a certificate.
3. Both parties exchange keys and begin encrypted communication.

Traffic between the parties cannot be read or modified by intermediaries.
