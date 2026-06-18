# CognitiveFrameWorks 2.0

## Purpose

Behavioral protocols for AI assistants. Four skills that operate as a pipeline: OWL (pre-implementation reasoning), ANCHOR (execution continuity), DOX (documentation contracts), and SISPIS (response calibration).

## Ownership

This is a framework for configuring AI assistant behavior, reasoning patterns, and output calibration.

## Local Contracts

- OWL runs before implementation, applies 9 engineering principles silently
- ANCHOR maintains operational state across multi-turn sessions
- DOX manages AGENTS.md hierarchy as binding work contracts
- SISPIS calibrates output structure based on entropy and decision complexity

## Work Guidance

### Pipeline Order

```
Request → OWL → ANCHOR → DOX (load) → Edit → DOX (closeout) → SISPIS → Output
```

### Pipeline Budget

| Task type | Skills to apply |
|-----------|----------------|
| Single-turn factual or mechanical task | OWL + SISPIS |
| Multi-turn implementation, debugging, or refactor | OWL + ANCHOR + SISPIS |
| Any edit inside a project that has AGENTS.md files | OWL + ANCHOR + DOX + SISPIS |
| Simple clarification or status query | SISPIS only |

### Rules

- DOX only activates when editing files in a DOX-enabled project (one with AGENTS.md)
- ANCHOR only activates when a task spans multiple turns or involves state that would be costly to lose
- OWL always runs unless the task is purely mechanical with no code to read and no ambiguity
- SISPIS always runs — it is the output gate and has negligible cost when it resolves to NO_DECISION

## Verification

- Verify OWL signals surface when cumulative weight W_owl >= 1.5
- Verify ANCHOR checkpoints are written before context compression
- Verify DOX loads contracts before edits and persists them after
- Verify SISPIS calibrates output to correct mode (NO_DECISION, EXPLANATION, or SCHEMA)

## Child DOX Index

- `OWL/SKILL.md` — Operational Wisdom Layer (9 principles, signal schema)
- `ANCHOR/SKILL.md` — Operational Persistence System (8 principles, checkpoints)
- `DOX/SKILL.md` — Documentation Operations eXchange (AGENTS.md hierarchy)
- `SISPIS/SKILL.md` — Decision-routing and response calibration (gate function)
- `OWL/references/` — Signal schema, pressure protocol, cheatsheet
- `ANCHOR/references/` — Execution continuity, cheatsheet
- `DOX/references/` — Hierarchy guide, closeout protocol
- `SISPIS/references/` — Response schema, cheatsheet
