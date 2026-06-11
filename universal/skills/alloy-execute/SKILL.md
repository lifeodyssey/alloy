name: alloy-execute
description: Use when implementing an approved Alloy plan. Maintains progress.md, enforces TDD/debug discipline, and stops on blocked gates.

# Alloy Execute

Builder uses this skill to implement an approved plan task by task.

## Entry Conditions

- `.alloy/tasks/<task-id>/plan.md` exists.
- The plan frontmatter says `approved: true`, or the current user message explicitly approves execution.
- Builder has read `plan.md` and existing `progress.md`.

If no approved plan exists for non-trivial work, return `TASK NEEDS PLANNING`.

## Required Artifacts

Maintain:

```text
.alloy/tasks/<task-id>/progress.md
```

Required sections:

```markdown
# <task-id>: Progress

## Gate

## Iterations

## Findings

## Handoff
```

## Execution Loop

1. Pick the next ordered plan task.
2. For new behavior, invoke `alloy-tdd` and create a failing test or equivalent contract guard first.
3. For bugs or unexpected failures, invoke `alloy-debug` before changing code.
4. Make the smallest scoped change.
5. Run focused verification.
6. Update `progress.md` with files changed, commands run, command results, and gate updates.
7. Repeat until plan tasks are complete or blocked.

## Valid Gate Updates

- `tdd_red`: checked only after a failing test or equivalent guard proves the gap.
- `debug`: checked only after root cause is documented.
- `green`: checked only after focused verification passes.
- `review`: checked only after review is complete.
- `verified`: checked only after final required verification passes.

## Subagent Policy

Spawn one-shot subagents only with a narrow written brief:

- Explorer: broad source scan or hidden entry points.
- Fixer: multi-file bug with a root-cause hypothesis.
- Reviewer: independent acceptance criteria review.
- Tester: QA matrix or risky generated artifacts.

Do not spawn for obvious one-file edits, wording-only changes, or local fixes you can safely perform.

## Stop Conditions

Return `BLOCKED` when:

- Required context is missing.
- A verification command cannot run and no substitute proof is acceptable.
- The same fix strategy fails twice.
- Scope conflicts with the approved plan.

## Final Output

Return one of:

- `DONE`
- `DONE_WITH_CONCERNS`
- `NEEDS_CONTEXT`
- `BLOCKED`

Include task id, files changed, commands run, gate status, subagent findings, and remaining risk.
