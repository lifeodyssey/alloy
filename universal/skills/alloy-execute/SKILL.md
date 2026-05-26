---
name: alloy-execute
description: Use when you have a written implementation plan from alloy-plan and need task-by-task execution with verification checkpoints. Inline-fuses Superpowers subagent-driven development and Alloy status gates.
---

# Alloy Execute

This skill inlines Superpowers' subagent-driven development workflow and reviewer prompts, then keeps Alloy's 4-code status contract and ledger gates.

## Section 1: Superpowers Subagent-Driven Development (Alloy-normalized)

_Source: obra/superpowers v5.1.0 skills/subagent-driven-development/SKILL.md (MIT)_

Note: retired Superpowers entrypoint names are normalized to current Alloy skills.

---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

**Why subagents:** You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task. They should never inherit your session's context or history — you construct exactly what they need. This also preserves your own context for coordination work.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

**Continuous execution:** Do not pause to check in with your human partner between tasks. Execute all tasks from the plan without stopping. The only reasons to stop are: BLOCKED status you cannot resolve, ambiguity that genuinely prevents progress, or all tasks complete. "Should I continue?" prompts and progress summaries waste their time — they asked you to execute the plan, so execute it.

## When to Use

```dot
digraph when_to_use {
    "Have implementation plan?" [shape=diamond];
    "Tasks mostly independent?" [shape=diamond];
    "Stay in this session?" [shape=diamond];
    "subagent-driven-development" [shape=box];
    "executing-plans" [shape=box];
    "Manual execution or brainstorm first" [shape=box];

    "Have implementation plan?" -> "Tasks mostly independent?" [label="yes"];
    "Have implementation plan?" -> "Manual execution or brainstorm first" [label="no"];
    "Tasks mostly independent?" -> "Stay in this session?" [label="yes"];
    "Tasks mostly independent?" -> "Manual execution or brainstorm first" [label="no - tightly coupled"];
    "Stay in this session?" -> "subagent-driven-development" [label="yes"];
    "Stay in this session?" -> "executing-plans" [label="no - parallel session"];
}
```

**vs. Executing Plans (parallel session):**
- Same session (no context switch)
- Fresh subagent per task (no context pollution)
- Two-stage review after each task: spec compliance first, then code quality
- Faster iteration (no human-in-loop between tasks)

## The Process

```dot
digraph process {
    rankdir=TB;

    subgraph cluster_per_task {
        label="Per Task";
        "Dispatch implementer subagent (./implementer-prompt.md)" [shape=box];
        "Implementer subagent asks questions?" [shape=diamond];
        "Answer questions, provide context" [shape=box];
        "Implementer subagent implements, tests, commits, self-reviews" [shape=box];
        "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)" [shape=box];
        "Spec reviewer subagent confirms code matches spec?" [shape=diamond];
        "Implementer subagent fixes spec gaps" [shape=box];
        "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [shape=box];
        "Code quality reviewer subagent approves?" [shape=diamond];
        "Implementer subagent fixes quality issues" [shape=box];
        "Mark task complete in TodoWrite" [shape=box];
    }

    "Read plan, extract all tasks with full text, note context, create TodoWrite" [shape=box];
    "More tasks remain?" [shape=diamond];
    "Dispatch final code reviewer subagent for entire implementation" [shape=box];
    "Use superpowers:finishing-a-development-branch" [shape=box style=filled fillcolor=lightgreen];

    "Read plan, extract all tasks with full text, note context, create TodoWrite" -> "Dispatch implementer subagent (./implementer-prompt.md)";
    "Dispatch implementer subagent (./implementer-prompt.md)" -> "Implementer subagent asks questions?";
    "Implementer subagent asks questions?" -> "Answer questions, provide context" [label="yes"];
    "Answer questions, provide context" -> "Dispatch implementer subagent (./implementer-prompt.md)";
    "Implementer subagent asks questions?" -> "Implementer subagent implements, tests, commits, self-reviews" [label="no"];
    "Implementer subagent implements, tests, commits, self-reviews" -> "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)";
    "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)" -> "Spec reviewer subagent confirms code matches spec?";
    "Spec reviewer subagent confirms code matches spec?" -> "Implementer subagent fixes spec gaps" [label="no"];
    "Implementer subagent fixes spec gaps" -> "Dispatch spec reviewer subagent (./spec-reviewer-prompt.md)" [label="re-review"];
    "Spec reviewer subagent confirms code matches spec?" -> "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [label="yes"];
    "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" -> "Code quality reviewer subagent approves?";
    "Code quality reviewer subagent approves?" -> "Implementer subagent fixes quality issues" [label="no"];
    "Implementer subagent fixes quality issues" -> "Dispatch code quality reviewer subagent (./code-quality-reviewer-prompt.md)" [label="re-review"];
    "Code quality reviewer subagent approves?" -> "Mark task complete in TodoWrite" [label="yes"];
    "Mark task complete in TodoWrite" -> "More tasks remain?";
    "More tasks remain?" -> "Dispatch implementer subagent (./implementer-prompt.md)" [label="yes"];
    "More tasks remain?" -> "Dispatch final code reviewer subagent for entire implementation" [label="no"];
    "Dispatch final code reviewer subagent for entire implementation" -> "Use superpowers:finishing-a-development-branch";
}
```

