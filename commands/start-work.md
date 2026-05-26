---
description: DEPRECATED v0.1.0 — use /plan /execute /verify instead. Resume or start an Alloy workflow session
agent: Orchestrator
---

# /start-work

Use this command to resume planned work from Alloy state.

## Arguments

`/start-work [task-or-card] [--worktree <absolute-path>]`

## Workflow

1. Inspect `.alloy/state/tasks.jsonl`, `.alloy/state/evidence.jsonl`, and `.alloy/projections/current-plan.md`.
2. If no Alloy task exists, create one with `alloy state add-task` or ask for the missing work item.
3. If a plan exists, find the first incomplete card or missing gate.
4. If a worktree is needed and not already active, use the Alloy branch/worktree naming convention from the orchestrator prompt.
5. Resume at the first missing step:
   - fuzzy scope: use `alloy-plan` and update the current plan
   - missing plan: write or update `.alloy/projections/current-plan.md`
   - work incomplete: execute the next bounded card with `alloy-tdd`
   - implementation done but not reviewed: ask `@Reviewer`
   - review BLOCK findings exist: fix them with explicit evidence
   - review is clear but not verified: ask `@Tester` and run `alloy gate check`

## Rules

- Use `alloy-tdd` for every implementation card.
- Do not use legacy Sisyphus or GSD state.
- Do not invent completed state; read Alloy artifacts before resuming.
- Report the exact next command or action you chose and why.
