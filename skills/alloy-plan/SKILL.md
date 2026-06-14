---
name: alloy-plan
description: Use when turning context or a clear user request into an implementation-ready plan with acceptance criteria, files, commands, gates, risks, and handoff.
---

# Alloy Plan

Planner uses this skill to write the Builder handoff contract. Do not implement code while using this skill.

## Entry Conditions

- User request is understood, or `.alloy/tasks/<id>/context.md` exists.
- Planner has inspected relevant source files, generated targets, tests, docs, and package scripts.
- Any broad source scan has been done by Planner or a one-shot Explorer subagent.

## Artifact

Write:

```text
.alloy/tasks/<task-id>/plan.md
```

The file must start with:

```markdown
---
id: <task-id>
approved: false
---
```

If the user approves in chat, update the frontmatter or add a progress handoff note before `/execute`.

## Required Plan Sections

```markdown
# <task-id>: Plan

## Goal

## Non-Goals

## Acceptance Criteria
- AC-1:
- AC-2:

## Source Reality
- Files inspected:
- Existing conventions:
- Generated/runtime contracts:
- Tests or scripts available:

## File Scope
- Create:
- Modify:
- Delete:
- Avoid:

## Implementation Tasks
1. Task:
   - Files:
   - Test first:
   - Expected gate update:
2. Task:

## Verification Commands
- Command:
  - Purpose:
  - Expected result:

## Progress Gates
```markdown
## Gate
- [ ] tdd_red
- [ ] green
- [ ] review
- [ ] verified
```

## Risks And Rollback
- Risk:
  - Mitigation:
  - Rollback:

## Counterexamples
- Should not change:
- Should fail when:

## Subagent Handoff
- Explorer:
- Fixer:
- Reviewer:
- Tester:

## Builder Handoff
- Start here:
- First command:
- Stop conditions:
```

## Output Density

Do not write vague tasks like "update docs" or "fix tests". Include exact paths, exact commands, and what each command proves.

## Subagent Policy

Use one-shot Explorer only when the plan needs broad source discovery. The handoff must include the exact question, search scope, and expected output. Do not install or reference persistent subagent files.

## Final Chat Output

Return:

- task id
- plan path
- acceptance criteria count
- files in scope
- required verification commands
- unresolved risks
- next command: `Review the plan, set approved: true, then run /execute.`

## Upstream (fusionType `inline-append`)

This skill distills obra/superpowers v5.1.0 `brainstorming` + `writing-plans`. The verbatim upstream copies live under `vendor/skills/superpowers/5.1.0/` in the Alloy source repo; read them for the full brainstorming dialogue discipline and plan-writing depth when a plan is large or high-risk.
