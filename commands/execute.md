---
description: Execute an approved Alloy plan task-by-task with progress gates
agent: alloy-builder
---

# /execute

Run an approved Alloy implementation plan and maintain task progress.

## Workflow

1. Invoke the upstream `superpowers:subagent-driven-development` skill for the per-task implement-review loop (the alloy plugin enforces the approved-plan gate).
2. Load `.alloy/tasks/<id>/plan.md`.
3. Confirm the plan is approved.
4. Load or create `.alloy/tasks/<id>/progress.md`.
5. For new behavior, invoke `alloy-tdd` and prove RED before implementation.
6. For bugs or unexpected failures, invoke upstream `superpowers:systematic-debugging` before fixing.
7. Spawn one-shot `@Explorer`, `@Fixer`, or `@Tester` only when the plan or failure mode justifies it.
8. Update `progress.md` with iterations, findings, commands, and gate checkbox evidence.
9. Stop with `BLOCKED` if a required gate cannot be satisfied.

## Output

Chat response should include:

- task id
- files changed
- RED/GREEN or verification commands
- gate status
- remaining risk

## User Task

`$ARGUMENTS`
