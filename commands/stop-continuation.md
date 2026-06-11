---
description: Stop the active Alloy workflow without deleting task artifacts
agent: alloy-builder
---

# /stop-continuation

Stop after the current safe point and return control to the user.

## Workflow

1. Do not start new Alloy workflow steps.
2. Leave `.alloy/tasks/<id>/context.md`, `plan.md`, and `progress.md` intact.
3. Append a short `## Handoff` note to `progress.md` when a task is active.
4. Summarize current task, latest completed step, unchecked gates, and next safe resume command.
5. Tell the user `/start-work <task-id>` can resume.

Do not delete planning state or project files.
