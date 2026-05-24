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
6. For broad refactors, create an Alloy task and plan, then execute one bounded card at a time.
7. Run focused tests after each meaningful step.
8. Run `@alloy-reviewer` for evidence-based review.
9. Run `@alloy-verifier` and `alloy gate check` before final reporting.

## Safety

- Do not change public interfaces without reference search and explicit rationale.
- Do not mix refactoring with new behavior unless the user asks.
- Do not use OMO-only tool APIs.
- Use `gh`, `az devops`, and `psql` instead of removed MCPs.
