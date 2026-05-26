---
description: Turn a user request into the Spec section of an Alloy task plan
agent: alloy-orchestrator
---

# /spec

Write the user-approved `## Spec` section for an Alloy task plan.

## Workflow

1. Invoke the `alloy-brainstorm` skill.
2. Identify or create a stable spec id for `.alloy/specs/<id>/`.
3. Read `.alloy/specs/<id>/context.md` if `/discuss` already captured decisions.
4. Explore project context, clarify scope, present approaches, and obtain user approval.
5. Write output to the `## Spec` section of `.alloy/specs/<id>/task_plan.md`.

## User Task

`$ARGUMENTS`
