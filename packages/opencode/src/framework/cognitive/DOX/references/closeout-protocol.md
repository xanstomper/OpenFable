# DOX Closeout Protocol

## When to Run

Run the DOX closeout pass after every meaningful change. "Meaningful" means any edit that affects behavior, structure, contracts, or operating rules.

Skip the closeout pass only when the edit is purely cosmetic (typo fix in comments, whitespace, formatting) and does not change any contract, behavior, or documented fact.

## Closeout Checklist

### 1. Re-check Changed Paths

For each file or folder modified:

- Walk from the repo root to the changed path
- Identify the nearest owning AGENTS.md
- Confirm the AGENTS.md still accurately describes the changed scope

### 2. Update Nearest Owning Docs

Update the closest AGENTS.md when the change affects:

- **Purpose** — the subtree's reason for existing has changed
- **Scope** — what's in or out of the subtree's boundary has shifted
- **Ownership** — who owns the domain has changed
- **Structure** — files, folders, or modules were added, removed, or moved
- **Contracts** — interfaces, APIs, schemas, or conventions changed
- **Workflows** — how work happens in this subtree changed
- **Operating rules** — permissions, constraints, or side effects changed
- **Artifacts** — required inputs or outputs changed
- **User preferences** — behavior, communication, process, organization, or quality preferences changed

### 3. Update Parent Docs

Update parent AGENTS.md when:

- A child was added, removed, moved, or renamed
- The parent's own scope or ownership changed
- A child's purpose changed in a way that affects the parent's index

### 4. Update Child Docs

Update child AGENTS.md when:

- A parent rule changed that has local implications
- The child's scope relative to the parent shifted

### 5. Refresh Child DOX Indexes

Every AGENTS.md that lists the changed scope in its Child DOX Index must have that entry updated. Check:

- Path still exists
- One-line description still accurate
- No entries point to deleted or moved folders

### 6. Remove Stale Content

Delete (do not comment out):

- References to files, functions, or folders that no longer exist
- Rules that no longer apply
- Warnings for risks that have been resolved
- Contradictory text (resolve in favor of the current state)

### 7. Run Verification

If the AGENTS.md has a Verification section with checks that apply to the change, run them. If no verification framework exists, skip this step.

### 8. Report

If any AGENTS.md along the DOX chain was intentionally left unchanged, report which ones and why. Do not report docs that were updated.

## What NOT to Update

Do not update AGENTS.md files for:

- Typo fixes in code comments
- Whitespace or formatting changes
- Adding a single function that doesn't change any contract
- Renaming a private/internal symbol with no downstream impact

The DOX pass still happens for these — it just results in "no docs changed" which is correct.

## Stale Content Detection

Signs that an AGENTS.md needs updating:

- A file path in the doc returns "file not found"
- A function or class name in the doc no longer exists
- The doc references a workflow step that has been automated or removed
- The doc warns about a risk that has been mitigated
- The doc describes a constraint that has been relaxed or removed
- The Child DOX Index lists a folder that has been renamed or deleted
