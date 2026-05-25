---
name: alloy-plan
description: Use when you have a spec (from alloy-brainstorm or alloy-discuss) and need to turn it into a bite-sized implementation plan with TDD steps and exact file paths.
---

# Alloy Plan

## Overview

Turn a spec into a comprehensive implementation plan assuming the engineer has zero context for our codebase and questionable taste. Document everything they need: which files to touch, code, testing, docs to check, how to test. Give them the whole plan as bite-sized tasks. **DRY. YAGNI. TDD. Frequent commits.**

Assume the engineer is skilled but knows almost nothing about our toolset or problem domain. Assume they don't know good test design well.

**Announce at start:** "Using `alloy-plan` to create the implementation plan."

**Save plans to:** `.alloy/specs/YYYY-MM-DD-<feature-name>/task_plan.md` — append the `## Plan` section to the spec written by `alloy-brainstorm`.

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking it into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure (decompose first)

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file has one clear responsibility.
- You reason best about code you can hold in context at once. Edits are more reliable when files are focused. Prefer smaller, focused files.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If a codebase uses large files, don't unilaterally restructure — but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2–5 minutes):**
- "Write the failing test" — step
- "Run it to make sure it fails" — step
- "Implement the minimal code to make the test pass" — step
- "Run the tests and make sure they pass" — step
- "Commit" — step

## Plan Document Structure

The `## Plan` section is appended to `.alloy/specs/<id>/task_plan.md` after the `## Spec` section. **Every plan MUST start with this header:**

```markdown
## Plan

**For agentic workers:** REQUIRED SUB-SKILL — invoke `alloy-execute` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2–3 sentences about approach]

**Tech Stack:** [Key technologies / libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:

- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember

- **Exact file paths always.** No "the controller file" — `src/controllers/user.controller.ts`.
- **Complete code in every step** — if a step changes code, show the code.
- **Exact commands with expected output.**
- **DRY, YAGNI, TDD, frequent commits.**

## Source Coverage Audit (from GSD)

After writing the plan, verify every item from the `## Spec` section maps to at least one task:

For each acceptance criterion in spec:
- [ ] Find the task(s) that implement it
- [ ] If none → add a task or flag as gap

For each "out of scope" item:
- [ ] Confirm no task implements it (otherwise scope creep)

**Vocabulary blocklist** — flag any task that says:
- "v1", "v2", "simplified version", "static for now", "placeholder", "stub"

If you find these, replace with concrete implementation OR justify in `findings.md` why this scope reduction is acceptable.

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

1. **Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

2. **Placeholder scan:** Search your plan for red flags — any of the patterns from "No Placeholders" above. Fix them.

3. **Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Stack-Specific Guidance

Before finalizing, dispatch to stack skills to validate task design:
- React/Next: `vercel-react-best-practices`, `next-best-practices`
- Kotlin/Spring: `kotlin-backend-jpa-entity-mapping`, `sivalabs/spring-boot`
- PostgreSQL/jOOQ: `postgres`, `jooq-best-practices`
- Terraform: `terraform-skill`, `hashicorp/terraform-style-guide`
- AWS: `aws-agent-skills/{ecs,lambda,iam,secrets,cloudwatch,rds,s3}` as relevant

If a companion has a relevant constraint (e.g., "Next.js: don't put Server Component imports inside `'use client'` files"), embed it as a sub-step in the relevant task.

## Execution Handoff

After saving the plan and self-review, hand off to `alloy-execute`:

> "Plan complete and saved to `.alloy/specs/<id>/task_plan.md`. Hand off to `alloy-execute` to implement task-by-task. Use `--risk low|med|high` if running via `alloy-autopilot` for unattended execution."

**Do NOT invoke `alloy-tdd` directly from here** — `alloy-execute` invokes it per task. **Do NOT skip ahead to writing code.**

## Evidence

```
alloy_evidence { kind: "plan_done", taskId, summary: "Plan written with N tasks; spec coverage audit passed" }
```

`alloy gate check` for `code` tasks requires the `## Plan` section to exist with at least one task before `/execute` can proceed.

## Attribution

Fuses:
- **obra/superpowers** writing-plans — bite-sized step format, no-placeholders rules, task structure template, self-review (MIT)
- **GSD** — source coverage audit, vocabulary blocklist
- **Alloy** — `.alloy/specs/<id>/task_plan.md` artifact convention, stack companion routing, evidence integration, hand-off to alloy-execute
