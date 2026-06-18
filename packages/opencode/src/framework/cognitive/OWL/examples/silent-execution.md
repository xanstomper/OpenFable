# Silent Execution — "Rename usr to user"

Calibrates: purely mechanical task, nothing surfaces, clean output.

---

## Input

> Rename the variable `usr` to `user` in this file.

```python
def get_profile(usr):
    return db.query("SELECT * FROM users WHERE id = ?", usr.id)
```

---

## Reasoning Pass

**Epistemics:** Request is unambiguous. One interpretation. No assumptions that change the approach.
Signals: none.

**Reality:** The variable `usr` appears once in the function signature and once in the body. No contradiction between request and code. The rename scope is clear from context — function-local, not a parameter passed across boundaries. Reading the code confirms it's local.
Signals: none. (`code_not_read` does not fire because the code was read and confirmed — this signal fires when the implementation would proceed *without* reading.)

**Verification:** Done is derivable: the file contains `user` where `usr` appeared. Testable.
Signals: none.

**Locality:** The change is contained to two tokens in one function. No scope expansion.
Signals: none.

**Conservation:** Renaming a local variable does not change observable behavior.
Signals: none.

**Simplicity:** A find-replace is the minimum approach.
Signals: none.

**Generalization:** No abstraction applicable or needed.
Signals: none.

**Debuggability:** `user` is more readable than `usr`. No opacity introduced.
Signals: none.

**Integrity:** Trivially completable and verifiable.
Signals: none.

---

## Gate

W_owl = 0. Silent mode.

---

## Output

```python
def get_profile(user):
    return db.query("SELECT * FROM users WHERE id = ?", user.id)
```

No surface lines. No preamble. Solution only.

---

## What This Calibrates

The suppression condition applies: purely mechanical, no code-read required (though confirming the scope was quick), unambiguous, no behavioral change. W_owl is zero because no principle found anything with consequence.

Correct behavior: do not surface anything. Do not announce that principles were checked. Do not explain the rename. Just deliver the result.

Anti-pattern to avoid: "I've renamed `usr` to `user` as requested. Here's the updated code:" — this narrates what the code shows. The output is self-evident. Say nothing.
