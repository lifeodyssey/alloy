---
description: DEPRECATED v0.1.0 — use /plan /execute /verify instead. Generate or refresh hierarchical AGENTS.md project instructions
---

# /init-deep

Use this to create a concise project knowledge base for agents.

## Workflow

1. Read the root `AGENTS.md`, `README`, build files, test configs, and package manifests.
2. Map the project structure with `find`, `rg --files`, language tooling, and `sg` when useful.
3. Identify directories that need local instructions because they have distinct conventions.
4. For each selected directory, write or update `AGENTS.md` with:
   - purpose of the directory
   - important entry points
   - testing commands
   - local conventions
   - forbidden patterns
5. Keep files short and factual.
6. Review for duplication and contradictions.

## Rules

- Preserve existing project-specific instructions unless they are stale and clearly contradicted by the repository.
- Do not include secrets.
- Do not create deep instruction files for tiny or conventional directories.
- Use `alloy-tdd` language for implementation guidance.
