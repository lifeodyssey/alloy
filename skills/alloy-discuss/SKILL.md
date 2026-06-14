---
name: alloy-discuss
description: Use before planning when requirements are ambiguous, large, user-visible, or likely to cause rework unless decisions are locked.
---

# Alloy Discuss

Use this skill to turn fuzzy user intent into decision-locked context for Planner and Builder.

## Use When

- The user asks for a feature but acceptance criteria are incomplete.
- Product behavior, UX, policy, migration, rollout, or compatibility choices are unclear.
- The task is broad enough that a wrong assumption would cause rework.
- There are competing interpretations that need a user decision.

## Do Not Use When

- The change is a tiny typo, dependency bump, or clearly specified one-file edit.
- The missing detail can be discovered from local code or docs.
- The user explicitly asked to implement an already approved plan.

## Artifact

Write or update:

```text
.alloy/tasks/<task-id>/context.md
```

Use a stable task id from the user, issue id, branch name, or a short slug. Do not create multiple ids for the same request.

## Context Template

```markdown
# <task-id>: Context

## User Request
- Original request:
- Follow-up corrections:
- Explicit constraints:

## Decisions Locked
- Decision:
  - Chosen:
  - Reason:
  - Rejected alternatives:

## Acceptance Signals
- User-visible success:
- Non-goals:
- Compatibility expectations:

## Open Questions
- [ ] Question:
  - Why it blocks planning:
  - Options:

## Source Reality To Check In /plan
- Files/directories:
- Commands:
- Docs/specs:

## Handoff To /plan
- Task id:
- Planning focus:
- Risks:
```

## Question Discipline

Ask at most one blocking question at a time in chat. Prefer discovering codebase facts yourself. Ask the user only about intent, tradeoffs, and externally unknowable decisions.

## Subagent Policy

Planner may spawn one-shot Explorer only for broad source discovery. Do not create persistent subagent files.

## Final Output

Return:

- task id
- context path
- locked decisions count
- open blocking questions
- recommended next command
