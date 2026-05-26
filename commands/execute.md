---
description: Execute an Alloy plan task-by-task with status reporting
agent: alloy-orchestrator
---

# /execute

Run the Alloy implementation plan and report task status codes.

## Workflow

1. Invoke the `alloy-execute` skill.
2. Load the requested `.alloy/specs/<id>/task_plan.md` and review the plan before work starts.
3. Dispatch or execute each task with the required verification checkpoints.
4. Report the 4 status codes exactly: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, and `BLOCKED`.
5. Write output to `.alloy/specs/<id>/progress.md` and `.alloy/specs/<id>/findings.md`.

## User Task

`$ARGUMENTS`
