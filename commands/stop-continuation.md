---
description: Stop Alloy workflow continuation for this session
---

# /stop-continuation

Use this when the user wants to pause automated workflow progress and return to manual control.

## What To Do

1. Stop starting new GSD phases.
2. Leave existing `.planning` artifacts intact.
3. Summarize the current phase, latest completed step, and next safe resume command.
4. Tell the user that `/start-work` can resume from GSD state later.

Do not delete planning state or project files.
