---
description: Clarify ambiguous work before writing an Alloy plan
agent: alloy-planner
---

# /discuss

Clarify requirements and record decision-locked context for a future Alloy plan.

## Workflow

1. Invoke upstream `superpowers:brainstorming` and `mattpocock:grill-me` to diverge and lock decisions, then capture them in context.md.
2. Identify or create a stable task id for `.alloy/tasks/<id>/`.
3. Read existing `.alloy/tasks/<id>/context.md` and `plan.md` if they exist.
4. Ask one question at a time when a decision blocks planning.
5. Record decisions, constraints, non-goals, and open questions in `.alloy/tasks/<id>/context.md`.
6. Do not write implementation code.

## Output

Chat response should include:

- task id
- context path
- decisions captured
- unresolved questions
- whether `/plan` is ready

## User Task

`$ARGUMENTS`
