---
name: alloy-tdd
description: Use before implementing new behavior or behavior-sensitive changes. Enforces red-green-refactor and records gate proof in progress.md.
---

# Alloy TDD

Use this skill whenever a change can affect behavior, contracts, generated output, install behavior, command routing, or user-visible documentation semantics.

## Iron Rule

No implementation claim without fresh verification proof from this session.

## Acceptable RED Proof

Prefer an automated failing test. When a traditional test is not practical, use the strongest equivalent guard:

- installer dry-run
- manifest snapshot
- markdown contract test
- CLI output assertion
- grep guard for stale references
- schema check
- typecheck or syntax check that fails for the intended reason

Record why the guard is acceptable.

## Loop

1. Read `plan.md` and identify the acceptance criterion under work.
2. Write or update the smallest failing test/guard.
3. Run the focused command and capture the expected failure.
4. Update `progress.md` with the RED command, failure summary, and file path.
5. Implement the smallest change.
6. Run the focused command again and capture GREEN.
7. Refactor only if it reduces real complexity and stays in scope.
8. Run broader verification when the task touches shared behavior.

## Progress Updates

Use:

```markdown
## Gate
- [x] tdd_red - <timestamp> | <command> failed as expected
- [x] green - <timestamp> | <command> passed

## Findings
- RED proof:
- GREEN proof:
- Files:
```

Do not check `verified` here unless the full task verification command also passed.

## Anti-Patterns

- Writing implementation before RED.
- Changing tests to match a bug.
- Treating a stale command result from an earlier session as proof.
- Skipping tests because the change is "just prompt/docs" when the artifact is runtime behavior.

## Final Output

Report acceptance criterion, RED command/result, GREEN command/result, files changed, and any remaining verification needed.

## Deep References (bundled upstream)

This skill is a lean alloy-specific overview. When you need the full TDD philosophy, read these files bundled next to this SKILL.md (they ship with the skill):

- `references/tests.md` — integration-style testing; what to test vs. what not to
- `references/mocking.md` — mock only at system boundaries, never your own classes
- `references/deep-modules.md` — small interface, deep implementation
- `references/interface-design.md` — designing clean interfaces
- `references/refactoring.md` — refactoring discipline

Sources (fusionType `inline-append`): obra/superpowers v5.1.0 `test-driven-development` + mattpocock/skills `engineering/tdd`. Verbatim upstream copies also live under `vendor/skills/superpowers/5.1.0/test-driven-development/` in the Alloy source repo.
