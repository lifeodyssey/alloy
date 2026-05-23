---
name: alloy-tdd
description: OpenCode Alloy's single TDD entrypoint. Invoke before any implementation or bugfix.
---

# Alloy TDD

No production code without a failing test first.

If code was written before the test, delete that code and restart from the test. Do not keep it as reference.

## Universal Loop

Repeat one externally visible behavior at a time:

1. RED: write one focused test.
2. Verify RED: run the smallest relevant test command and confirm it fails for the expected reason.
3. GREEN: write the smallest implementation that passes that test.
4. Verify GREEN: run the same test and confirm it passes.
5. REFACTOR: simplify names, boundaries, and duplication while tests stay green.
6. Broaden verification only after the focused loop passes.

## Test Design

- Test public behavior, not private implementation.
- Prefer real code over mocks.
- Mock only external boundaries such as network, database, filesystem, clocks, or provider APIs.
- Test names describe behavior and condition.
- One test should fail for one reason.
- Use existing project helpers and factories before creating new ones.
- Regression fixes include a test that fails before the fix.

## Implementation Rules

- Keep changes scoped to the requested behavior.
- Reuse existing abstractions after searching for them.
- Avoid speculative options, flags, settings, or future-proofing.
- Prefer early returns over nested conditionals.
- Keep functions small and focused.
- Stage explicit files only when committing.

## Stack Companions

These are optional companion skills, not TDD replacements:

- React/Next: `vercel-react-best-practices`.
- Kotlin/JPA: `kotlin-backend-jpa-entity-mapping`.
- Terraform/OpenTofu: `terraform-skill`.
- Postgres/SQL: `postgres`, `design-postgres-tables`, `pgvector-semantic-search`.

If a companion skill is missing, continue with project conventions and mention the missing optional skill in the final report.

## Evidence To Report

For every implementation, report:

- The RED command and expected failure.
- The GREEN command and passing result.
- Any broader verification.
- Any unavailable optional companion skill.
