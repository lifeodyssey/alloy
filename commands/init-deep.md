---
description: Generate or refresh concise project instructions
agent: alloy-planner
---

# /init-deep

Create or refresh project knowledge files without changing implementation code.

## Workflow

1. Read root `AGENTS.md`, `README`, build files, test configs, package manifests, and existing local instruction files.
2. Map project structure with `rg --files`, language tooling, and `sg` when available.
3. Identify directories that need local instructions.
4. Write or update `AGENTS.md` with entry points, testing conventions, forbidden patterns, and task artifact conventions.
5. Reference Alloy workflow state as `.alloy/tasks/<id>/context.md`, `plan.md`, and `progress.md`.
6. Keep files short, factual, and non-duplicative.

## Rules

- Preserve existing project-specific instructions unless stale.
- Do not include secrets.
- Do not create deep instruction files for tiny or conventional directories.
- Do not write implementation code.
