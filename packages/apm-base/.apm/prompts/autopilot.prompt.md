---
description: Run the Alloy phase machine with bounded unattended execution
agent: alloy-builder
---

# /autopilot

Run a bounded `/discuss -> /plan -> /execute -> /verify` chain for work the user has explicitly allowed to proceed.

## Workflow

1. Invoke `alloy-autopilot`.
2. Parse `$ARGUMENTS` for task id, requested outcome, risk level, required checks, and max iteration count.
3. Use `.alloy/tasks/<id>/context.md`, `plan.md`, and `progress.md` as the only durable task state.
4. If requirements are ambiguous, stop after `/discuss` and ask for the missing decision.
5. If no approved plan exists, run `/plan`, write `approved: false`, and stop for approval unless the user explicitly authorized unattended approval in this message.
6. Execute one ordered task at a time with `alloy-tdd` or upstream `superpowers:systematic-debugging`.
7. Update `progress.md` with `## Gate`, `## Iterations`, `## Findings`, and `## Handoff`.
8. Run `/verify`, update gate checkboxes, and stop on `DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`.

## Stop Conditions

- Any required gate remains unchecked.
- A verification command cannot run.
- The same fix strategy fails twice.
- Scope expands beyond the approved plan.
- The iteration budget is exhausted.

## User Task

`$ARGUMENTS`
