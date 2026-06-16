# Alloy

Alloy is an OpenCode team configuration for running one developer workflow with two primary agents, command-driven phases, and markdown task state.

v0.1.4 is the Alloy rename and redesign release. It replaces the old persistent multi-agent surface with:

- `Planner` for `/discuss` and `/plan`
- `Builder` for `/execute`, `/verify`, and bounded retry loops
- one-shot subagents through the native Task tool when a narrow delegation is useful
- `.alloy/tasks/<id>/` markdown artifacts as the durable state layer

## Install

Clone Alloy once, then install a pack into each target repository:

```bash
git clone https://github.com/lifeodyssey/alloy.git ~/src/alloy
cd /path/to/target-repo
bash ~/src/alloy/setup.sh --pack core --target local --models github-copilot
```

Or use the CLI directly from this repo during development:

```bash
npm test
node bin/alloy.mjs install --pack core --target local --models github-copilot
node bin/alloy.mjs doctor
```

## Requirements

Required runtime:

- Node 20+
- Bun 1.1+ — OpenCode resolves the local plugin dependency path through Bun; the installer pins plugin deps into the target `.opencode/package.json`.

Optional, only needed by specific skills:

- Playwright + chromium (`npx playwright install chromium`) — `alloy-qa-e2e`
- Azure CLI `az` (logged in) — `azure-devops-context` / QA card fetch
- 1Password CLI `op` + `OP_SERVICE_ACCOUNT_TOKEN` — QA credential resolution
- `ffmpeg` — QA GIF generation from video
- `FIGMA_TOKEN` — QA Figma design comparison

## Runtime Shape

Alloy installs into OpenCode's `.opencode/` layout while keeping source packs in this repo.

```text
.opencode/
  agent/
    Planner.md
    Builder.md
  command/
    discuss.md
    plan.md
    execute.md
    verify.md
  skill/
    alloy-plan/SKILL.md
    alloy-tdd/SKILL.md
  alloy.manifest.json
```

Project task state lives under:

```text
.alloy/
  .gitignore
  tasks/<task-id>/
    context.md
    plan.md
    progress.md
    qa.md
    codebase-map.md
    .lock
  run/<id>/env
```

`.alloy/run/` and `*.lock` are ignored. `context.md`, `plan.md`, `progress.md`, QA reports, and codebase maps are normal markdown artifacts.

## Commands

`/discuss` clarifies ambiguous requirements and writes `.alloy/tasks/<id>/context.md`.

`/plan` writes `.alloy/tasks/<id>/plan.md` with frontmatter:

```markdown
---
id: <task-id>
approved: false
---
```

`/execute` loads an approved plan and maintains `.alloy/tasks/<id>/progress.md`.

`/verify` maps acceptance criteria to proof, updates review/verified gates, and runs `alloy gate check`.

Compatibility commands such as `/start-work`, `/handoff`, `/autopilot`, `/ralph-loop`, and `/ulw-loop` are thin wrappers around the same task artifacts.

## Gates

`progress.md` is the physical gate carrier:

```markdown
## Gate

- [ ] tdd_red
- [ ] debug
- [ ] green
- [ ] review
- [ ] verified
```

Run:

```bash
node bin/alloy.mjs gate check --task-id <task-id> --json
```

The gate passes only when every checkbox under `## Gate` is checked.

## Agents And Subagents

Only two primary Alloy agents are shipped:

- `Planner`: read-only planning and source understanding.
- `Builder`: read-write implementation, debugging, and verification.

Subagents are one-shot native Task sessions, not files installed by Alloy. Planner or Builder may ask for:

- Explorer: broad source discovery.
- Fixer: bounded multi-file bug work with a hypothesis.
- Reviewer: independent acceptance criteria review.
- Tester: QA matrix or risky artifact checks.

Do not spawn subagents for obvious one-file edits, small wording changes, or local fixes the primary agent can safely handle.

## Skill Contract

Alloy skills are intentionally detailed. Chat summaries can be short, but durable artifacts must include:

- acceptance criteria
- exact files
- exact commands
- gates
- risks and rollback
- counterexamples
- subagent handoff notes
- final handoff status

First-party skills (shipped in this repo):

- `alloy-plan` — write the Builder handoff contract (`plan.md`)
- `alloy-tdd` — red-green-refactor + gate proof
- `alloy-verify` — close acceptance-criteria gates
- `alloy-autopilot` — bounded unattended execution (delegates the loop to `ralph-loop`)
- `alloy-map-codebase` — structural codebase overview
- `alloy-using` — workflow entry guide
- `alloy-qa-e2e` — end-to-end QA entry (spawns the QA agent)
- `azure-devops-context` — read Azure DevOps work items
- `git-master` — commit / squash / rebase (includes REBASE mode)
- `humanizer` — de-AI prose
- `using-sandboxes` — run untrusted commands safely
- `playwright-cli` (frontend scope) — deterministic browser automation

Method skills are **not** reimplemented here — they are delegated to upstream (see below).

## Third-Party Dependencies (delegated, not rewritten)

Alloy ships the code-enforced gate and thin orchestration; the *methods* come from upstream, unchanged.

Delegated skills:

| Skill | Used by | Source |
|---|---|---|
| `superpowers:brainstorming` | Planner (diverge) | obra/superpowers |
| `superpowers:writing-plans` | Planner (plan depth) | obra/superpowers |
| `superpowers:subagent-driven-development` | Builder (execute per-task) | obra/superpowers |
| `superpowers:systematic-debugging` | Builder (bug root cause) | obra/superpowers |
| `grill-me` | Planner (interrogate request) | mattpocock |
| `grill-with-docs` | Planner (interrogate vs a doc) | mattpocock |

MCP servers (enabled by default):

- `sequential-thinking` — step-by-step reasoning
- `context7` — current library/API docs
- `figma` — design frames for QA
- `grep_app` — cross-repo code search
- `exa` — web search (denied at the agent layer)

Plugins:

- `plannotator` — inline annotation of long plans/docs
- `planning-with-files` — file-based planning workflow
- `ralph-loop` — unattended iteration loop (used by `alloy-autopilot`)

## Packs

Pack definitions live in `packs/`. `package.json` is the version source of truth.

- `core`: primary Alloy skills, commands, agents, and baseline MCPs.
- `frontend`, `backend`, `infra`: core plus scoped skills.
- `all`: all shipped packs.

Generated target files and installer output are the runtime contract. When changing packs or templates, update tests and run installer verification.

## Verification

Use:

```bash
npm test
node --check bin/alloy.mjs
python3 scripts/test_alloy_installer.py
node --test scripts/test_resolver.mjs scripts/test_alloy_plugin.mjs
```

Useful grep guards:

```bash
rg -n "alloy_switch_preset|presets\\.json" templates packs bin
rg -n "\\.alloy/plans|\\.alloy/state|\\.alloy/projections|alloy_evidence|alloy_claim" agents commands universal/skills templates bin
```

## Design Spec

The implementation target for this release is `docs/redesign/SPEC-v0.1.4.md`.
