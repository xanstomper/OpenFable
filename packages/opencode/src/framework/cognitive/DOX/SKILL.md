---
name: DOX
description: Documentation Operations eXchange — AGENTS.md hierarchy protocol that treats documentation as a binding work contract. Use when editing files inside a project that contains AGENTS.md, when creating or updating AGENTS.md, when the user asks to maintain DOX, sync AGENTS.md, build the DOX tree, index the project, or mentions AGENTS.md hierarchy, child DOX index, or documentation contracts. After meaningful edits in a DOX-enabled project, run the DOX closeout pass.
---

# DOX — Documentation Operations eXchange

## What This Does

DOX treats AGENTS.md files as a binding work contract hierarchy. Every subtree owns its documentation. Work products, source materials, instructions, records, assets, and durable docs must be understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it.

DOX runs in two phases: **Read Before Editing** (load the contract) and **Update After Editing** (keep the contract current).

Full child doc template, hierarchy rules, and style guide: `references/hierarchy-guide.md`. Closeout checklist and update triggers: `references/closeout-protocol.md`.

---

## Phase 1: Read Before Editing

Before touching any file, load the applicable DOX chain:

1. Read the root AGENTS.md.
2. Identify every file or folder expected to be touched.
3. Walk from the repository root to each target path.
4. Read every AGENTS.md found along each route.
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there.
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules.
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX itself.

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

---

## Contract Signal (Phase 1 Output)

When Phase 1 loads a contract and finds a constraint that applies to the current edit scope, DOX emits a contract signal before the edit proceeds. This signal is readable by OWL and ANCHOR.

**Emit when:** A loaded AGENTS.md contains a constraint, scope rule, or permission that directly applies to the files or behavior being changed, and that constraint is not already visible in the current session context.

**Format:**
```
**[DOX contract]:** [constraint or rule found]. [Applies to: scope / files / behavior.]
```

**Examples:**
```
**[DOX contract]:** All auth changes must be reviewed by security team before merge. Applies to: any edit in /src/auth/.
**[DOX contract]:** This module must not introduce new external dependencies. Applies to: package.json, import statements.
```

**Integration with OWL and ANCHOR:**
- OWL's Locality and Conservation principles should absorb this signal. A contract constraint on scope maps to `scope_expansion` risk; a constraint on behavior maps to `behavior_change_risk`.
- ANCHOR's State Integrity principle should absorb it as a verified constraint (class: Observed from the AGENTS.md).
- DOX does not score entropy or emit signal weights — it surfaces the constraint once, before the edit, in the format above.

---

## Phase 2: Update After Editing

Every meaningful change requires a DOX pass before the task is done.

### When to Update

Update the closest owning AGENTS.md when a change affects:

- Purpose, scope, ownership, or responsibilities
- Durable structure, contracts, workflows, or operating rules
- Required inputs, outputs, permissions, constraints, side effects, or artifacts
- User preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately.

Small edits that do not change behavior or contracts may leave docs unchanged — but the DOX pass still must happen.

### Closeout Sequence

1. Re-check changed paths against the DOX chain.
2. Update nearest owning docs and any affected parents or children.
3. Refresh every affected Child DOX Index.
4. Remove stale or contradictory text.
5. Run existing verification when relevant.
6. Report any docs intentionally left unchanged and why.

Full closeout checklist: `references/closeout-protocol.md`.

---

## Hierarchy Rules

- **Root AGENTS.md** is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index.
- **Child AGENTS.md files** own domain-specific instructions and their own Child DOX Index.
- Each parent explains what its direct children cover and what stays owned by the parent.
- The closer a doc is to the work, the more specific and practical it must be.

Full hierarchy guide, child doc shape, and creation criteria: `references/hierarchy-guide.md`.

---

## Child Doc Creation

Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards.

Default section order for child docs:

1. Purpose
2. Ownership
3. Local Contracts
4. Work Guidance
5. Verification
6. Child DOX Index

**Work Guidance** must reflect current project or user standards. If no specific standards exist yet, leave it empty.

**Verification** must reflect an existing check. If no verification framework exists yet, leave it empty and update it when one exists.

Full template and examples: `references/hierarchy-guide.md` § Child Doc Shape.

---

## Style Rules

- Keep docs concise, current, and operational.
- Document stable contracts, not diary entries.
- Put broad rules in parent docs and concrete details in child docs.
- Prefer direct bullets with explicit names.
- Do not duplicate rules across many files unless each scope needs a local version.
- Delete stale notes instead of explaining history.
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist.

---

## User Preferences

When the user requests a durable behavior change, record it in the root AGENTS.md User Preferences section or in the relevant child AGENTS.md.

---

## Unindexed Projects

If the root AGENTS.md says the project is unindexed, build or update only the minimum DOX tree needed for the current task. Do not scan the entire repo or create nested DOX files unless the user explicitly requested full indexing.

---

## Non-Interference

DOX preserves contracts; it does not expand task scope.

Do not create, move, rename, or rewrite AGENTS.md files unless the current change affects durable project contracts or the user explicitly requested DOX maintenance.

If docs are stale but unrelated to the current touched paths, report the stale area instead of fixing it opportunistically.

---

## Additional Resources

### Reference Files

- **`references/hierarchy-guide.md`** — Full child doc template, creation criteria, section order, and nesting rules
- **`references/closeout-protocol.md`** — Detailed closeout checklist, update triggers, and stale content detection

### Example Files

Working examples in `examples/`:

- **`root-agents.md`** — Example root AGENTS.md with Child DOX Index
- **`child-agents.md`** — Example child AGENTS.md for a domain subtree
