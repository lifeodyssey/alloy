---
name: alloy-execute
description: Use when you have a written implementation plan (from alloy-plan) and need to execute task-by-task with verification checkpoints. Tracks status via 4-code system and gates on TDD evidence.
---

# Alloy Execute

## Overview

Load the plan, review critically, execute all tasks, report when complete. Each task goes through TDD via `alloy-tdd`. Per-task status is one of 4 codes that drive `alloy gate check`.

**Announce at start:** "Using `alloy-execute` to implement this plan."

**Note:** If your platform has subagent dispatch (Claude Code, OpenCode `task` tool), prefer dispatching a fresh subagent per task (cleaner context). Otherwise execute inline in this session.

## The Process

### Step 1: Load and Review Plan

1. Read `.alloy/plans/<id>/plan.md`
2. Review critically — identify questions or concerns about the plan
3. If concerns: raise them with the user BEFORE starting
4. If no concerns: create a TodoWrite-style task list and proceed

### Step 2: Execute Each Task

For each task:

1. **Mark as in_progress** in todos and append `state.set` event
2. **Invoke `alloy-tdd`** to drive RED → GREEN → REFACTOR for the task's behavior
3. **Follow the plan's steps exactly** (the plan has bite-sized steps for a reason)
4. **Run verifications as specified** in the plan's "Expected" annotations
5. **At task end, emit a status code** (see below)
6. **Mark as completed** if status is DONE; otherwise pause and report

### The 4 Status Codes

After completing (or attempting) each task, emit one of these:

| Status | Meaning | Next Action |
|---|---|---|
| **DONE** | Task complete, all verifications pass, evidence recorded | Move to next task |
| **DONE_WITH_CONCERNS** | Task complete but you noticed an issue (technical debt, scope creep risk, fragile pattern). Evidence recorded with concern noted | Move to next task BUT surface concern in `findings.md` |
| **NEEDS_CONTEXT** | Cannot proceed without information you don't have (unfamiliar dep, missing infra, ambiguous spec) | STOP. Ask the user. Do not guess. |
| **BLOCKED** | External obstacle (creds missing, dependency broken, env issue) | STOP. Report with exact missing dependency + next diagnostic command. |

Record the status in `.alloy/state/evidence.jsonl`:

```
alloy_evidence { kind: "task_status", taskId, summary: "Task 3 DONE", paths: ["src/foo.ts", "tests/foo.test.ts"] }
```

### Step 3: Update Progress

After each task, update `.alloy/plans/<id>/progress.md`:

```markdown
- [x] Task 1: <name> — DONE (commit abc123)
- [x] Task 2: <name> — DONE_WITH_CONCERNS (commit def456; see findings.md "ScopeCreep1")
- [ ] Task 3: <name> — NEEDS_CONTEXT (waiting on user)
- [ ] Task 4: <name>
```

This file survives `/clear` so any session can resume.

### Step 4: Capture Findings

Anything discovered during execution that wasn't in the plan goes to `.alloy/plans/<id>/findings.md`:

- New dependency you needed to install
- Codebase convention you discovered
- Counter-example to a plan assumption
- Out-of-scope work you intentionally deferred
- Architectural concern surfaced by DONE_WITH_CONCERNS

This file becomes the source for the next plan's context.

### Step 5: Complete Development

After all tasks DONE (or only DONE_WITH_CONCERNS):

> "All tasks executed. Handing off to `alloy-verify` for final gate check, then `alloy-ship` (vendor: SuperPower finishing-a-development-branch) for branch finalization."

## When to Stop and Ask for Help

**STOP executing immediately when:**

