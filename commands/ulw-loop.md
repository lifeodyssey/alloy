---
description: Continue Alloy review/fix/verify loops until completion or escalation
agent: alloy-builder
---

# /ulw-loop

Continue an active Alloy task through the smallest useful review, fix, or verification loop.

## Loop

1. Read `.alloy/tasks/<id>/plan.md` and `progress.md`.
2. If implementation is incomplete, execute the next bounded plan task.
3. If review is missing, spawn a one-shot Reviewer.
4. If findings block completion, fix one root cause and record it in `progress.md`.
5. If review is clear, run the required verification commands and `alloy gate check`.
6. Stop when gates pass, an iteration budget is hit, or escalation is required.

## Escalation

Escalate to the user when:

- The same BLOCK finding survives two fix cycles.
- Verification cannot run because credentials, services, or environments are missing.
- The requested scope conflicts with the approved plan.
