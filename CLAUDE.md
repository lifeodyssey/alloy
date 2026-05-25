# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This repo is **OpenCode Alloy v2** (npm name `opencode-alloy`, branded `opencode-team-config` for the legacy repo slug). It is **not an application** — it is a distribution/control layer that resolves "packs" of OpenCode agents, skills, commands, MCPs, and model-role maps, then materializes them into a target repo's `.opencode/` (runtime) and `.alloy/` (workflow state).

OpenCode is the runtime (agent host, tool host, MCP host, plugin host). Alloy is the resolver, installer, state ledger, evidence collector, and gate checker.

## Common Commands

```bash
# Install a pack into the CURRENT repo (most common)
bash setup.sh --pack core --target local --models github-copilot

# Equivalent direct CLI
node bin/alloy.mjs install --pack core --target local --models github-copilot

# Dry run (must print: .alloy/, .opencode/agents, .opencode/skills, .opencode/plugins/alloy.ts; must NOT print npx skills add, bunx oh-my-opencode-slim install, or any GSD/OMO entry)
bash setup.sh --dry-run --pack core --target local

# Doctor (verifies pack resolution, Node/Bun availability, plugin versions, vendor.lock paths, no OMO/GSD residue)
bash setup.sh --doctor --pack core --target local

# Tests (runs Node unit tests for the resolver, then Python e2e driving the CLI as subprocesses)
npm test
# Just the fast Node unit tests
npm run test:unit
# Just the Python e2e tests
npm run test:e2e
# Single Python e2e test
python3 -m unittest scripts.test_alloy_installer.AlloyInstallerTest.test_core_dry_run_is_offline_project_local_and_bun_enabled
python3 -m unittest scripts.test_audit_prompt_dependencies

# Syntax check for the CLI
npm run check   # node --check bin/alloy.mjs

# Audit prompt-referenced dependencies against installable inventory
python3 scripts/audit_prompt_dependencies.py
```

