---
name: alloy-autopilot
description: Use only when the user explicitly allows bounded unattended execution of an approved Alloy task.
---

# Alloy Autopilot

Autopilot chains `/execute` and `/verify` under strict stop conditions. It does not add a scheduler, daemon, or extra persistent agent.

## Relationship To ralph-loop

`ralph-loop` owns the unattended iteration mechanism. Autopilot does not reimplement looping — it delegates the loop to `ralph-loop` and contributes the alloy-specific layer on top: the approved-plan entry gate, `progress.md` gate recording, risk tiers, and the stop conditions below. Use `/ralph-loop` for the raw loop; use `/autopilot` when you want that loop wrapped in alloy's gate and risk controls.

## Entry Conditions

- User explicitly requests unattended or autopilot execution.
- `.alloy/tasks/<task-id>/plan.md` exists and is approved, or the user approves it in the current message.
- Verification commands are known.
- Risk level and iteration budget are understood.

## Arguments

```text
/autopilot <task-id> [--risk low|med|high] [--max-iters N] [--resume]
```

## Workflow

1. Read `plan.md` and `progress.md`.
2. Confirm gates and stop conditions.
3. Run one `/execute` task at a time (via `ralph-loop` for the iteration mechanism).
4. Use `alloy-tdd` for new code and `superpowers:systematic-debugging` for failures, as required.
5. Append every iteration to `progress.md`.
6. Run `/verify` after implementation tasks are complete.
7. Stop and report status.

## Risk Controls

Low risk: small scope, known tests, no secrets, no production services.

Medium risk: multi-file changes or generated artifacts. Require review before final `DONE`.

High risk: migrations, auth, billing, data loss, production infra, or secrets. Do not run unattended unless the user explicitly overrides and provides verification boundaries.

## Stop Conditions

- Any required gate cannot be checked.
- A command fails twice for the same root cause.
- Scope expands beyond the approved plan.
- A required service, credential, or permission is missing.
- Max iterations reached.

## Final Output

Return status, iterations used, files changed, commands run, gate state, remaining risk, and next safe command.
