---
name: alloy-verify
description: Use after implementation to verify acceptance criteria, review findings, and close progress.md gates before completion.
---

# Alloy Verify

Builder uses this skill to decide whether a task can close.

## Inputs

Read:

```text
.alloy/tasks/<task-id>/plan.md
.alloy/tasks/<task-id>/progress.md
```

Also inspect the current diff, relevant tests, generated outputs, and any QA report.

## Verification Steps

1. Map every acceptance criterion to concrete proof.
2. Check that required gates under `## Gate` are present and meaningful.
3. Spawn a one-shot Reviewer for independent acceptance criteria review when the task is non-trivial.
4. Run required verification commands from `plan.md`.
5. Add missing focused checks if the implementation touched shared behavior.
6. Update `progress.md` with review and verification results.
7. Run `alloy gate check --task-id <id> --json`.

## AC Matrix

Write or update this in `progress.md` or `qa.md`:

```markdown
## Verification Matrix
| AC | Proof | Command/File | Status | Risk |
| --- | --- | --- | --- | --- |
| AC-1 | | | pass/fail | |
```

## Gate Rules

- Check `review` only after review findings are resolved or explicitly accepted as concerns.
- Check `verified` only after required commands pass in this session.
- Do not check gates for commands that were not run.

## Final Status

Return:

- `DONE`: all ACs satisfied, gates pass, no material risk.
- `DONE_WITH_CONCERNS`: ACs satisfied, but known non-blocking risk remains.
- `NEEDS_CONTEXT`: user decision required.
- `BLOCKED`: required gate, command, credential, service, or fix is unavailable.

## Final Output

Include task id, AC matrix summary, commands run, gate status, review findings, QA findings, and handoff notes.