Runtime requirements: Node 20+, Bun 1.1+ (Bun is needed for OpenCode's local plugin dependency path; the installer pins plugin dependencies declared in `defaults.json` into the target `.opencode/package.json`).

## Architecture

### Resolver pipeline

```
defaults.json  +  packs/*.json  +  models/*.json  +  .alloy/alloy.project.json
       │
       ▼
bin/alloy.mjs  (resolveConfig)
       │
       ├─► .opencode/                .alloy/
       │     agents/                   alloy.project.json
       │     skills/                   workflow.md
       │     commands/                 policies/{claims,tdd,review,debug}.md
       │     plugins/alloy.ts          state/{tasks,claims,evidence,runs}.jsonl
       │     opencode.json             projections/{status,current-plan}.md
       │     package.json
       │
       └── (the Bun plugin writes back into .alloy/state/*.jsonl at runtime)
```

`bin/alloy.mjs` is the single CLI entry. Subcommands: `init`, `resolve`, `install` (default), `doctor`, `state {add-task|add-evidence|add-claim|list ...}`, `gate check`, `sync`. The flow:

1. `loadPack(id)` reads `packs/<id>.json` (with `PACK_ALIASES` mapping `default`/`team`/`profile` → `core`).
2. `mergePack` unions skills/agents/commands/mcp/modelRoles when a project's `packs` array lists multiple ids.
3. `resolveConfig` combines the pack with `models/<name>.json` (role → model assignments) and the project's `.alloy/alloy.project.json` overrides.
4. The installer copies repo-local `agents/`, `skills/`, `commands/`, and `templates/opencode/alloy-plugin.ts` into the target `.opencode/`, generates `opencode.json` + `package.json`, and seeds `.alloy/` from `templates/alloy/`.
5. `MANAGED_NAMES` defines what the installer owns inside `.opencode/`; anything else is left untouched.

### Packs (declarative inventory)

`packs/*.json` declare what to install. Every pack lists the same 6 agents and 7 commands; what varies is `skills` and `mcp`:

| Pack | Adds beyond core skills |
|---|---|
| `core` | base 5 skills only (`alloy-tdd`, `alloy-brainstorm`, `alloy-debug`, `git-master`, `humanizer`) |
| `frontend` | + `frontend-ui-ux`, `playwright-cli`, `vercel-react-best-practices` |
| `backend` | + `kotlin-backend-jpa-entity-mapping`, `postgres`, `design-postgres-tables`, `pgvector-semantic-search` |
| `infra` | + `terraform-skill` |
| `all` | every first-party + vendored third-party skill |

MCP baseline is always `context7`, `grep_app`, `exa`. GitHub/Azure/Postgres use CLI replacements (`gh`, `az devops`, `psql`) — do NOT add project-specific MCP servers.

### Source-of-truth split

- **Repo-level sources** (what Alloy ships): `agents/*.md`, `skills/*/SKILL.md`, `commands/*.md`, `packs/*.json`, `models/*.json`, `templates/`, `vendor/`.
- **Installed-into-target outputs**: `.opencode/` (machine-readable for OpenCode) and `.alloy/` (workflow state + Markdown policies).
- Inside `.alloy/`: **JSONL files are source of truth**, Markdown in `policies/` is human/agent-readable policy, Markdown in `projections/` is generated from JSONL.

### Vendor policy

`vendor/skills/` holds licensed third-party skill content (Superpowers, Vercel, Kotlin, Timescale, Terraform). `vendor.lock.json` records `{name, kind, source, version, license, sha256, paths}` for every vendored item. Doctor verifies these paths exist. `third_party_notices/` carries license text.

## Hard Rules

These constraints are enforced by code and tests. Violating them will fail `npm test`, `bash setup.sh --doctor`, or `audit_prompt_dependencies.py`.

- **No `npx skills add`**. Skills are installed by copying from `skills/` or `vendor/skills/` into the target `.opencode/skills/`.
- **No OMO Slim and no GSD runtime/commands**. The `--with`/`--without` flags are removed and now throw. `DEPRECATED_AGENTS = ["orchestrator_append", "librarian_append", "code-reviewer", "plan-reviewer", "executor"]` and `DEPRECATED_SKILLS = ["team-tdd", "frontend-tdd", "backend-tdd", "tdd"]` must not appear in prompts or packs.
- **No global writes by default**. `--target local` (current repo `.opencode/`) is the default; `--target global` writes to `~/.config/opencode/` and should be used explicitly.
- **MCP baseline is fixed** to `context7`, `grep_app`, `exa`. Do not introduce GitHub/Azure/Postgres MCP servers — use the CLI replacements.
- **Plugin dependency versions and MCP URLs are pinned in `defaults.json`** (single source of truth). `bin/alloy.mjs` reads `DEFAULTS.plugin` and `DEFAULTS.mcp` at startup. Doctor's `validateRootOpencodeConfig` fails if root `opencode.json` MCP URLs drift from `defaults.json`. When bumping plugin versions, edit only `defaults.json` and re-run doctor.
- **`--profile` is a deprecated alias** for `--pack` and must keep working during migration.
- **Prompt → installable consistency**: every skill/agent/MCP/CLI referenced in `agents/*.md`, `commands/*.md`, `README.md`, or `INSTALL.md` must be installable by some pack or be a real system CLI. `scripts/audit_prompt_dependencies.py` is the gate; it is wired into `setup.sh`'s flow and tested by `scripts/test_audit_prompt_dependencies.py`.

## Testing Model

Two complementary layers:

1. **Node unit tests** (`scripts/test_resolver.mjs`, run via `node --test`) cover pure resolver functions exported from `bin/alloy.mjs`: `parseArgs`, `loadPack`, `mergePack`, `defaultProjectConfig`, `detectMcpConflicts`, plus a `defaults.json` shape check and a "every pack's MCPs exist in defaults.json" invariant. Fast (~80ms), no subprocess.

2. **Python e2e tests** (`scripts/test_alloy_installer.py`, run via `python3 -m unittest`) drive `setup.sh` and `bin/alloy.mjs` as subprocesses inside `tempfile.TemporaryDirectory()` and assert on:
   - stdout fragments (dry-run output must mention specific paths and must NOT mention removed runtimes),
   - file presence under `.opencode/` and `.alloy/`,
   - JSON shape of `opencode.json`, `.opencode/package.json`, and resolved configs.

`bin/alloy.mjs` is both a CLI and an importable module: it gates `await main()` behind an entry-point check so `node --test` can import its exports without firing the CLI.

When changing pack content, plugin versions, MCP baseline, or installer behavior, update `defaults.json` or `packs/*.json` first, then the matching assertions in `scripts/test_resolver.mjs` (for resolver-shape changes) and `scripts/test_alloy_installer.py` (for installer-output changes).

## Project Conventions

- Keep agents (`agents/*.md`) and commands (`commands/*.md`) as the single source of OpenCode prompts — the installer copies them verbatim.
- New skills go under `skills/<name>/SKILL.md`. Vendored skills go under `vendor/skills/<source>/<version>/<name>/` and get registered in `vendor.lock.json`.
- When adding a skill/agent/command, also add it to the appropriate `packs/*.json` — otherwise it will not be installed into any target repo.
- `templates/AGENTS.md` is the per-target-repo `AGENTS.md` template (different from this `CLAUDE.md`); customize it after `setup.sh` runs.
