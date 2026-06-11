---
description: Run one bounded Alloy retry iteration
agent: alloy-builder
---

# /ralph-loop

Run one retry iteration for an active Alloy task. This is a bounded command, not an autonomous daemon.

## Workflow

1. Identify the task id from `$ARGUMENTS`, `ALLOY_TASK_ID`, or the most recent `.alloy/tasks/<id>/progress.md`.
2. Read the approved `plan.md` and current `progress.md`.
3. Pick exactly one failed gate, failed command, or unresolved finding.
4. Use `alloy-debug` before changing code.
5. Update `progress.md` under `## Iterations` and `## Findings`.
6. Re-run the smallest meaningful verification command.
7. Stop after one iteration and report the next command.

## Stop Conditions

- No approved plan.
- No reproducible failure or unchecked gate.
- Same fix strategy has failed twice.
- Required services, credentials, or permissions are missing.

## User Task

`$ARGUMENTS`
