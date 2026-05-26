---
description: Start a bounded Ralph Loop retry cycle
agent: Orchestrator
---

# ralph-loop

Delegate to the `ralph-loop` skill.

## Workflow

1. Invoke the `ralph-loop` skill.
2. Parse `$ARGUMENTS` for the task, maximum iteration count, required checks, and stop condition.
3. Run one bounded pass at a time, preserving findings and verification evidence between passes.
4. Stop when the goal is satisfied, the stop condition is met, the iteration budget is exhausted, or the user cancels the loop.

## User Task

`$ARGUMENTS`
