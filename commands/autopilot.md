---
description: Run the Alloy SDD pipeline unattended with bounded risk controls
agent: alloy-orchestrator
---

# /autopilot

Chain Alloy discuss, spec, plan, execute, and verify phases for bounded unattended work.

## Workflow

1. Invoke the `alloy-autopilot` skill.
2. Parse `$ARGUMENTS` for the spec id plus optional `--risk low|med|high` and `--max-iters N` arguments.
3. Chain `alloy-discuss`, `alloy-brainstorm`, `alloy-plan`, `alloy-execute`, and `alloy-verify` as needed.
4. Stop on `BLOCKED` or exhausted iteration budget, and preserve resume state.
5. Write output to `.alloy/specs/<id>/context.md`, `.alloy/specs/<id>/task_plan.md`, `.alloy/specs/<id>/progress.md`, `.alloy/specs/<id>/findings.md`, `.alloy/specs/<id>/verification.md`, and `.alloy/state/autopilot.jsonl`.

## User Task

`$ARGUMENTS`
