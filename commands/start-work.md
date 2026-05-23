---
description: Resume or start a GSD-backed work session
agent: alloy-orchestrator
---

# /start-work

Use this command to resume planned work from GSD state.

## Arguments

`/start-work [phase-or-card] [--worktree <absolute-path>]`

## Workflow

1. Inspect `.planning/` in the current project.
2. If no GSD state exists, ask whether to run `/gsd-discuss-phase` or `/gsd-plan-phase`.
3. If a plan exists, find the first incomplete phase/card.
4. If a worktree is needed and not already active, use the Alloy branch/worktree naming convention from the orchestrator prompt.
5. Resume at the first missing step:
   - missing requirements or fuzzy scope: `/gsd-discuss-phase`
   - missing plan: `/gsd-plan-phase`
   - plan exists but work incomplete: `/gsd-execute-phase`
   - implementation done but not reviewed: `/gsd-code-review`
   - review BLOCK findings exist: `/gsd-code-review-fix`
   - review is clear but not verified: `/gsd-verify-work`

## Rules

- Use `alloy-tdd` for every implementation card.
- Do not use legacy Sisyphus state.
- Do not invent completed state; read GSD artifacts before resuming.
- Report the exact next command or action you chose and why.
