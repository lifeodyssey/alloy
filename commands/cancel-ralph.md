---
description: Stop the active Ralph Loop-style retry cycle and hand control back
agent: alloy-builder
---

# /cancel-ralph

Stop scheduling continuation passes for the current task.

## Workflow

1. Identify the active `.alloy/tasks/<id>/progress.md`.
2. Append a `## Handoff` note with the latest completed iteration, failed attempts, unchecked gates, and next safe command.
3. Do not start another executor pass.
4. Do not delete artifacts, locks, branch state, or verification output.
5. Return control to the user with `BLOCKED` or `DONE_WITH_CONCERNS`.
