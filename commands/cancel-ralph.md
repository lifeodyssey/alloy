---
description: Cancel the active Ralph Loop and return control to the user
agent: Orchestrator
---

# cancel-ralph

Cancel the active Ralph Loop by delegating to `ralph-loop/cancel-ralph.md`.

## Workflow

1. Stop scheduling any further loop iterations.
2. Preserve current artifacts, findings, and verification evidence.
3. Summarize the latest completed iteration and unresolved work.
4. Return control to the user without starting another executor pass.
