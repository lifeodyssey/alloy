---
description: Run the full Alloy workflow for a substantial task
agent: alloy-builder
---

# /ultrawork

Use this for complex work that should proceed through planning, implementation, review, and verification.

## Workflow

1. Classify the request and create or identify `.alloy/tasks/<id>/`.
2. Run `/discuss` if requirements, non-goals, or acceptance criteria are unclear.
3. Run `/plan` and write a detailed `plan.md` with `approved: false`.
4. Do not implement until the plan is approved by the user or explicitly approved in the current request.
5. Run `/execute` one ordered task at a time.
6. Use `alloy-tdd` for new behavior and upstream `superpowers:systematic-debugging` for failures.
7. Spawn one-shot subagents only when the plan or failure mode justifies it.
8. Run `/verify`, close gates in `progress.md`, and run `alloy gate check`.
9. Report changed files, verification, gate status, risks, and handoff notes.

## Tool Policy

- GitHub: `gh`
- Azure DevOps: `az devops`
- Postgres: `psql`
- Docs: `context7`
- Public code examples: `grep_app`

## User Task

`$ARGUMENTS`
