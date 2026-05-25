---
description: DEPRECATED v0.1.0 — use /spec /plan /execute /verify instead. Run the full Alloy workflow for a substantial task
agent: Orchestrator
---

# /ultrawork

Use this for complex, multi-step work that should proceed through planning, execution, review, and verification.

## Workflow

1. Classify the user request.
2. If it can change code or project state, ask for the card/work item number.
3. Clarify requirements with `grill-me` or `grill-with-docs` when installed.
4. Explore existing code and conventions.
5. Use `alloy-brainstorm` if the task is still fuzzy.
6. Create an Alloy task and update `.alloy/projections/current-plan.md`.
7. Review the plan with `@Architect`.
8. Execute one bounded card at a time; every implementation card invokes `alloy-tdd`.
9. Review with `@Reviewer`.
10. Fix BLOCK findings until resolved or two cycles have failed.
11. Verify with `@Tester` and `alloy gate check`.
12. Report changed files, verification, evidence, and any unresolved risk.

## Tool Policy

- GitHub: `gh`
- Azure DevOps: `az devops`
- Postgres: `psql`
- Docs: `context7`
- Public code examples: `grep_app`
- General web search: `exa`

## User Task

`$ARGUMENTS`
