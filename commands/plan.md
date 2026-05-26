---
description: Brainstorm + plan an implementation in one phase (merged spec + plan)
agent: alloy-orchestrator
---

# /plan

Brainstorm the user request and produce an implementation-ready plan in one pass.
This phase replaces the old separate spec and plan commands.

## Workflow

1. Invoke the `alloy-plan` skill, which now includes brainstorm and clarify behavior.
2. Identify or create a stable plan id for `.alloy/plans/<id>/`.
3. Read `.alloy/plans/<id>/context.md` if `/discuss` already captured decisions.
4. Brainstorm and clarify scope with the user.
5. Produce bite-sized implementation tasks with exact files, commands, and verification steps.
6. Write to `.alloy/plans/<id>/plan.md` with frontmatter:
   ```yaml
   ---
   id: <id>
   approved: false
   required_skills: [...]
   required_mcps: [...]
   required_agents: [...]
   files_to_touch: [...]
   acceptance_criteria: [...]
   ---
   ```
7. Stop here and wait for user approval before `/execute`.

## User Task

`$ARGUMENTS`
