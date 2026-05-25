---
description: Verify an Alloy implementation before completion claims
agent: alloy-orchestrator
---

# /verify

Record evidence that an Alloy implementation satisfies its spec.

## Workflow

1. Invoke the `alloy-verify` skill.
2. Load the requested `.alloy/specs/<id>/task_plan.md`, progress, and findings.
3. Map acceptance criteria to concrete proof commands or review checks.
4. Run the full required verification commands and read their output before making claims.
5. Write output to `.alloy/specs/<id>/verification.md`.

## User Task

`$ARGUMENTS`
