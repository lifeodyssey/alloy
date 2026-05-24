# Alloy Workflow

Alloy keeps workflow control in repo-local state and keeps implementation thinking in OpenCode agents and skills.

1. Clarify the task and create or update a task record.
2. For non-trivial work, keep the current plan visible in `.alloy/projections/current-plan.md`.
3. Execute through the smallest useful task boundary.
4. Record evidence for tests, lint, manual verification, review, and any skipped gates.
5. Close only when `alloy gate check` passes.

OpenCode is the runtime. Alloy is the resolver, state ledger, evidence collector, and gate checker.