- Hit a blocker (missing dependency, test fails repeatedly, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly (3 attempts → invoke `alloy-debug`)
- You're tempted to drift from the plan ("the plan says X but I think Y would be better")

**Ask for clarification rather than guessing.** Emit status `NEEDS_CONTEXT` and pause.

## When to Revisit Earlier Steps

**Return to Step 1 (review plan) when:**
- User updates the plan based on your feedback
- Fundamental approach needs rethinking
- Plan's stated architecture conflicts with reality you discovered

**Don't force through blockers** — stop and ask.

## Sub-Agent Dispatch (when available)

If running on a platform with subagents (OpenCode `task` tool, Claude Code `Task` tool):

1. For each task in the plan, dispatch a fresh subagent
2. Pass: the task's bite-sized steps + relevant context files (NOT the whole plan)
3. The subagent runs `alloy-tdd` for the task's behavior
4. Parent agent receives status code + commit SHA
5. Parent agent reviews diff before moving to next task

**Why dispatch?** Fresh context per task = cleaner reasoning, no context bleed between unrelated tasks. Parent stays at high level (orchestration), subagents go deep.

**Status convention for subagent return:** the subagent reports the 4 status codes exactly. Parent never overrides.

## Parallel Task Dispatch (wave execution)

**Inspired by GSD wave execution.** Multiple tasks can run in parallel IF AND ONLY IF their `files_modified` lists do NOT intersect.

Before dispatching N tasks in parallel:

1. List `files_modified` for each task
2. Compute pairwise intersections
3. If ANY two tasks share a file → force serial execution
4. Otherwise → parallel dispatch via subagents

This prevents `.git/config.lock` races and `git worktree add` collisions.

## Important Rules

- **Never start implementation on `main`/`master`** without explicit user consent. Use `using-git-worktrees` if available.
- **Don't force through blockers** — emit NEEDS_CONTEXT or BLOCKED, stop, ask.
- **Don't skip verifications** in the plan — they exist for a reason.
- **Reference skills when the plan says to** — `alloy-tdd`, `alloy-debug`, stack-specific skills.
- **Atomic commits per task** — one task = one commit (or one RED-GREEN-REFACTOR cycle inside a task).
- **No "while I'm here"** improvements during execution — capture them in `findings.md` for the NEXT plan.

## Evidence

```
alloy_evidence { kind: "execute_start", taskId, summary: "Beginning plan execution for N tasks" }
alloy_evidence { kind: "task_status", taskId, summary: "Task K DONE", command: "git rev-parse HEAD" }
alloy_evidence { kind: "execute_done", taskId, summary: "All N tasks complete" }
```

`alloy gate check` for `code` tasks requires:
- At least one `tdd_red` and one `tdd_green` (or `test`) evidence per implementation task
- `claim` entries for completed tasks bound to evidence ids
- No outstanding `NEEDS_CONTEXT` or `BLOCKED` status

## Related Skills

- **alloy-tdd** — per-task RED→GREEN→REFACTOR
- **alloy-debug** — when verification fails repeatedly
- **alloy-verify** — final gate before claiming whole plan done
- **alloy-ship** (vendor: SuperPower finishing-a-development-branch) — branch finalization
- **using-git-worktrees** (vendor: SuperPower) — isolated workspace

## Deep references (sub-agent prompt templates)

When dispatching sub-agents (Sub-Agent Dispatch section above), use these prompt templates verbatim — they encode the right discipline:

- **`references/implementer-prompt.md`** — Prompt for a fresh sub-agent that will implement ONE task (SuperPower subagent-driven-development)
- **`references/plan-reviewer-prompt.md`** — Prompt for the plan-compliance reviewer pass (does this match the plan?)
- **`references/code-quality-reviewer-prompt.md`** — Prompt for the code-quality reviewer pass (is this code good, regardless of spec?)

Read these and adapt only the project-specific bits (file paths, language idioms). The discipline encoded in the prompts has been battle-tested.

## Attribution

Fuses:
- **obra/superpowers** executing-plans + subagent-driven-development — load+review+execute pattern, sub-agent dispatch, when-to-stop rules, plus 3 reviewer/implementer prompt templates vendored under `references/` (MIT)
- **GSD** — wave execution with `files_modified` intersection check
- **Alloy** — 4 status codes (DONE/CONCERNS/NEEDS_CONTEXT/BLOCKED), `.alloy/state` evidence integration, progress.md + findings.md artifact pattern, gate-check binding

See `/CREDITS.md` at repo root for full attribution.
