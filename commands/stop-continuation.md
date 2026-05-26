---
description: DEPRECATED v0.1.0 — use /plan /execute /verify instead. Stop Alloy workflow continuation for this session
---

# /stop-continuation

Use this when the user wants to pause automated workflow progress and return to manual control.

## What To Do

1. Stop starting new Alloy workflow steps.
2. Leave existing `.alloy` artifacts intact.
3. Summarize the current task, latest completed step, and next safe resume command.
4. Tell the user that `/start-work` can resume from Alloy state later.

Do not delete planning state or project files.
