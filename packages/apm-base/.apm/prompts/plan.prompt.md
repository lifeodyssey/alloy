---
description: Brainstorm and write an implementation-ready Alloy plan
agent: alloy-planner
---

# /plan

Produce an implementation-ready plan for an Alloy task. The plan is the handoff contract for Builder.

## Workflow

1. Invoke the `alloy-plan` skill.
2. Identify or create a stable task id for `.alloy/tasks/<id>/`.
3. Read `.alloy/tasks/<id>/context.md` if `/discuss` already captured decisions.
4. Inspect source files, generated targets, tests, and docs relevant to the work.
5. Spawn one-shot `@Explorer` only when broad source coverage is needed.
6. Write `.alloy/tasks/<id>/plan.md` with frontmatter:

```yaml
---
id: <id>
approved: false
---
```

7. Include acceptance criteria, file scope, ordered tasks, verification commands, gate expectations, risks, and handoff notes.
8. Stop before implementation.

## Output

Chat response should include:

- plan path
- acceptance criteria count
- files in scope
- verification commands
- approval status

## User Task

`$ARGUMENTS`