## Model Selection

Use the least powerful model that can handle each role to conserve cost and increase speed.

**Mechanical implementation tasks** (isolated functions, clear specs, 1-2 files): use a fast, cheap model. Most implementation tasks are mechanical when the plan is well-specified.

**Integration and judgment tasks** (multi-file coordination, pattern matching, debugging): use a standard model.

**Architecture, design, and review tasks**: use the most capable available model.

**Task complexity signals:**
- Touches 1-2 files with a complete spec → cheap model
- Touches multiple files with integration concerns → standard model
- Requires design judgment or broad codebase understanding → most capable model

## Handling Implementer Status

Implementer subagents report one of four statuses. Handle each appropriately:

**DONE:** Proceed to spec compliance review.

**DONE_WITH_CONCERNS:** The implementer completed the work but flagged doubts. Read the concerns before proceeding. If the concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed to review.

**NEEDS_CONTEXT:** The implementer needs information that wasn't provided. Provide the missing context and re-dispatch.

**BLOCKED:** The implementer cannot complete the task. Assess the blocker:
1. If it's a context problem, provide more context and re-dispatch with the same model
2. If the task requires more reasoning, re-dispatch with a more capable model
3. If the task is too large, break it into smaller pieces
4. If the plan itself is wrong, escalate to the human

**Never** ignore an escalation or force the same model to retry without changes. If the implementer said it's stuck, something needs to change.

## Prompt Templates

- `./implementer-prompt.md` - Dispatch implementer subagent
- `./spec-reviewer-prompt.md` - Dispatch spec compliance reviewer subagent
- `./code-quality-reviewer-prompt.md` - Dispatch code quality reviewer subagent

## Example Workflow

```
You: I'm using Subagent-Driven Development to execute this plan.

[Read plan file once: docs/superpowers/plans/feature-plan.md]
[Extract all 5 tasks with full text and context]
[Create TodoWrite with all tasks]

Task 1: Hook installation script

[Get Task 1 text and context (already extracted)]
[Dispatch implementation subagent with full task text + context]

Implementer: "Before I begin - should the hook be installed at user or system level?"

You: "User level (~/.config/superpowers/hooks/)"

Implementer: "Got it. Implementing now..."
[Later] Implementer:
  - Implemented install-hook command
  - Added tests, 5/5 passing
  - Self-review: Found I missed --force flag, added it
  - Committed

[Dispatch spec compliance reviewer]
Spec reviewer: ✅ Spec compliant - all requirements met, nothing extra

[Get git SHAs, dispatch code quality reviewer]
Code reviewer: Strengths: Good test coverage, clean. Issues: None. Approved.

[Mark Task 1 complete]

Task 2: Recovery modes

[Get Task 2 text and context (already extracted)]
[Dispatch implementation subagent with full task text + context]

Implementer: [No questions, proceeds]
Implementer:
  - Added verify/repair modes
  - 8/8 tests passing
  - Self-review: All good
  - Committed

[Dispatch spec compliance reviewer]
Spec reviewer: ❌ Issues:
  - Missing: Progress reporting (spec says "report every 100 items")
  - Extra: Added --json flag (not requested)

[Implementer fixes issues]
Implementer: Removed --json flag, added progress reporting

[Spec reviewer reviews again]
Spec reviewer: ✅ Spec compliant now

[Dispatch code quality reviewer]
Code reviewer: Strengths: Solid. Issues (Important): Magic number (100)

[Implementer fixes]
Implementer: Extracted PROGRESS_INTERVAL constant

[Code reviewer reviews again]
Code reviewer: ✅ Approved

[Mark Task 2 complete]

...

[After all tasks]
[Dispatch final code-reviewer]
Final reviewer: All requirements met, ready to merge

Done!
```

