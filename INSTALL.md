# OpenCode Alloy Install Runbook

## 1. Preflight

```bash
which opencode
which node
which gh || true
which az || true
which psql || true
opencode --version
```

Required for core:

- `opencode`
- Python 3

Required for `workflow-gsd`:

- Node.js for the project-local `gsd-sdk query` shim

Optional CLI replacements:

- `gh` for GitHub
- `az devops` for Azure Boards
- `psql` for Postgres

## 2. Dry Run

```bash
bash setup.sh --dry-run --profile core --target local --models github-copilot
```

Expected:

- prints `OpenCode Alloy Setup`
- shows `.opencode/agents`, `.opencode/skills`, and `.opencode/opencode.json`
- does not print `npx skills add`
- does not print `bunx oh-my-opencode-slim install`

For GSD:

```bash
bash setup.sh --dry-run --profile workflow-gsd --target local --models github-copilot
```

Expected:

- shows `Copy vendored GSD snapshot gsd-opencode@1.38.5`
- shows `Apply overlays/gsd`
- shows GSD commands under `.opencode/commands/gsd`

## 3. Install

```bash
bash setup.sh --profile core --target local --models github-copilot
```

The installer writes only to the selected target:

- local: current repo `.opencode/`
- global: `~/.config/opencode/`

Local is the default because Alloy is designed for multi-repo separation.

## 4. Profile Installs

```bash
bash setup.sh --profile frontend --target local
bash setup.sh --profile backend --target local
bash setup.sh --profile infra --target local
bash setup.sh --profile workflow-gsd --target local
bash setup.sh --profile all --target local
```

Each profile has explicit `skills`, `agents`, `commands`, `mcp`, `includeGsd`, `includeExperimentalOmo`, and `modelRoles` fields.

## 5. Experimental OMO Slim

```bash
bash setup.sh --profile core --target local --with omo
```

This only copies `experimental/omo-slim/oh-my-opencode-slim.json` and adds the pinned plugin entry. It does not install Bun or run the upstream OMO installer. Use it only when the repo explicitly needs OMO Slim and Copilot auth is already configured.

## 6. Doctor

```bash
bash setup.sh --doctor --profile core --target local
```

Doctor checks:

- profile references resolve to repo or vendor files
- model maps contain planner/executor/reviewer/debugger/verifier
- `vendor.lock.json` hashes match vendored paths
- no default OMO Slim plugin unless requested
- no `skills: ["*"]`
- prompt dependency audit passes

## 7. Rollback

```bash
bash setup.sh --rollback latest --target local
```

Or restore a specific backup:

```bash
bash setup.sh --rollback .opencode/backups/YYYYMMDD-HHMMSS --target local
```

## 8. Troubleshooting

### GSD Query Shim

Alloy vendors GSD `dist` and `get-shit-done`, not the upstream SDK `node_modules` tree. The generated `.opencode/bin/gsd-sdk` supports `gsd-sdk query ...` through an Alloy shim. GSD `run`, `init`, and `auto` are intentionally not the default path; use the vendored `/gsd-*` OpenCode commands.

### MCP Access

Alloy keeps MCP usage small: `context7`, `grep_app`, and `exa`. GitHub, Azure, and Postgres workflows should use `gh`, `az devops`, and `psql` instead of project-specific MCP servers.
