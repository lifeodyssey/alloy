---
description: Convert an Alloy spec into an implementation plan
agent: alloy-orchestrator
---

# /plan

Append the implementation-ready `## Plan` section to an Alloy task plan.

## Workflow

1. Invoke the `alloy-plan` skill.
2. Identify the requested `.alloy/specs/<id>/task_plan.md`.
3. Confirm the `## Spec` section exists and is specific enough to plan.
4. Produce bite-sized implementation tasks with exact files, commands, and verification steps.
5. Append output to the `## Plan` section of `.alloy/specs/<id>/task_plan.md`.

## User Task

`$ARGUMENTS`
