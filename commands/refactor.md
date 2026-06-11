---
description: Plan and perform a safe refactor through the Alloy phase machine
agent: alloy-builder
---

# /refactor

Use `/refactor <target> [--scope=file|module|project] [--strategy=safe|aggressive]` for behavior-preserving code changes.

## Workflow

1. If scope or intent is unclear, route to `/discuss`.
2. For non-trivial refactors, route to `/plan` and write `.alloy/tasks/<id>/plan.md`.
3. Execute only after the plan is approved.
4. Use `rg`, language tooling, and tests to map references before editing.
5. Use `alloy-tdd` or an equivalent contract guard before changing behavior-sensitive code.
6. Update `.alloy/tasks/<id>/progress.md` with changed files, commands, gates, risks, and rollback notes.
7. Run `/verify` before reporting completion.

## Rules

- Do not mix refactoring with new product behavior unless the user asks.
- Do not change public interfaces without explicit rationale.
- Spawn one-shot subagents only for broad scan, multi-file diagnosis, review, or QA.
