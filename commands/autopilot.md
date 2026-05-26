---
description: Run the Alloy SDD pipeline unattended with bounded risk controls
agent: alloy-orchestrator
---

# /autopilot

Chain Alloy plan, execute, and verify phases for bounded unattended work.

## Workflow

1. Invoke the `alloy-autopilot` skill.
2. Parse `$ARGUMENTS` for the plan id plus optional `--risk low|med|high` and `--max-iters N` arguments.
3. Chain `alloy-discuss`, `alloy-plan`, `alloy-execute`, and `alloy-verify` as needed.
4. Stop on `BLOCKED` or exhausted iteration budget, and preserve resume state.
5. Write output to `.alloy/plans/<id>/context.md`, `.alloy/plans/<id>/plan.md`, `.alloy/plans/<id>/progress.md`, `.alloy/plans/<id>/findings.md`, `.alloy/plans/<id>/verification.md`, and `.alloy/state/autopilot.jsonl`.

## User Task

`$ARGUMENTS`
