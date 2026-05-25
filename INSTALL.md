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
- does not show GSD runtime, GSD commands, OMO Slim config, or OMO plugin entries

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
bash setup.sh --pack all --target local
```

`--profile` remains as a deprecated alias for `--pack` during migration.

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

## 7. Removed Runtime Paths

Alloy v2 does not expose GSD or OMO Slim install switches. Old migration flags now fail fast instead of installing either runtime.

The GSD/OMO ideas are now represented by Alloy-native agents, skills, model-role maps, Markdown policies, JSONL state, and gate checks.

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
- no OMO Slim plugin
- no GSD command/runtime paths

If plugin dependencies are not installed yet, doctor prints the exact command:

```bash
cd .opencode && bun install
```

OpenCode may also run Bun install automatically at startup.

## 9. Troubleshooting

### MCP Access

Alloy keeps MCP usage small: `context7`, `grep_app`, and `exa`. GitHub, Azure, and Postgres workflows should use `gh`, `az devops`, and `psql` instead of project-specific MCP servers.
