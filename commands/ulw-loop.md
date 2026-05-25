---
description: Continue Alloy review/fix/verify loops until completion or escalation
agent: Orchestrator
---

# /ulw-loop

Use this when a task is already in progress and should continue through review and verification.

## Loop

1. Read the current `.alloy` task, evidence, claims, and plan artifacts.
2. If implementation is incomplete, execute the next bounded card with `alloy-tdd`.
3. If implementation is complete but review is missing, ask `@Reviewer`.
4. If BLOCK findings exist, fix them and record evidence.
5. If review is clear, ask `@Tester` and run `alloy gate check`.
6. Stop when verification is complete and gates pass.

## Escalation

Escalate to the user when:

- The same BLOCK finding survives two fix cycles.
- Verification cannot run because credentials, services, or environments are missing.
- The requested scope conflicts with the plan or work item.

No autonomous continuation plugin is required for this command.
