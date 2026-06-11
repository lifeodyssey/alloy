---
description: Verify an Alloy task against its approved plan and progress gates
agent: alloy-builder
---

# /verify

Verify that an Alloy task satisfies its approved plan before completion claims.

## Workflow

1. Invoke the `alloy-verify` skill.
2. Load `.alloy/tasks/<id>/plan.md` and `.alloy/tasks/<id>/progress.md`.
3. Map each acceptance criterion to concrete evidence.
4. Spawn one-shot `@Reviewer` for independent AC review when implementation risk is non-trivial.
5. Run required verification commands and read their output.
6. Update `progress.md` gate checkboxes for `review` and `verified` only when evidence supports them.
7. Run `alloy gate check --task-id <id> --json`.

## Output

Chat response should include:

- task id
- acceptance criteria status
- verification commands
- gate result
- open risks or follow-up work

## User Task

`$ARGUMENTS`
