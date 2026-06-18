# DOX Hierarchy Guide

## When to Create a Child AGENTS.md

Create a child AGENTS.md when a folder meets one or more of these criteria:

- It has a distinct purpose separate from sibling directories
- It has its own ownership (a team, person, or role owns it)
- It has local contracts, interfaces, or APIs that other code depends on
- It has its own workflow (build, test, deploy) that differs from siblings
- It has materials (schemas, configs, templates) that need documentation
- It has quality standards (coverage thresholds, lint rules) that differ from the parent

Do **not** create a child AGENTS.md for:
- A folder that is a flat collection of files with no distinct identity
- A folder whose purpose is fully described by the parent doc
- A temporary or experimental directory

## Child Doc Shape

Default section order:

```
# [Domain Name]

## Purpose
One or two sentences. What this subtree owns and why it exists.

## Ownership
Who owns this domain. Can be a role, team, or individual.

## Local Contracts
Interfaces, APIs, schemas, or conventions that other code depends on.
Document the contract, not the implementation.

## Work Guidance
How to work in this subtree. Coding standards, patterns to follow,
patterns to avoid. Leave empty if no project-specific standards exist yet.

## Verification
How to verify work in this subtree. Test commands, coverage thresholds,
lint rules. Leave empty if no verification framework exists yet.

## Child DOX Index
| Path | Purpose |
|------|---------|
| `subfolder/` | [one-line description] |
```

## Nesting Depth

There is no hard limit on nesting depth, but prefer shallow trees. Most projects need only 2–3 levels. If a subtree needs more than 3 levels of AGENTS.md, consider whether the project structure itself should be flattened.

## Parent Doc Responsibilities

Each parent AGENTS.md must:

1. State what it owns at its own level (not delegated to children)
2. List its direct children in the Child DOX Index with one-line descriptions
3. Define any rules that apply to all children
4. Not duplicate child-level detail

## Child Doc Responsibilities

Each child AGENTS.md must:

1. State its purpose and ownership
2. Document local contracts that dependents rely on
3. Not contradict parent rules (closer docs control local details but cannot weaken DOX or parent-level constraints)
4. Maintain its own Child DOX Index if it has sub-children

## Index Format

Use a flat table in each AGENTS.md:

```markdown
## Child DOX Index

| Path | Purpose |
|------|---------|
| `src/auth/` | Authentication and session management |
| `src/api/` | REST API handlers and routing |
| `docs/` | Project documentation and specs |
```

Keep descriptions to one line. If a description needs more than one line, the child doc's Purpose section is probably unclear.

## Moving and Renaming

When a folder is moved or renamed:

1. Update the Child DOX Index in the old parent
2. Update the Child DOX Index in the new parent
3. Update any references in sibling docs
4. If the folder has its own AGENTS.md, update its Ownership section if the move changes ownership

## Deleting

When a folder is deleted:

1. Remove its entry from the parent's Child DOX Index
2. Delete the child AGENTS.md
3. Remove any references to the deleted scope from parent docs
