# OpenCode Alloy Install Runbook

## 1. Preflight

```bash
which opencode
which node
which bun
which gh || true
which az || true
which psql || true
opencode --version
node --version
bun --version
```

Required by default:

- `opencode`
- Node.js 20+
- Bun 1.1+

Bun is used for OpenCode's local plugin dependency path. Alloy generates `.opencode/package.json` with pinned plugin dependencies.

Optional CLI replacements:

- `gh` for GitHub
- `az devops` for Azure Boards
- `psql` for Postgres

## 2. Dry Run

```bash
bash setup.sh --dry-run --pack core --target local --models github-copilot
```

Expected:

- prints `OpenCode Alloy Setup`
- shows `.alloy/`, `.opencode/agents`, `.opencode/skills`, `.opencode/plugins/alloy.ts`, and `.opencode/opencode.json`
- does not print `npx skills add`
- does not print `bunx oh-my-opencode-slim install`

For legacy GSD:

```bash
bash setup.sh --dry-run --pack workflow-gsd --target local --models github-copilot
```

Expected:

- shows `Copy vendored GSD snapshot gsd-opencode@1.38.5`
- shows `Apply overlays/gsd`
- shows GSD commands under `.opencode/commands/gsd`

## 3. Install

```bash
bash setup.sh --pack core --target local --models github-copilot
```

The installer writes only to the selected target:

- local: current repo `.opencode/`
- global: `~/.config/opencode/`

Local is the default because Alloy is designed for multi-repo separation.

## 4. Pack Installs

```bash
bash setup.sh --pack frontend --target local
bash setup.sh --pack backend --target local
bash setup.sh --pack infra --target local
bash setup.sh --pack workflow --target local
bash setup.sh --pack workflow-gsd --target local
bash setup.sh --pack all --target local
```

`--profile` remains as a deprecated alias for `--pack` during migration.

Use `--with gsd` to add the legacy GSD snapshot to another pack:

```bash
bash setup.sh --pack core --target local --with gsd
```

## 5. Alloy State and Gates

```bash
node bin/alloy.mjs state add-task --title "Implement feature" --kind code
node bin/alloy.mjs state add-evidence --task-id <id> --kind tdd_red --summary "Failing test added"
node bin/alloy.mjs state add-evidence --task-id <id> --kind tdd_green --summary "Test passes"
node bin/alloy.mjs state add-evidence --task-id <id> --kind test --summary "npm test passed"
node bin/alloy.mjs gate check --task-id <id> --json
```

The source of truth lives in `.alloy/state/*.jsonl`. Markdown projections under `.alloy/projections/` are generated for people and agents to read.

## 6. Multi-repo Sync

Create `alloy.workspace.json`:

```json
{
  "projects": [
    { "path": "../web", "config": ".alloy/alloy.project.json" },
    { "path": "../api", "config": ".alloy/alloy.project.json" },
    { "path": "../infra", "config": ".alloy/alloy.project.json" }
  ]
}
```

Run:

```bash
node bin/alloy.mjs sync --workspace alloy.workspace.json --dry-run
```

Sync installs project-local `.opencode/` configs and does not write global OpenCode config by default.

## 7. Experimental OMO Slim

```bash
bash setup.sh --pack core --target local --with omo
```

This only copies `experimental/omo-slim/oh-my-opencode-slim.json` and adds the pinned plugin entry. It does not run the upstream OMO installer.

## 8. Doctor

```bash
bash setup.sh --doctor --pack core --target local
```

Doctor checks:

- pack references resolve to repo or vendor files
- Node and Bun are available
- `.opencode/package.json` and `.opencode/plugins/alloy.ts` exist
- installed plugin dependency versions match Alloy's pinned versions when dependencies are present
- `vendor.lock.json` references existing vendored paths
- no default OMO Slim plugin unless requested

If plugin dependencies are not installed yet, doctor prints the exact command:

```bash
cd .opencode && bun install
```

OpenCode may also run Bun install automatically at startup.

## 9. Troubleshooting

### GSD Query Shim

Alloy vendors GSD `dist` and `get-shit-done`, not the upstream SDK `node_modules` tree. The generated `.opencode/bin/gsd-sdk` supports `gsd-sdk query ...` through an Alloy shim. GSD `run`, `init`, and `auto` are intentionally not the default path; use the vendored `/gsd-*` OpenCode commands only in the `workflow-gsd` legacy pack or explicit `--with gsd` installs.

### MCP Access

Alloy keeps MCP usage small: `context7`, `grep_app`, and `exa`. GitHub, Azure, and Postgres workflows should use `gh`, `az devops`, and `psql` instead of project-specific MCP servers.
