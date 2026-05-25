---
description: Clarify ambiguous work before writing an Alloy spec
agent: alloy-orchestrator
---

# /discuss

Extract decision-locked context for a future Alloy spec.

## Workflow

1. Invoke the `alloy-discuss` skill.
2. Identify or create a stable spec id for `.alloy/specs/<id>/`.
3. Read prior Alloy state, project guidance, and relevant codebase context.
4. Identify specific gray areas, discuss selected decisions with the user, and record outcomes.
5. Write output to `.alloy/specs/<id>/context.md`.

## User Task

`$ARGUMENTS`
