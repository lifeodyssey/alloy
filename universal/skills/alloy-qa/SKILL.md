name: alloy-qa
description: Use for product or UI QA, regression checks, generated artifact inspection, and release confidence reporting.

# Alloy QA

Use this skill when verification needs more than unit tests: UI flows, install output, generated files, docs/runtime parity, accessibility, or regression risk.

## Inputs

- Task id and approved plan.
- Target URL, command, artifact, or package output.
- Known baseline or expected behavior.
- Required browser/device/environment if relevant.

## Artifact

Write:

```text
.alloy/tasks/<task-id>/qa.md
```

Also summarize important QA results in `progress.md`.

## QA Template

```markdown
# <task-id>: QA

## Scope
- Included:
- Excluded:

## Environment
- Command/URL:
- Browser/device:
- Data/fixtures:

## Checks
| Area | Check | Result | Proof | Severity |
| --- | --- | --- | --- | --- |

## Regressions
- Before:
- After:

## Accessibility Or UX Notes

## Release Recommendation
- Ship / Ship with concerns / Block
```

## Tiers

- quick: smoke checks for the changed surface.
- standard: smoke plus main regression paths.
- exhaustive: standard plus edge cases, accessibility, visual inspection, and generated artifacts.

## Rules

- Do not mark `verified` only from QA impressions; tie it to commands or inspectable artifacts.
- Include exact screenshots, URLs, files, or command outputs when relevant.
- Record blockers in `progress.md`.

## Final Output

Report tier, checks run, failures, fixed issues, remaining risks, and release recommendation.
