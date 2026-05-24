---
description: Create a continuation summary for a new OpenCode session
---

# /handoff

Use this when the session is long and the user wants a self-contained continuation summary.

## Gather Context

Inspect, when available:

- The latest user request and constraints from this conversation.
- Current `git status --short`.
- Recent `git diff --stat`.
- Relevant `.alloy/state/*.jsonl` records and `.alloy/projections/*.md` artifacts.
- Files changed or discussed in this session.
- Verification already run and remaining gaps.

## Output Format

```
HANDOFF CONTEXT
===============

USER REQUESTS
-------------
- [verbatim user requests that still matter]

GOAL
----
[one sentence]

CURRENT STATE
-------------
- [what is true now]

WORK COMPLETED
--------------
- [what has been changed or decided]

PENDING TASKS
-------------
- [next concrete steps]

KEY FILES
---------
- [path] - [why it matters]

DECISIONS
---------
- [important workflow/config decisions]

CONSTRAINTS
-----------
- [explicit constraints only]

NEXT SESSION PROMPT
-------------------
Continue from this handoff context and [next action].
```

Keep the handoff focused, avoid secrets, and include exact file paths when useful.
