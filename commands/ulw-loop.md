---
description: Continue GSD review/fix/verify loops until completion or escalation
agent: alloy-orchestrator
---

# /ulw-loop

Use this when a task is already in progress and should continue through review and verification.

## Loop

1. Read the current GSD `.planning` state and latest artifacts.
2. If implementation is incomplete, run `/gsd-execute-phase`.
3. If implementation is complete but review is missing, run `/gsd-code-review`.
4. If BLOCK findings exist, run `/gsd-code-review-fix`.
5. If review is clear, run `/gsd-verify-work`.
6. Stop when verification is complete.

## Escalation

Escalate to the user when:

- The same BLOCK finding survives two fix cycles.
- Verification cannot run because credentials, services, or environments are missing.
- The requested scope conflicts with the plan or work item.

No autonomous continuation plugin is required for this command.
