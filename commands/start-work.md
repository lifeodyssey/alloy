---
description: Resume or start an Alloy workflow session
agent: alloy-builder
---

# /start-work

Resume planned work from Alloy markdown task artifacts.

## Arguments

`/start-work [task-id] [--worktree <absolute-path>]`

## Workflow

1. Identify the task id from `$ARGUMENTS`, `ALLOY_TASK_ID`, or the most recent `.alloy/tasks/<id>/`.
2. Read `context.md`, `plan.md`, and `progress.md`.
3. If no task exists, ask the user for the work item or run `/discuss`.
4. If no approved plan exists, run `/plan` and stop for approval.
5. If implementation is incomplete, run `/execute`.
6. If implementation is complete but gates are open, run `/verify`.
7. Report the exact next action, gate status, and verification command.

## Rules

- Do not invent completed state.
- Do not use legacy JSONL state.
- Keep progress in `.alloy/tasks/<id>/progress.md`.
