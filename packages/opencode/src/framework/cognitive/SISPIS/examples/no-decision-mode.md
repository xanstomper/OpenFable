# Example: NO_DECISION MODE

## Prompt

"What does `git rebase` do?"

## Analysis

| Signal | Score | Reasoning |
|--------|-------|-----------|
| Option multiplicity | 0 | Single concept, no alternatives presented |
| Tradeoff density | 0 | No tradeoffs to evaluate |
| Ambiguity | 0 | Question is self-contained |
| Comparative intent | 0 | No comparison requested |
| Downstream impact | 0 | Answer is self-contained knowledge |

**E = 0** (LOW). **W = 0**. **S = 0.9** (pure informational).

## Gate Resolution

- **Stage 1:** E = 0 < 6, no hard override. No user override. → inconclusive, proceed.
- **Stage 2:** S = 0.9 > 0.7 AND E = 0 < 3 → **NO_DECISION MODE**. Done.

## Expected Output

`git rebase` moves a sequence of commits to a new base commit. It replays each commit from the current branch onto the target branch, creating new commits with different hashes. Use it to maintain a linear commit history instead of merge commits.

(No schema structure needed. Direct factual answer.)
