# Alloy Workflow

Alloy keeps workflow control in repo-local markdown artifacts and keeps implementation work in OpenCode agents and skills.

1. Clarify the task and create or update `.alloy/tasks/<id>/context.md`.
2. Plan non-trivial work in `.alloy/tasks/<id>/plan.md`.
3. Execute through the smallest useful task boundary.
4. Record commands, findings, review, verification, and handoff in `.alloy/tasks/<id>/progress.md`.
5. Close only when `alloy gate check --task-id <id>` passes.

OpenCode is the runtime. Alloy is the resolver, artifact contract, and gate checker.
