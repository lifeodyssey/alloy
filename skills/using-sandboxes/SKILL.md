---
name: using-sandboxes
description: Use when a task benefits from Container Use isolation, especially risky dependency installs, large refactors, or unfamiliar test commands.
---

# Using Sandboxes

Container Use gives Alloy agents an opt-in Docker/Dagger-backed workspace for work that should not run directly on the host checkout.

Use a sandbox when:
- Installing unfamiliar dependencies or running untrusted project scripts.
- Making a broad refactor where parallel isolation reduces collision risk.
- Reproducing a bug that may create noisy local artifacts.
- Trying destructive commands that should be reviewed before host application.

Do not use a sandbox when:
- The task is a small read-only inspection.
- A single-file edit can be verified with normal local tests.
- The setup overhead would exceed the risk of running in the host worktree.

When Container Use MCP tools are available, prefer this loop:

1. Create or open an environment for the current repo.
2. Run commands inside the environment until the change is verified.
3. Summarize the changed files and verification evidence.
4. Apply or merge the sandbox changes back to the host repo with `cu apply` or `cu merge`.

If the Container Use MCP is unavailable after `alloy add container-use`, stop and surface the missing runtime or MCP problem. Do not silently fall back to risky host execution for commands that needed isolation.
