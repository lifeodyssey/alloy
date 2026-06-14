---
name: alloy-using
description: Use when explaining how Alloy works, how to choose /discuss /plan /execute /verify, or how task artifacts should be maintained.
---

# Alloy Using

Alloy v0.1.4 is a command-driven workflow for one developer using OpenCode with two primary agents and disposable subagents.

## Core Model

- Planner owns `/discuss` and `/plan`.
- Builder owns `/execute`, `/verify`, and bounded retry loops.
- Subagents are native one-shot Task sessions. They are not installed as persistent Alloy agent files.
- Durable task state lives in `.alloy/tasks/<task-id>/`.
- Chat can be concise. Durable artifacts must be complete.

## Task Directory

```text
.alloy/tasks/<task-id>/
  context.md   # requirements, decisions, constraints, open questions
  plan.md      # approved or unapproved implementation plan
  progress.md  # gate checkboxes, iterations, findings, handoff
  qa.md        # optional QA matrix/report
  codebase-map.md # optional source map for broad work
```

Runtime-only files such as `.lock` and `.alloy/run/` are gitignored.

## Command Choice

Use `/discuss` when the request has product ambiguity, visible behavior choices, acceptance criteria gaps, or non-goal uncertainty.

Use `/plan` when the goal is known but needs implementation sequencing, files, tests, risks, and handoff.

Use `/execute` when an approved `plan.md` exists and Builder should implement.

Use `/verify` when implementation appears complete and gates must be closed against acceptance criteria.

Use `/start-work` to resume an existing task.

Use `/handoff` to produce a continuation summary for a new session.

## Gate Vocabulary

Common gate lines in `progress.md`:

```markdown
## Gate

- [ ] tdd_red
- [ ] debug
- [ ] green
- [ ] review
- [ ] verified
```

Only include gates that matter for the task. `alloy gate check --task-id <id> --json` passes when every checkbox under `## Gate` is checked.

## Output Density Rule

All Alloy artifacts must include enough detail for a fresh Builder session:

- acceptance criteria
- exact files or directories
- exact commands
- gate names and checkbox state
- risks and rollback
- negative cases and counterexamples
- subagent handoff instructions
- final handoff summary

Do not hide important details in chat only.