## Advantages

**vs. Manual execution:**
- Subagents follow TDD naturally
- Fresh context per task (no confusion)
- Parallel-safe (subagents don't interfere)
- Subagent can ask questions (before AND during work)

**vs. Executing Plans:**
- Same session (no handoff)
- Continuous progress (no waiting)
- Review checkpoints automatic

**Efficiency gains:**
- No file reading overhead (controller provides full text)
- Controller curates exactly what context is needed
- Subagent gets complete information upfront
- Questions surfaced before work begins (not after)

**Quality gates:**
- Self-review catches issues before handoff
- Two-stage review: spec compliance, then code quality
- Review loops ensure fixes actually work
- Spec compliance prevents over/under-building
- Code quality ensures implementation is well-built

**Cost:**
- More subagent invocations (implementer + 2 reviewers per task)
- Controller does more prep work (extracting all tasks upfront)
- Review loops add iterations
- But catches issues early (cheaper than debugging later)

## Red Flags

**Never:**
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Skip scene-setting context (subagent needs to understand where task fits)
- Ignore subagent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance (spec reviewer found issues = not done)
- Skip review loops (reviewer found issues = implementer fixes = review again)
- Let implementer self-review replace actual review (both are needed)
- **Start code quality review before spec compliance is ✅** (wrong order)
- Move to next task while either review has open issues

**If subagent asks questions:**
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**
- Implementer (same subagent) fixes them
- Reviewer reviews again
- Repeat until approved
- Don't skip the re-review

**If subagent fails task:**
- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - Ensures isolated workspace (creates one or verifies existing)
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:requesting-code-review** - Code review template for reviewer subagents
- **superpowers:finishing-a-development-branch** - Complete development after all tasks

**Subagents should use:**
- **alloy-tdd** - Subagents follow TDD for each task

**Alternative workflow:**
- **superpowers:executing-plans** - Use for parallel session instead of same-session execution

## Section 2: implementer prompt (verbatim)

_Source: obra/superpowers v5.1.0 skills/subagent-driven-development/implementer-prompt.md (MIT); local backup universal/skills/alloy-execute/references/implementer-prompt.md_

# Implementer Subagent Prompt Template

Use this template when dispatching an implementer subagent.

```
Task tool (general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing Task N: [task name]

    ## Task Description

    [FULL TEXT of task from plan - paste it here, don't make subagent read file]

    ## Context

    [Scene-setting: where this fits, dependencies, architectural context]

    ## Before You Begin

    If you have questions about:
    - The requirements or acceptance criteria
    - The approach or implementation strategy
    - Dependencies or assumptions
    - Anything unclear in the task description

    **Ask them now.** Raise any concerns before starting work.

    ## Your Job

    Once you're clear on requirements:
    1. Implement exactly what the task specifies
    2. Write tests (following TDD if task says to)
    3. Verify implementation works
    4. Commit your work
    5. Self-review (see below)
    6. Report back

    Work from: [directory]

    **While you work:** If you encounter something unexpected or unclear, **ask questions**.
    It's always OK to pause and clarify. Don't guess or make assumptions.

    ## Code Organization

    You reason best about code you can hold in context at once, and your edits are more
    reliable when files are focused. Keep this in mind:
    - Follow the file structure defined in the plan
    - Each file should have one clear responsibility with a well-defined interface
    - If a file you're creating is growing beyond the plan's intent, stop and report
      it as DONE_WITH_CONCERNS — don't split files on your own without plan guidance
    - If an existing file you're modifying is already large or tangled, work carefully
      and note it as a concern in your report
    - In existing codebases, follow established patterns. Improve code you're touching
      the way a good developer would, but don't restructure things outside your task.

    ## When You're in Over Your Head

    It is always OK to stop and say "this is too hard for me." Bad work is worse than
    no work. You will not be penalized for escalating.

    **STOP and escalate when:**
    - The task requires architectural decisions with multiple valid approaches
    - You need to understand code beyond what was provided and can't find clarity
    - You feel uncertain about whether your approach is correct
    - The task involves restructuring existing code in ways the plan didn't anticipate
    - You've been reading file after file trying to understand the system without progress

    **How to escalate:** Report back with status BLOCKED or NEEDS_CONTEXT. Describe
    specifically what you're stuck on, what you've tried, and what kind of help you need.
    The controller can provide more context, re-dispatch with a more capable model,
    or break the task into smaller pieces.

    ## Before Reporting Back: Self-Review

    Review your work with fresh eyes. Ask yourself:

    **Completeness:**
    - Did I fully implement everything in the spec?
    - Did I miss any requirements?
    - Are there edge cases I didn't handle?

    **Quality:**
    - Is this my best work?
    - Are names clear and accurate (match what things do, not how they work)?
    - Is the code clean and maintainable?

    **Discipline:**
    - Did I avoid overbuilding (YAGNI)?
    - Did I only build what was requested?
    - Did I follow existing patterns in the codebase?

    **Testing:**
    - Do tests actually verify behavior (not just mock behavior)?
    - Did I follow TDD if required?
    - Are tests comprehensive?

    If you find issues during self-review, fix them now before reporting.

    ## Report Format

    When done, report:
    - **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - What you implemented (or what you attempted, if blocked)
    - What you tested and test results
    - Files changed
    - Self-review findings (if any)
    - Any issues or concerns

    Use DONE_WITH_CONCERNS if you completed the work but have doubts about correctness.
    Use BLOCKED if you cannot complete the task. Use NEEDS_CONTEXT if you need
    information that wasn't provided. Never silently produce work you're unsure about.
```

## Section 3: spec reviewer prompt (verbatim)

_Source: obra/superpowers v5.1.0 skills/subagent-driven-development/spec-reviewer-prompt.md (MIT); local backup universal/skills/alloy-execute/references/spec-reviewer-prompt.md_

# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less)

```
Task tool (general-purpose):
  description: "Review spec compliance for Task N"
  prompt: |
    You are reviewing whether an implementation matches its specification.

    ## What Was Requested

    [FULL TEXT of task requirements]

    ## What Implementer Claims They Built

    [From implementer's report]

    ## CRITICAL: Do Not Trust the Report

    The implementer finished suspiciously quickly. Their report may be incomplete,
    inaccurate, or optimistic. You MUST verify everything independently.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about completeness
    - Accept their interpretation of requirements

    **DO:**
    - Read the actual code they wrote
    - Compare actual implementation to requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they didn't mention

    ## Your Job

    Read the implementation code and verify:

    **Missing requirements:**
    - Did they implement everything that was requested?
    - Are there requirements they skipped or missed?
    - Did they claim something works but didn't actually implement it?

    **Extra/unneeded work:**
    - Did they build things that weren't requested?
    - Did they over-engineer or add unnecessary features?
    - Did they add "nice to haves" that weren't in spec?

    **Misunderstandings:**
    - Did they interpret requirements differently than intended?
    - Did they solve the wrong problem?
    - Did they implement the right feature but wrong way?

    **Verify by reading code, not by trusting report.**

    Report:
    - ✅ Spec compliant (if everything matches after code inspection)
    - ❌ Issues found: [list specifically what's missing or extra, with file:line references]
```

## Section 4: code quality reviewer prompt (verbatim)

_Source: obra/superpowers v5.1.0 skills/subagent-driven-development/code-quality-reviewer-prompt.md (MIT); local backup universal/skills/alloy-execute/references/code-quality-reviewer-prompt.md_

# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Task tool (general-purpose):
  Use template at requesting-code-review/code-reviewer.md

  DESCRIPTION: [task summary, from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment

## Alloy Integration Layer

_Source: Current Alloy alloy-execute/SKILL.md body before Task 7, MIT._

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

## Attribution

- obra/superpowers v5.1.0 `skills/subagent-driven-development/SKILL.md` and reviewer prompts — MIT; inlined, with retired entrypoint names normalized to Alloy names where needed.
- Alloy current `alloy-execute` integration layer — MIT / first-party Alloy.

See `/CREDITS.md` at repo root for the full attribution chain.
