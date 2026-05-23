---
description: Plan and perform a safe refactor with codebase awareness
agent: alloy-orchestrator
---

# /refactor

Usage:

`/refactor <target> [--scope=file|module|project] [--strategy=safe|aggressive]`

## Workflow

1. Clarify the target, desired outcome, scope, and risk tolerance.
2. If the request is open-ended, ask for the specific improvement before touching code.
3. Search definitions and references with `rg`, LSP, and `sg` when available.
4. Map affected files, tests, public interfaces, and likely regression paths.
5. For small refactors, invoke `alloy-tdd` and make one behavior-preserving change at a time.
6. For broad refactors, run `/gsd-plan-phase` first, then `/gsd-execute-phase`.
7. Run focused tests after each meaningful step.
8. Run `/gsd-code-review` for GSD work or `@alloy-reviewer` for small non-GSD work.
9. Run `/gsd-verify-work` or equivalent final verification.

## Safety

- Do not change public interfaces without reference search and explicit rationale.
- Do not mix refactoring with new behavior unless the user asks.
- Do not use OMO-only tool APIs.
- Use `gh`, `az devops`, and `psql` instead of removed MCPs.
