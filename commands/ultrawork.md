---
description: Run the full Alloy workflow for a substantial task
agent: alloy-orchestrator
---

# /ultrawork

Use this for complex, multi-step work that should proceed through planning, execution, review, and verification.

## Workflow

1. Classify the user request.
2. If it can change code or project state, ask for the card/work item number.
3. Clarify requirements with `grill-me` or `grill-with-docs` when installed.
4. Explore existing code and conventions.
5. Use `/gsd-discuss-phase` if the task is still fuzzy.
6. Use `/gsd-plan-phase` for the implementation plan.
7. Review the plan with `@alloy-planner` or GSD plan checking.
8. Use `/gsd-execute-phase`; every implementation card invokes `alloy-tdd`.
9. Use `/gsd-code-review`.
10. Use `/gsd-code-review-fix` until BLOCK findings are resolved or two cycles have failed.
11. Use `/gsd-verify-work`.
12. Report changed files, verification, and any unresolved risk.

## Tool Policy

- GitHub: `gh`
- Azure DevOps: `az devops`
- Postgres: `psql`
- Docs: `context7`
- Public code examples: `grep_app`
- General web search: `exa`

## User Task

`$ARGUMENTS`
