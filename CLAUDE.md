# CLAUDE.md

## Design Beliefs (6 信条)

These guide every architectural decision in alloy. Encode them when adding new features.

1. **最强约束**: 关键流程靠 code 强制 (transition table / capability isolation / hook block)，**不**靠 prompt 建议
2. **Plugin-first, CLI-minimal**: 用户日常在 chat 里完成所有操作。CLI 只用于 `install` / `doctor` / `completion`
3. **不替用户做选择**: install 时 prompt 让用户选 (像 npx skills)。User overlay (用户手动装的 skill) 默认全 visible
4. **Vendor over rewrite**: 上游 skills 走 inline copy + alloy append，**不重写不删除**
5. **状态外置但极简**: `.alloy/tasks/<id>/` markdown artifacts + gate checkboxes。**不上数据库，不写 JSONL ledger**。
6. **零依赖运行时**: `.mjs` + zod + jsdoc。**没 build step**。Install 即可用

## What Alloy is NOT

- ❌ Not a chat UI (用户在 OpenCode/Claude Code 现有 UI 里工作)
- ❌ Not an LLM agent (alloy 是给 agent 套规则的外壳，不是 agent 本身)
- ❌ Not a SaaS (本地跑，状态在 repo 里)
- ❌ Not a framework (不强迫你重写代码，是配置+集成)

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

This repo is **Alloy** (npm `@lifeodyssey/alloy`, GitHub `lifeodyssey/alloy`). It is **not an application** — it is a distribution/control layer that resolves "packs" of skills, agents, commands, MCPs, and model-role maps, then materializes them into a target repo's runtime-specific layout.

**v0.1.x** supports OpenCode runtime (`.opencode/` + `.alloy/`). Future versions add Claude Code (`.claude/` adapter) and Codex CLI adapters. The resolver core (atoms.json, packs/, extends mechanism) is runtime-neutral.

## Common Commands

```bash
# Install a pack into the CURRENT repo (most common)
bash setup.sh --pack core --target local --models github-copilot

# Equivalent direct CLI
node bin/alloy.mjs install --pack core --target local --models github-copilot

# Dry run (must print: .alloy/, .opencode/agents, .opencode/skills, .opencode/plugins/alloy.ts; must NOT print non-deterministic per-skill install commands, bunx oh-my-opencode-slim install, or any GSD/OMO entry)
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

```text
defaults.json + packs/*.json + models/*.json + .alloy/alloy.project.json
  -> bin/alloy.mjs (resolveConfig/install/doctor/gate)
  -> .opencode/
       agents/{Planner,Builder}.md
       skills/<name>/SKILL.md
       commands/*.md
       plugins/alloy.ts
       opencode.json
       package.json
  -> .alloy/
       alloy.project.json
       workflow.md
       policies/{claims,tdd,review,debug}.md
       .gitignore
       tasks/<task-id>/{context.md,plan.md,progress.md}
```

`bin/alloy.mjs` is the single CLI entry. Subcommands: `init`, `resolve`, `install`, `doctor`, `state {add-task|add-evidence|add-claim|list ...}`, `gate check`, and `sync`.

1. `loadPack(id)` reads `packs/<id>.json` (with `PACK_ALIASES` mapping `default`/`team`/`profile` -> `core`) and expands `extends` entries from `packs/atoms.json`.
2. `mergePack` unions skills/agents/commands/mcp/modelRoles when a config lists multiple pack ids.
3. `resolveConfig` combines pack, model preset, and `.alloy/alloy.project.json` overrides.
4. Installer copies repo-local `agents/`, `commands/`, scoped skills from `universal/skills/` plus vendored skills, and `templates/opencode/alloy-plugin.ts` into `.opencode/`.
5. `.alloy/tasks/<task-id>/progress.md` is the gate source of truth. Do not reintroduce `.alloy/state/*.jsonl` or `.alloy/projections/*.md`.
6. One-shot subagents such as Explorer/Fixer/Reviewer/Tester are prompt conventions only; do not add persistent agent files for them.

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
- New universal first-party skills go under `universal/skills/<name>/SKILL.md`; scope-only first-party skills go under `scopes/<kind>/skills/<name>/SKILL.md`. Vendored skills stay under `vendor/skills/` and get registered in `vendor.lock.json`.
- When adding a skill/agent/command, also add it to the appropriate atom in `packs/atoms.json` and extend that atom from a pack — otherwise it will not be installed into any target repo.
- `templates/AGENTS.md` is the per-target-repo `AGENTS.md` template (different from this `CLAUDE.md`); customize it after `setup.sh` runs.
